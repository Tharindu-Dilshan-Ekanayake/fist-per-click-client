import { useFrame } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier } from '@react-three/rapier'
import { Suspense, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { aim } from './aim'
import { AvatarBoundary, StandInBody } from './AvatarBoundary'
import { PUNCH_S, punchFor } from './avatarRig'
import { applyFx, fightFx, knockedOut } from './fightFx'
import { leaveFootprint } from './footprintSets'
import { useGame } from './gameStore'
import { readInput } from './input'
import PlayerAvatar from './PlayerAvatar'
import { WALK_SPEED } from './progression'
import { playSound } from './sound'
import useKeyboard from './useKeyboard'

// Capsule roughly matching the humanoid. Rapier's capsule args are the half-height of
// the *cylindrical* section plus the radius, so total height = 2*(halfHeight+radius).
const CAPSULE_RADIUS = 0.35
const CAPSULE_HALF_HEIGHT = 0.55
const PLAYER_HEIGHT = 2 * (CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS)

/** World units per second; the HUD shows it as WALK_SPEED (16 → 6). */
const MOVE_SPEED = WALK_SPEED * (6 / 16)
const SPRINT_MULTIPLIER = 1.6
/**
 * Upward speed set on jump. Set directly rather than applied as an impulse so the
 * height doesn't depend on the collider's mass: v²/2g ≈ 1.6 units at gravity 18,
 * enough to hop onto the 1.2-unit terrace steps.
 */
const JUMP_VELOCITY = 7.6
/** Seconds the gloves stay up after the last punch before the arms relax into a run. */
const GUARD_HOLD_S = 1.6
/** How far from a wall's middle the player steps in to punch it. */
const WALL_STAND = 1.25
/** Close enough to where we are stepping to; stops the last few centimetres jittering. */
const STEP_SLACK = 0.12
/** Falling below this puts the player back at their spawn point. */
const FALL_LIMIT_Y = -25
/** Extra ray length past the capsule bottom; tolerates small ground gaps. */
const GROUND_RAY_SLACK = 0.15
/** Stops one long Space press from re-triggering the moment the ray re-hits. */
const JUMP_COOLDOWN_S = 0.25

// Scratch objects, reused each frame so the loop allocates nothing.
const _input = new Vector3()
const _move = new Vector3()
const _camForward = new Vector3()
const _camRight = new Vector3()
const _rayOrigin = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)
/** This frame's movement request, merged from the keyboard and the thumbstick. */
const _wanted = { x: 0, z: 0, jump: false, sprint: false }

/**
 * The player: a dynamic Rapier capsule with the assembled Bloxity avatar as its
 * visual mesh. The avatar is a child of the RigidBody, so R3F/Rapier keeps the mesh
 * on the body transform automatically — no manual per-frame copying.
 *
 * @param {{ position?: [number,number,number], onAvatarReady?: () => void,
 *           bodyRef?: React.MutableRefObject<any>,
 *           anchorRef?: React.MutableRefObject<any> }} props
 *   `anchorRef` receives an empty group on the body, which Rapier eases between
 *   physics steps - what anything following the player should read (playerAnchor.js).
 */
export function Player({ position = [0, 3, 0], onAvatarReady, bodyRef: externalBodyRef, anchorRef }) {
  // The follow camera needs to read this body's transform, so the scene may own the
  // ref. Fall back to a local one when used standalone.
  const localBodyRef = useRef(null)
  const bodyRef = externalBodyRef || localBodyRef
  const visualRef = useRef(null)
  useKeyboard()
  const { rapier, world } = useRapier()

  const jumpCooldown = useRef(0)

  /**
   * Motion state handed to the avatar so it can pose itself. A ref, not state:
   * this is written every frame and must not trigger a re-render.
   */
  const motionRef = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: MOVE_SPEED, guard: 1 })
  /** When each hand last threw, and what: which hand is whose turn follows punchCount. */
  const punches = useRef({ count: 0, rAt: -Infinity, lAt: -Infinity, styleR: 'jab', styleL: 'jab' })
  /** Walk-cycle phase (radians) and what the footstep and landing sounds track. */
  const stride = useRef({ phase: 0, beat: 0, airborne: 0, fallSpeed: 0 })

  /**
   * Grounded check: cast a short ray straight down from the capsule centre and see
   * whether it hits anything before clearing the capsule's own bottom. Without this
   * the player can jump indefinitely in mid-air.
   */
  // Plain function, not useCallback: it's only ever called from useFrame, so a stable
  // identity buys nothing.
  const isGrounded = () => {
    const body = bodyRef.current
    if (!body) return false

    const pos = body.translation()
    _rayOrigin.set(pos.x, pos.y, pos.z)

    const ray = new rapier.Ray(_rayOrigin, { x: 0, y: -1, z: 0 })
    const maxDistance = CAPSULE_HALF_HEIGHT + CAPSULE_RADIUS + GROUND_RAY_SLACK

    const hit = world.castRay(
      ray,
      maxDistance,
      true, // solid
      undefined,
      undefined,
      undefined,
      body, // exclude our own body, or we just hit ourselves
    )

    return hit !== null && hit.timeOfImpact <= maxDistance
  }

  useFrame((state, delta) => {
    const body = bodyRef.current
    if (!body) return

    jumpCooldown.current = Math.max(0, jumpCooldown.current - delta)

    const k = readInput(_wanted)

    // Evaluated once per frame now: both the jump gate and the avatar's pose need it.
    const grounded = isGrounded()

    // --- Horizontal movement, relative to camera yaw -----------------------------
    // Already a vector, and already clamped: a thumbstick can ask for half speed,
    // where the keyboard only ever asks for all of it (see game/input.js).
    _input.set(k.x, 0, k.z)

    const linvel = body.linvel()
    // Knocked down in the ring: nobody walks off a knockout.
    const staggered = knockedOut()

    const push = staggered ? 0 : _input.length()
    if (push > 0.02) {
      // Normalise the direction but keep how hard it was pushed: full deflection is
      // a run, half is a walk. A key is always full.
      _input.divideScalar(push)

      // Flatten the camera's forward onto the ground plane so W always means
      // "away from the camera", the standard 3rd-person runner feel.
      state.camera.getWorldDirection(_camForward)
      _camForward.y = 0
      _camForward.normalize()

      // Screen-right, derived from that flattened forward.
      _camRight.crossVectors(_camForward, _up).normalize()

      // Build the move vector from the camera basis directly rather than rotating
      // the raw input by a yaw angle - the yaw form silently mirrored both axes,
      // sending W toward the camera and A to the right.
      // input.z is -1 for W (forward), input.x is +1 for D (right).
      _move
        .set(0, 0, 0)
        .addScaledVector(_camForward, -_input.z)
        .addScaledVector(_camRight, _input.x)
        .normalize()

      const speed = MOVE_SPEED * (k.sprint ? SPRINT_MULTIPLIER : 1) * Math.min(1, push)

      // Set velocity directly rather than accumulating impulses: gives crisp,
      // predictable runner control and no drift. Y is left to gravity.
      body.setLinvel({ x: _move.x * speed, y: linvel.y, z: _move.z * speed }, true)

      // Face the direction of travel.
      if (visualRef.current) {
        _targetQuat.setFromAxisAngle(_up, Math.atan2(_move.x, _move.z))
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    } else {
      // Damp horizontal motion to a stop; don't touch the fall speed - unless there
      // is something to punch just out of reach, in which case step in to it: onto
      // the spot in front of the bag while training, or up to the wall after a punch.
      const game = useGame.getState()
      const here = body.translation()
      let step = null
      if (game.activeTrainer && game.trainSpot) {
        step = [game.trainSpot[0] - here.x, game.trainSpot[1] - here.z]
      } else if (game.nearWall && performance.now() / 1000 - game.punchAt < 0.6) {
        const side = here.z > game.nearWall.z ? 1 : -1
        const dz = game.nearWall.z + side * WALL_STAND - here.z
        if (dz * side < 0) step = [0, dz]
      }
      const gap = step ? Math.hypot(step[0], step[1]) : 0
      if (!staggered && gap > STEP_SLACK) {
        const speed = Math.min(MOVE_SPEED * 0.75, gap * 6)
        body.setLinvel({ x: (step[0] / gap) * speed, y: linvel.y, z: (step[1] / gap) * speed }, true)
      } else if (!staggered) {
        body.setLinvel({ x: linvel.x * 0.8, y: linvel.y, z: linvel.z * 0.8 }, true)
      }

      // Training: turn to face the bag. Beside a stage wall: turn to face the
      // wall. In a ring: turn to face the opponent.
      if (visualRef.current && !knockedOut() && (game.activeTrainer || game.nearWall || aim.target)) {
        const yaw = game.activeTrainer
          ? game.trainYaw
          : game.nearWall
            ? here.z > game.nearWall.z
              ? Math.PI
              : 0
            : Math.atan2(aim.target[0] - here.x, aim.target[2] - here.z)
        _targetQuat.setFromAxisAngle(_up, yaw)
        visualRef.current.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta))
      }
    }

    // --- Jump --------------------------------------------------------------------
    if (k.jump && !staggered && jumpCooldown.current === 0 && grounded) {
      const v = body.linvel()
      body.setLinvel({ x: v.x, y: JUMP_VELOCITY, z: v.z }, true)
      jumpCooldown.current = JUMP_COOLDOWN_S
      playSound('jump')
    }

    if (body.translation().y < FALL_LIMIT_Y) {
      body.setTranslation({ x: position[0], y: position[1], z: position[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
    }

    // --- Publish motion state for the avatar's pose -------------------------------
    const nowVel = body.linvel()
    const speed = Math.hypot(nowVel.x, nowVel.z)
    const maxSpeed = MOVE_SPEED * (k.sprint ? SPRINT_MULTIPLIER : 1)
    const s = stride.current
    // The avatar's walk cycle runs on this phase (see avatarRig), so the footsteps
    // below land exactly as a foot does, at the far ends of the leg swing.
    s.phase += Math.min(delta, 0.1) * (5 + Math.min(speed / maxSpeed, 1) * 5)
    const motion = motionRef.current
    motion.time += delta
    motion.speed = speed
    motion.grounded = grounded
    motion.maxSpeed = maxSpeed
    motion.phase = s.phase

    // Punches: each new one goes to the hand whose turn it is (see punchFor), so a
    // fast auto clicker alternates rather than restarting one arm.
    const now = performance.now() / 1000
    const game = useGame.getState()
    const pu = punches.current
    if (game.punchCount !== pu.count) {
      if (game.punchCount > pu.count) {
        const { right, style } = punchFor(game.punchCount)
        if (right) {
          pu.rAt = game.punchAt
          pu.styleR = style
        } else {
          pu.lAt = game.punchAt
          pu.styleL = style
        }
      }
      pu.count = game.punchCount
    }
    motion.punchR = (now - pu.rAt) / PUNCH_S
    motion.punchL = (now - pu.lAt) / PUNCH_S
    motion.styleR = pu.styleR
    motion.styleL = pu.styleL
    // Gloves up whenever there is something to hit, or something was just hit.
    const fighting =
      now - Math.max(pu.rAt, pu.lAt) < GUARD_HOLD_S || game.activeTrainer || game.nearWall || aim.target
    motion.guard += ((fighting ? 1 : 0) - motion.guard) * (1 - Math.exp(-delta * 6))
    applyFx(motion, fightFx, now)
    // The way the player faces, for the punch effects (see PunchEffects). A pure turn
    // about +Y, so the yaw falls straight out of the quaternion.
    if (visualRef.current) {
      const q = visualRef.current.quaternion
      aim.yaw = 2 * Math.atan2(q.y, q.w)
    }

    // --- Footsteps and landing ------------------------------------------------------
    const beat = Math.floor(s.phase / Math.PI - 0.5)
    if (beat !== s.beat) {
      s.beat = beat
      if (grounded && speed > 1) {
        playSound('step', { sprint: k.sprint })
        // Feet first: the capsule's centre is a body's height off the ground.
        const at = body.translation()
        leaveFootprint(at.x, at.y - CAPSULE_HALF_HEIGHT - CAPSULE_RADIUS, at.z, Math.atan2(nowVel.x, nowVel.z), beat % 2 ? 1 : -1)
      }
    }
    if (grounded) {
      if (s.airborne > 0.25 && s.fallSpeed > 4) playSound('land', { strength: Math.min(1, s.fallSpeed / 14) })
      s.airborne = 0
      s.fallSpeed = 0
    } else {
      s.airborne += delta
      s.fallSpeed = Math.max(s.fallSpeed, -nowVel.y)
    }
  })

  return (
    <RigidBody
      ref={bodyRef}
      position={position}
      colliders={false}
      mass={1}
      // Locking rotation keeps the capsule upright; facing is handled on the mesh.
      enabledRotations={[false, false, false]}
      friction={0.2}
      linearDamping={0.1}
      ccd
      name="player"
    >
      <CapsuleCollider args={[CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS]} />
      {/* Empty, and at the body's own origin: the smoothed position to follow. */}
      <group ref={anchorRef} />
      {/* Avatar origin is at the feet; the capsule origin is at its centre. */}
      <group ref={visualRef} position={[0, -PLAYER_HEIGHT / 2, 0]}>
        {/* The avatar downloads on its own, so the body (and the camera following
            it) work straight away; a stand-in shows until it arrives, or for good
            if it can't be loaded. */}
        <AvatarBoundary
          onError={onAvatarReady}
          fallback={<StandInBody height={PLAYER_HEIGHT} />}
        >
          <Suspense fallback={<StandInBody height={PLAYER_HEIGHT} />}>
            <PlayerAvatar
              onReady={onAvatarReady}
              targetHeight={PLAYER_HEIGHT}
              motionRef={motionRef}
            />
          </Suspense>
        </AvatarBoundary>
      </group>
    </RigidBody>
  )
}

export { PLAYER_HEIGHT }
export default Player
