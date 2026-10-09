import { useFrame } from '@react-three/fiber'
import { createContext, useContext, useMemo, useRef } from 'react'

import { unitBox, unitSpike } from './geometry'
import { radialGlowTexture, shade } from './textures'

/** Footstep dust puffs fade out over this long. */
const DUST_LIFE_S = 1
/** The ring that snaps out from under a footfall is quicker than the dust. */
const RING_LIFE_S = 0.5

/** The pet's emissive strength, so every voxel below picks it up without the
 *  whole rig having to thread `glow` through a hundred call sites. */
const GlowContext = createContext(0)

/** The one coat material: flat-shaded, so each cube facet reads as its own plane. */
function VoxelMaterial({ color, roughness = 0.42 }) {
  const glow = useContext(GlowContext)
  return (
    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={glow} roughness={roughness} flatShading />
  )
}

/** One voxel slab. Boxes are most of the vocabulary here, so this earns its keep. */
function Box({ position, rotation, scale, color, roughness, shadow = true }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} geometry={unitBox()} castShadow={shadow}>
      <VoxelMaterial color={color} roughness={roughness} />
    </mesh>
  )
}

/** A 4-sided pyramid - ears, fur spikes, horns and claws are all made of these. */
function Spike({ position, rotation, scale, color, shadow = false }) {
  return (
    <mesh position={position} rotation={rotation} scale={scale} geometry={unitSpike()} castShadow={shadow}>
      <VoxelMaterial color={color} roughness={0.5} />
    </mesh>
  )
}

/**
 * Every pet is a different animal, and this is the whole of the difference: body
 * proportions, where the head sits, how long the legs are, which ears and tail it
 * wears, the extras bolted on (horns, wings, antlers, back plates) and how it
 * moves. PetModel reads one of these and builds the rest.
 *
 * Lengths are in model units with the feet at y = 0, facing +Z.
 *
 * gait.mode: 'trot' (four legs, diagonal pairs) or 'hop' (rabbit, both back legs
 * together with an arc through the air). `rate` is [idle, extra at full speed].
 */
const SPECIES = {
  /** Small, round and springy, with the ears of a jackrabbit. */
  rabbit: {
    scale: 0.95,
    body: { size: [0.38, 0.36, 0.42], y: 0.34, z: -0.04 },
    chest: { size: [0.4, 0.3, 0.2], y: 0.32, z: 0.16 },
    head: { size: [0.34, 0.32, 0.3], y: 0.62, z: 0.2 },
    snout: { size: [0.16, 0.12, 0.12] },
    legs: { x: 0.14, hip: 0.19, len: 0.16, thick: 0.11, front: 0.16, back: -0.15, backPaw: 1.6 },
    ears: 'long',
    tail: 'puff',
    ruff: 0.5,
    whiskers: true,
    gait: { mode: 'hop', swing: 0.9, bounce: 0.2, rate: [3.4, 3.6] },
  },
  /** Blocky and friendly: floppy ears, a tail that never stops. */
  dog: {
    scale: 1,
    body: { size: [0.44, 0.38, 0.56], y: 0.38, z: -0.04 },
    chest: { size: [0.46, 0.32, 0.22], y: 0.36, z: 0.2 },
    head: { size: [0.4, 0.36, 0.36], y: 0.66, z: 0.38 },
    snout: { size: [0.22, 0.16, 0.2] },
    legs: { x: 0.18, hip: 0.22, len: 0.2, thick: 0.12, front: 0.22, back: -0.2 },
    ears: 'floppy',
    tail: 'wag',
    ruff: 0.7,
    gait: { mode: 'trot', swing: 0.6, bounce: 0.06, rate: [5, 6] },
  },
  /** Long, low and slinky, with a tail that curls at the tip. */
  cat: {
    scale: 0.94,
    body: { size: [0.34, 0.31, 0.58], y: 0.42, z: -0.04 },
    chest: { size: [0.36, 0.26, 0.22], y: 0.4, z: 0.2 },
    head: { size: [0.33, 0.3, 0.29], y: 0.64, z: 0.36 },
    snout: { size: [0.16, 0.12, 0.12] },
    legs: { x: 0.14, hip: 0.27, len: 0.25, thick: 0.09, front: 0.22, back: -0.2 },
    ears: 'cat',
    tail: 'long',
    ruff: 0.3,
    whiskers: true,
    gait: { mode: 'trot', swing: 0.45, bounce: 0.035, rate: [4.4, 5.6] },
  },
  /** The only two-legged one: heavy tail out back, tiny arms, plates down the spine. */
  dino: {
    scale: 1,
    body: { size: [0.46, 0.48, 0.54], y: 0.56, z: -0.02 },
    chest: { size: [0.42, 0.34, 0.24], y: 0.52, z: 0.2 },
    head: { size: [0.42, 0.36, 0.42], y: 0.94, z: 0.3 },
    snout: { size: [0.3, 0.2, 0.26] },
    legs: { x: 0.18, hip: 0.34, len: 0.32, thick: 0.17, back: -0.06, biped: true },
    ears: 'none',
    tail: 'heavy',
    backSpikes: true,
    fangs: true,
    arms: true,
    gait: { mode: 'trot', swing: 0.55, bounce: 0.1, rate: [3.6, 4.4] },
  },
  /** Low-slung, huge ears, and the biggest brush of a tail in the game. */
  fox: {
    scale: 0.95,
    body: { size: [0.42, 0.34, 0.58], y: 0.34, z: -0.04 },
    chest: { size: [0.44, 0.3, 0.22], y: 0.32, z: 0.2 },
    head: { size: [0.4, 0.34, 0.34], y: 0.58, z: 0.38 },
    snout: { size: [0.18, 0.13, 0.26] },
    legs: { x: 0.16, hip: 0.19, len: 0.17, thick: 0.1, front: 0.22, back: -0.2 },
    ears: 'fox',
    tail: 'bush',
    ruff: 1,
    gait: { mode: 'trot', swing: 0.62, bounce: 0.055, rate: [5.2, 6.4] },
  },
  /** Broad, heavy and humped at the shoulder; rolls along rather than trots. */
  bear: {
    scale: 1.05,
    body: { size: [0.58, 0.48, 0.66], y: 0.46, z: -0.04 },
    chest: { size: [0.56, 0.4, 0.24], y: 0.44, z: 0.24 },
    head: { size: [0.42, 0.38, 0.36], y: 0.74, z: 0.4 },
    snout: { size: [0.26, 0.18, 0.18] },
    legs: { x: 0.22, hip: 0.26, len: 0.24, thick: 0.18, front: 0.24, back: -0.24 },
    ears: 'round',
    tail: 'stub',
    hump: true,
    ruff: 0.4,
    gait: { mode: 'trot', swing: 0.38, bounce: 0.07, rate: [3.2, 3.8] },
  },
  /** Horns, bat wings and a spade tail, head carried high on a short neck. */
  dragon: {
    scale: 1,
    body: { size: [0.44, 0.4, 0.54], y: 0.5, z: -0.04 },
    chest: { size: [0.42, 0.34, 0.22], y: 0.46, z: 0.2 },
    head: { size: [0.38, 0.34, 0.4], y: 0.92, z: 0.34 },
    snout: { size: [0.24, 0.16, 0.24] },
    neck: { size: [0.24, 0.26, 0.24], y: 0.74, z: 0.26 },
    legs: { x: 0.18, hip: 0.28, len: 0.26, thick: 0.13, front: 0.2, back: -0.2 },
    ears: 'horns',
    tail: 'spade',
    backSpikes: true,
    wings: true,
    fangs: true,
    gait: { mode: 'trot', swing: 0.5, bounce: 0.09, rate: [4.4, 5.4] },
  },
  /** Tall and thin-legged, antlers up top, a white flag of a tail. */
  deer: {
    scale: 1,
    body: { size: [0.36, 0.34, 0.56], y: 0.62, z: -0.04 },
    chest: { size: [0.38, 0.3, 0.22], y: 0.6, z: 0.2 },
    head: { size: [0.28, 0.26, 0.34], y: 1.02, z: 0.34 },
    snout: { size: [0.18, 0.14, 0.14] },
    neck: { size: [0.19, 0.34, 0.2], y: 0.84, z: 0.26 },
    legs: { x: 0.15, hip: 0.46, len: 0.44, thick: 0.075, front: 0.2, back: -0.2, hooves: true },
    ears: 'deer',
    tail: 'flick',
    antlers: true,
    gait: { mode: 'trot', swing: 0.72, bounce: 0.075, rate: [4.6, 6] },
  },
  /** Longer and leggier than the fox, with a thick mane and a straight brush tail. */
  wolf: {
    scale: 1.02,
    body: { size: [0.46, 0.4, 0.66], y: 0.48, z: -0.04 },
    chest: { size: [0.48, 0.34, 0.24], y: 0.46, z: 0.24 },
    head: { size: [0.4, 0.35, 0.38], y: 0.76, z: 0.44 },
    snout: { size: [0.2, 0.15, 0.24] },
    legs: { x: 0.18, hip: 0.3, len: 0.28, thick: 0.12, front: 0.26, back: -0.24 },
    ears: 'wolf',
    tail: 'brush',
    mane: true,
    ruff: 0.8,
    fangs: true,
    gait: { mode: 'trot', swing: 0.66, bounce: 0.06, rate: [4.8, 6.2] },
  },
  /** A horse silhouette: long muzzle, hooves, a flowing mane, wings and the horn. */
  unicorn: {
    scale: 1.02,
    body: { size: [0.44, 0.42, 0.64], y: 0.58, z: -0.04 },
    // Never the same width as the body, or their side faces z-fight.
    chest: { size: [0.46, 0.36, 0.22], y: 0.56, z: 0.24 },
    head: { size: [0.26, 0.28, 0.42], y: 1.04, z: 0.42 },
    snout: { size: [0.2, 0.18, 0.14] },
    neck: { size: [0.22, 0.36, 0.24], y: 0.84, z: 0.3 },
    legs: { x: 0.17, hip: 0.44, len: 0.42, thick: 0.1, front: 0.24, back: -0.24, hooves: true },
    ears: 'horse',
    tail: 'flow',
    horn: true,
    mane: true,
    wings: true,
    gait: { mode: 'trot', swing: 0.7, bounce: 0.08, rate: [4.6, 6] },
  },
}

/**
 * A companion animal, built entirely from boxes and 4-sided pyramids — chunky
 * voxel critters in the same procedural style as EggStand's voxel egg and
 * SwordModel's blocky blade, with no external model files. Everything is
 * flat-shaded so the cube facets read cleanly.
 *
 * `pet.species` (see SPECIES above, and pets.js) picks the animal: a rabbit, dog,
 * cat, dino, fox, bear, dragon, deer, wolf or unicorn, each with its own
 * proportions, ears, tail, extras and way of moving. `pet.colors` paints it and
 * `pet.glow` sets how much it shines.
 *
 * With `walkRef` (a `{ current: { speed } }` updated every frame by the caller,
 * same idea as the player avatar's `motionRef`) it comes alive: the legs swing
 * from the hip, the body bounces and squashes on each footfall, the head nods a
 * beat behind it, the ears and tail swing later still, and a puff of dust plus a
 * quick ring kicks up from under each step. The rabbit hops instead, arcing
 * through the air with its back legs tucked. Standing still, it breathes, sways
 * its tail and flicks an ear now and then.
 *
 * @param {{ pet: object, walkRef?: React.MutableRefObject<{ speed: number }> }} props
 */
export function PetModel({ pet, walkRef }) {
  const { colors, glow = 0 } = pet
  const s = SPECIES[pet.species] ?? SPECIES.dog

  const bounceRef = useRef(null)
  const leanRef = useRef(null)
  const headRef = useRef(null)
  const tailRef = useRef(null)
  const wingRefs = useRef([])
  const legRefs = useRef([])
  const earRefs = useRef([])
  const dustRef = useRef(null)
  const ringRef = useRef(null)
  const phase = useRef(0)
  const step = useRef({ beat: 0, dust: DUST_LIFE_S, ring: RING_LIFE_S })

  /** Hips, in the order the refs are collected. `sign` picks which legs swing together. */
  const legs = useMemo(() => {
    const { x, front, back, biped } = s.legs
    if (biped) {
      return [
        { x, z: back, sign: 1 },
        { x: -x, z: back, sign: -1 },
      ]
    }
    return [
      { x, z: front, sign: 1 },
      { x: -x, z: front, sign: -1 },
      { x, z: back, sign: -1 },
      { x: -x, z: back, sign: 1 },
    ]
  }, [s])

  // Everything below hangs off the head cube, so derive it once rather than
  // repeating half-depths at every call site.
  const headHalf = s.head.size[2] / 2
  const headTop = s.head.size[1] / 2
  const snoutZ = headHalf + s.snout.size[2] / 2 - 0.02
  const noseZ = snoutZ + s.snout.size[2] / 2
  /** The face plate's front surface: where the eyes and blush are pinned. */
  const faceZ = headHalf + 0.01
  const tailBase = [0, s.body.y + s.body.size[1] * 0.1, s.body.z - s.body.size[2] / 2]
  // Eyes clear the muzzle rather than sinking into it, which matters on the
  // broad-snouted species (dino, bear, dragon, unicorn): sit them above its top
  // edge, and out towards the cheeks but never past the side of the head.
  const muzzleTop = -s.head.size[1] * 0.14 + s.snout.size[1] / 2
  const eyeY = Math.max(s.head.size[1] * 0.14, muzzleTop + 0.055)
  const eyeX = Math.min(
    Math.max(s.head.size[0] * 0.27, s.snout.size[0] / 2 + 0.05),
    s.head.size[0] / 2 - 0.045,
  )
  // The collar rides the neck where there is one, otherwise the base of the head.
  const collar = s.neck
    ? { y: s.neck.y - s.neck.size[1] * 0.25, z: s.neck.z, size: [s.neck.size[0] * 1.35, 0.08, s.neck.size[2] * 1.3] }
    : { y: s.head.y - headTop + 0.02, z: s.head.z, size: [s.head.size[0] * 1.1, 0.08, s.head.size[2] * 0.95] }
  /** Tips of tails and fur: a darker take on the coat. */
  const furTip = shade(colors.accent, -0.45)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const speed = walkRef?.current?.speed ?? 0
    const moving = Math.min(speed / 4, 1)
    const [idleRate, gainRate] = s.gait.rate
    phase.current += delta * (idleRate + moving * gainRate)
    const p = phase.current
    const hopping = s.gait.mode === 'hop'

    // One "stride" is a full turn of `phase`. A trot plants a foot twice a turn,
    // a hop lands once - `strike` is 1 at the moment of a footfall, 0 mid-air.
    const strike = hopping ? Math.max(0, -Math.sin(p)) : Math.abs(Math.sin(p))
    const lift = hopping ? Math.max(0, Math.sin(p)) : strike

    legRefs.current.forEach((leg, i) => {
      if (!leg) return
      if (hopping) {
        // Back legs tuck up under the body, front legs reach ahead.
        const front = legs[i].z > 0
        leg.rotation.x = (front ? 1 : -1) * lift * s.gait.swing * moving
      } else {
        leg.rotation.x = moving > 0.03 ? Math.sin(p * legs[i].sign) * s.gait.swing * moving : 0
      }
    })

    if (bounceRef.current) {
      const bounce = lift * s.gait.bounce * moving
      bounceRef.current.position.y = bounce
      // Squash on the landing, stretch through the air: the whole reason a blocky
      // walk reads as weight rather than a slide.
      const squash = hopping ? lift * 0.12 : strike * 0.07
      const breathe = Math.sin(t * 1.6) * 0.015 * (1 - moving)
      bounceRef.current.scale.set(1 + squash * 0.5 + breathe * 0.5, 1 - squash + breathe, 1 + squash * 0.5 + breathe * 0.5)
    }

    if (leanRef.current) {
      // Nose up on the way up, down on the way down - strongest on the hop.
      leanRef.current.rotation.x = hopping
        ? -Math.sin(p) * 0.3 * moving
        : Math.sin(p * 2) * 0.05 * moving
    }

    if (headRef.current) {
      // The head trails the body by a beat, and sways gently when idle.
      headRef.current.rotation.x = Math.sin(p * 2 + 0.8) * 0.1 * moving + Math.sin(t * 1.3) * 0.03 * (1 - moving)
      headRef.current.rotation.y = Math.sin(t * 0.8) * 0.12 * (1 - moving)
    }

    // An ear flick every few seconds while standing around, and a swing in step
    // with the body once moving.
    const flick = Math.max(0, Math.sin(t * 0.8) - 0.985) * 40
    earRefs.current.forEach((ear, i) => {
      if (!ear) return
      // Each pair is already tilted by its style (horns sweep back, floppy ears
      // hang forward), so swing around that rather than flattening it to zero.
      if (ear.userData.restX === undefined) ear.userData.restX = ear.rotation.x
      const side = i % 2 === 0 ? 1 : -1
      ear.rotation.x = ear.userData.restX + Math.sin(p * 2 + 1.3) * 0.22 * moving + flick * side * 0.3 * (1 - moving)
    })

    if (tailRef.current) {
      tailRef.current.rotation.y = moving > 0.03 ? Math.sin(p * 1.6) * 0.5 : Math.sin(t * 1.6) * 0.22
      tailRef.current.rotation.x = Math.sin(p * 2 + 2) * 0.12 * moving
    }

    wingRefs.current.forEach((wing, i) => {
      if (!wing) return
      const side = i === 0 ? 1 : -1
      wing.rotation.z = side * (0.3 + Math.sin(t * 4 + moving * 6) * (0.15 + moving * 0.25))
    })

    // A puff of dust and a ring each time a stride lands, same beat detector the
    // player uses for footstep sounds.
    const d = step.current
    const beat = Math.floor(p / Math.PI - 0.5)
    if (moving > 0.1 && beat !== d.beat) {
      d.beat = beat
      d.dust = 0
      d.ring = 0
    } else {
      d.dust = Math.min(DUST_LIFE_S, d.dust + delta)
      d.ring = Math.min(RING_LIFE_S, d.ring + delta)
    }
    if (dustRef.current) {
      const age = d.dust / DUST_LIFE_S
      dustRef.current.visible = age < 1
      if (age < 1) {
        dustRef.current.scale.setScalar(0.18 + age * 0.3)
        dustRef.current.material.opacity = (1 - age) * 0.45
      }
    }
    if (ringRef.current) {
      const age = d.ring / RING_LIFE_S
      ringRef.current.visible = age < 1
      if (age < 1) {
        ringRef.current.scale.setScalar(0.2 + age * 0.85)
        ringRef.current.material.opacity = (1 - age) * (1 - age) * 0.5
      }
    }
  })

  return (
    <GlowContext.Provider value={glow}>
      <group scale={s.scale * (1 + glow * 0.1)}>
        {/* Footfall marks, flat on the ground and outside the bounce so they stay put. */}
        <mesh ref={ringRef} position={[0, 0.012, 0.02]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.62, 1, 20]} />
          <meshBasicMaterial color={glow > 0 ? colors.accent : '#ffffff'} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh ref={dustRef} position={[0, 0.015, 0.04]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            map={radialGlowTexture()}
            color={glow > 0 ? colors.accent : '#e8e2d8'}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        {/* A gem floating over the top-tier pets. */}
        {glow >= 0.6 && (
          <mesh position={[0, s.head.y + s.head.size[1] * 0.8, s.head.z]} rotation={[0, Math.PI / 4, 0]} scale={0.055} castShadow>
            <octahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#ffffff" emissive={colors.accent} emissiveIntensity={0.9} roughness={0.1} metalness={0.4} />
          </mesh>
        )}

        <group ref={bounceRef}>
          {/* Legs - a pivot at the hip, so the blocky foot below can swing. */}
          {legs.map(({ x, z }, i) => (
            <group key={i} position={[x, s.legs.hip, z]} ref={(el) => (legRefs.current[i] = el)}>
              <Box
                position={[0, -s.legs.len / 2, 0]}
                scale={[s.legs.thick, s.legs.len, s.legs.thick]}
                color={colors.accent}
              />
              {s.legs.hooves ? (
                <Box
                  position={[0, -s.legs.len - 0.03, 0]}
                  scale={[s.legs.thick * 1.25, 0.07, s.legs.thick * 1.25]}
                  color={furTip}
                  roughness={0.3}
                />
              ) : (
                <Box
                  position={[0, -s.legs.len - 0.025, 0.01]}
                  scale={[
                    s.legs.thick * 1.2 * (z < 0 ? (s.legs.backPaw ?? 1) : 1),
                    0.06,
                    s.legs.thick * 1.3 * (z < 0 ? (s.legs.backPaw ?? 1) : 1),
                  ]}
                  color={shade(colors.accent, -0.3)}
                  roughness={0.55}
                />
              )}
            </group>
          ))}

          <group ref={leanRef}>
            {/* Body, chest and underside. */}
            <Box position={[0, s.body.y, s.body.z]} scale={s.body.size} color={colors.body} />
            <Box position={[0, s.chest.y, s.chest.z]} scale={s.chest.size} color={colors.belly} roughness={0.5} />
            <Box
              position={[0, s.body.y - s.body.size[1] * 0.34, s.body.z]}
              scale={[s.body.size[0] * 0.86, s.body.size[1] * 0.34, s.body.size[2] * 0.8]}
              color={colors.belly}
              roughness={0.5}
              shadow={false}
            />
            {/* A flat highlight facet along the top of the back - the "toy shelf" shine. */}
            <Box
              position={[s.body.size[0] * 0.2, s.body.y + s.body.size[1] / 2 + 0.005, s.body.z]}
              scale={[s.body.size[0] * 0.34, 0.02, s.body.size[2] * 0.5]}
              color="#ffffff"
              roughness={0.2}
              shadow={false}
            />

            {/* A humped shoulder, for the bear. */}
            {s.hump && (
              <Box
                position={[0, s.body.y + s.body.size[1] * 0.42, s.body.z + s.body.size[2] * 0.2]}
                scale={[s.body.size[0] * 0.72, s.body.size[1] * 0.3, s.body.size[2] * 0.4]}
                color={colors.body}
              />
            )}

            {/* Shaggy fur down the spine, as much of it as the species wears. */}
            {s.ruff > 0 &&
              [0.3, 0.1, -0.1, -0.3].map((f, i) => (
                <Spike
                  key={i}
                  position={[0, s.body.y + s.body.size[1] / 2 + 0.03, s.body.z + s.body.size[2] * f]}
                  scale={[0.1 * s.ruff, 0.16 * s.ruff, 0.1 * s.ruff]}
                  color={colors.belly}
                  shadow
                />
              ))}

            {/* A thick mane around the shoulders. */}
            {s.mane &&
              [-0.9, -0.45, 0, 0.45, 0.9].map((a, i) => (
                <Box
                  key={i}
                  position={[
                    Math.sin(a) * s.body.size[0] * 0.55,
                    s.body.y + s.body.size[1] * 0.45 + Math.cos(a) * 0.08,
                    s.body.z + s.body.size[2] * 0.42,
                  ]}
                  rotation={[0, 0, -a]}
                  scale={[0.1, 0.2, 0.14]}
                  color={colors.accent}
                  roughness={0.5}
                />
              ))}

            {/* Plates down the back. */}
            {s.backSpikes &&
              [0.34, 0.14, -0.06, -0.26].map((f, i) => (
                <Spike
                  key={i}
                  position={[0, s.body.y + s.body.size[1] / 2 + 0.05, s.body.z + s.body.size[2] * f]}
                  rotation={[0, Math.PI / 4, 0]}
                  scale={[0.07, 0.2 - i * 0.025, 0.07]}
                  color={colors.accent}
                  shadow
                />
              ))}

            {/* Tiny arms, for the dino. */}
            {s.arms &&
              [1, -1].map((side) => (
                <group key={side} position={[side * s.body.size[0] * 0.5, s.body.y + 0.04, s.body.z + 0.18]}>
                  <Box rotation={[0.5, 0, 0]} scale={[0.07, 0.16, 0.07]} color={colors.accent} />
                  <Box position={[0, -0.09, 0.05]} scale={[0.06, 0.05, 0.08]} color={furTip} roughness={0.5} />
                </group>
              ))}

            {/* Wings - flat voxel slabs, pivoted at the shoulder so they can beat. */}
            {s.wings &&
              [1, -1].map((side, i) => (
                <group
                  key={side}
                  ref={(el) => (wingRefs.current[i] = el)}
                  position={[side * s.body.size[0] * 0.45, s.body.y + s.body.size[1] * 0.36, s.body.z - s.body.size[2] * 0.1]}
                >
                  <Box position={[side * 0.13, 0.02, -0.08]} scale={[0.24, 0.05, 0.26]} color={colors.accent} roughness={0.3} />
                  <Box position={[side * 0.29, 0.07, -0.17]} scale={[0.16, 0.04, 0.2]} color={colors.belly} roughness={0.3} />
                  <Spike
                    position={[side * 0.4, 0.12, -0.24]}
                    rotation={[0, 0, side * -1.2]}
                    scale={[0.1, 0.14, 0.1]}
                    color={colors.accent}
                  />
                </group>
              ))}

            {/* Patches on the coat. */}
            {pet.spots &&
              [
                [s.body.size[0] / 2, s.body.y + 0.04, s.body.z + 0.12, [0.02, 0.13, 0.14]],
                [-s.body.size[0] / 2, s.body.y - 0.02, s.body.z - 0.14, [0.02, 0.13, 0.14]],
                [0, s.body.y + s.body.size[1] / 2, s.body.z - 0.2, [0.14, 0.02, 0.13]],
              ].map(([x, y, z, scale], i) => (
                <Box key={i} position={[x, y, z]} scale={scale} color={colors.accent} roughness={0.45} shadow={false} />
              ))}

            {/* A neck, on the species that carry their head up high. */}
            {s.neck && <Box position={[0, s.neck.y, s.neck.z]} scale={s.neck.size} color={colors.body} />}

            {/* Collar - a flat voxel band, with a little tag hanging off the front. */}
            <Box position={[0, collar.y, collar.z]} scale={collar.size} color={colors.accent} roughness={0.35} />
            <mesh
              position={[0, collar.y - 0.07, collar.z + collar.size[2] / 2 - 0.02]}
              rotation={[0, 0, Math.PI / 4]}
              scale={0.05}
              castShadow
            >
              <boxGeometry args={[1, 1, 0.3]} />
              <meshStandardMaterial color="#ffe066" roughness={0.2} metalness={0.3} flatShading />
            </mesh>

            {/* Head, and everything that hangs off it. */}
            <group ref={headRef} position={[0, s.head.y, s.head.z]}>
              <Box scale={s.head.size} color={colors.body} />
              {/* Pale face plate, standing just proud of the front of the cube. */}
              <Box
                position={[0, -s.head.size[1] * 0.08, headHalf + 0.005 - (s.head.size[2] * 0.42) / 2]}
                scale={[s.head.size[0] * 0.86, s.head.size[1] * 0.72, s.head.size[2] * 0.42]}
                color={colors.belly}
                roughness={0.5}
              />
              {/* Muzzle and nose. */}
              <Box
                position={[0, -s.head.size[1] * 0.14, snoutZ]}
                scale={s.snout.size}
                color={colors.belly}
                roughness={0.5}
              />
              <Box
                position={[0, -s.head.size[1] * 0.08, noseZ]}
                scale={[s.snout.size[0] * 0.45, s.snout.size[1] * 0.4, 0.05]}
                color={shade(colors.eye, -0.2)}
                roughness={0.3}
              />
              {/* Fangs poking out of the jaw. */}
              {s.fangs &&
                [1, -1].map((side) => (
                  <Spike
                    key={side}
                    position={[side * s.snout.size[0] * 0.28, -s.head.size[1] * 0.26, snoutZ + s.snout.size[2] * 0.2]}
                    rotation={[Math.PI, 0, 0]}
                    scale={[0.035, 0.08, 0.035]}
                    color="#ffffff"
                  />
                ))}
              {/* Whiskers */}
              {s.whiskers &&
                [1, -1].flatMap((side) =>
                  [-0.04, 0.03].map((dy, i) => (
                    <Box
                      key={`${side}-${i}`}
                      position={[side * s.head.size[0] * 0.42, -s.head.size[1] * 0.12 + dy, faceZ - 0.02]}
                      rotation={[0, 0, side * 0.12]}
                      scale={[0.16, 0.012, 0.012]}
                      color="#ffffff"
                      roughness={0.4}
                      shadow={false}
                    />
                  )),
                )}
              {/* Cheek tufts, for the fluffier species. */}
              {s.ruff >= 0.5 &&
                [1, -1].map((side) => (
                  <Spike
                    key={side}
                    position={[side * s.head.size[0] * 0.52, -s.head.size[1] * 0.1, -0.02]}
                    rotation={[0, 0, side * 1.35]}
                    scale={[0.08, 0.17, 0.08]}
                    color={colors.belly}
                  />
                ))}
              {/* Blush - a flat pixel square on the side of each cheek, where no
                  muzzle can ever swallow it. */}
              {[1, -1].map((side) => (
                <mesh
                  key={side}
                  position={[side * (s.head.size[0] / 2 + 0.005), eyeY - 0.07, faceZ - 0.06]}
                  scale={[0.01, 0.05, 0.075]}
                  geometry={unitBox()}
                >
                  <meshStandardMaterial color={colors.accent} transparent opacity={0.55} roughness={0.6} flatShading />
                </mesh>
              ))}
              {/* Eyes - blocky pixels with a highlight square each. */}
              {[1, -1].map((side) => (
                <group key={side} position={[side * eyeX, eyeY, faceZ]}>
                  <mesh scale={[0.075, 0.09, 0.03]} geometry={unitBox()}>
                    <meshStandardMaterial color={colors.eye} roughness={0.15} flatShading />
                  </mesh>
                  <mesh position={[0.018, 0.022, 0.02]} scale={[0.028, 0.03, 0.02]} geometry={unitBox()}>
                    <meshStandardMaterial color="#ffffff" roughness={0.1} flatShading />
                  </mesh>
                </group>
              ))}

              {/* The horn, and the antlers, both sprouting from the top of the head. */}
              {s.horn && (
                <>
                  <Spike position={[0, headTop + 0.16, 0.06]} scale={[0.07, 0.34, 0.07]} color={colors.accent} shadow />
                  <Box position={[0, headTop + 0.08, 0.06]} scale={[0.09, 0.04, 0.09]} color={colors.belly} roughness={0.3} />
                </>
              )}
              {s.antlers &&
                [1, -1].map((side) => (
                  <group key={side} position={[side * s.head.size[0] * 0.3, headTop, -0.02]}>
                    <Box position={[0, 0.16, 0]} rotation={[0, 0, side * -0.2]} scale={[0.05, 0.32, 0.05]} color={colors.accent} />
                    <Box position={[side * 0.11, 0.26, 0]} rotation={[0, 0, side * -0.9]} scale={[0.045, 0.18, 0.045]} color={colors.accent} />
                    <Box position={[side * 0.06, 0.38, -0.06]} rotation={[0.5, 0, side * -0.4]} scale={[0.04, 0.16, 0.04]} color={colors.accent} />
                  </group>
                ))}

              {/* Ears. Each pair is collected into earRefs so they can swing and flick. */}
              {s.ears === 'long' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.38, headTop, -0.02]}
                    rotation={[0.1, 0, side * -0.1]}
                  >
                    <Box position={[0, 0.22, 0]} scale={[0.11, 0.46, 0.08]} color={colors.body} />
                    <Box position={[0, 0.2, 0.045]} scale={[0.06, 0.36, 0.02]} color={colors.accent} roughness={0.55} shadow={false} />
                  </group>
                ))}
              {s.ears === 'floppy' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.56, headTop * 0.7, -0.01]}
                    rotation={[0.2, 0, side * -0.3]}
                  >
                    <Box position={[0, -0.15, 0]} scale={[0.1, 0.3, 0.09]} color={colors.accent} roughness={0.5} />
                    <Box position={[0, -0.17, 0.05]} scale={[0.055, 0.22, 0.02]} color={shade(colors.accent, -0.3)} roughness={0.55} shadow={false} />
                  </group>
                ))}
              {s.ears === 'cat' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.32, headTop, -0.01]}
                    rotation={[0, 0, side * -0.12]}
                  >
                    <Spike position={[0, 0.07, 0]} scale={[0.11, 0.17, 0.07]} color={colors.body} shadow />
                    <Spike position={[0, 0.05, 0.03]} scale={[0.06, 0.11, 0.03]} color={colors.accent} />
                  </group>
                ))}
              {s.ears === 'fox' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.34, headTop, -0.02]}
                    rotation={[0, 0, side * -0.18]}
                  >
                    <Spike position={[0, 0.14, 0]} scale={[0.14, 0.32, 0.1]} color={colors.body} shadow />
                    <Spike position={[0, 0.11, 0.04]} scale={[0.08, 0.22, 0.04]} color={colors.belly} />
                  </group>
                ))}
              {s.ears === 'wolf' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.32, headTop, -0.03]}
                    rotation={[0, 0, side * -0.1]}
                  >
                    <Spike position={[0, 0.12, 0]} scale={[0.11, 0.28, 0.09]} color={colors.body} shadow />
                    <Spike position={[0, 0.09, 0.035]} scale={[0.06, 0.18, 0.04]} color={furTip} />
                  </group>
                ))}
              {s.ears === 'round' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.38, headTop * 0.85, -0.02]}
                  >
                    <Box scale={[0.15, 0.15, 0.08]} color={colors.body} />
                    <Box position={[0, -0.01, 0.045]} scale={[0.085, 0.085, 0.03]} color={colors.accent} roughness={0.5} shadow={false} />
                  </group>
                ))}
              {s.ears === 'deer' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.5, headTop * 0.5, -0.02]}
                    rotation={[0, side * 0.3, side * -0.9]}
                  >
                    <Box position={[side * 0.1, 0, 0]} scale={[0.19, 0.09, 0.07]} color={colors.body} />
                    <Box position={[side * 0.11, 0, 0.04]} scale={[0.13, 0.05, 0.02]} color={colors.belly} roughness={0.55} shadow={false} />
                  </group>
                ))}
              {s.ears === 'horse' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.44, headTop, -0.06]}
                    rotation={[0, 0, side * -0.2]}
                  >
                    <Spike position={[0, 0.09, 0]} scale={[0.08, 0.2, 0.07]} color={colors.body} shadow />
                    <Spike position={[0, 0.07, 0.03]} scale={[0.045, 0.13, 0.03]} color={colors.belly} />
                  </group>
                ))}
              {s.ears === 'horns' &&
                [1, -1].map((side, i) => (
                  <group
                    key={side}
                    ref={(el) => (earRefs.current[i] = el)}
                    position={[side * s.head.size[0] * 0.34, headTop * 0.8, -0.08]}
                    rotation={[-0.5, 0, side * -0.5]}
                  >
                    <Box position={[0, 0.1, 0]} scale={[0.07, 0.2, 0.07]} color={colors.accent} />
                    <Spike position={[0, 0.24, 0]} rotation={[0, 0, side * -0.3]} scale={[0.06, 0.16, 0.06]} color={colors.belly} shadow />
                  </group>
                ))}
            </group>

            {/* Tail - a pivot group at the base, so it can wag. */}
            <group position={tailBase} ref={tailRef}>
              {s.tail === 'puff' && (
                <>
                  <Box position={[0, 0.02, -0.08]} scale={[0.16, 0.16, 0.14]} color={colors.body} />
                  <Box position={[0, 0.06, -0.2]} scale={[0.22, 0.22, 0.16]} color={colors.belly} roughness={0.5} />
                </>
              )}
              {s.tail === 'wag' && (
                <>
                  <Box position={[0, 0.06, -0.1]} scale={[0.11, 0.11, 0.2]} color={colors.body} />
                  <Box position={[0, 0.2, -0.2]} scale={[0.09, 0.2, 0.12]} color={colors.body} />
                  <Box position={[0, 0.32, -0.24]} scale={[0.08, 0.12, 0.09]} color={furTip} roughness={0.5} />
                </>
              )}
              {s.tail === 'long' && (
                <>
                  <Box position={[0, 0.04, -0.1]} scale={[0.09, 0.09, 0.2]} color={colors.body} />
                  <Box position={[0, 0.16, -0.22]} scale={[0.08, 0.22, 0.09]} color={colors.body} />
                  <Box position={[0, 0.3, -0.28]} scale={[0.075, 0.12, 0.16]} color={colors.body} />
                  <Box position={[0, 0.34, -0.4]} scale={[0.07, 0.07, 0.12]} color={furTip} roughness={0.5} />
                </>
              )}
              {s.tail === 'heavy' && (
                <>
                  <Box position={[0, -0.02, -0.16]} scale={[0.26, 0.26, 0.32]} color={colors.body} />
                  <Box position={[0, -0.1, -0.44]} scale={[0.19, 0.19, 0.28]} color={colors.body} />
                  <Box position={[0, -0.17, -0.66]} scale={[0.12, 0.12, 0.2]} color={furTip} roughness={0.5} />
                </>
              )}
              {s.tail === 'bush' && (
                <>
                  <Box position={[0, 0.03, -0.14]} scale={[0.24, 0.22, 0.26]} color={colors.body} />
                  <Box position={[0, 0.09, -0.36]} scale={[0.3, 0.28, 0.24]} color={colors.accent} roughness={0.45} />
                  <Box position={[0, 0.15, -0.54]} scale={[0.24, 0.22, 0.16]} color={colors.belly} roughness={0.5} />
                </>
              )}
              {s.tail === 'brush' && (
                <>
                  <Box position={[0, 0.04, -0.14]} scale={[0.16, 0.16, 0.26]} color={colors.body} />
                  <Box position={[0, 0.1, -0.36]} scale={[0.2, 0.2, 0.26]} color={colors.body} />
                  <Box position={[0, 0.16, -0.54]} scale={[0.14, 0.14, 0.16]} color={furTip} roughness={0.5} />
                </>
              )}
              {s.tail === 'spade' && (
                <>
                  <Box position={[0, 0.0, -0.14]} scale={[0.14, 0.14, 0.26]} color={colors.body} />
                  <Box position={[0, 0.04, -0.34]} scale={[0.11, 0.11, 0.22]} color={colors.body} />
                  <Spike
                    position={[0, 0.08, -0.5]}
                    rotation={[-Math.PI / 2, 0, Math.PI / 4]}
                    scale={[0.14, 0.2, 0.14]}
                    color={colors.accent}
                    shadow
                  />
                </>
              )}
              {s.tail === 'stub' && <Box position={[0, 0.02, -0.08]} scale={[0.14, 0.14, 0.12]} color={colors.body} />}
              {s.tail === 'flick' && (
                <>
                  <Box position={[0, 0.08, -0.06]} scale={[0.09, 0.16, 0.09]} color={colors.body} />
                  <Box position={[0, 0.18, -0.06]} scale={[0.11, 0.1, 0.07]} color={colors.belly} roughness={0.5} />
                </>
              )}
              {s.tail === 'flow' &&
                [-1, 0, 1].map((i) => (
                  <Box
                    key={i}
                    position={[i * 0.08, -0.06 - Math.abs(i) * 0.04, -0.16 - Math.abs(i) * 0.03]}
                    rotation={[0.25, 0, i * 0.18]}
                    scale={[0.11, 0.42 - Math.abs(i) * 0.08, 0.14]}
                    color={i === 0 ? colors.accent : colors.belly}
                    roughness={0.45}
                  />
                ))}
              {/* Fur flaring off the tail, matching the spine. */}
              {s.ruff >= 0.7 &&
                [1, -1].map((side) => (
                  <Spike
                    key={side}
                    position={[side * 0.13, 0.06, -0.26]}
                    rotation={[0, 0, side * 1.25]}
                    scale={[0.07, 0.15, 0.07]}
                    color={colors.belly}
                  />
                ))}
            </group>
          </group>
        </group>
      </group>
    </GlowContext.Provider>
  )
}

export default PetModel
