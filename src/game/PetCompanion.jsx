import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { useGame } from './gameStore'
import { getPet } from './pets'
import { playerPosition } from './playerAnchor'
import { PLAYER_HEIGHT } from './Player'
import { Sparkle } from './world/Effects'
import { PetModel } from './world/PetModel'

/** How far behind the player the first pet settles once it catches up. */
const HEEL_DISTANCE = 1.7
/** Each row further back sits this much deeper, and this much wider apart. */
const ROW_DEPTH = 0.55
const ROW_SPREAD = 0.8
/** How far off the centre line the innermost pair walks. */
const SIDE_OFFSET = 0.45
/** A pet only starts moving once further than this from its heel spot. */
const FOLLOW_SLACK = 0.6
/** Higher = snappier catch-up. */
const FOLLOW_SMOOTHING = 5
const TURN_SMOOTHING = 6
/** Below this speed the player's turned in place, not walking - keep facing put. */
const TURN_SPEED = 0.5

const _playerPos = new Vector3()
const _heelPos = new Vector3()
const _dir = new Vector3()
const _before = new Vector3()
const _targetQuat = new Quaternion()
const _up = new Vector3(0, 1, 0)

/**
 * Where the i-th pet of the squad walks, relative to the player's facing: a V
 * opening out behind them, alternating sides so the pack stays balanced and
 * nobody rides directly in the player's tracks (or the sword's swing arc).
 */
function slot(i) {
  const side = i % 2 === 0 ? 1 : -1
  const row = Math.floor(i / 2)
  return { back: HEEL_DISTANCE + row * ROW_DEPTH, lateral: side * (SIDE_OFFSET + row * ROW_SPREAD) }
}

/**
 * One pet, trotting along at its own spot in the formation. A ref-driven group,
 * not physics-backed: it just chases a point behind-and-beside the player's
 * capsule, reading the same Rapier body FollowCamera does. Facing comes from the
 * body's own velocity (like RemotePlayers does for the avatar) rather than the
 * pet's own past movement, so it can't fall into a feedback loop and spin in
 * place once it's caught up.
 *
 * @param {{ bodyRef: React.MutableRefObject<any>, pet: object, index: number }} props
 */
function Follower({ bodyRef, anchorRef, pet, index }) {
  const groupRef = useRef(null)
  const initialised = useRef(false)
  const facing = useRef(0)
  /** Handed to PetModel so its legs trot in step with how fast it's actually moving. */
  const walkRef = useRef({ speed: 0 })

  useFrame((state, delta) => {
    const body = bodyRef.current
    const group = groupRef.current
    if (!body || !group) return

    // The eased position, so the pet trots beside the avatar rather than the
    // physics body's stepped one (see playerAnchor.js).
    if (!playerPosition(anchorRef, bodyRef, _playerPos)) return
    _playerPos.y -= PLAYER_HEIGHT / 2
    const v = body.linvel()

    if (Math.hypot(v.x, v.z) > TURN_SPEED) facing.current = Math.atan2(v.x, v.z)

    const { back, lateral } = slot(index)
    _dir.set(Math.sin(facing.current), 0, Math.cos(facing.current))
    _heelPos.copy(_playerPos).addScaledVector(_dir, -back)
    _heelPos.x += Math.cos(facing.current) * lateral
    _heelPos.z -= Math.sin(facing.current) * lateral

    if (!initialised.current) {
      group.position.copy(_heelPos)
      initialised.current = true
      walkRef.current.speed = 0
    } else if (group.position.distanceTo(_heelPos) > FOLLOW_SLACK) {
      _before.copy(group.position)
      group.position.lerp(_heelPos, 1 - Math.pow(0.001, delta * (FOLLOW_SMOOTHING / 10)))
      walkRef.current.speed = delta > 0 ? _before.distanceTo(group.position) / delta : 0
    } else {
      walkRef.current.speed = 0
    }

    // Feet on the ground: the bob and bounce are the pet's own, from its gait
    // (see PetModel), not a hover applied from out here.
    group.position.y = _playerPos.y

    _targetQuat.setFromAxisAngle(_up, facing.current)
    group.quaternion.slerp(_targetQuat, 1 - Math.pow(0.001, delta * (TURN_SMOOTHING / 10)))
  })

  return (
    <group ref={groupRef}>
      <PetModel pet={pet} walkRef={walkRef} />
      {(pet.glow ?? 0) > 0 && (
        <Sparkle count={8} scale={[0.9, 0.9, 0.9]} position={[0, 0.35, 0]} size={2.5} speed={0.4} color={pet.colors.accent} />
      )}
    </group>
  )
}

/**
 * The whole squad of equipped pets (see the Pets panel), each walking its own
 * slot in the formation behind the player.
 *
 * @param {{ bodyRef: React.MutableRefObject<any>,
 *           anchorRef?: React.MutableRefObject<any> }} props
 */
export function PetCompanion({ bodyRef, anchorRef }) {
  const equipped = useGame((s) => s.equippedPets)

  return (
    <>
      {equipped.map((id, i) => {
        const pet = getPet(id)
        return pet ? <Follower key={id} bodyRef={bodyRef} anchorRef={anchorRef} pet={pet} index={i} /> : null
      })}
    </>
  )
}

export default PetCompanion
