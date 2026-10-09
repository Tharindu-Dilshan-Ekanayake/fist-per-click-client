import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending } from 'three'

import GloveModel from '../GloveModel'
import { Sparkle } from './Effects'
import { radialGlowTexture } from './textures'

/** The champion's gloves: gold leather, white cuffs, red trim. Not for sale. */
const CHAMPION = { id: 'champion', name: 'Champion Gloves', design: 'pro', main: '#ffc21a', cuff: '#ffffff', trim: '#e8352d', size: 1, glow: 0.35 }

/**
 * A giant pair of golden gloves bumping fists high over a plinth: the spawn plaza's
 * centrepiece. `position` is the top of the plinth; the plinth itself is part of the
 * static map.
 *
 * @param {{ position: number[], glove?: object, scale?: number }} props
 */
export function GloveStatue({ position, glove = CHAMPION, scale = 3.6 }) {
  const aura = useRef(null)
  const spin = useRef(null)
  const left = useRef(null)
  const right = useRef(null)
  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime
    if (aura.current) aura.current.opacity = 0.35 + 0.15 * Math.sin(t * 1.5)
    if (spin.current) {
      spin.current.rotation.y += delta * 0.3
      spin.current.position.y = 3 + Math.sin(t * 0.9) * 0.15
    }
    // Every couple of seconds the two gloves draw back and bump together.
    const k = Math.max(0, Math.sin(t * 2.6)) ** 6
    if (left.current) left.current.position.x = -0.42 - 0.25 * (1 - k)
    if (right.current) right.current.position.x = 0.42 + 0.25 * (1 - k)
  })

  return (
    <group position={position}>
      <group ref={spin} position={[0, 3, 0]}>
        <group scale={scale}>
          {/* Lying on their sides, knuckles turned in to meet in the middle. */}
          <group ref={left} position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <GloveModel glove={glove} side={1} minGlow={0.4} />
          </group>
          <group ref={right} position={[0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
            <GloveModel glove={glove} side={-1} minGlow={0.4} sparkles={false} />
          </group>
        </group>
      </group>
      <Billboard position={[0, 3, 0]}>
        <mesh>
          <planeGeometry args={[8, 6]} />
          <meshBasicMaterial
            ref={aura}
            map={radialGlowTexture()}
            color={glove.trim}
            transparent
            opacity={0.4}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Sparkle count={40} scale={[5, 4, 5]} position={[0, 3, 0]} size={6} speed={0.4} color={glove.trim} />
      {/* Solid, so nobody climbs into it - and the camera backs off it rather than
          ending up inside a glove. */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[3.7, 1.2, 1.1]} position={[0, 3, 0]} />
      </RigidBody>
    </group>
  )
}

export default GloveStatue
