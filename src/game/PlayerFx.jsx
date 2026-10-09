import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, Color, DoubleSide, Vector3 } from 'three'

import { gloveTier } from './gloves'
import { createParticles } from './particles'
import { qualityOf, useSettings } from './settings'
import { playSound } from './sound'
import { beamTexture, labelTexture, neonOutlineTexture, radialGlowTexture } from './world/textures'

/**
 * Everything that glows round one player, for the player themselves and for everyone
 * else in the lobby alike - all of it driven by what is already sent over the
 * network (their position, their punch count, their gloves, aura and level):
 *
 *   - their aura, if they wear one: a ring of light at their feet, a glow round the
 *     body, and particles that move the way the aura's style says (see auras.js)
 *   - their gloves' own effect: a trail off each fist in the gloves' colours and in
 *     the manner of their design (fire, sparks, stars, frost...) - faint for the
 *     first pairs, rich for the best - streaming as they walk and bursting on every
 *     punch
 *   - a burst of light, a beam and "LEVEL UP!" whenever they reach a new level
 *   - a shockwave where a flying punch comes down
 *
 * Rendered in world space (not inside the player's own group): the particles stay
 * where they were let go, which is what makes them trail.
 *
 * @param {{ followRef: React.MutableRefObject<import('three').Object3D>,
 *           motionRef: React.MutableRefObject<object>,
 *           fistsRef: React.MutableRefObject<{ right?: import('three').Object3D, left?: import('three').Object3D }>,
 *           glove: object, aura?: object | null, levelUpRef: React.MutableRefObject<number>,
 *           local?: boolean }} props
 *   `followRef` is anything whose world position is the player's centre;
 *   `levelUpRef.current` is when they last levelled up (performance.now() seconds).
 */
export function PlayerFx({ followRef, motionRef, fistsRef, glove, aura, levelUpRef, local = false }) {
  const rich = useSettings((s) => qualityOf(s.quality).sparkles)
  const pool = useMemo(() => createParticles(rich ? 600 : 300), [rich])
  useEffect(() => () => pool.dispose(), [pool])

  const groundRing = useRef(null)
  const bodyGlow = useRef(null)
  const halo = useRef(null)
  const column = useRef(null)
  const lvlRing = useRef(null)
  const lvlBeam = useRef(null)
  const lvlText = useRef(null)
  const wave = useRef(null)

  const state = useRef({
    acc: 0,
    fistAcc: [0, 0],
    last: [new Vector3(), new Vector3()],
    hasLast: [false, false],
    flared: [false, false],
    boltAt: 0,
    seenLevel: -Infinity,
    airPunch: false,
    waveAt: -Infinity,
    waveAt0: new Vector3(),
  })

  const tier = gloveTier(glove)
  const auraColors = useMemo(() => (aura ? aura.colors.map((c) => new Color(c)) : null), [aura])

  useFrame(({ camera, clock }, delta) => {
    const follow = followRef.current
    if (!follow) return
    const t = clock.elapsedTime
    const now = performance.now() / 1000
    const dt = Math.min(delta, 0.05)
    const s = state.current
    const m = motionRef.current ?? {}
    follow.getWorldPosition(_c)
    const feet = _c.y - 0.9
    const moving = Math.min(1, (m.speed ?? 0) / 4)
    const rate = rich ? 1 : 0.5

    // --- Aura -------------------------------------------------------------------
    if (aura) {
      s.acc += dt * rate * auraRate(aura) * (1 + moving * 0.6)
      while (s.acc >= 1) {
        s.acc -= 1
        emitAura(pool, aura, _c, feet, t)
      }
      // A beat of extra light on every punch.
      const p = Math.max(punchKick(m.punchR), punchKick(m.punchL))
      if (groundRing.current) {
        groundRing.current.visible = true
        groundRing.current.position.set(_c.x, feet + 0.06, _c.z)
        groundRing.current.rotation.z = t * 1.2
        const k = 1 + 0.08 * Math.sin(t * 3) + p * 0.35
        groundRing.current.scale.setScalar((aura.big ? 3.2 : 2.6) * k)
        groundRing.current.material.opacity = 0.9 + p * 0.1
      }
      if (bodyGlow.current) {
        bodyGlow.current.visible = true
        bodyGlow.current.position.set(_c.x, _c.y + 0.1, _c.z)
        bodyGlow.current.scale.setScalar((aura.big ? 3.8 : 3.1) * (1 + 0.06 * Math.sin(t * 2.4) + p * 0.3))
        bodyGlow.current.material.opacity = 0.65 + p * 0.3
      }
      if (column.current) {
        column.current.visible = true
        column.current.position.set(_c.x, feet + 1.25, _c.z)
        column.current.rotation.y = t * 0.6
        column.current.material.opacity = 0.5 + 0.12 * Math.sin(t * 3) + p * 0.3
      }
      if (halo.current) {
        halo.current.visible = aura.style === 'crown'
        if (halo.current.visible) {
          halo.current.position.set(_c.x, _c.y + 1.35 + Math.sin(t * 2) * 0.05, _c.z)
          halo.current.rotation.z = t * 0.8
        }
      }
      if (aura.style === 'lightning' && now - s.boltAt > 0.35 + Math.random() * 0.5) {
        s.boltAt = now
        emitBolt(pool, _c, feet, aura)
      }
    } else {
      if (groundRing.current) groundRing.current.visible = false
      if (bodyGlow.current) bodyGlow.current.visible = false
      if (column.current) column.current.visible = false
      if (halo.current) halo.current.visible = false
    }

    // --- The gloves' trails and punch bursts -----------------------------------
    const fists = fistsRef.current ?? {}
    const look = gloveLook(glove)
    for (const [i, hand, progress] of [
      [0, fists.right, m.punchR],
      [1, fists.left, m.punchL],
    ]) {
      if (!hand) continue
      hand.getWorldPosition(_f)
      if (!s.hasLast[i]) {
        s.last[i].copy(_f)
        s.hasLast[i] = true
      }
      const travelled = _f.distanceTo(s.last[i])
      // Trails follow the fist's own movement: walking, and above all punching.
      if (travelled < 3) {
        s.fistAcc[i] += travelled * look.density * (0.5 + tier / 16) * rate
        while (s.fistAcc[i] >= 1) {
          s.fistAcc[i] -= 1
          _v.lerpVectors(s.last[i], _f, Math.random())
          emitTrail(pool, look, _v, glove)
        }
      } else {
        s.fistAcc[i] = 0
      }
      // A burst as the punch reaches full stretch.
      const out = progress >= 0.28 && progress < 0.5
      if (out && !s.flared[i]) {
        _d.subVectors(_f, s.last[i])
        emitBurst(pool, look, _f, _d, glove, 6 + Math.round(tier / 2) + (aura ? 4 : 0), rate)
      }
      s.flared[i] = out
      s.last[i].copy(_f)
    }

    // --- Level up -------------------------------------------------------------------
    const lvl = levelUpRef?.current ?? -Infinity
    if (lvl > s.seenLevel && now - lvl < 0.5) {
      s.seenLevel = lvl
      for (let k = 0; k < 70 * rate + 20; k++) {
        const a = Math.random() * Math.PI * 2
        const sp = 2.5 + Math.random() * 3.5
        pool.emit({
          x: _c.x,
          y: feet + 0.3 + Math.random() * 1.6,
          z: _c.z,
          vx: Math.cos(a) * sp,
          vy: 1 + Math.random() * 4,
          vz: Math.sin(a) * sp,
          life: 0.9 + Math.random() * 0.6,
          size: 0.35,
          endSize: 0.05,
          color: k % 3 ? '#fff6a8' : '#7ff9ff',
          endColor: '#ffb000',
          drag: 2.2,
          gravity: 3,
        })
      }
    }
    const lk = (now - lvl) / 1.6
    const lvlOn = lk >= 0 && lk < 1
    if (lvlRing.current) {
      lvlRing.current.visible = lvlOn
      if (lvlOn) {
        lvlRing.current.position.set(_c.x, feet + 0.08, _c.z)
        lvlRing.current.scale.setScalar(1 + lk * 7)
        lvlRing.current.material.opacity = (1 - lk) ** 1.5
      }
    }
    if (lvlBeam.current) {
      lvlBeam.current.visible = lvlOn
      if (lvlOn) {
        lvlBeam.current.position.set(_c.x, feet + 4, _c.z)
        lvlBeam.current.scale.set(1 - lk * 0.5, 1, 1 - lk * 0.5)
        lvlBeam.current.material.opacity = 0.7 * (1 - lk)
      }
    }
    if (lvlText.current) {
      lvlText.current.visible = lvlOn
      if (lvlOn) {
        lvlText.current.position.set(_c.x, _c.y + 1.9 + lk * 1.2, _c.z)
        lvlText.current.quaternion.copy(camera.quaternion)
        const pop = lk < 0.12 ? 0.5 + (lk / 0.12) * 0.7 : 1.2 - Math.min(0.2, (lk - 0.12) * 0.5)
        lvlText.current.scale.set(2.6 * pop, 0.9 * pop, 1)
        lvlText.current.material.opacity = lk < 0.75 ? 1 : 1 - (lk - 0.75) / 0.25
      }
    }

    // --- The flying punch's landing -------------------------------------------------
    const flying = (m.styleR === 'superman' && m.punchR >= 0 && m.punchR < 1) || (m.styleL === 'superman' && m.punchL >= 0 && m.punchL < 1)
    if (flying && !m.grounded) s.airPunch = true
    if (s.airPunch && m.grounded) {
      s.airPunch = false
      s.waveAt = now
      s.waveAt0.set(_c.x, feet, _c.z)
      for (let k = 0; k < 36 * rate + 10; k++) {
        const a = (k / 36) * Math.PI * 2
        pool.emit({
          x: _c.x + Math.cos(a) * 0.4,
          y: feet + 0.15,
          z: _c.z + Math.sin(a) * 0.4,
          vx: Math.cos(a) * (5 + Math.random() * 2),
          vy: 0.6 + Math.random() * 1.4,
          vz: Math.sin(a) * (5 + Math.random() * 2),
          life: 0.6,
          size: 0.45,
          endSize: 0.1,
          color: '#fff3d0',
          endColor: glove.trim,
          drag: 3,
          gravity: 2,
        })
      }
      const distance = camera.position.distanceTo(_c)
      if (local) playSound('shockwave')
      else if (distance < 25) playSound('shockwave')
    }
    const wk = (now - s.waveAt) / 0.55
    if (wave.current) {
      wave.current.visible = wk >= 0 && wk < 1
      if (wave.current.visible) {
        wave.current.position.set(s.waveAt0.x, s.waveAt0.y + 0.07, s.waveAt0.z)
        wave.current.scale.setScalar(1 + wk * 9)
        wave.current.material.opacity = (1 - wk) ** 1.3
      }
    }

    pool.update(delta)
  })

  const ringMap = neonOutlineTexture(aura?.colors[1] ?? '#ffffff', 'circle')
  const glow = { transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }
  return (
    <>
      <primitive object={pool.points} />
      <mesh ref={groundRing} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={ringMap} color={auraColors?.[0] ?? '#ffffff'} {...glow} />
      </mesh>
      <sprite ref={bodyGlow} visible={false} renderOrder={2}>
        <spriteMaterial map={radialGlowTexture()} color={auraColors?.[1] ?? '#ffffff'} {...glow} />
      </sprite>
      {/* A soft column of the aura's light, fading upwards. */}
      <mesh ref={column} visible={false} renderOrder={2}>
        <cylinderGeometry args={[0.62, 0.78, 2.5, 24, 1, true]} />
        <meshBasicMaterial map={beamTexture()} color={auraColors?.[1] ?? '#ffffff'} side={DoubleSide} {...glow} />
      </mesh>
      <mesh ref={halo} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[0.32, 0.04, 8, 32]} />
        <meshBasicMaterial color={aura?.colors[0] ?? '#ffffff'} toneMapped={false} />
      </mesh>
      <mesh ref={lvlRing} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
        <ringGeometry args={[0.45, 0.6, 40]} />
        <meshBasicMaterial color="#fff3a0" side={DoubleSide} {...glow} />
      </mesh>
      <mesh ref={lvlBeam} visible={false} renderOrder={2}>
        <cylinderGeometry args={[0.8, 0.8, 8, 24, 1, true]} />
        <meshBasicMaterial map={beamTexture()} color="#fff3a0" side={DoubleSide} {...glow} />
      </mesh>
      <mesh ref={lvlText} visible={false} renderOrder={6}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={levelUpLabel()} transparent depthWrite={false} depthTest={false} toneMapped={false} />
      </mesh>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} visible={false} renderOrder={2}>
        <ringGeometry args={[0.35, 0.5, 40]} />
        <meshBasicMaterial color={glove.trim} side={DoubleSide} {...glow} />
      </mesh>
    </>
  )
}

const _c = new Vector3()
const _f = new Vector3()
const _v = new Vector3()
const _d = new Vector3()
const _hue = new Color()

const levelUpLabel = () => labelTexture({ lines: [{ text: 'LEVEL UP!', fill: ['#fff6a8', '#ffb31a'] }], aspect: 2.9, width: 512 })

/** 0..1 for the moment a punch lands, else 0. */
const punchKick = (p) => (p >= 0.25 && p < 0.6 ? 1 - Math.abs(p - 0.35) / 0.25 : 0)

/** Particles a second for each aura style. */
const auraRate = (aura) =>
  ({ spark: 28, flame: 70, swirl: 46, bubbles: 16, lightning: 34, galaxy: 40, rainbow: 54, crown: 26 })[aura.style] *
  (aura.big ? 1.5 : 1)

const rand = (a, b) => a + Math.random() * (b - a)
const pickColor = (colors) => colors[Math.random() < 0.5 ? 0 : 1]

/** One aura particle, round the player at centre `c`. */
function emitAura(pool, aura, c, feet, t) {
  const [c0, c1] = aura.colors
  const big = (aura.big ? 1.4 : 1) * 1.45
  const a = Math.random() * Math.PI * 2
  switch (aura.style) {
    case 'flame': {
      const r = rand(0.3, 0.6) * big
      pool.emit({
        x: c.x + Math.cos(a) * r, y: feet + rand(0, 0.3), z: c.z + Math.sin(a) * r,
        vx: -Math.cos(a) * 0.3, vy: rand(1.4, 2.6) * big, vz: -Math.sin(a) * 0.3,
        life: rand(0.5, 0.85), size: rand(0.35, 0.55) * big, endSize: 0.04, color: c0, endColor: c1, drag: 0.8, gravity: -1.2, alpha: 0.85,
      })
      break
    }
    case 'swirl': {
      const arm = Math.random() < 0.5 ? 0 : Math.PI
      const ang = t * 3 + arm
      pool.emit({
        x: c.x + Math.cos(ang) * 0.7, y: feet + rand(0, 0.2), z: c.z + Math.sin(ang) * 0.7,
        vx: -Math.sin(ang) * 2, vy: rand(1, 1.6), vz: Math.cos(ang) * 2,
        life: 1.2, size: 0.38, endSize: 0.06, color: c0, endColor: c1, drag: 0.3, spin: 4,
      })
      break
    }
    case 'bubbles': {
      const r = rand(0.2, 0.8)
      pool.emit({
        x: c.x + Math.cos(a) * r, y: feet + rand(0, 0.6), z: c.z + Math.sin(a) * r,
        vx: rand(-0.2, 0.2), vy: rand(0.6, 1.1), vz: rand(-0.2, 0.2),
        life: rand(1.3, 1.9), size: rand(0.24, 0.36), endSize: 0.46, color: pickColor(aura.colors), endColor: c1, drag: 0.2, spin: rand(-3, 3), alpha: 0.8,
      })
      break
    }
    case 'lightning': {
      const r = rand(0.35, 0.6)
      pool.emit({
        x: c.x + Math.cos(a) * r, y: feet + rand(0.1, 1.9), z: c.z + Math.sin(a) * r,
        vx: rand(-2, 2), vy: rand(-1, 2), vz: rand(-2, 2),
        life: rand(0.12, 0.25), size: 0.34, endSize: 0.06, color: c0, endColor: c1, drag: 4,
      })
      break
    }
    case 'galaxy': {
      const tilt = Math.random() < 0.5 ? 0.35 : -0.35
      const r = 0.85
      pool.emit({
        x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r * tilt, z: c.z + Math.sin(a) * r,
        vx: -Math.sin(a) * 2.6, vy: Math.cos(a) * tilt * 2.6, vz: Math.cos(a) * 2.6,
        life: rand(1.1, 1.6), size: rand(0.2, 0.32), endSize: 0.06, color: pickColor(aura.colors), endColor: '#ffffff', drag: 0, spin: 3,
      })
      break
    }
    case 'rainbow': {
      const ang = t * 2.6 + Math.random() * 0.5
      _hue.setHSL((t * 0.35 + Math.random() * 0.15) % 1, 1, 0.6)
      pool.emit({
        x: c.x + Math.cos(ang) * 0.75, y: feet + rand(0, 0.2), z: c.z + Math.sin(ang) * 0.75,
        vx: -Math.sin(ang) * 1.6, vy: rand(1.2, 2), vz: Math.cos(ang) * 1.6,
        life: 1.2, size: 0.42, endSize: 0.08, color: `#${_hue.getHexString()}`, drag: 0.3, spin: 3.5,
      })
      break
    }
    case 'crown': {
      const r = rand(0, 0.32)
      pool.emit({
        x: c.x + Math.cos(a) * r, y: c.y + 1.3, z: c.z + Math.sin(a) * r,
        vx: rand(-0.3, 0.3), vy: rand(-0.4, -0.1), vz: rand(-0.3, 0.3),
        life: rand(1, 1.4), size: rand(0.14, 0.24) * big, endSize: 0.04, color: c0, endColor: c1, drag: 0.6, gravity: 1.2,
      })
      if (Math.random() < 0.5) {
        pool.emit({
          x: c.x + Math.cos(a) * 0.6, y: feet + rand(0, 0.2), z: c.z + Math.sin(a) * 0.6,
          vy: rand(0.8, 1.4), life: 1, size: 0.32, endSize: 0.05, color: c1, drag: 0.4,
        })
      }
      break
    }
    default: {
      // spark
      const r = rand(0.4, 0.75)
      pool.emit({
        x: c.x + Math.cos(a) * r, y: feet + rand(0, 1.8), z: c.z + Math.sin(a) * r,
        vx: rand(-0.15, 0.15), vy: rand(0.5, 1.1), vz: rand(-0.15, 0.15),
        life: rand(0.8, 1.3), size: rand(0.22, 0.36), endSize: 0.03, color: c0, endColor: c1, drag: 0.5,
      })
    }
  }
}

/** A lightning aura's bolt: a jagged line of sparks from head to toe. */
function emitBolt(pool, c, feet, aura) {
  const a = Math.random() * Math.PI * 2
  let x = c.x + Math.cos(a) * 0.55
  let z = c.z + Math.sin(a) * 0.55
  for (let y = c.y + 1.2; y > feet; y -= 0.12) {
    x += rand(-0.08, 0.08)
    z += rand(-0.08, 0.08)
    pool.emit({ x, y, z, life: 0.18, size: 0.32, endSize: 0.18, color: aura.colors[0], endColor: aura.colors[1], drag: 0 })
  }
}

/**
 * How a pair's trail looks, by design: how dense, which way its particles go, how
 * long they last, and in what colours.
 */
function gloveLook(glove) {
  const base = { density: 14, life: 0.5, size: 0.28, rise: 0, spread: 0.2, gravity: 0, colors: [glove.trim, glove.cuff], burst: [glove.trim, '#ffffff'] }
  switch (glove.design) {
    case 'flame':
      return { ...base, density: 30, life: 0.55, size: 0.46, rise: 1.4, gravity: -1.5, colors: ['#fff3a0', glove.cuff], burst: ['#fff3a0', '#ff5a1a'] }
    case 'crystal':
      return { ...base, density: 20, life: 0.9, size: 0.24, spread: 0.4, colors: [glove.trim, '#ffffff'], burst: ['#ffffff', glove.trim] }
    case 'tech':
      return { ...base, density: 22, life: 0.4, size: 0.22, spread: 0.6, colors: [glove.trim, glove.cuff] }
    case 'thunder':
      return { ...base, density: 26, life: 0.22, size: 0.26, spread: 2.2, colors: ['#ffffff', glove.cuff], burst: ['#ffffff', '#ffe94a'] }
    case 'galaxy':
      return { ...base, density: 22, life: 1.1, size: 0.22, spread: 0.3, colors: [glove.trim, glove.cuff], burst: [glove.cuff, '#ffffff'] }
    case 'royal':
      return { ...base, density: 20, life: 0.8, size: 0.22, gravity: 2.5, spread: 0.4, colors: ['#ffe46a', glove.trim], burst: ['#fff3a0', '#ffb000'] }
    case 'dragon':
      return { ...base, density: 28, life: 0.6, size: 0.42, rise: 1, gravity: -1.2, colors: [glove.trim, '#1f7a46'], burst: ['#d9ffe8', glove.trim] }
    case 'divine':
      return { ...base, density: 24, life: 0.9, size: 0.3, rise: 0.8, gravity: -0.6, colors: ['#ffffff', glove.cuff], burst: ['#ffffff', '#ffe9a8'] }
    case 'spiked':
      return { ...base, density: 12, life: 0.35, size: 0.2, colors: [glove.trim, glove.main], burst: ['#fff6d0', '#ffb347'] }
    default:
      return base
  }
}

/** One trail particle at `p`. */
function emitTrail(pool, look, p) {
  const s = look.spread
  pool.emit({
    x: p.x, y: p.y, z: p.z,
    vx: rand(-s, s), vy: look.rise + rand(-s, s) * 0.5, vz: rand(-s, s),
    life: look.life * rand(0.7, 1.2), size: look.size * rand(0.8, 1.2), endSize: look.size * 0.15,
    color: look.colors[0], endColor: look.colors[1], drag: 2, gravity: look.gravity,
  })
}

/** The burst off a fist as its punch lands, flying on in the direction it was going. */
function emitBurst(pool, look, p, dir, glove, count, rate) {
  const len = dir.length() || 1
  const fx = dir.x / len
  const fy = dir.y / len
  const fz = dir.z / len
  const sparks = glove.design === 'spiked' || glove.design === 'thunder'
  for (let k = 0; k < Math.max(3, count * rate); k++) {
    const sp = sparks ? rand(4, 8) : rand(2, 4.5)
    pool.emit({
      x: p.x, y: p.y, z: p.z,
      vx: fx * sp + rand(-2, 2), vy: fy * sp + rand(-1, 2.5), vz: fz * sp + rand(-2, 2),
      life: sparks ? rand(0.25, 0.45) : rand(0.35, 0.6), size: sparks ? 0.22 : 0.42, endSize: 0.05,
      color: look.burst[0], endColor: look.burst[1], drag: sparks ? 2 : 4, gravity: sparks ? 9 : 0,
    })
  }
}

export default PlayerFx
