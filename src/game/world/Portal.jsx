import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'

import { useGame } from '../gameStore'
import { Sparkle } from './Effects'
import { radialGlowTexture, swirlTexture } from './textures'

/** Height of the portal's middle; the shared light sits here too. */
export const CENTER_Y = 4.2
const RADIUS = 3.3

/** How far in front of the arch the light hangs, in the portal's own -Z/+Z sense. */
export const LIGHT_Z = 2

/**
 * Swirling purple portal. Walking into it teleports the player to `target`.
 * The stone arch around it is part of the static map (see layout.js).
 *
 * The purple light it casts is not here: see PortalLight in World.jsx, which is one
 * light shared by all three portals and always in the scene. It used to be a
 * `pointLight` on this component, which meant the scene's point-light count went
 * from one to zero and back every time you walked out of range of a portal and
 * returned - and a change in the light count makes three.js rebuild the shader for
 * every material in view. The lobby portal stands nine metres from the spawn point,
 * so that was a recompile of the whole scene on the way out and another on the way
 * back, which is most of what made walking anywhere stutter.
 *
 * @param {{ position: number[], rotationY?: number, target: number[], requiresWall?: number,
 *           requiresRebirths?: number, name?: string, color?: string }} props
 *   With `requiresWall`, it only works once that stage wall has been broken; with
 *   `requiresRebirths`, once the player has rebirthed that many times. `name` is
 *   what the refusal calls the place, and `color` tints the halo.
 */
export function Portal({
  position,
  rotationY = 0,
  target,
  requiresWall = 0,
  requiresRebirths = 0,
  name = 'this portal',
  color = '#b35cff',
}) {
  const front = useRef(null)
  const back = useRef(null)
  const halo = useRef(null)

  useFrame(({ clock }, delta) => {
    if (front.current) front.current.rotation.z -= delta * 1.6
    if (back.current) back.current.rotation.z += delta * 0.9
    if (halo.current) halo.current.opacity = 0.55 + 0.2 * Math.sin(clock.elapsedTime * 2)
  })

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player' || !other.rigidBody) return
    const game = useGame.getState()
    if (game.bestWall < requiresWall) {
      game.notify(`Break wall ${requiresWall} to unlock ${name}`, 'error')
      return
    }
    if (game.rebirths < requiresRebirths) {
      const short = requiresRebirths - game.rebirths
      game.notify(`${name} needs Rebirth ${requiresRebirths} - ${short} more to go!`, 'error')
      return
    }
    other.rigidBody.setTranslation({ x: target[0], y: target[1], z: target[2] }, true)
    other.rigidBody.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh ref={front} position={[0, CENTER_Y, 0.05]}>
        <circleGeometry args={[RADIUS, 48]} />
        {/* forceSinglePass: see the note in world/Effects.jsx. */}
        <meshBasicMaterial
          map={swirlTexture()}
          transparent
          side={DoubleSide}
          forceSinglePass
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={back} position={[0, CENTER_Y, 0.1]} scale={0.75}>
        <circleGeometry args={[RADIUS, 48]} />
        <meshBasicMaterial
          map={swirlTexture()}
          transparent
          opacity={0.6}
          blending={AdditiveBlending}
          side={DoubleSide}
          forceSinglePass
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, CENTER_Y, 0.6]}>
        <planeGeometry args={[11, 11]} />
        <meshBasicMaterial
          ref={halo}
          map={radialGlowTexture()}
          color={color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Sparkle
        count={50}
        scale={[6, 7, 2]}
        position={[0, CENTER_Y, 0.8]}
        size={6}
        speed={0.5}
        color="#e3b8ff"
      />
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[RADIUS, RADIUS + 0.4, 0.5]}
          position={[0, CENTER_Y, 0]}
          onIntersectionEnter={onEnter}
        />
      </RigidBody>
    </group>
  )
}

export default Portal
