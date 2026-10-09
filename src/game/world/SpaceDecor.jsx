import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'

import { Sparkle } from './Effects'

/** Planets hanging under the hub's roof: [x, y, z] from the hub's centre, radius, colour, ringed. */
const PLANETS = [
  [-14, 11, 6, 2.6, '#ff7a3a', false],
  [16, 12, -6, 3.2, '#7a5cff', true],
  [2, 12.5, 20, 1.6, '#4fd8ff', false],
]

/**
 * What makes Space World's hub read as space: a field of stars filling the room and
 * three glowing planets turning slowly up by the ceiling. Purely decorative - no
 * colliders, nothing to stand on - and drawn only while the hub is near enough to
 * matter (World mounts it from the near field like everything else).
 *
 * @param {{ center: number[] }} props the hub's centre on the ground
 */
export function SpaceDecor({ center }) {
  const planets = useRef([])
  useFrame((_state, delta) => {
    for (const planet of planets.current) if (planet) planet.rotation.y += delta * 0.2
  })

  return (
    <group position={center}>
      <Sparkle count={220} scale={[58, 14, 58]} position={[0, 8, 0]} size={3} speed={0.08} color="#ffffff" />
      <Sparkle count={60} scale={[58, 10, 58]} position={[0, 9, 0]} size={5} speed={0.15} color="#7ff9ff" />
      {PLANETS.map(([x, y, z, r, color, ringed], i) => (
        <group
          key={i}
          position={[x, y, z]}
          ref={(el) => {
            planets.current[i] = el
          }}
        >
          <mesh>
            <sphereGeometry args={[r, 24, 16]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} roughness={0.8} />
          </mesh>
          {ringed && (
            <mesh rotation={[1.2, 0, 0.3]}>
              <torusGeometry args={[r * 1.6, r * 0.12, 8, 40]} />
              <meshStandardMaterial color="#ffe9a8" emissive="#ffe9a8" emissiveIntensity={0.4} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  )
}

export default SpaceDecor
