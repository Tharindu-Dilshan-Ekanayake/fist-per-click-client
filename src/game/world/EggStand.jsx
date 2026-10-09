import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, ConeGeometry, SphereGeometry, Vector3 } from 'three'

import { formatBonus, formatNumber } from '../format'
import { useGame } from '../gameStore'
import { getPet } from '../pets'
import { Label, Sparkle } from './Effects'
import { geometry, merge } from './geometry'
import InteractPrompt from './InteractPrompt'
import { radialGlowTexture, shade } from './textures'
import { PetModel } from './PetModel'

/** The egg's height, and its half-width at the widest. */
const EGG_HEIGHT = 2.6
const EGG_R = 0.92
const STAND_TOP = 0.42
const LIFT = 0.25
const GOLD = ['#fff6a8', '#ffc21a']
const GEM = ['#d6f6ff', '#2fa8ff']

/**
 * A smooth, glossy egg: a sphere drawn out tall and narrowed towards the top, with
 * spots of its second colour set into the shell and a zig-zag band round its waist.
 * The shapes are the same for every egg, so they are built once.
 */
const eggParts = () =>
  geometry('egg-smooth', () => {
    const shell = new SphereGeometry(1, 36, 28)
    const pos = shell.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      const k = y > 0 ? 1 - 0.24 * y : 1 - 0.03 * y * y
      pos.setXYZ(i, pos.getX(i) * EGG_R * k, y * (EGG_HEIGHT / 2), pos.getZ(i) * EGG_R * k)
    }
    shell.translate(0, EGG_HEIGHT / 2, 0)
    shell.computeVertexNormals()

    const spots = []
    const at = (angle, y, r) => {
      const h = y / (EGG_HEIGHT / 2) - 1
      const k = (h > 0 ? 1 - 0.24 * h : 1 - 0.03 * h * h) * EGG_R * Math.sqrt(Math.max(0, 1 - h * h))
      const g = new SphereGeometry(r, 16, 12)
      g.scale(1, 1, 0.35)
      g.lookAt(new Vector3(Math.sin(angle), 0, Math.cos(angle)))
      g.translate(Math.sin(angle) * k, y, Math.cos(angle) * k)
      spots.push(g)
    }
    for (let i = 0; i < 6; i++) at((i / 6) * Math.PI * 2, 1.75, 0.2)
    for (let i = 0; i < 5; i++) at((i / 5) * Math.PI * 2 + 0.6, 0.62, 0.16)
    // The waist band: a ring of little triangles all the way round.
    const band = []
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2
      const g = new ConeGeometry(0.13, 0.26, 3)
      g.rotateX(i % 2 ? Math.PI : 0)
      g.scale(1, 1, 0.3)
      g.lookAt(new Vector3(Math.sin(a), 0, Math.cos(a)))
      const r = EGG_R * 0.985
      g.translate(Math.sin(a) * r, 1.2, Math.cos(a) * r)
      band.push(g)
    }
    return [shell, merge([...spots, ...band])]
  })

function EggModel({ egg }) {
  const glow = egg.glow ?? 0
  const parts = eggParts()
  return (
    <group>
      {parts.map((part, i) => (
        <mesh key={i} geometry={part} castShadow>
          <meshPhysicalMaterial
            color={egg.colors[i]}
            emissive={egg.colors[i]}
            emissiveIntensity={glow * 0.6}
            roughness={0.3}
            clearcoat={0.8}
            clearcoatRoughness={0.2}
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
    <group position={position} name="eggstand">
      <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.5, 1.7, 0.3, 24]} />
        <meshStandardMaterial color={shade(egg.colors[1], -0.35)} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[1.25, 1.35, 0.12, 24]} />
        <meshStandardMaterial color={egg.colors[0]} emissive={egg.colors[0]} emissiveIntensity={0.4} />
      </mesh>

      <>
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
      </>

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
