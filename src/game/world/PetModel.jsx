import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, CapsuleGeometry, ConeGeometry, SphereGeometry, TorusGeometry } from 'three'

import { Sparkle } from './Effects'
import { geometry } from './geometry'
import { radialGlowTexture, shade } from './textures'

/**
 * The pets: round, chibi-style animals - a head as big as the body, glossy eyes with
 * a highlight, rosy cheeks - each in a boxer's headband and a pair of tiny boxing
 * gloves on its front paws, because this is a game about punching.
 *
 * Every pet is built from the same few shared shapes (a sphere, a capsule, a cone, a
 * ring) scaled into place; what makes a rabbit a rabbit and a dragon a dragon is the
 * SPECIES table below: ears, tail, horns, wings, spikes and how it moves.
 *
 * Lengths are in metres with the feet at y = 0, facing +Z. A pet stands about a
 * metre tall to the tips of its ears.
 */

const sphere = () => geometry('pet-sphere', () => new SphereGeometry(1, 24, 16))
const capsule = () => geometry('pet-capsule', () => new CapsuleGeometry(1, 1, 6, 12))
const cone = () => geometry('pet-cone', () => new ConeGeometry(1, 1, 12))
const ring = () => geometry('pet-ring', () => new TorusGeometry(1, 0.13, 8, 28))

/** Glossy, a little soft: the look of a vinyl toy. */
function Skin({ color, glow = 0, roughness = 0.45 }) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={roughness} metalness={0.02} />
}

/** One part: `kind` picks the shared shape, scaled and placed. */
function Part({ kind = 'sphere', position, rotation, scale, color, glow, roughness, shadow = true }) {
  const g = kind === 'capsule' ? capsule() : kind === 'cone' ? cone() : kind === 'ring' ? ring() : sphere()
  return (
    <mesh geometry={g} position={position} rotation={rotation} scale={scale} castShadow={shadow}>
      <Skin color={color} glow={glow} roughness={roughness} />
    </mesh>
  )
}

/**
 * What makes each animal itself.
 *
 * ears:   'long' | 'floppy' | 'pointy' | 'big' | 'round' | 'horns' | 'none'
 * tail:   'puff' | 'wag' | 'curl' | 'bush' | 'stub' | 'heavy' | 'spade' | 'mane'
 * snout:  how far the muzzle sticks out, 0..1
 * gait:   'hop' (both back feet together, an arc through the air) or 'trot'
 * extras: spikes down the back, wings, antlers, a unicorn's horn and mane, whiskers
 * size:   overall scale
 */
const SPECIES = {
  rabbit: { ears: 'long', tail: 'puff', snout: 0.45, gait: 'hop', whiskers: true, size: 0.95 },
  dog: { ears: 'floppy', tail: 'wag', snout: 0.85, gait: 'trot', size: 1 },
  cat: { ears: 'pointy', tail: 'curl', snout: 0.5, gait: 'trot', whiskers: true, size: 0.95 },
  dino: { ears: 'none', tail: 'heavy', snout: 0.9, gait: 'trot', spikes: true, size: 1.05 },
  fox: { ears: 'big', tail: 'bush', snout: 0.8, gait: 'trot', size: 0.98 },
  bear: { ears: 'round', tail: 'stub', snout: 0.85, gait: 'trot', chunky: true, size: 1.08 },
  dragon: { ears: 'horns', tail: 'spade', snout: 0.85, gait: 'trot', wings: true, spikes: true, size: 1.05 },
  deer: { ears: 'pointy', tail: 'puff', snout: 0.7, gait: 'trot', antlers: true, size: 1 },
  wolf: { ears: 'pointy', tail: 'bush', snout: 0.9, gait: 'trot', size: 1.02 },
  unicorn: { ears: 'pointy', tail: 'mane', snout: 0.75, gait: 'trot', horn: true, mane: true, size: 1.05 },
}

/** The body plan every species shares. */
const BODY = { r: [0.24, 0.22, 0.27], y: 0.34 }
const HEAD = { r: 0.27, y: 0.7, z: 0.1 }
/** The neck pivot the head nods about. */
const NECK = [0, 0.5, 0.08]
const LEGS = [
  { x: 0.13, z: 0.13, front: true, sign: 1 },
  { x: -0.13, z: 0.13, front: true, sign: -1 },
  { x: 0.13, z: -0.13, front: false, sign: -1 },
  { x: -0.13, z: -0.13, front: false, sign: 1 },
]
const HIP_Y = 0.22
const LEG_LEN = 0.12
/** How often a pet blinks, and how long a blink lasts. */
const BLINK_EVERY_S = 3.6
const BLINK_S = 0.13
/** The boxing kit: red gloves with white cuffs, and a headband. */
const GLOVE = '#ff3b3b'
const CUFF = '#ffffff'

/** Ears, in the head's frame (head centre at the origin). */
function Ears({ kind, colors, glow, earRefs }) {
  const inner = shade(colors.accent, 0.25)
  const pair = (render) =>
    [1, -1].map((side, i) => (
      <group key={side} ref={(el) => (earRefs.current[i] = el)}>
        {render(side)}
      </group>
    ))
  if (kind === 'long') {
    return pair((side) => (
      <group position={[side * 0.1, 0.2, -0.02]} rotation={[-0.1, 0, side * -0.18]}>
        <Part kind="capsule" position={[0, 0.2, 0]} scale={[0.065, 0.16, 0.045]} color={colors.body} glow={glow} />
        <Part kind="capsule" position={[0, 0.2, 0.025]} scale={[0.035, 0.12, 0.02]} color={inner} glow={glow} shadow={false} />
      </group>
    ))
  }
  if (kind === 'floppy') {
    return pair((side) => (
      <group position={[side * 0.24, 0.08, 0]} rotation={[0.15, 0, side * 0.5]}>
        <Part position={[0, -0.12, 0]} scale={[0.07, 0.15, 0.1]} color={colors.accent} glow={glow} />
      </group>
    ))
  }
  if (kind === 'pointy' || kind === 'big') {
    const big = kind === 'big' ? 1.35 : 1
    return pair((side) => (
      <group position={[side * 0.15, 0.2, 0]} rotation={[0, 0, side * -0.32]}>
        <Part kind="cone" position={[0, 0.07 * big, 0]} scale={[0.085 * big, 0.17 * big, 0.06]} color={colors.body} glow={glow} />
        <Part kind="cone" position={[0, 0.06 * big, 0.022]} scale={[0.05 * big, 0.11 * big, 0.03]} color={inner} glow={glow} shadow={false} />
      </group>
    ))
  }
  if (kind === 'round') {
    return pair((side) => (
      <group position={[side * 0.18, 0.2, -0.02]}>
        <Part scale={[0.08, 0.08, 0.05]} color={colors.accent} glow={glow} />
        <Part position={[0, 0, 0.03]} scale={[0.045, 0.045, 0.02]} color={inner} glow={glow} shadow={false} />
      </group>
    ))
  }
  if (kind === 'horns') {
    return pair((side) => (
      <group position={[side * 0.13, 0.22, -0.05]} rotation={[-0.5, 0, side * -0.25]}>
        <Part kind="cone" position={[0, 0.07, 0]} scale={[0.05, 0.16, 0.05]} color={colors.belly} glow={glow} roughness={0.3} />
      </group>
    ))
  }
  return null
}

/** The tail, in the body's frame, from a pivot at the base of the spine. */
function Tail({ kind, colors, glow }) {
  const tip = shade(colors.accent, 0.4)
  switch (kind) {
    case 'puff':
      return <Part position={[0, 0, -0.04]} scale={[0.09, 0.09, 0.09]} color={colors.belly} glow={glow} />
    case 'wag':
      return <Part kind="capsule" position={[0, 0.1, -0.06]} rotation={[-0.6, 0, 0]} scale={[0.04, 0.09, 0.04]} color={colors.body} glow={glow} />
    case 'curl':
      return (
        <>
          <Part kind="capsule" position={[0, 0.12, -0.08]} rotation={[-0.4, 0, 0]} scale={[0.035, 0.12, 0.035]} color={colors.body} glow={glow} />
          <Part position={[0, 0.27, -0.12]} scale={[0.05, 0.05, 0.05]} color={colors.accent} glow={glow} />
        </>
      )
    case 'bush':
      return (
        <>
          <Part position={[0, 0.1, -0.14]} rotation={[-0.7, 0, 0]} scale={[0.1, 0.18, 0.1]} color={colors.body} glow={glow} />
          <Part position={[0, 0.22, -0.24]} scale={[0.07, 0.08, 0.07]} color={tip} glow={glow} />
        </>
      )
    case 'stub':
      return <Part position={[0, 0.02, -0.03]} scale={[0.06, 0.06, 0.06]} color={colors.accent} glow={glow} />
    case 'heavy':
      return <Part kind="cone" position={[0, -0.02, -0.18]} rotation={[-1.75, 0, 0]} scale={[0.11, 0.38, 0.09]} color={colors.body} glow={glow} />
    case 'spade':
      return (
        <>
          <Part kind="capsule" position={[0, 0.02, -0.18]} rotation={[-1.4, 0, 0]} scale={[0.035, 0.14, 0.035]} color={colors.body} glow={glow} />
          <Part kind="cone" position={[0, 0.07, -0.37]} rotation={[-1.2, 0, Math.PI / 4]} scale={[0.08, 0.1, 0.02]} color={colors.accent} glow={glow} />
        </>
      )
    case 'mane':
      return (
        <>
          {[0, 1, 2].map((i) => (
            <Part
              key={i}
              position={[0, 0.06 - i * 0.06, -0.06 - i * 0.07]}
              scale={[0.07, 0.07, 0.07]}
              color={[colors.accent, colors.belly, '#ffffff'][i]}
              glow={glow}
            />
          ))}
        </>
      )
    default:
      return null
  }
}

/**
 * One pet, posed and animated.
 *
 * @param {{ pet: import('../pets').PETS[number], walkRef?: React.MutableRefObject<{ speed: number }> }} props
 *   `walkRef.current.speed` (m/s) drives the trot; without it the pet stands and
 *   breathes, blinks and wags.
 */
export function PetModel({ pet, walkRef }) {
  const { colors, glow = 0 } = pet
  const s = SPECIES[pet.species] ?? SPECIES.dog
  const skinGlow = glow * 0.45

  const bounceRef = useRef(null)
  const headRef = useRef(null)
  const tailRef = useRef(null)
  const eyeRefs = useRef([])
  const legRefs = useRef([])
  const earRefs = useRef([])
  const wingRefs = useRef([])
  const phase = useRef(0)
  // Each pet blinks on its own clock, from its id.
  const offset = useMemo(() => [...pet.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 7, [pet.id])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime + offset
    const speed = walkRef?.current?.speed ?? 0
    const moving = Math.min(speed / 4, 1)
    const hop = s.gait === 'hop'
    phase.current += delta * (4 + moving * (hop ? 5 : 8))
    const p = phase.current

    // Trot: legs swing in diagonal pairs. Hop: front reach, back tuck, all at once.
    const lift = hop ? Math.max(0, Math.sin(p)) : Math.abs(Math.sin(p))
    legRefs.current.forEach((leg, i) => {
      if (!leg) return
      const l = LEGS[i]
      leg.rotation.x = hop ? (l.front ? 1 : -1) * lift * 0.8 * moving : Math.sin(p * l.sign) * 0.7 * moving
    })

    if (bounceRef.current) {
      const breathe = Math.sin(t * 2.2) * 0.02 * (1 - moving)
      bounceRef.current.position.y = lift * (hop ? 0.16 : 0.05) * moving + Math.max(0, breathe) * 0.3
      const squash = (hop ? (1 - lift) * 0.08 : lift * 0.05) * moving
      bounceRef.current.scale.set(1 + squash * 0.6 + breathe * 0.5, 1 - squash + breathe, 1 + squash * 0.6 + breathe * 0.5)
      bounceRef.current.rotation.x = hop ? -Math.sin(p) * 0.25 * moving : 0
    }
    if (headRef.current) {
      headRef.current.rotation.x = Math.sin(p * 2 + 0.6) * 0.08 * moving + Math.sin(t * 1.2) * 0.04 * (1 - moving)
      // An idle look round, and a tilt now and then - the cute bit.
      headRef.current.rotation.y = Math.sin(t * 0.7) * 0.25 * (1 - moving)
      headRef.current.rotation.z = Math.sin(t * 0.45) ** 3 * 0.18 * (1 - moving)
    }
    earRefs.current.forEach((ear, i) => {
      if (!ear) return
      const side = i === 0 ? 1 : -1
      const flick = Math.max(0, Math.sin(t * 0.9 + i) - 0.97) * 12
      ear.rotation.z = side * (Math.sin(p * 2) * 0.12 * moving + flick * 0.4)
    })
    if (tailRef.current) {
      tailRef.current.rotation.y = Math.sin(t * (moving > 0.05 ? 12 : 4)) * (s.tail === 'wag' ? 0.6 : 0.3)
    }
    // Blink.
    const blink = (t % BLINK_EVERY_S) < BLINK_S ? 0.12 : 1
    eyeRefs.current.forEach((eye) => {
      if (eye) eye.scale.y = blink
    })
    wingRefs.current.forEach((wing, i) => {
      if (!wing) return
      const side = i === 0 ? 1 : -1
      wing.rotation.z = side * (0.4 + Math.sin(t * (4 + moving * 8)) * (0.25 + moving * 0.2))
    })
  })

  // Always dark eyes: a pale one reads as a blank stare, not a colour.
  const eyeColor = '#1b1b25'
  const snout = s.snout

  return (
    <group scale={s.size}>
      {/* The soft shadow-glow of the rarer pets, and their sparkle. */}
      {glow >= 0.3 && (
        <sprite position={[0, 0.55, 0]} scale={1.6}>
          <spriteMaterial map={radialGlowTexture()} color={colors.accent} transparent opacity={0.25 + glow * 0.25} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      )}
      {glow >= 0.6 && <Sparkle count={10} scale={[1, 1.1, 1]} position={[0, 0.6, 0]} size={3} speed={0.5} color={colors.accent} />}

      <group ref={bounceRef}>
        {/* Legs, from the hip; the front paws wear the gloves. */}
        {LEGS.map((leg, i) => (
          <group key={i} position={[leg.x, HIP_Y, leg.z]} ref={(el) => (legRefs.current[i] = el)}>
            <Part kind="capsule" position={[0, -LEG_LEN / 2, 0]} scale={[0.065, LEG_LEN / 2, 0.065]} color={colors.body} glow={skinGlow} />
            {leg.front ? (
              <group position={[0, -LEG_LEN - 0.02, 0.03]}>
                <Part scale={[0.085, 0.08, 0.095]} color={GLOVE} roughness={0.3} />
                <Part kind="ring" position={[0, 0.06, -0.01]} rotation={[Math.PI / 2, 0, 0]} scale={[0.062, 0.062, 0.062]} color={CUFF} shadow={false} />
              </group>
            ) : (
              <Part position={[0, -LEG_LEN - 0.02, 0.02]} scale={[0.075, 0.05, 0.09]} color={colors.accent} glow={skinGlow} />
            )}
          </group>
        ))}

        {/* Body and belly. */}
        <Part position={[0, BODY.y, 0]} scale={s.chunky ? [0.28, 0.24, 0.29] : BODY.r} color={colors.body} glow={skinGlow} />
        <Part position={[0, BODY.y - 0.03, 0.17]} scale={[0.17, 0.15, 0.11]} color={colors.belly} glow={skinGlow} shadow={false} />
        {s.spikes &&
          [0, 1, 2, 3].map((i) => (
            <Part
              key={i}
              kind="cone"
              position={[0, BODY.y + 0.2 - i * 0.02, 0.05 - i * 0.1]}
              rotation={[-0.3, 0, 0]}
              scale={[0.045, 0.09, 0.03]}
              color={colors.accent}
              glow={skinGlow}
            />
          ))}
        {s.wings &&
          [1, -1].map((side, i) => (
            <group key={side} position={[side * 0.18, BODY.y + 0.12, -0.04]} ref={(el) => (wingRefs.current[i] = el)}>
              <Part position={[side * 0.17, 0.08, 0]} rotation={[0, 0, side * 0.4]} scale={[0.2, 0.1, 0.025]} color={colors.accent} glow={skinGlow} />
              <Part position={[side * 0.26, 0.14, 0]} rotation={[0, 0, side * 0.6]} scale={[0.1, 0.05, 0.02]} color={colors.belly} glow={skinGlow} shadow={false} />
            </group>
          ))}
        <group ref={tailRef} position={[0, BODY.y + 0.02, -BODY.r[2] + 0.04]}>
          <Tail kind={s.tail} colors={colors} glow={skinGlow} />
        </group>

        {/* The head: nods about the neck. */}
        <group position={NECK}>
          <group ref={headRef}>
            <group position={[0, HEAD.y - NECK[1], HEAD.z - NECK[2]]}>
              <Part scale={[HEAD.r, HEAD.r * 0.94, HEAD.r * 0.92]} color={colors.body} glow={skinGlow} />
              {/* Muzzle and nose. */}
              <Part position={[0, -0.08, 0.2 + snout * 0.04]} scale={[0.11 + snout * 0.04, 0.08, 0.06 + snout * 0.06]} color={colors.belly} glow={skinGlow} shadow={false} />
              <Part position={[0, -0.05, 0.26 + snout * 0.09]} scale={[0.038, 0.028, 0.025]} color="#2a1a1f" roughness={0.25} shadow={false} />
              {/* Eyes: big, glossy, each with its highlight. */}
              {[1, -1].map((side, i) => (
                <group key={side} position={[side * 0.1, 0.03, 0.22]} ref={(el) => (eyeRefs.current[i] = el)}>
                  <Part scale={[0.055, 0.07, 0.04]} color={eyeColor} roughness={0.15} shadow={false} />
                  <Part position={[side * -0.012 + 0.015, 0.03, 0.03]} scale={[0.02, 0.02, 0.012]} color="#ffffff" roughness={0.1} shadow={false} />
                </group>
              ))}
              {/* Rosy cheeks. */}
              {[1, -1].map((side) => (
                <Part key={side} position={[side * 0.17, -0.07, 0.17]} rotation={[0, side * 0.6, 0]} scale={[0.045, 0.028, 0.01]} color="#ff8fb0" shadow={false} />
              ))}
              {s.whiskers &&
                [1, -1].map((side) => (
                  <Part
                    key={side}
                    kind="capsule"
                    position={[side * 0.17, -0.07, 0.24]}
                    rotation={[0, 0, Math.PI / 2 + side * 0.1]}
                    scale={[0.006, 0.07, 0.006]}
                    color="#2a1a1f"
                    shadow={false}
                  />
                ))}
              {/* The boxer's headband, its tails flying out behind. */}
              <Part kind="ring" position={[0, 0.1, -0.01]} rotation={[Math.PI / 2 - 0.15, 0, 0]} scale={[0.262, 0.262, 0.262]} color={GLOVE} roughness={0.5} shadow={false} />
              {[1, -1].map((side) => (
                <Part
                  key={side}
                  kind="capsule"
                  position={[side * 0.04, 0.06, -0.3]}
                  rotation={[-1.1, side * 0.4, 0]}
                  scale={[0.022, 0.06, 0.012]}
                  color={GLOVE}
                  shadow={false}
                />
              ))}
              <Ears kind={s.ears} colors={colors} glow={skinGlow} earRefs={earRefs} />
              {s.antlers &&
                [1, -1].map((side) => (
                  <group key={side} position={[side * 0.1, 0.24, -0.03]} rotation={[0, 0, side * -0.35]}>
                    <Part kind="capsule" position={[0, 0.1, 0]} scale={[0.02, 0.1, 0.02]} color={colors.accent} glow={skinGlow} />
                    <Part kind="capsule" position={[side * 0.05, 0.14, 0]} rotation={[0, 0, side * -0.9]} scale={[0.016, 0.05, 0.016]} color={colors.accent} glow={skinGlow} />
                  </group>
                ))}
              {s.horn && (
                <Part kind="cone" position={[0, 0.24, 0.14]} rotation={[0.5, 0, 0]} scale={[0.045, 0.2, 0.045]} color="#ffd23f" glow={0.5} roughness={0.2} />
              )}
              {s.mane &&
                [0, 1, 2, 3].map((i) => (
                  <Part
                    key={i}
                    position={[0, 0.22 - i * 0.07, -0.18 - i * 0.03]}
                    scale={[0.07, 0.07, 0.07]}
                    color={[colors.accent, colors.belly, '#ffffff', colors.accent][i]}
                    glow={skinGlow}
                  />
                ))}
            </group>
          </group>
        </group>

        {/* A gem floating over the very best. */}
        {glow >= 0.75 && (
          <mesh position={[0, 1.18, HEAD.z]} rotation={[0, Math.PI / 4, 0]} scale={0.06}>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#ffffff" emissive={colors.accent} emissiveIntensity={0.9} roughness={0.1} metalness={0.4} />
          </mesh>
        )}
      </group>
    </group>
  )
}

export default PetModel
