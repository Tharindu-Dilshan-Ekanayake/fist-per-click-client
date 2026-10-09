import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import GunModel from '../GunModel'
import { glowColor } from '../guns'
import { Label } from './Effects'
import InteractPrompt from './InteractPrompt'
import PadGlow from './PadGlow'
import { radialGlowTexture, shade } from './textures'

/** Pad colour: red not owned (pulsing when affordable), yellow owned, purple equipped. */
const STATUS_COLOR = {
  equipped: '#b05cff',
  owned: '#ffd23f',
  affordable: '#ff3b3b',
  locked: '#d9302b',
}

/** How brightly the pad's glow shines: dim while out of reach, brightest in hand. */
const STATUS_GLOW = {
  equipped: 1.15,
  owned: 0.85,
  affordable: 1,
  locked: 0.5,
}

const GOLD = ['#fff6a8', '#ffc21a']
const GEM = ['#d6f6ff', '#2fa8ff']
const PAD_TOP = 0.26
/** Shop guns are shown bigger than held ones so the row reads from the path. */
const DISPLAY_SCALE = 1.6
/** Height the gun floats at over the pad. */
const DISPLAY_Y = 1.25

/**
 * Shop slot: a gun turning slowly over a glowing hexagon pad, with its price, name
 * and Ammo per click floating above. Walking up to it shows an E prompt to buy the
 * gun, or equip it if already owned.
 *
 * @param {{ gun: object, position: number[] }} props
 */
export function GunPad({ gun, position }) {
  const status = useGame((s) =>
    s.equipped === gun.id
      ? 'equipped'
      : s.owned.includes(gun.id)
        ? 'owned'
        : s.wins >= gun.cost
          ? 'affordable'
          : 'locked',
  )
  const gunRef = useRef(null)
  const padMaterial = useRef(null)
  const aura = useRef(null)

  /** Each gun glows in its own colour. */
  const glow = glowColor(gun)
  /** Roughly how tall the floating gun and its glow stand. */
  const height = DISPLAY_Y + 0.6 * gun.size

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (gunRef.current) {
      gunRef.current.rotation.y += delta * 0.6
      gunRef.current.position.y = DISPLAY_Y + Math.sin(t * 1.4 + position[0]) * 0.08
    }
    if (padMaterial.current) {
      padMaterial.current.emissiveIntensity =
        status === 'affordable' ? 0.45 + 0.25 * Math.sin(t * 4) : status === 'locked' ? 0.12 : 0.35
    }
    if (aura.current) aura.current.opacity = 0.3 + 0.12 * Math.sin(t * 2 + position[0])
  })

  const inRange = useGame((s) => s.interact?.kind === 'gun' && s.interact.id === gun.id)

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().setInteract('gun', gun.id)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('gun', gun.id)
  }

  const price = gun.cost === 0 ? 'Free' : `🏆 ${formatNumber(gun.cost)} Wins`
  const prompt = {
    equipped: { action: 'Equipped', tone: 'done', detail: 'In your hand' },
    owned: { action: 'Equip', tone: 'normal', detail: 'You own this gun' },
    affordable: { action: 'Buy', tone: 'normal', detail: price },
    locked: { action: 'Buy', tone: 'warn', detail: `${price} · not enough Wins` },
  }[status]

  const color = STATUS_COLOR[status]
  const priceLine =
    status === 'equipped'
      ? { text: 'EQUIPPED', fill: ['#f0dcff', '#c07bff'] }
      : status === 'owned'
        ? { text: 'OWNED', fill: GOLD }
        : gun.cost === 0
          ? { text: 'FREE', fill: ['#ffffff', '#b8ffb0'] }
          : { text: `${formatNumber(gun.cost)} Wins`, icon: 'trophy', fill: GOLD }

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

      {/* Centred on its own middle, so it turns in place rather than round its grip. */}
      <group ref={gunRef} position={[0, DISPLAY_Y, 0]} scale={DISPLAY_SCALE}>
        <group position={[0, -0.05, -0.2 * gun.size]}>
          <GunModel gun={gun} minGlow={0.3} />
        </group>
      </group>

      {/* Neon rim and rings rising round the gun, in its colour, plus a soft aura
          behind it. */}
      <PadGlow
        color={glow}
        shape="hex"
        size={3.4}
        y={PAD_TOP + 0.01}
        rise={Math.max(2.4, height + 0.4)}
        level={STATUS_GLOW[status]}
        sparkles={gun.glow ? 8 : 5}
        phase={position[0]}
      />
      <Billboard position={[0, DISPLAY_Y, 0]}>
        <mesh>
          <planeGeometry args={[2.2 * gun.size, 1.6 * gun.size]} />
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

      <Billboard position={[0, height + 1.35, 0]}>
        <Label
          lines={[
            ...(gun.vip ? [{ text: 'VIP', scale: 0.8, fill: GEM }] : []),
            priceLine,
            { text: gun.name, scale: 1.3 },
            { text: `+${formatNumber(gun.ammo)} Ammo`, icon: 'ammo', fill: ['#ff9a9a', '#ff3030'] },
          ]}
          position={[0, 0, 0]}
          size={[3.8, gun.vip ? 2.3 : 1.9]}
          style={{ width: 512 }}
        />
      </Billboard>

      {inRange && <InteractPrompt position={[0, 2.2, 0]} title={gun.name} {...prompt} />}

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

export default GunPad
