import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Vector3 } from 'three'

import { aim } from './aim'
import { useGame } from './gameStore'
import { getGun } from './guns'
import { playerPosition } from './playerAnchor'
import { unitBox } from './world/geometry'
import { radialGlowTexture } from './world/textures'
import { isSpaceWall } from './walls'
import { OPEN_HALF, SPACE_SPAWN } from './world/themes'

/** Shots that can be in the air at once; an OP auto clicker keeps about two up. */
const POOL = 10
/** Bullet speed, in metres a second. Fast enough to read as instant, slow enough to see. */
const BULLET_SPEED = 140
const BULLET_W = 0.07
/** How long a laser beam stays on screen, fading. */
const BEAM_S = 0.12
const BEAM_W = 0.1
/** How long the flash where a shot lands lasts. */
const IMPACT_S = 0.12
/** How far a shot at nothing in particular flies before it fades out. */
const RANGE = 16
/** Fallback muzzle offsets used only before the held gun has mounted. */
const MUZZLE_UP = 0.5
const MUZZLE_FORWARD = 1
const MUZZLE_SIDE = 0.3

const _here = new Vector3()
const _from = new Vector3()
const _to = new Vector3()
const _mid = new Vector3()

/**
 * What a shot looks like on its way: a bright streak flying from the gun to whatever
 * it was fired at - the target on your pad, the stage wall in front of you, the boss
 * - and a flash where it lands. Laser guns draw a beam instead of a streak.
 *
 * Local shots only. Other players' shots are already told by their recoil and their
 * sound, and drawing every tracer in an eight-player lobby would be a lot of glowing
 * lines for very little.
 *
 * @param {{ bodyRef: React.MutableRefObject<any>, anchorRef: React.MutableRefObject<any> }} props
 */
export function ShotEffects({ bodyRef, anchorRef }) {
  const streaks = useRef([])
  const flashes = useRef([])
  const state = useRef({
    seen: -Infinity,
    next: 0,
    shots: Array.from({ length: POOL }, () => ({
      born: -Infinity,
      flight: 0,
      laser: false,
      from: new Vector3(),
      to: new Vector3(),
    })),
  })

  useFrame(() => {
    const now = performance.now() / 1000
    const s = state.current
    const game = useGame.getState()

    if (game.shotAt > s.seen) {
      s.seen = game.shotAt
      if (playerPosition(anchorRef, bodyRef, _here)) {
        const yaw = aim.yaw
        const fx = Math.sin(yaw)
        const fz = Math.cos(yaw)
        if (aim.muzzle) {
          aim.muzzle.getWorldPosition(_from)
        } else {
          _from.set(
            _here.x + fx * MUZZLE_FORWARD - fz * MUZZLE_SIDE,
            _here.y + MUZZLE_UP,
            _here.z + fz * MUZZLE_FORWARD + fx * MUZZLE_SIDE,
          )
        }
        if (aim.target && (game.activeTrainer || game.inBossArena)) {
          _to.set(aim.target[0], aim.target[1], aim.target[2])
        } else if (game.nearWall) {
          // Straight at the wall, at about chest height, wherever along it you stand.
          const cx = isSpaceWall(game.nearWall.number) ? SPACE_SPAWN[0] : 0
          const x = Math.max(cx - OPEN_HALF + 1, Math.min(cx + OPEN_HALF - 1, _from.x))
          _to.set(x, _from.y + 0.6, game.nearWall.z)
        } else {
          _to.set(_from.x + fx * RANGE, _from.y, _from.z + fz * RANGE)
        }
        const gun = getGun(game.equipped)
        const shot = s.shots[s.next]
        const i = s.next
        s.next = (s.next + 1) % POOL
        shot.born = now
        shot.laser = Boolean(gun.laser)
        shot.from.copy(_from)
        shot.to.copy(_to)
        shot.flight = shot.laser ? 0 : _from.distanceTo(_to) / BULLET_SPEED
        const color = gun.laser ? gun.trim : '#ffd27a'
        streaks.current[i]?.material.color.set(color)
        flashes.current[i]?.material.color.set(color)
      }
    }

    for (let i = 0; i < POOL; i++) {
      const shot = s.shots[i]
      const streak = streaks.current[i]
      const flash = flashes.current[i]
      if (!streak || !flash) continue
      const age = now - shot.born
      const dist = shot.from.distanceTo(shot.to)

      // The streak, or the beam.
      if (shot.laser) {
        streak.visible = age < BEAM_S
        if (streak.visible) {
          _mid.addVectors(shot.from, shot.to).multiplyScalar(0.5)
          streak.position.copy(_mid)
          streak.lookAt(shot.to)
          const w = BEAM_W * (1 - age / BEAM_S)
          streak.scale.set(w, w, dist)
          streak.material.opacity = 1 - age / BEAM_S
        }
      } else {
        // Keep a short muzzle-to-target tracer visible as a clear line. A tiny
        // moving streak was easy to miss from the local third-person camera.
        streak.visible = age < BEAM_S
        if (streak.visible) {
          _mid.addVectors(shot.from, shot.to).multiplyScalar(0.5)
          streak.position.copy(_mid)
          streak.lookAt(shot.to)
          streak.scale.set(BULLET_W, BULLET_W, dist)
          streak.material.opacity = 1 - age / BEAM_S
        }
      }

      // The flash where it lands, once it has.
      const landed = age - shot.flight
      flash.visible = landed >= 0 && landed < IMPACT_S
      if (flash.visible) {
        flash.position.copy(shot.to)
        const k = 1 - landed / IMPACT_S
        flash.scale.setScalar(0.6 + (1 - k) * 1.4)
        flash.material.opacity = k
      }
    }
  })

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <mesh
          key={`s${i}`}
          ref={(el) => {
            streaks.current[i] = el
          }}
          geometry={unitBox()}
          visible={false}
          frustumCulled={false}
        >
          <meshBasicMaterial transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POOL }, (_, i) => (
        <sprite
          key={`f${i}`}
          ref={(el) => {
            flashes.current[i] = el
          }}
          visible={false}
        >
          <spriteMaterial
            map={radialGlowTexture()}
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      ))}
    </>
  )
}

export default ShotEffects
