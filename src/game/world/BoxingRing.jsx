import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, SRGBColorSpace } from 'three'

import { useBloxity } from '../../bloxity/BloxityContext'
import { useLobby } from '../../net/lobbyClient'
import { FONT_WEIGHT, GAME_FONT } from '../font'
import { SEE_THROUGH } from '../physicsGroups'
import { ringPad } from '../ringLocal'
import { ringLocked, ringSecondsLeft, useRings } from '../ringState'
import {
  CORNER_COLORS,
  CORNER_NAMES,
  padOf,
  PAD_RADIUS,
  RING_FLOOR,
  RING_HALF,
  RING_MAX_HP,
  RING_PLATFORM_HALF,
  RING_POST_H,
} from '../rings'
import { Label } from './Effects'
import { geometry, merge } from './geometry'
import PadGlow from './PadGlow'
import { labelTexture, radialGlowTexture, shade } from './textures'

/** Rope heights above the canvas. */
const ROPES = [0.5, 1.0, 1.5]
/** Where the posts stand: just outside the canvas, on the apron. */
const POST = RING_HALF + 0.18
/**
 * The ropes are a wall, all the time: nobody climbs in through them and nobody falls
 * out. The only way in is the pads (see RingDirector). Tall enough that a jump off
 * the apron does not clear it.
 */
const BARRIER = RING_HALF + 0.42
const BARRIER_H = 4.6
/** The light rig over the ring, and the scoreboard hanging under it. */
const RIG_Y = 8.2
const BOARD_Y = 6.6
const BOARD_W = 4.6
const BOARD_H = BOARD_W / 2

/** Corner posts: red, blue, and two neutral white ones. Red is the west side. */
const CORNERS = [
  { x: -POST, z: -POST, color: '#ff3b3b' },
  { x: POST, z: POST, color: '#2f7cff' },
  { x: POST, z: -POST, color: '#f4f4f4' },
  { x: -POST, z: POST, color: '#f4f4f4' },
]

/** One rope level as one geometry: four sides of a square at height `y`. */
const ropeGeometry = (y) =>
  geometry(`ring-rope-${y}`, () => {
    const len = POST * 2
    const sides = []
    for (const [x, z, along] of [
      [0, -POST, 'x'],
      [0, POST, 'x'],
      [-POST, 0, 'z'],
      [POST, 0, 'z'],
    ]) {
      const g = new CylinderGeometry(0.065, 0.065, len, 8)
      if (along === 'x') g.rotateZ(Math.PI / 2)
      else g.rotateX(Math.PI / 2)
      g.translate(x, RING_FLOOR + y, z)
      sides.push(g)
    }
    return merge(sides)
  })

/** The light rig: a square truss over the ring. */
const rigGeometry = () =>
  geometry('ring-rig', () => {
    const half = RING_HALF + 0.6
    const bars = []
    for (const [x, z, along] of [
      [0, -half, 'x'],
      [0, half, 'x'],
      [-half, 0, 'z'],
      [half, 0, 'z'],
    ]) {
      const g = new CylinderGeometry(0.09, 0.09, half * 2 + 0.2, 6)
      if (along === 'x') g.rotateZ(Math.PI / 2)
      else g.rotateX(Math.PI / 2)
      g.translate(x, RIG_Y, z)
      bars.push(g)
    }
    return merge(bars)
  })

const INK = '#12131f'
const font = (size) => `${FONT_WEIGHT.heavy} ${size}px ${GAME_FONT}`

/** Text with the game's thick outline. */
function outlined(ctx, text, x, y, size, fill, align = 'center') {
  ctx.font = font(size)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = size * 0.24
  ctx.strokeStyle = INK
  ctx.strokeText(text, x, y)
  ctx.fillStyle = fill
  ctx.fillText(text, x, y)
}

/** Cuts `text` down until it fits in `max` pixels at the current font. */
function fit(ctx, text, max) {
  if (ctx.measureText(text).width <= max) return text
  let out = text
  while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1)
  return `${out}…`
}

/**
 * The scoreboard over a ring: its name, what is going on, and both fighters with
 * their health - or, between fights, who is waiting on the pads.
 */
function drawBoard(ctx, w, h, ring, state, names) {
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = INK
  ctx.beginPath()
  ctx.roundRect(0, 0, w, h, 34)
  ctx.fill()
  const body = ctx.createLinearGradient(0, 0, 0, h)
  body.addColorStop(0, '#2a2d58')
  body.addColorStop(1, '#16182f')
  ctx.fillStyle = body
  ctx.beginPath()
  ctx.roundRect(8, 8, w - 16, h - 16, 28)
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = ring.accent
  ctx.beginPath()
  ctx.roundRect(8, 8, w - 16, h - 16, 28)
  ctx.stroke()

  outlined(ctx, ring.name, w / 2, 46, 40, '#ffffff')

  const now = performance.now()
  const open = state.s === 'open'
  // Between fights the board shows the pads; during one, the fighters.
  const [a, b] = open ? state.p : state.f
  const waiting = state.p.filter(Boolean).length
  let status
  let statusFill
  if (state.s === 'countdown') {
    status = `GET READY... ${Math.max(1, Math.ceil(ringSecondsLeft(state, now)))}`
    statusFill = '#ffd23f'
  } else if (state.s === 'fight') {
    status = `FIGHT!  ${Math.ceil(ringSecondsLeft(state, now))}s`
    statusFill = '#ff6a5a'
  } else if (state.s === 'ko') {
    status = 'K.O.!'
    statusFill = '#ff4fd8'
  } else if (waiting === 1) {
    status = '1 READY - NEED A CHALLENGER'
    statusFill = '#9fe8ff'
  } else {
    status = 'STAND ON A PAD TO FIGHT'
    statusFill = '#b4ff8a'
  }
  outlined(ctx, status, w / 2, 98, status.length > 14 ? 26 : 34, statusFill)

  for (const [slot, id] of [[0, a], [1, b]]) {
    const x0 = slot === 0 ? 28 : w / 2 + 10
    const bw = w / 2 - 38
    const y = 150
    ctx.fillStyle = CORNER_COLORS[slot]
    ctx.beginPath()
    ctx.roundRect(x0, y - 22, 14, 44, 6)
    ctx.fill()
    ctx.font = font(26)
    const name = id ? fit(ctx, names(id), bw - 26) : '- empty -'
    outlined(ctx, name, x0 + 22, y, 26, id ? '#ffffff' : '#8a8fb0', 'left')
    const hp = open ? (id ? 1 : 0) : Math.max(0, state.hp[slot]) / RING_MAX_HP
    const by = y + 34
    ctx.fillStyle = INK
    ctx.beginPath()
    ctx.roundRect(x0, by, bw, 30, 15)
    ctx.fill()
    if (hp > 0) {
      const grad = ctx.createLinearGradient(0, by, 0, by + 30)
      const [top, bottom] = hp > 0.5 ? ['#b4ff6e', '#22b81a'] : hp > 0.25 ? ['#fff07a', '#e09400'] : ['#ffa08a', '#d62a1a']
      grad.addColorStop(0, top)
      grad.addColorStop(1, bottom)
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.roundRect(x0 + 4, by + 4, (bw - 8) * hp, 22, 11)
      ctx.fill()
    }
    const caption = open ? (id ? 'READY' : '') : id ? `${Math.ceil(state.hp[slot])}` : ''
    outlined(ctx, caption, x0 + bw / 2, by + 15, 20, '#ffffff')
  }
  outlined(ctx, 'VS', w / 2, 168, 30, '#ffd23f')
}

/** The scoreboard's canvas, and a `draw` that repaints it and flags it for upload. */
function createBoard(ring) {
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 4
  return {
    texture,
    draw(state, names) {
      drawBoard(ctx, 512, 256, ring, state, names)
      texture.needsUpdate = true
    },
  }
}

/**
 * One of the two pads beside a ring: a glowing disc in its corner's colour, a sign
 * over it saying whose it is, and a sensor that tells RingDirector when you step on
 * or off.
 */
function RingPad({ ring, slot, occupant, fightOn }) {
  const color = CORNER_COLORS[slot]
  const [px, pz] = padOf(ring, slot)
  const disc = useRef(null)
  useFrame(({ clock }) => {
    if (disc.current) disc.current.emissiveIntensity = (occupant ? 0.9 : 0.45) + 0.2 * Math.sin(clock.elapsedTime * 4 + slot)
  })
  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') ringPad(ring.id, slot, true)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') ringPad(ring.id, slot, false)
  }
  const status = occupant
    ? { text: `${occupant} is ready!`, scale: 0.6, fill: '#b4ff8a' }
    : { text: fightOn ? 'Wait here for the next fight' : 'Stand here to fight!', scale: 0.6, fill: '#ffe9a8' }
  return (
    <group position={[px - ring.x, 0, pz - ring.z]}>
      <mesh position={[0, 0.1, 0]} receiveShadow>
        <cylinderGeometry args={[PAD_RADIUS + 0.25, PAD_RADIUS + 0.35, 0.2, 32]} />
        <meshStandardMaterial color={shade(color, -0.45)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[PAD_RADIUS, PAD_RADIUS, 0.06, 32]} />
        <meshStandardMaterial ref={disc} color={color} emissive={color} emissiveIntensity={0.5} roughness={0.4} />
      </mesh>
      <PadGlow color={color} shape="circle" size={PAD_RADIUS * 2 + 0.5} y={0.27} rise={2.2} level={occupant ? 1.2 : 0.8} sparkles={4} phase={ring.id + slot} />
      <Billboard position={[0, 3.4, 0]}>
        <Label
          lines={[{ text: CORNER_NAMES[slot], fill: ['#ffffff', shade(color, 0.3)] }, status]}
          position={[0, 0, 0]}
          size={[3.4, 1.2]}
          style={{ width: 512 }}
        />
      </Billboard>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider sensor args={[PAD_RADIUS - 0.1, 1, PAD_RADIUS - 0.1]} position={[0, 1, 0]} onIntersectionEnter={onEnter} onIntersectionExit={onExit} />
      </RigidBody>
    </group>
  )
}

/**
 * One boxing ring: a raised platform with a canvas, ropes and corner posts, a light
 * rig over it, a scoreboard everyone in the lobby can read, and a pad either side.
 *
 * Who is fighting is the server's business (see RingDirector and the server's
 * rings.js). This only shows it. The ropes are solid all the time - nobody climbs
 * in or falls out - and they shimmer while a fight is on.
 *
 * @param {{ ring: import('../rings').RINGS[number] }} props
 */
export function BoxingRing({ ring }) {
  const state = useRings((s) => s.rings[ring.id])
  const players = useLobby((s) => s.players)
  const selfId = useLobby((s) => s.selfId)
  const { identity } = useBloxity()
  const myName = identity?.displayName || identity?.username || 'You'
  const locked = ringLocked(state)

  const board = useMemo(() => createBoard(ring), [ring])
  useEffect(() => () => board.texture.dispose(), [board])

  // Who is who: our own name for us, the lobby's for everyone else.
  const names = useMemo(() => (id) => (id === selfId ? myName : players[id]?.name ?? 'Player'), [selfId, myName, players])

  // Redrawn when anything on it changes; the clocks also tick it once a second.
  const ticked = useRef(null)
  useEffect(() => board.draw(state, names), [board, state, names])

  const field = useRef([])
  const glow = useRef(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (state.s === 'countdown' || state.s === 'fight') {
      const second = Math.ceil(ringSecondsLeft(state))
      if (ticked.current !== second) {
        ticked.current = second
        board.draw(state, names)
      }
    }
    for (const mesh of field.current) {
      if (!mesh) continue
      mesh.visible = locked
      // Faint, so the fight inside and the crowd outside can still see each other.
      if (locked) mesh.material.opacity = 0.1 + 0.05 * Math.sin(t * 4 + mesh.position.x + mesh.position.z)
    }
    if (glow.current) glow.current.opacity = (state.s === 'fight' ? 0.5 : 0.3) + 0.1 * Math.sin(t * 3)
  })

  const skirtLabel = useMemo(
    () => labelTexture({ lines: [{ text: ring.name, fill: ['#ffffff', shade(ring.accent, 0.3)] }], aspect: 4, width: 512 }),
    [ring],
  )
  const matLogo = useMemo(
    () =>
      labelTexture({
        lines: [
          { text: '+1 FIST', scale: 1, fill: [shade(ring.skirt, 0.2), ring.skirt] },
          { text: ring.name, scale: 0.7, fill: [shade(ring.skirt, 0.2), ring.skirt] },
        ],
        aspect: 1.6,
        width: 512,
        stroke: null,
      }),
    [ring],
  )

  return (
    <group position={[ring.x, 0, ring.z]}>
      {/* Platform: the apron's skirt all round, the canvas on top. */}
      <mesh position={[0, RING_FLOOR / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[RING_PLATFORM_HALF * 2, RING_FLOOR, RING_PLATFORM_HALF * 2]} />
        <meshStandardMaterial color={ring.skirt} roughness={0.7} />
      </mesh>
      <mesh position={[0, RING_FLOOR + 0.03, 0]} receiveShadow>
        <boxGeometry args={[RING_HALF * 2 + 0.5, 0.06, RING_HALF * 2 + 0.5]} />
        <meshStandardMaterial color={ring.mat} roughness={0.85} />
      </mesh>
      <mesh position={[0, RING_FLOOR + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[5.2, 3.25]} />
        <meshBasicMaterial map={matLogo} transparent depthWrite={false} toneMapped={false} opacity={0.85} />
      </mesh>
      {/* A neon lip round the apron. */}
      <mesh position={[0, RING_FLOOR - 0.02, 0]}>
        <boxGeometry args={[RING_PLATFORM_HALF * 2 + 0.08, 0.08, RING_PLATFORM_HALF * 2 + 0.08]} />
        <meshBasicMaterial color={ring.accent} toneMapped={false} />
      </mesh>
      {/* The ring's name on all four sides of the skirt. */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        const d = RING_PLATFORM_HALF + 0.01
        return (
          <mesh key={i} position={[Math.sin(a) * d, RING_FLOOR * 0.48, Math.cos(a) * d]} rotation={[0, a, 0]}>
            <planeGeometry args={[3.6, 0.9]} />
            <meshBasicMaterial map={skirtLabel} transparent depthWrite={false} toneMapped={false} />
          </mesh>
        )
      })}

      {/* Corner posts and their pads. */}
      {CORNERS.map((c, i) => (
        <group key={i} position={[c.x, RING_FLOOR, c.z]}>
          <mesh position={[0, RING_POST_H / 2, 0]} castShadow>
            <cylinderGeometry args={[0.13, 0.15, RING_POST_H, 10]} />
            <meshStandardMaterial color="#c8ccd8" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 1.0, 0]} castShadow>
            <boxGeometry args={[0.42, 1.25, 0.42]} />
            <meshStandardMaterial color={c.color} roughness={0.5} />
          </mesh>
          <mesh position={[0, RING_POST_H + 0.06, 0]}>
            <sphereGeometry args={[0.16, 12, 8]} />
            <meshStandardMaterial color={c.color} emissive={c.color} emissiveIntensity={0.5} />
          </mesh>
        </group>
      ))}
      {/* Three ropes, each in its own colour. */}
      {ROPES.map((y, i) => (
        <mesh key={y} geometry={ropeGeometry(y)} castShadow>
          <meshStandardMaterial color={ring.ropes[i]} roughness={0.45} emissive={ring.ropes[i]} emissiveIntensity={0.2} />
        </mesh>
      ))}

      {/* The light rig, its lamps, and a pool of light on the canvas. */}
      <mesh geometry={rigGeometry()}>
        <meshStandardMaterial color="#20222e" metalness={0.6} roughness={0.4} />
      </mesh>
      {CORNERS.map((c, i) => (
        <mesh key={i} position={[c.x * 0.75, RIG_Y - 0.2, c.z * 0.75]} rotation={[Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.32, 16]} />
          <meshBasicMaterial color="#fff6d0" toneMapped={false} side={DoubleSide} />
        </mesh>
      ))}
      <mesh position={[0, RING_FLOOR + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[RING_HALF * 2.4, RING_HALF * 2.4]} />
        <meshBasicMaterial
          ref={glow}
          map={radialGlowTexture()}
          color="#fff3d0"
          transparent
          opacity={0.3}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* The scoreboard, turning to whoever is looking. */}
      <Billboard position={[0, BOARD_Y, 0]}>
        <mesh>
          <planeGeometry args={[BOARD_W, BOARD_H]} />
          <meshBasicMaterial map={board.texture} transparent toneMapped={false} />
        </mesh>
      </Billboard>

      {/* The ropes' shimmer while a fight is on. */}
      {[0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2
        return (
          <mesh
            key={i}
            ref={(el) => {
              field.current[i] = el
            }}
            position={[Math.sin(a) * BARRIER, RING_FLOOR + 1.1, Math.cos(a) * BARRIER]}
            rotation={[0, a, 0]}
            visible={false}
          >
            <planeGeometry args={[BARRIER * 2, 2.2]} />
            <meshBasicMaterial
              color={ring.accent}
              transparent
              opacity={0.12}
              blending={AdditiveBlending}
              depthWrite={false}
              side={DoubleSide}
              forceSinglePass
              toneMapped={false}
            />
          </mesh>
        )
      })}

      {[0, 1].map((slot) => {
        const id = state.p[slot]
        return (
          <RingPad
            key={slot}
            ring={ring}
            slot={slot}
            occupant={id ? names(id) : null}
            fightOn={state.s !== 'open'}
          />
        )
      })}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[RING_PLATFORM_HALF, RING_FLOOR / 2, RING_PLATFORM_HALF]} position={[0, RING_FLOOR / 2, 0]} />
        {/* Posts are solid, and so are the ropes - always. */}
        {CORNERS.map((c, i) => (
          <CuboidCollider key={i} args={[0.2, RING_POST_H / 2, 0.2]} position={[c.x, RING_FLOOR + RING_POST_H / 2, c.z]} />
        ))}
        {[0, 1, 2, 3].map((i) => {
          const a = (i * Math.PI) / 2
          return (
            <CuboidCollider
              key={`b${i}`}
              args={[BARRIER + 0.2, BARRIER_H / 2, 0.15]}
              position={[Math.sin(a) * BARRIER, RING_FLOOR + BARRIER_H / 2, Math.cos(a) * BARRIER]}
              rotation={[0, a, 0]}
              collisionGroups={SEE_THROUGH}
            />
          )
        })}
      </RigidBody>
    </group>
  )
}

export default BoxingRing
