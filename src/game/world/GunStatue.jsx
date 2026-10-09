import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import GunModel from '../GunModel'
import { Sparkle } from './Effects'
import { radialGlowTexture } from './textures'

/**
 * A giant gun turning slowly above a rock: the gun zone's centrepiece.
 * `position` is the top of the rock; the rock itself is part of the static map.
 *
 * @param {{ position: number[], gun: object, scale?: number }} props
 */
export function GunStatue({ position, gun, scale = 3.2 }) {
  const aura = useRef(null)
  const spin = useRef(null)
  useFrame(({ clock }, delta) => {
    if (aura.current) aura.current.opacity = 0.35 + 0.15 * Math.sin(clock.elapsedTime * 1.5)
    if (spin.current) {
      spin.current.rotation.y += delta * 0.35
      spin.current.position.y = 2.4 + Math.sin(clock.elapsedTime * 0.9) * 0.15
    }
  })

  return (
    <group position={position}>
      <group ref={spin} position={[0, 2.4, 0]}>
        {/* Tipped up, muzzle to the sky, and centred on its own middle. */}
        <group rotation={[-0.5, 0, 0]} scale={scale}>
          <group position={[0, -0.1, -0.2 * gun.size]}>
            <GunModel gun={gun} minGlow={0.4} />
          </group>
        </group>
      </group>
      <Billboard position={[0, 2.4, 0]}>
        <mesh>
          <planeGeometry args={[5, 5]} />
          <meshBasicMaterial
            ref={aura}
            map={radialGlowTexture()}
            color={gun.trim}
            transparent
            opacity={0.4}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Sparkle count={40} scale={[3.5, 4, 3.5]} position={[0, 2.4, 0]} size={6} speed={0.4} color={gun.trim} />
    </group>
  )
}

export default GunStatue
