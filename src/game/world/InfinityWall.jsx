import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AdditiveBlending, Color, Euler, Matrix4, Quaternion, Vector3 } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { caveWallHp, caveWallReward, THEME_SPAN } from '../infinityCave'
import { playSound } from '../sound'
import { WALL_REGEN } from '../walls'
import {
  createDynamicLabel,
  createHpBar,
  createWallNumber,
  glowFrameTexture,
  HP_BAR_ASPECT,
  radialGlowTexture,
  wallTexture,
} from './textures'
import { FRAME_COLOR, OPEN_H, OPEN_HALF, THEMES } from './themes'

const WIDTH = OPEN_HALF * 2
const DEPTH = 0.6
/** Local z of the slab's centre; its front face (the only one - nothing is behind it) is at z = 0. */
const WALL_Z = -0.45
const BAR = 0.5
const FRAME_W = WIDTH + BAR
const FRAME_H = OPEN_H + BAR / 2
const GLOW_MARGIN = 3
const BAR_W = WIDTH * 0.64
const BAR_H = BAR_W / HP_BAR_ASPECT
const BAR_Y = OPEN_H * 0.36

const REACH = 3.2
const HIT_DELAY_S = 0.06
const SHAKE_S = 0.25
const FLASH_S = 0.2
const WEAK_HIT = 0.1
const DEBRIS_COUNT = 40
const GRAVITY = -18
const POPUP_COUNT = 6
const POPUP_S = 0.9

const _m = new Matrix4()
const _p = new Vector3()
const _q = new Quaternion()
const _s = new Vector3()
const _e = new Euler()
const _c = new Color()

/**
 * The Infinity Cave's one wall: shoot it like any stage wall, and
 * the moment it breaks a fresh one — one number higher, a little tougher, its look
 * cycled from the game's own stage themes — takes its place right where it stood.
 * Wins pay out directly on every break; there's nothing to walk through to.
 *
 * @param {{ position?: number[] }} props
 */
export function InfinityWall({ position = [0, 0, 0] }) {
  const [number, setNumber] = useState(1)
  const themeIndex = Math.floor((number - 1) / THEME_SPAN) % THEMES.length
  const theme = THEMES[themeIndex]
  const maxHp = caveWallHp(number)
  const reward = caveWallReward(number)

  // Reuses the same cached textures the numbered stage walls draw with that theme.
  const surface = wallTexture(themeIndex + 1, theme.wall)
  const glow = glowFrameTexture(FRAME_COLOR, FRAME_W, FRAME_H, GLOW_MARGIN)
  const glowStrength = theme.wall.glow ?? 0

  // Not cached (every wall's number is different) - each one made this way is
  // disposed the moment it's replaced, not just on unmount, since this wall's
  // number keeps changing for as long as the cave stays open.
  const numberMap = useMemo(() => createWallNumber(number), [number])
  useEffect(() => () => numberMap.dispose(), [numberMap])

  const bar = useMemo(() => createHpBar(), [])
  const popupLabels = useMemo(
    () => Array.from({ length: POPUP_COUNT }, () => createDynamicLabel({ aspect: 2.4, width: 256 })),
    [],
  )
  useEffect(
    () => () => {
      bar.texture.dispose()
      popupLabels.forEach((label) => label.texture.dispose())
    },
    [bar, popupLabels],
  )

  const surfaceMat = useRef(null)
  const slab = useRef(null)
  const glowRef = useRef(null)
  const impact = useRef(null)
  const impactMaterial = useRef(null)
  const debrisMesh = useRef(null)
  const popups = useRef([])

  const fx = useRef({
    hp: maxHp,
    shown: -1,
    seenSwing: -Infinity,
    impactAt: 0,
    hitX: 0,
    hitAt: -Infinity,
    warnedAt: -Infinity,
    near: false,
    nextDebris: 0,
    nextPopup: 0,
    popupAt: [],
    popupX: [],
    debris: Array.from({ length: DEBRIS_COUNT }, () => ({
      born: -Infinity,
      life: 1,
      size: 0,
      alive: false,
      p: new Vector3(),
      v: new Vector3(),
      spin: new Vector3(),
    })),
  })

  // Debris starts hidden, each chunk in the current theme's colours.
  useLayoutEffect(() => {
    const mesh = debrisMesh.current
    if (!mesh) return
    const palette = theme.wall.palette
    _m.makeScale(0, 0, 0)
    for (let i = 0; i < DEBRIS_COUNT; i++) {
      mesh.setMatrixAt(i, _m)
      mesh.setColorAt(i, _c.set(palette[i % palette.length]))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [theme])

  const spawnDebris = (s, now, count, big) => {
    for (let n = 0; n < count; n++) {
      const d = s.debris[s.nextDebris]
      s.nextDebris = (s.nextDebris + 1) % DEBRIS_COUNT
      const r = Math.random
      d.born = now
      d.alive = true
      d.life = big ? 1.2 + r() * 0.6 : 0.6 + r() * 0.3
      d.size = big ? 0.35 + r() * 0.55 : 0.12 + r() * 0.16
      if (big) d.p.set((r() - 0.5) * WIDTH * 0.9, 0.5 + r() * (OPEN_H - 1), WALL_Z + 0.2)
      else d.p.set(s.hitX + (r() - 0.5) * 1.2, 1.8 + r() * 1.4, WALL_Z + DEPTH / 2 + 0.05)
      d.v.set((r() - 0.5) * (big ? 6 : 4), (big ? 2 : 3) + r() * 4, (big ? 2 + r() * 5 : 1.5 + r() * 2.5))
      d.spin.set(r() * 12 - 6, r() * 12 - 6, r() * 12 - 6)
    }
  }

  const showDamage = (s, now, damage) => {
    const i = s.nextPopup
    s.nextPopup = (i + 1) % POPUP_COUNT
    s.popupAt[i] = now
    s.popupX[i] = s.hitX + (Math.random() - 0.5) * 1.5
    popupLabels[i].draw({ lines: [{ text: `-${formatNumber(damage)}`, icon: 'ammo', fill: ['#ffffff', '#ffb347'] }] })
  }

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()

    if (s.near && game.shotAt > s.seenSwing && now - game.shotAt < 0.2) {
      s.seenSwing = game.shotAt
      s.impactAt = game.shotAt + HIT_DELAY_S
      const at = game.shotPos
      s.hitX = at ? Math.max(-OPEN_HALF + 1.5, Math.min(OPEN_HALF - 1.5, at[0])) : 0
    }

    if (s.impactAt && now >= s.impactAt) {
      s.impactAt = 0
      const damage = game.ammo
      s.hp -= damage
      s.hitAt = now
      spawnDebris(s, now, 6, false)
      showDamage(s, now, damage)
      if (s.hp <= 0) {
        spawnDebris(s, now, DEBRIS_COUNT - 8, true)
        playSound('wallBreak')
        game.breakCaveWall(number, reward)
        // The next wall takes over right away, one number higher and a little
        // tougher - computed directly (not from the render's own `maxHp`, which
        // still reflects the wall that just broke until this component re-renders).
        const next = number + 1
        s.hp = caveWallHp(next)
        s.shown = -1
        s.warnedAt = -Infinity
        setNumber(next)
      } else {
        playSound('wallHit', { strength: Math.min(1, (damage / maxHp) * 4) })
        if (damage < maxHp * WEAK_HIT && now - s.warnedAt > 2) {
          s.warnedAt = now
          game.notify(`This wall needs about ${formatNumber(Math.ceil(maxHp * WEAK_HIT))} Ammo to dent`, 'error')
        }
      }
    }

    if (s.hp < maxHp) s.hp = Math.min(maxHp, s.hp + maxHp * WALL_REGEN * delta)
    const shown = Math.ceil(s.hp)
    if (shown !== s.shown) {
      s.shown = shown
      bar.draw(shown, maxHp)
    }

    const t = now - s.hitAt
    const flash = t < FLASH_S ? 1 - t / FLASH_S : 0
    if (slab.current) slab.current.position.x = t < SHAKE_S ? Math.sin(t * 80) * 0.12 * (1 - t / SHAKE_S) : 0
    // Hidden while faded out; see the same flash in world/StageWall.jsx.
    if (impact.current) {
      impact.current.visible = flash > 0
      if (flash > 0) impact.current.position.set(s.hitX, 2.6, WALL_Z + DEPTH / 2 + 0.08)
    }
    if (impactMaterial.current) impactMaterial.current.opacity = flash
    const emissive = glowStrength * (0.8 + 0.2 * Math.sin(clock.elapsedTime * 1.5 + number)) + flash * 0.35
    if (surfaceMat.current) surfaceMat.current.emissiveIntensity = emissive
    if (glowRef.current) glowRef.current.opacity = 0.8 + 0.2 * Math.sin(clock.elapsedTime * 2.2 + number)

    const mesh = debrisMesh.current
    if (mesh) {
      let dirty = false
      for (let i = 0; i < DEBRIS_COUNT; i++) {
        const d = s.debris[i]
        if (!d.alive) continue
        const age = now - d.born
        dirty = true
        if (age > d.life) {
          d.alive = false
          mesh.setMatrixAt(i, _m.makeScale(0, 0, 0))
          continue
        }
        const size = d.size * Math.min(1, (d.life - age) / (d.life * 0.3))
        _p.set(
          d.p.x + d.v.x * age,
          Math.max(size / 2, d.p.y + d.v.y * age + 0.5 * GRAVITY * age * age),
          d.p.z + d.v.z * age,
        )
        _q.setFromEuler(_e.set(d.spin.x * age, d.spin.y * age, d.spin.z * age))
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s.setScalar(size)))
      }
      if (dirty) mesh.instanceMatrix.needsUpdate = true
      // `dirty` is exactly "something was in flight this frame", which is also the
      // only time the mesh has anything to show: every other chunk is scaled to zero.
      if (mesh.visible !== dirty) mesh.visible = dirty
    }

    popups.current.forEach((popup, i) => {
      if (!popup) return
      const age = now - (s.popupAt[i] ?? -Infinity)
      popup.visible = age >= 0 && age < POPUP_S
      if (!popup.visible) return
      popup.position.set(s.popupX[i], 4.4 + age * 2, WALL_Z + 1.2)
      popup.material.opacity = 1 - (age / POPUP_S) ** 2
      popup.quaternion.copy(camera.quaternion)
    })
  })

  const onNear = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') fx.current.near = true
  }
  const onFar = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') fx.current.near = false
  }

  return (
    <group position={position}>
    <group ref={slab}>
      <mesh position={[0, OPEN_H / 2, WALL_Z]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, OPEN_H, DEPTH]} />
        <meshStandardMaterial color={theme.wall.gap} roughness={0.9} />
      </mesh>

      <mesh position={[0, OPEN_H / 2, WALL_Z + DEPTH / 2 + 0.01]}>
        <planeGeometry args={[WIDTH, OPEN_H]} />
        <meshStandardMaterial
          ref={surfaceMat}
          map={surface}
          emissiveMap={surface}
          emissive="#ffffff"
          emissiveIntensity={glowStrength}
          roughness={0.9}
        />
      </mesh>
      <mesh position={[0, OPEN_H / 2, WALL_Z + DEPTH / 2 + 0.02]}>
        <planeGeometry args={[WIDTH, OPEN_H]} />
        <meshBasicMaterial map={numberMap} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, BAR_Y, WALL_Z + DEPTH / 2 + 0.03]}>
        <planeGeometry args={[BAR_W, BAR_H]} />
        <meshBasicMaterial map={bar.texture} transparent depthWrite={false} toneMapped={false} />
      </mesh>

      <mesh ref={impact}>
        <planeGeometry args={[4.5, 4.5]} />
        <meshBasicMaterial
          ref={impactMaterial}
          map={radialGlowTexture()}
          color="#fff3c4"
          transparent
          opacity={0}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <instancedMesh ref={debrisMesh} args={[undefined, undefined, DEBRIS_COUNT]} frustumCulled={false} castShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.85} />
      </instancedMesh>

      {popupLabels.map((label, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
          renderOrder={2}
        >
          <planeGeometry args={[2.6, 1.08]} />
          <meshBasicMaterial map={label.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      {[
        [-(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [(WIDTH + BAR) / 2, FRAME_H / 2, BAR, FRAME_H],
        [0, OPEN_H + BAR / 2, FRAME_W + BAR, BAR],
        [0, 0.05, FRAME_W, 0.1],
      ].map(([x, y, w, h], i) => (
        <mesh key={i} position={[x, y, WALL_Z + DEPTH / 2 + 0.05]}>
          <boxGeometry args={[w, h, 0.3]} />
          <meshBasicMaterial color="#d8feff" toneMapped={false} />
        </mesh>
      ))}
      <mesh position={[0, FRAME_H / 2, WALL_Z + DEPTH / 2 + 0.22]}>
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
        <CuboidCollider args={[OPEN_HALF, OPEN_H / 2, DEPTH / 2]} position={[0, OPEN_H / 2, WALL_Z]} />
        <CuboidCollider
          sensor
          args={[OPEN_HALF, OPEN_H / 2, REACH]}
          position={[0, OPEN_H / 2, WALL_Z + DEPTH / 2 + REACH]}
          onIntersectionEnter={onNear}
          onIntersectionExit={onFar}
        />
      </RigidBody>
    </group>
    </group>
  )
}

export default InfinityWall
