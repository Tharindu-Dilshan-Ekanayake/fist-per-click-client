import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BoxGeometry, Color, DoubleSide, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { playSound } from '../sound'
import { isSpaceWall, SPACE_WALL_BASE, WALL_REGEN, wallHp } from '../walls'
import { geometry, merge } from './geometry'
import {
  CRACK_VARIANTS,
  crackTexture,
  createDynamicLabel,
  createHpBar,
  createWallNumber,
  glowFrameTexture,
  HP_BAR_ASPECT,
  radialGlowTexture,
  shade,
  wallTexture,
} from './textures'
import { OPEN_H, OPEN_HALF } from './themes'

const WIDTH = OPEN_HALF * 2
const DEPTH = 0.6
/** Local z of the slab's centre; the doorway's front face is at z = 0. */
const WALL_Z = -0.45
const BAR = 0.5
const FRAME_W = WIDTH + BAR
const FRAME_H = OPEN_H + BAR / 2
const GLOW_MARGIN = 3
const BAR_W = WIDTH * 0.62
const BAR_H = BAR_W / HP_BAR_ASPECT
const BAR_Y = OPEN_H * 0.4
/** The "Need X Strength" line under the bar. */
const NEED_W = BAR_W * 0.62
const NEED_H = NEED_W / 6
const NEED_Y = BAR_Y - BAR_H / 2 - NEED_H / 2 - 0.08

/**
 * How far in front of or behind the wall a punch still reaches it. In a tunnel the
 * next wall's reach ends inside this wall's frame, so it can't be hit through this
 * one; and a broken wall ignores the player (see onNear), so it never steals hits.
 */
const REACH = 3.2
/** Delay from click to impact: the time the glove takes to get there. */
const HIT_DELAY_S = 0.09
const SHAKE_S = 0.28
const FLASH_S = 0.2
/** Hits weaker than this fraction of the wall's health can't outpace its healing. */
const WEAK_HIT = 0.1
/**
 * The grid the wall comes apart along: the same eight-by-five the 'blocks' pattern
 * is drawn on, so a shattering wall falls apart into its own slabs.
 */
const GRID_COLS = 8
const GRID_ROWS = 5
const BLOCKS = GRID_COLS * GRID_ROWS
/** Chips knocked off by each punch, recycled round a small pool after the blocks. */
const CHIPS = 16
const DEBRIS_COUNT = BLOCKS + CHIPS
const GRAVITY = -18
const POPUP_COUNT = 6
const POPUP_S = 0.9
/**
 * Least time between health-bar redraws. The wall heals every frame, so its number
 * changes every frame, and each change used to redraw a canvas and re-upload it to
 * the GPU - sixty times a second, for every damaged wall in range.
 */
const BAR_REDRAW_S = 1 / 12
/** Damage below this shows no cracks at all; the first ones need a real dent. */
const CRACK_MIN = 0.03

/**
 * The four neon bars of the frame as one geometry. Every wall's frame is the same
 * size, so all of them share this one.
 */
const frameGeometry = () =>
  geometry('wall-frame', () =>
    merge(
      [
        [-(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [0, OPEN_H + BAR / 2, FRAME_W + BAR, BAR],
        [0, 0.05, FRAME_W, 0.1],
      ].map(([x, y, w, h]) => {
        const g = new BoxGeometry(w, h, 0.3)
        g.translate(x, y, 0.05)
        return g
      }),
    ),
  )

// Scratch objects for the debris matrices.
const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _c = new Color()

/**
 * The solid, numbered wall that fills a stage doorway. Stand within reach and click
 * to punch it: each punch deals your current Strength as damage, cracks spread out
 * from where you hit as its health falls, and the wall heals between punches, so a
 * tougher wall needs more Strength. At 0 health it bursts apart into its blocks and
 * lets you through, and stays down until you're back in the lobby.
 *
 * @param {{ number: number, stage: number, theme: object, zFront: number, x?: number }} props
 *   `zFront` is the z of the doorway's front (+Z) face. Space World's walls are
 *   numbered from 1001 (see walls.js) but wear 1-10, like a stage of their own.
 */
export function StageWall({ number, stage, theme, zFront, x = 0 }) {
  const maxHp = wallHp(number)
  const space = isSpaceWall(number)
  const shown = space ? number - SPACE_WALL_BASE : number
  const need = Math.ceil(maxHp * WEAK_HIT)
  // Shared by the whole stage; the number is this wall's own.
  const surface = wallTexture(stage, theme.wall)
  const cracks = crackTexture((number * 7) % CRACK_VARIANTS)
  const crackColor = shade(theme.wall.gap, -0.55)
  const numberMap = useMemo(() => createWallNumber(shown, theme.neon), [shown, theme.neon])
  const needLabel = useMemo(() => {
    const label = createDynamicLabel({ aspect: NEED_W / NEED_H, width: 384 })
    label.draw({
      lines: [{ text: `Need ${formatNumber(need)} Strength`, icon: 'fist', fill: ['#ffffff', '#ffd9a0'] }],
      bg: 'rgba(12, 14, 30, 0.7)',
    })
    return label
  }, [need])
  const glow = glowFrameTexture(theme.neon, FRAME_W, FRAME_H, GLOW_MARGIN)
  const glowStrength = theme.wall.glow ?? 0

  const bar = useMemo(() => createHpBar(), [])
  /**
   * Damage-number canvases, built on the first hit rather than on mount. Most of the
   * walls in range are only ever walked past, and six canvases each for walls nobody
   * touches was the largest single use of texture memory in the game.
   */
  const popupLabels = useRef(null)
  const ensureLabels = () => {
    popupLabels.current ??= Array.from({ length: POPUP_COUNT }, () =>
      createDynamicLabel({ aspect: 2.4, width: 256 }),
    )
    return popupLabels.current
  }
  useEffect(
    () => () => {
      bar.texture.dispose()
      numberMap.dispose()
      needLabel.texture.dispose()
      popupLabels.current?.forEach((label) => label.texture.dispose())
    },
    [bar, numberMap, needLabel],
  )

  /** The front and back surface materials, pulsed and flashed every frame. */
  const surfaces = useRef([])
  /** The crack overlays on both faces. */
  const crackMeshes = useRef([])
  const slab = useRef(null)
  const glowRef = useRef(null)
  const impact = useRef(null)
  const impactMaterial = useRef(null)
  const debrisMesh = useRef(null)
  const popups = useRef([])

  const broken = useGame((s) => !!s.brokenWalls[number])
  // Hit state lives in a ref: it changes every frame and must not re-render.
  const fx = useRef({
    hp: maxHp,
    shown: -1,
    seenPunch: -Infinity,
    impactAt: 0,
    side: 1,
    hitX: 0,
    hitAt: -Infinity,
    broken: false,
    warnedAt: -Infinity,
    nextChip: 0,
    /** Pieces in flight; at zero the debris loop below is skipped entirely. */
    liveDebris: 0,
    barAt: -Infinity,
    nextPopup: 0,
    popupAt: [],
    popupX: [],
    popupSide: [],
    debris: Array.from({ length: DEBRIS_COUNT }, () => ({
      born: -Infinity,
      life: 1,
      sx: 0,
      sy: 0,
      sz: 0,
      alive: false,
      p: new Vector3(),
      v: new Vector3(),
      spin: new Vector3(),
    })),
  })

  // Debris starts hidden, each piece in one of the wall's colours.
  useLayoutEffect(() => {
    const mesh = debrisMesh.current
    if (!mesh) return
    const palette = theme.wall.palette
    _m.makeScale(0, 0, 0)
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      mesh.setMatrixAt(i, _m)
      mesh.setColorAt(i, _c.set(palette[(i * 5 + number) % palette.length]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [theme, number])

  const launch = (s, d, now) => {
    if (!d.alive) s.liveDebris++
    d.alive = true
    d.born = now
  }

  /** Knocks `count` chips off at the point of impact, flying back at the puncher. */
  const chip = (s, now, count) => {
    for (let n = 0; n < count; n++) {
      const d = s.debris[BLOCKS + s.nextChip]
      s.nextChip = (s.nextChip + 1) % CHIPS
      launch(s, d, now)
      const r = Math.random
      const size = 0.12 + r() * 0.18
      d.sx = d.sy = d.sz = size
      d.life = 0.6 + r() * 0.35
      d.p.set(s.hitX + (r() - 0.5) * 1.2, 1.2 + r() * 1.2, WALL_Z + s.side * (DEPTH / 2 + 0.05))
      d.v.set((r() - 0.5) * 4, 2.5 + r() * 4, s.side * (1.5 + r() * 2.5))
      d.spin.set(r() * 12 - 6, r() * 12 - 6, r() * 12 - 6)
    }
  }

  /**
   * The wall bursts: every block of its grid flies out, the ones nearest the punch
   * fastest, tumbling, and the rest topple after them.
   */
  const shatter = (s, now) => {
    const bw = WIDTH / GRID_COLS
    const bh = OPEN_H / GRID_ROWS
    for (let i = 0; i < BLOCKS; i++) {
      const d = s.debris[i]
      launch(s, d, now)
      const r = Math.random
      const col = i % GRID_COLS
      const row = Math.floor(i / GRID_COLS)
      const bx = -WIDTH / 2 + bw * (col + 0.5)
      const by = bh * (row + 0.5)
      d.sx = bw * 0.94
      d.sy = bh * 0.94
      d.sz = DEPTH * (0.8 + r() * 0.3)
      d.life = 1.6 + r() * 0.8
      d.p.set(bx, by, WALL_Z)
      // Blown away from where it was hit: hardest near the punch, low down.
      const dx = bx - s.hitX
      const near = Math.max(0, 1 - Math.hypot(dx, by - 1.6) / 9)
      const away = -s.side
      d.v.set(dx * 0.35 + (r() - 0.5) * 2, 1.5 + r() * 3 + near * 3, away * (2 + near * 9 + r() * 2))
      d.spin.set((r() - 0.5) * 5, (r() - 0.5) * 4, (r() - 0.5) * 5)
    }
    chip(s, now, CHIPS)
  }

  const showDamage = (s, now, damage) => {
    const i = s.nextPopup
    s.nextPopup = (i + 1) % POPUP_COUNT
    s.popupAt[i] = now
    s.popupX[i] = s.hitX + (Math.random() - 0.5) * 1.5
    s.popupSide[i] = s.side
    const label = ensureLabels()[i]
    label.draw({ lines: [{ text: `-${formatNumber(damage)}`, icon: 'fist', fill: ['#ffffff', '#ffb347'] }] })
    const mesh = popups.current[i]
    if (mesh && mesh.material.map !== label.texture) {
      mesh.material.map = label.texture
      mesh.material.needsUpdate = true
    }
  }

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()
    const near = game.nearWall?.number === number
    // Follow the store: a rebuilt wall comes back at full health.
    const isBroken = !!game.brokenWalls[number]
    if (s.broken && !isBroken) s.hp = maxHp
    s.broken = isBroken

    // A fresh punch within range: queue the impact, on whichever side the player is.
    if (!s.broken && near && game.punchAt > s.seenPunch && now - game.punchAt < 0.2) {
      s.seenPunch = game.punchAt
      s.impactAt = game.punchAt + HIT_DELAY_S
      const at = game.punchPos
      s.side = at && at[2] < zFront + WALL_Z ? -1 : 1
      s.hitX = at ? Math.max(-OPEN_HALF + 1.5, Math.min(OPEN_HALF - 1.5, at[0] - x)) : 0
    }

    if (s.impactAt && now >= s.impactAt) {
      s.impactAt = 0
      if (!s.broken) {
        const damage = game.strength
        s.hp -= damage
        s.hitAt = now
        chip(s, now, 5)
        showDamage(s, now, damage)
        if (s.hp <= 0) {
          s.hp = 0
          s.broken = true
          shatter(s, now)
          playSound('wallBreak')
          game.breakWall(number)
        } else {
          playSound('wallHit', { strength: Math.min(1, (damage / maxHp) * 4) })
          if (damage < need && now - s.warnedAt > 2) {
            s.warnedAt = now
            game.notify(
              `${space ? 'Space wall' : 'Wall'} ${shown} is too strong! Get about ${formatNumber(need)} Strength`,
              'error',
            )
          }
        }
      }
    }

    // Heals all the time, so hits have to outpace it.
    if (!s.broken && s.hp < maxHp) s.hp = Math.min(maxHp, s.hp + maxHp * WALL_REGEN * delta)
    const hpShown = Math.ceil(s.hp)
    // Always redraw the moment it empties or comes back to full, so the bar is never
    // left a frame behind at either end; in between, at BAR_REDRAW_S.
    if (hpShown !== s.shown && (now - s.barAt > BAR_REDRAW_S || hpShown === 0 || hpShown === maxHp)) {
      s.shown = hpShown
      s.barAt = now
      bar.draw(hpShown, maxHp)
    }

    // The cracks: as much of the pattern as the damage has earned.
    const damage = 1 - s.hp / maxHp
    for (const mesh of crackMeshes.current) {
      if (!mesh) continue
      const show = !s.broken && damage > CRACK_MIN
      mesh.visible = show
      if (show) mesh.material.alphaTest = Math.min(0.985, Math.max(0.02, 1 - damage * 1.05))
    }

    // Shake, flash and the pulsing neon.
    const t = now - s.hitAt
    const flash = t < FLASH_S ? 1 - t / FLASH_S : 0
    if (slab.current) {
      // Never hit means t is Infinity, and sin(Infinity) is NaN - which, times
      // nothing, is still NaN, and a NaN position hides the whole wall. So only
      // shake while there is a shake to show.
      const k = t >= 0 && t < SHAKE_S ? 1 - t / SHAKE_S : 0
      slab.current.position.x = k > 0 ? Math.sin(t * 80) * 0.12 * k : 0
      // Dented in by the punch, springing back.
      slab.current.position.z = k > 0 ? -s.side * 0.12 * k * k : 0
    }
    // Hidden rather than merely invisible while it is faded out. A wall is unhit for
    // almost all of its life, and an additive quad at zero opacity is not free: it is
    // still a draw call, and it still blends every pixel of four and a half metres of
    // screen to arrive at the colour that was already there.
    if (impact.current) {
      impact.current.visible = flash > 0
      if (flash > 0) impact.current.position.set(s.hitX, 1.9, WALL_Z + s.side * (DEPTH / 2 + 0.08))
    }
    if (impactMaterial.current) impactMaterial.current.opacity = flash
    const emissive = glowStrength * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 1.5 + number)) + flash * 0.35
    for (const material of surfaces.current) if (material) material.emissiveIntensity = emissive
    if (glowRef.current) glowRef.current.opacity = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.2 + number)

    // Debris: simple ballistic arcs that stop at the floor and shrink away.
    const mesh = debrisMesh.current
    const flying = s.liveDebris > 0
    if (mesh && mesh.visible !== flying) mesh.visible = flying
    if (mesh && flying) {
      let dirty = false
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const d = s.debris[i]
        if (!d.alive) continue
        const age = now - d.born
        dirty = true
        if (age > d.life) {
          d.alive = false
          s.liveDebris--
          mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
          continue
        }
        const shrink = Math.min(1, (d.life - age) / (d.life * 0.3))
        const half = (d.sy * shrink) / 2
        const y = d.p.y + d.v.y * age + 0.5 * GRAVITY * age * age
        // Landed: stop spinning and sliding, just lie there and shrink.
        const landed = y < half
        _p.set(d.p.x + d.v.x * age * (landed ? 0.85 : 1), Math.max(half, y), d.p.z + d.v.z * age * (landed ? 0.85 : 1))
        _q.setFromEuler(_e.set(d.spin.x * age, d.spin.y * age, d.spin.z * age))
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s.set(d.sx * shrink, d.sy * shrink, d.sz * shrink)))
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true
    }

    // No canvases yet means this wall has never been hit, so there is nothing to fade.
    if (!popupLabels.current) return
    popups.current.forEach((popup, i) => {
      if (!popup) return
      const age = now - (s.popupAt[i] ?? -Infinity)
      popup.visible = age >= 0 && age < POPUP_S
      if (!popup.visible) return
      popup.position.set(s.popupX[i], 3.4 + age * 2, WALL_Z + s.popupSide[i] * 1.2)
      popup.material.opacity = 1 - (age / POPUP_S) ** 2
      popup.quaternion.copy(camera.quaternion)
    })
  })

  const onNear = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    const game = useGame.getState()
    // A broken wall is just a doorway; don't let it steal hits from the next one.
    if (game.brokenWalls[number]) return
    game.setNearWall(number, zFront + WALL_Z)
    // Only until it's been broken once; after that the player knows what to do.
    if (!fx.current.broken && (space ? game.spaceBest < shown : game.bestWall < number)) {
      game.notify(`${space ? 'Space wall' : 'Wall'} ${shown} - ${formatNumber(maxHp)} HP. Click to punch it!`)
    }
  }
  const onFar = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearNearWall(number)
  }

  return (
    <group position={[x, 0, zFront]}>
      <group ref={slab} visible={!broken}>
        <mesh position={[0, OPEN_H / 2, WALL_Z]} castShadow receiveShadow>
          <boxGeometry args={[WIDTH, OPEN_H, DEPTH]} />
          <meshStandardMaterial color={theme.wall.gap} roughness={0.9} />
        </mesh>

        {/* The same face, cracks, number and health bar on both sides. */}
        {[1, -1].map((face, i) => (
          <group
            key={face}
            position={[0, 0, WALL_Z + face * (DEPTH / 2 + 0.01)]}
            rotation={[0, face > 0 ? 0 : Math.PI, 0]}
          >
            <mesh position={[0, OPEN_H / 2, 0]}>
              <planeGeometry args={[WIDTH, OPEN_H]} />
              {/* Emissive is always on, so a hit can flash the surface white. */}
              <meshStandardMaterial
                ref={(el) => {
                  surfaces.current[i] = el
                }}
                map={surface}
                emissiveMap={surface}
                emissive="#ffffff"
                emissiveIntensity={glowStrength}
                roughness={0.9}
              />
            </mesh>
            {/* Cracks: shown as far as the damage has reached (see crackTexture). */}
            <mesh
              position={[0, OPEN_H / 2, 0.006]}
              visible={false}
              ref={(el) => {
                crackMeshes.current[i] = el
              }}
            >
              <planeGeometry args={[WIDTH, OPEN_H]} />
              <meshBasicMaterial color={crackColor} alphaMap={cracks} alphaTest={0.98} toneMapped={false} />
            </mesh>
            <mesh position={[0, OPEN_H / 2, 0.012]}>
              <planeGeometry args={[WIDTH, OPEN_H]} />
              <meshBasicMaterial map={numberMap} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, BAR_Y, 0.02]}>
              <planeGeometry args={[BAR_W, BAR_H]} />
              <meshBasicMaterial map={bar.texture} transparent depthWrite={false} toneMapped={false} />
            </mesh>
            <mesh position={[0, NEED_Y, 0.02]}>
              <planeGeometry args={[NEED_W, NEED_H]} />
              <meshBasicMaterial map={needLabel.texture} transparent depthWrite={false} toneMapped={false} />
            </mesh>
          </group>
        ))}

        <mesh ref={impact}>
          <planeGeometry args={[4.5, 4.5]} />
          {/* forceSinglePass: see the note in world/Effects.jsx. */}
          <meshBasicMaterial
            ref={impactMaterial}
            map={radialGlowTexture()}
            color="#fff3c4"
            transparent
            opacity={0}
            blending={AdditiveBlending}
            depthWrite={false}
            side={DoubleSide}
            forceSinglePass
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* No castShadow: forty-odd blocks in the shadow pass, for a second and a half
          of tumbling rubble, is not a trade worth making. */}
      <instancedMesh ref={debrisMesh} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>

      {/* The map is attached on the first hit, with the canvas - see ensureLabels. */}
      {Array.from({ length: POPUP_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
          renderOrder={2}
        >
          <planeGeometry args={[2.6, 1.08]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      {/* Neon frame in the stage's colour: solid bars plus a pulsing additive halo. */}
      <mesh geometry={frameGeometry()}>
        <meshBasicMaterial color={shade(theme.neon, 0.45)} toneMapped={false} />
      </mesh>
      <mesh position={[0, FRAME_H / 2, 0.22]}>
        <planeGeometry args={[FRAME_W + GLOW_MARGIN * 2, FRAME_H + GLOW_MARGIN * 2]} />
        <meshBasicMaterial
          ref={glowRef}
          map={glow}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <RigidBody type="fixed" colliders={false}>
        {/* Solid until broken. */}
        {!broken && <CuboidCollider args={[OPEN_HALF, OPEN_H / 2, DEPTH / 2]} position={[0, OPEN_H / 2, WALL_Z]} />}
        <CuboidCollider
          sensor
          args={[OPEN_HALF, OPEN_H / 2, REACH]}
          position={[0, OPEN_H / 2, WALL_Z]}
          onIntersectionEnter={onNear}
          onIntersectionExit={onFar}
        />
      </RigidBody>
    </group>
  )
}

export default StageWall
