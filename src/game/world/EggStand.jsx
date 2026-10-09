import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, BoxGeometry } from 'three'

import { formatBonus, formatNumber } from '../format'
import { useGame } from '../gameStore'
import { getPet } from '../pets'
import { Label, Sparkle } from './Effects'
import { geometry, merge } from './geometry'
import InteractPrompt from './InteractPrompt'
import { radialGlowTexture, shade } from './textures'
import { PetModel } from './PetModel'

/** Voxel egg silhouette, bottom to top: [width, height, colour index]. */
const LAYERS = [
  [1.1, 0.3, 0],
  [1.6, 0.35, 0],
  [1.9, 0.4, 1],
  [2.0, 0.45, 0],
  [1.9, 0.4, 0],
  [1.6, 0.35, 1],
  [1.2, 0.3, 0],
  [0.7, 0.25, 0],
]
/** Centre height of each layer. */
const LAYER_Y = LAYERS.map(([, h], i) => LAYERS.slice(0, i).reduce((sum, [, lh]) => sum + lh, 0) + h / 2)
const EGG_HEIGHT = LAYERS.reduce((sum, [, h]) => sum + h, 0)
/** Accent spots poking out of the widest layer: [x, z]. */
const SPOTS = [
  [1.0, 0.35],
  [-1.0, -0.4],
  [0.3, 1.0],
  [-0.4, -1.0],
]
const WIDEST = 3
const STAND_TOP = 0.42
const LIFT = 0.25
const GOLD = ['#fff6a8', '#ffc21a']
const GEM = ['#d6f6ff', '#2fa8ff']

/**
 * The egg's layers and spots, split by which of the two colours they take and merged
 * into one geometry each. The silhouette is the same for every egg in the game, so
 * this is built once: twelve meshes a stand became two.
 */
const eggParts = () =>
  geometry('egg', () => {
    const box = (w, h, d, x, y, z) => {
      const g = new BoxGeometry(w, h, d)
      g.translate(x, y, z)
      return g
    }
    const byColor = [[], []]
    LAYERS.forEach(([w, h, ci], i) => byColor[ci].push(box(w, h, w, 0, LAYER_Y[i], 0)))
    for (const [x, z] of SPOTS) byColor[1].push(box(0.4, 0.4, 0.4, x, LAYER_Y[WIDEST], z))
    return byColor.map(merge)
  })

function EggModel({ egg }) {
  const glow = egg.glow ?? 0
  const parts = eggParts()
  return (
    <group>
      {parts.map((part, i) => (
        <mesh key={i} geometry={part} castShadow>
          <meshStandardMaterial
            color={egg.colors[i]}
            emissive={egg.colors[i]}
            emissiveIntensity={glow}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}

/**
 * An egg spinning over a glowing round stand, with its name and price above.
 * Walking up to it shows an E prompt to open it; hatching isn't built yet, so for
 * now opening just says so.
 *
 * @param {{ egg: object, position: number[] }} props
 */
export function EggStand({ egg, position }) {
  const eggRef = useRef(null)
  const aura = useRef(null)
  const petRef = useRef(null)
  const glow = egg.glow ?? 0
  const pet = getPet(egg.id)

  const owned = useGame((s) => s.ownedPets.includes(egg.id))
  const equipped = useGame((s) => s.equippedPets.includes(egg.id))

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (eggRef.current) {
      eggRef.current.rotation.y += delta * 0.6
      eggRef.current.position.y = STAND_TOP + LIFT + Math.sin(t * 1.5 + position[2]) * 0.12
    }
    if (aura.current) aura.current.opacity = 0.3 + 0.12 * Math.sin(t * 2 + position[2])
    if (petRef.current) {
      petRef.current.rotation.y += delta * 0.8
      // STAND_TOP, not 0 - the pedestal is solid up to there, so anything lower
      // just sinks into it (its legs disappearing into the stone).
      petRef.current.position.y = STAND_TOP + Math.abs(Math.sin(t * 3 + position[2])) * 0.22
    }
  })

  const inRange = useGame((s) => s.interact?.kind === 'egg' && s.interact.id === egg.id)

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().setInteract('egg', egg.id)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('egg', egg.id)
  }

  return (
    <group position={position}>
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.3, 24]} />
        <meshStandardMaterial color={shade(egg.colors[1], -0.35)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[1.25, 1.35, 0.12, 24]} />
        <meshStandardMaterial color={egg.colors[0]} emissive={egg.colors[0]} emissiveIntensity={0.4} />
      </mesh>

      {owned ? (
        <group ref={petRef} position={[0, STAND_TOP, 0]}>
          <PetModel pet={pet} />
        </group>
      ) : (
        <group ref={eggRef} position={[0, STAND_TOP + LIFT, 0]}>
          <EggModel egg={egg} />
        </group>
      )}

      {glow > 0 && (
        <>
          <Billboard position={[0, STAND_TOP + EGG_HEIGHT / 2, 0]}>
            <mesh>
              <planeGeometry args={[3.4, EGG_HEIGHT * 1.6]} />
              <meshBasicMaterial
                ref={aura}
                map={radialGlowTexture()}
                color={egg.colors[0]}
                transparent
                opacity={0.35}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </Billboard>
          <Sparkle
            count={16}
            scale={[2.6, EGG_HEIGHT + 1, 2.6]}
            position={[0, STAND_TOP + EGG_HEIGHT / 2, 0]}
            size={4}
            speed={0.5}
            color={egg.colors[1]}
          />
        </>
      )}

      <Billboard position={[0, STAND_TOP + EGG_HEIGHT + 1.3, 0]}>
        <Label
          lines={
            owned
              ? [
                  { text: pet.name, scale: 1.2 },
                  { text: `x${formatBonus(pet.winsBonus)} Wins`, icon: 'trophy', fill: GOLD },
                  { text: equipped ? 'Following you' : 'Tap E to summon', scale: 0.85 },
                ]
              : [
                    ...(egg.vip ? [{ text: 'VIP', scale: 0.75, fill: GEM }] : []),
                    { text: egg.name, scale: 1.2 },
                    { text: `${formatNumber(egg.cost)} Wins`, icon: 'trophy', fill: GOLD },
                    { text: `Pet: x${formatBonus(pet.winsBonus)} Wins`, scale: 0.85, fill: '#9ff5c0' },
                  ]
          }
          position={[0, 0, 0]}
          size={[3.6, egg.vip && !owned ? 2.4 : 2]}
          style={{ width: 512 }}
        />
      </Billboard>

      <RigidBody type="fixed" colliders={false}>
        {/* Solid stand and egg, plus a wider sensor for walking up to it. */}
        <CuboidCollider args={[1.1, 1.6, 1.1]} position={[0, 1.6, 0]} />
        <CuboidCollider
          sensor
          args={[2, 1, 2]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>

      {inRange &&
        (owned ? (
          <InteractPrompt
            position={[0, 1.8, 0]}
            action={equipped ? 'Dismiss' : 'Summon'}
            title={pet.name}
            detail={`🏆 x${formatBonus(pet.winsBonus)} Wins`}
            tone={equipped ? 'done' : 'normal'}
          />
        ) : (
          <InteractPrompt
            position={[0, 1.8, 0]}
            action="Hatch"
            title={egg.name}
            detail={`🏆 ${formatNumber(egg.cost)} Wins  ·  pet x${formatBonus(pet.winsBonus)}`}
          />
        ))}
    </group>
  )
}

export default EggStand
