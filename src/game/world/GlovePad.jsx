import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { glowColor } from '../gloves'
import GloveModel from '../GloveModel'
import { Label } from './Effects'
import InteractPrompt from './InteractPrompt'
import PadGlow from './PadGlow'
import { radialGlowTexture, shade } from './textures'

/** Pad colour: red not owned (pulsing when affordable), yellow owned, purple worn. */
const STATUS_COLOR = {
  equipped: '#b05cff',
  owned: '#ffd23f',
  affordable: '#ff3b3b',
  locked: '#d9302b',
}

/** How brightly the pad's glow shines: dim while out of reach, brightest when worn. */
const STATUS_GLOW = {
  equipped: 1.15,
  owned: 0.85,
  affordable: 1,
  locked: 0.5,
}

const GOLD = ['#fff6a8', '#ffc21a']
const GEM = ['#d6f6ff', '#2fa8ff']
const PAD_TOP = 0.26
/** Shop gloves are shown bigger than worn ones so the row reads from the path. */
const DISPLAY_SCALE = 1.9
/** Height the pair floats at over the pad. */
const DISPLAY_Y = 1.45
/** Half the gap between the two gloves of the pair. */
const PAIR_GAP = 0.3

/**
 * Shop slot: a pair of gloves turning slowly over a glowing hexagon pad, knuckles to
 * the sky, with their price, name and Strength per punch floating above. Walking up
 * to it shows an E prompt to buy them, or put them on if already owned.
 *
 * @param {{ glove: object, position: number[] }} props
 */
export function GlovePad({ glove, position }) {
  const status = useGame((s) =>
    s.equipped === glove.id
      ? 'equipped'
      : s.owned.includes(glove.id)
        ? 'owned'
        : s.wins >= glove.cost
          ? 'affordable'
          : 'locked',
  )
  const pairRef = useRef(null)
  const padMaterial = useRef(null)
  const aura = useRef(null)

  /** Each pair glows in its own colour. */
  const glow = glowColor(glove)
  /** Roughly how tall the floating pair and its glow stand. */
  const height = DISPLAY_Y + 0.7 * glove.size

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (pairRef.current) {
      pairRef.current.rotation.y += delta * 0.6
      pairRef.current.position.y = DISPLAY_Y + Math.sin(t * 1.4 + position[0] + position[2]) * 0.08
    }
    if (padMaterial.current) {
      padMaterial.current.emissiveIntensity =
        status === 'affordable' ? 0.45 + 0.25 * Math.sin(t * 4) : status === 'locked' ? 0.12 : 0.35
    }
    if (aura.current) aura.current.opacity = 0.3 + 0.12 * Math.sin(t * 2 + position[0])
  })

  const inRange = useGame((s) => s.interact?.kind === 'glove' && s.interact.id === glove.id)

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().setInteract('glove', glove.id)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('glove', glove.id)
  }

  const price = glove.cost === 0 ? 'Free' : `🏆 ${formatNumber(glove.cost)} Wins`
  const prompt = {
    equipped: { action: 'Wearing', tone: 'done', detail: 'On your hands' },
    owned: { action: 'Wear', tone: 'normal', detail: 'You own these gloves' },
    affordable: { action: 'Buy', tone: 'normal', detail: price },
    locked: { action: 'Buy', tone: 'warn', detail: `${price} · not enough Wins` },
  }[status]

  const color = STATUS_COLOR[status]
  const priceLine =
    status === 'equipped'
      ? { text: 'WEARING', fill: ['#f0dcff', '#c07bff'] }
      : status === 'owned'
        ? { text: 'OWNED', fill: GOLD }
        : glove.cost === 0
          ? { text: 'FREE', fill: ['#ffffff', '#b8ffb0'] }
          : { text: `${formatNumber(glove.cost)} Wins`, icon: 'trophy', fill: GOLD }

  return (
    <group position={position}>
      {/* Hexagon pad: dark rim with a glowing top. */}
      <mesh position={[0, 0.09, 0]} rotation={[0, Math.PI / 6, 0]} receiveShadow>
        <cylinderGeometry args={[1.6, 1.7, 0.18, 6]} />
        <meshStandardMaterial color={shade(color, -0.45)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.2, 0]} rotation={[0, Math.PI / 6, 0]} receiveShadow>
        <cylinderGeometry args={[1.3, 1.4, 0.12, 6]} />
        <meshStandardMaterial
          ref={padMaterial}
          color={color}
          emissive={color}
          emissiveIntensity={0.35}
          roughness={0.5}
        />
      </mesh>

      {/* The pair, knuckles up, side by side, turning together. Flipped so the
          knuckles point at the sky (the model's fist points down -Y). */}
      <group ref={pairRef} position={[0, DISPLAY_Y, 0]} scale={DISPLAY_SCALE}>
        <group position={[-PAIR_GAP * glove.size, 0.2 * glove.size, 0]} rotation={[0, 0, Math.PI]}>
          <GloveModel glove={glove} side={1} minGlow={0.3} />
        </group>
        <group position={[PAIR_GAP * glove.size, 0.2 * glove.size, 0]} rotation={[0, 0, Math.PI]}>
          <GloveModel glove={glove} side={-1} minGlow={0.3} sparkles={false} />
        </group>
      </group>

      {/* Neon rim and rings rising round the gloves, in their colour, plus a soft aura
          behind them. */}
      <PadGlow
        color={glow}
        shape="hex"
        size={3.4}
        y={PAD_TOP + 0.01}
        rise={Math.max(2.4, height + 0.4)}
        level={STATUS_GLOW[status]}
        sparkles={glove.glow ? 8 : 5}
        phase={position[0] + position[2]}
      />
      <Billboard position={[0, DISPLAY_Y, 0]}>
        <mesh>
          <planeGeometry args={[2.4 * glove.size, 2 * glove.size]} />
          <meshBasicMaterial
            ref={aura}
            map={radialGlowTexture()}
            color={glow}
            transparent
            opacity={0.35}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>

      <Billboard position={[0, height + 1.4, 0]}>
        <Label
          lines={[
            ...(glove.vip ? [{ text: 'VIP', scale: 0.8, fill: GEM }] : []),
            priceLine,
            { text: glove.name, scale: 1.3 },
            { text: `+${formatNumber(glove.power)} Strength`, icon: 'fist', fill: ['#ffd0d0', '#ff4040'] },
          ]}
          position={[0, 0, 0]}
          size={[3.8, glove.vip ? 2.3 : 1.9]}
          style={{ width: 512 }}
        />
      </Billboard>

      {inRange && <InteractPrompt position={[0, 2.4, 0]} title={glove.name} {...prompt} />}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[1.7, 1, 1.7]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default GlovePad
