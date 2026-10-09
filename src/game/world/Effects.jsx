import { Sparkles } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import {
  AdditiveBlending,
  BackSide,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  IcosahedronGeometry,
  OctahedronGeometry,
  SphereGeometry,
} from 'three'


import { qualityOf, useSettings } from '../settings'
import { geometry, merge } from './geometry'
import { beamTexture, labelTexture, mulberry32, skyTexture } from './textures'

/**
 * Decorative sparkles, switched off below High graphics (see game/settings.js).
 * Every sparkle field in the game goes through this rather than reaching for
 * drei's component directly, so one setting turns the lot of them off.
 */
export function Sparkle(props) {
  const on = useSettings((s) => qualityOf(s.quality).sparkles)
  return on ? <Sparkles {...props} /> : null
}

/** Gradient sky dome that follows the camera, so it never clips at the far stages. */
export function Sky() {
  const ref = useRef(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => ref.current?.position.copy(camera.position))
  return (
    <mesh ref={ref} renderOrder={-1}>
      <sphereGeometry args={[500, 32, 16]} />
      <meshBasicMaterial
        map={skyTexture()}
        side={BackSide}
        fog={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/** Endless grass far below the map, so nothing looks like it floats over a void. */
export function Backdrop() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, -250]}>
      <planeGeometry args={[3000, 3000]} />
      <meshStandardMaterial color="#4cae45" roughness={1} />
    </mesh>
  )
}

const CLOUD_SPAN = 700
const CLOUD_COUNT = 16

/** One material for every cloud; they are all the same flat white. */
const CLOUD_MATERIAL = { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 0.35, roughness: 1 }

/**
 * Puffy clouds drifting slowly across the sky.
 *
 * Each cloud's four-to-six puffs are merged into one geometry: they never move
 * relative to each other, so drawing them separately bought nothing and cost eighty
 * draw calls in every frame of the game. Detail 1 rather than 2 on the sphere halves
 * the triangles again - at sixty metres up nobody can tell.
 */
export function Clouds() {
  const group = useRef(null)
  const clouds = useMemo(
    () =>
      geometry('clouds', () => {
        const rand = mulberry32(42)
        return Array.from({ length: CLOUD_COUNT }, () => {
          const position = [(rand() - 0.5) * CLOUD_SPAN, 60 + rand() * 35, -650 + rand() * 850]
          const puffs = Array.from({ length: 4 + Math.floor(rand() * 3) }, (_, i) => {
            const radius = 6 + rand() * 5
            const g = new IcosahedronGeometry(1, 1)
            g.scale(radius, radius * 0.6, radius)
            g.translate(i * 7 - 10 + rand() * 4, rand() * 3, (rand() - 0.5) * 8)
            return g
          })
          return { position, geometry: merge(puffs) }
        })
      }),
    [],
  )

  useFrame((_state, delta) => {
    if (!group.current) return
    for (const cloud of group.current.children) {
      cloud.position.x += delta * 2
      if (cloud.position.x > CLOUD_SPAN / 2) cloud.position.x -= CLOUD_SPAN
    }
  })

  return (
    <group ref={group}>
      {clouds.map((cloud, i) => (
        <mesh key={i} position={cloud.position} geometry={cloud.geometry}>
          <meshStandardMaterial {...CLOUD_MATERIAL} />
        </mesh>
      ))}
    </group>
  )
}

/**
 * Radial segments in a GlowPad's disc, ring and beam. Was 40, which is smoother than
 * a 1.8-metre disc seen from six metres away can show.
 */
const PAD_SEGMENTS = 16

/**
 * Why every see-through, two-sided material in the game says `forceSinglePass`.
 *
 * three.js draws a material that is `transparent` *and* `DoubleSide` twice - back
 * faces, then front faces - so that a see-through shape sorts against itself. It
 * also flips `material.side` between the two passes and sets `needsUpdate` each
 * time, and `needsUpdate` means "work the whole shader out again from scratch". So
 * every glow in view cost two draw calls and two full shader-parameter lookups in
 * every single frame, for its whole life.
 *
 * Nothing here needs the second pass. These are all additively blended and none of
 * them writes depth, and addition does not care what order it happens in: back then
 * front and front then back give the same pixel. (The portal's swirl is a flat
 * circle, where the two passes draw the same quad twice over.) `forceSinglePass`
 * tells three exactly that, and the picture is unchanged.
 *
 * It was the largest single cost in the game: thirty-seven of these were in view at
 * once on the lowest graphics level and a hundred and twenty-eight on High.
 */

/** Glowing floor pad with a light beam and rising sparkles. */
export function GlowPad({ position, color, radius = 1.8, beamHeight = 6 }) {
  const beam = useRef(null)
  useFrame(({ clock }) => {
    if (beam.current) beam.current.opacity = 0.45 + 0.15 * Math.sin(clock.elapsedTime * 2.4)
  })
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[radius, radius, 0.12, PAD_SEGMENTS]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.7, radius * 0.8, PAD_SEGMENTS]} />
        <meshBasicMaterial color="#ffffff" toneMapped={false} />
      </mesh>
      <mesh position={[0, beamHeight / 2, 0]}>
        <cylinderGeometry args={[radius * 0.95, radius, beamHeight, PAD_SEGMENTS, 1, true]} />
        <meshBasicMaterial
          ref={beam}
          map={beamTexture()}
          color={color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          forceSinglePass
          toneMapped={false}
        />
      </mesh>
      <Sparkle
        count={30}
        scale={[radius * 2, beamHeight, radius * 2]}
        position={[0, beamHeight / 2, 0]}
        size={5}
        speed={0.6}
        color={color}
      />
    </group>
  )
}

/**
 * The crown's shape, built once and shared by every crown on the map. There are
 * thirty-six of them, and each used to be sixteen separate meshes - a band, five
 * spikes, and two gems apiece - which came to five hundred and seventy-six draws
 * for pure decoration standing in rooms nobody was in. Merged by material it is
 * three, and the three share their geometry across every crown.
 */
const crownParts = () =>
  geometry('crown', () => {
    const band = new CylinderGeometry(1, 1, 0.7, 20, 1, true)
    const gold = [band]
    const pink = []
    const blue = []
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      const x = Math.cos(a)
      const z = Math.sin(a)
      const spike = new ConeGeometry(0.28, 0.8, 10)
      spike.translate(x, 0.75, z)
      gold.push(spike)

      const top = new SphereGeometry(0.13, 8, 6)
      top.translate(x, 1.2, z)
      pink.push(top)

      const stud = new SphereGeometry(0.1224, 8, 6)
      stud.translate(x, 0, z)
      blue.push(stud)
    }
    return { gold: merge(gold), pink: merge(pink), blue: merge(blue) }
  })

const CROWN_GOLD = { color: '#ffc93c', metalness: 0.6, roughness: 0.25, emissive: '#7a5200', emissiveIntensity: 0.5 }

/** Floating, spinning gold crown. */
export function Crown({ position }) {
  const ref = useRef(null)
  const parts = crownParts()
  useFrame(({ clock }, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.8
    ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 1.6) * 0.25
  })
  return (
    <group ref={ref} position={position}>
      <mesh geometry={parts.gold}>
        <meshStandardMaterial {...CROWN_GOLD} side={DoubleSide} />
      </mesh>
      <mesh geometry={parts.pink}>
        <meshStandardMaterial color="#ff3b6b" emissive="#ff3b6b" emissiveIntensity={0.6} />
      </mesh>
      <mesh geometry={parts.blue}>
        <meshStandardMaterial color="#3bb8ff" emissive="#3bb8ff" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

const CRYSTAL_SHARDS = [
  { offset: [0, 0, 0], scale: 1, tilt: [0, 0, 0] },
  { offset: [0.55, 0, 0.2], scale: 0.65, tilt: [0.1, 0, -0.35] },
  { offset: [-0.45, 0, -0.25], scale: 0.55, tilt: [-0.15, 0, 0.4] },
]

/** The three shards as one geometry, shared by all forty-nine clusters. */
const crystalGeometry = () =>
  geometry('crystal', () => {
    const parts = CRYSTAL_SHARDS.map((shard) => {
      const g = new OctahedronGeometry(1, 0)
      g.scale(0.55 * shard.scale, 1.4 * shard.scale, 0.55 * shard.scale)
      g.rotateX(shard.tilt[0])
      g.rotateY(shard.tilt[1])
      g.rotateZ(shard.tilt[2])
      g.translate(shard.offset[0], 1.1 * shard.scale, shard.offset[2])
      return g
    })
    const merged = merge(parts)
    // Flat shading needs per-face normals, which merging smooth ones does not give.
    merged.computeVertexNormals()
    return merged
  })

/** Cluster of glowing crystal shards. */
export function Crystal({ position, color, scale = 1 }) {
  return (
    <mesh position={position} scale={scale} geometry={crystalGeometry()} castShadow>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={0.45}
        roughness={0.15}
        metalness={0.1}
        flatShading
      />
    </mesh>
  )
}

/** A flat sign with canvas-rendered text. */
export function Label({ lines, position, rotationY = 0, size, style }) {
  const texture = labelTexture({ lines, aspect: size[0] / size[1], ...style })
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} transparent toneMapped={false} />
    </mesh>
  )
}
