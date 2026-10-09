import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useRef } from 'react'
import { Quaternion, Vector3 } from 'three'

import { remoteStates, useLobby } from '../net/lobbyClient'
import { isFootprintSet } from './footprintSets'
import { FootprintTrail } from './Footprints'
import { playTrack } from '../net/snapshots'
import { getGun, shotKind } from './guns'
import { getPet } from './pets'
import { playSound } from './sound'
import { AvatarBoundary, StandInBody } from './AvatarBoundary'
import { PLAYER_HEIGHT, SHOT_DURATION_S } from './Player'
import PlayerAvatar from './PlayerAvatar'
import { Label } from './world/Effects'
import { PetModel } from './world/PetModel'

const _quat = new Quaternion()
const _petQuat = new Quaternion()
const _petBefore = new Vector3()
const _up = new Vector3(0, 1, 0)
const _sample = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }
/** Other players' shots can be heard up to this far from the camera. */
const HEAR_DISTANCE = 25
/** How far behind a remote player their pet trails, once it's caught up. */
const PET_HEEL_DISTANCE = 1.7
/** And a little off to one side, matching PetCompanion. */
const PET_SIDE_OFFSET = 0.4
/** Higher = snappier catch-up. */
const PET_FOLLOW_SMOOTHING = 0.5
/**
 * Ground covered between two of another player's footprints. Their steps are not
 * sent - only where they are - so a print goes down every stride's worth of ground,
 * which at a run lands about as often as their feet do.
 */
const REMOTE_STRIDE = 0.95

/**
 * Another player in our lobby, played back smoothly from the positions they send:
 * drawn a little behind real time, between the two positions around that moment,
 * with a delay that adapts to how late their updates arrive (see snapshots.js).
 * Facing, walk cycle and jumps come from that same smooth motion. No collider:
 * players pass through each other.
 */
function RemotePlayer({ id, player }) {
  const body = useRef(null)
  const visual = useRef(null)
  // maxSpeed a little under the walk speed (6), so small wobbles in their played-back
  // speed don't shrink the stride; a sprint is past it too, so both get the full cycle.
  const motion = useRef({ time: 0, speed: 0, grounded: true, maxSpeed: 5.5, shot: Infinity })
  const shots = useRef({ sw: null, at: -Infinity })
  const pet = useRef(null)
  const petFacing = useRef(0)
  const petInitialised = useRef(false)
  const lastPetId = useRef(null)
  /** Handed to PetModel so its legs trot in step with the pet's own catch-up speed. */
  const petWalkRef = useRef({ speed: 0 })
  /** Their footprints waiting to be drawn, and how far they have walked since the last. */
  const steps = useRef([])
  const stride = useRef({ walked: 0, side: 1, x: null, z: null })

  useFrame((state, delta) => {
    const track = remoteStates.get(id)
    const group = body.current
    if (!track || !group) return

    const now = performance.now()
    const s = playTrack(track, now, delta * 1000, _sample)
    group.position.set(s.x, s.y, s.z)

    const m = motion.current
    const horizontal = Math.hypot(s.vx, s.vz)
    m.time += delta
    m.speed += (horizontal - m.speed) * (1 - Math.exp(-delta * 12))
    m.grounded = Math.abs(s.vy) < 1.5
    if (visual.current && horizontal > 0.5) {
      _quat.setFromAxisAngle(_up, Math.atan2(s.vx, s.vz))
      visual.current.quaternion.slerp(_quat, 1 - Math.pow(0.001, delta))
    }

    // Their footprints, if they wear any: one every stride of ground covered.
    const st = stride.current
    if (st.x !== null && m.grounded && horizontal > 1) {
      st.walked += Math.hypot(s.x - st.x, s.z - st.z)
      if (st.walked >= REMOTE_STRIDE && isFootprintSet(player.footprints)) {
        st.walked = 0
        st.side = -st.side
        if (steps.current.length >= 8) steps.current.shift()
        steps.current.push({ x: s.x, y: s.y - PLAYER_HEIGHT / 2, z: s.z, yaw: Math.atan2(s.vx, s.vz), side: st.side })
      }
    } else {
      st.walked = 0
    }
    st.x = s.x
    st.z = s.z

    // Their pet, trailing a fixed distance behind wherever they're facing - same
    // heel-follow idea as our own PetCompanion, just driven off their played-back
    // track instead of a local Rapier body.
    if (player.pet !== lastPetId.current) {
      lastPetId.current = player.pet
      petInitialised.current = false
    }
    if (pet.current) {
      if (horizontal > 0.5) petFacing.current = Math.atan2(s.vx, s.vz)
      const feetY = s.y - PLAYER_HEIGHT / 2
      const heelX = s.x - Math.sin(petFacing.current) * PET_HEEL_DISTANCE + Math.cos(petFacing.current) * PET_SIDE_OFFSET
      const heelZ = s.z - Math.cos(petFacing.current) * PET_HEEL_DISTANCE - Math.sin(petFacing.current) * PET_SIDE_OFFSET
      if (!petInitialised.current) {
        pet.current.position.set(heelX, feetY, heelZ)
        petInitialised.current = true
        petWalkRef.current.speed = 0
      } else {
        _petBefore.copy(pet.current.position)
        const t = 1 - Math.pow(0.001, delta * PET_FOLLOW_SMOOTHING)
        pet.current.position.x += (heelX - pet.current.position.x) * t
        pet.current.position.z += (heelZ - pet.current.position.z) * t
        petWalkRef.current.speed = delta > 0 ? _petBefore.distanceTo(pet.current.position) / delta : 0
      }
      // Feet on the ground; the bounce comes from the pet's own gait (see PetModel).
      pet.current.position.y = feetY
      _petQuat.setFromAxisAngle(_up, petFacing.current)
      pet.current.quaternion.slerp(_petQuat, 1 - Math.pow(0.001, delta * 0.8))
    }

    // A new shot count means they just fired.
    const sw = shots.current
    if (track.sw !== sw.sw) {
      if (sw.sw !== null) {
        sw.at = now / 1000
        // Heard when they're close, fading out with distance.
        const distance = state.camera.position.distanceTo(group.position)
        if (distance < HEAR_DISTANCE) {
          playSound('shoot', { kind: shotKind(getGun(player.gun)), gain: 0.4 * (1 - distance / HEAR_DISTANCE) })
        }
      }
      sw.sw = track.sw
    }
    m.shot = (now / 1000 - sw.at) / SHOT_DURATION_S
  })

  const petDef = player.pet ? getPet(player.pet) : null

  const standIn = <StandInBody height={PLAYER_HEIGHT} />
  return (
    <>
      <group ref={body}>
        <group ref={visual} position={[0, -PLAYER_HEIGHT / 2, 0]}>
          <AvatarBoundary fallback={standIn}>
            <Suspense fallback={standIn}>
              <PlayerAvatar
                remote
                equipped={player.avatar?.equipped ?? null}
                proportions={player.avatar?.proportions}
                gunId={player.gun}
                targetHeight={PLAYER_HEIGHT}
                motionRef={motion}
              />
            </Suspense>
          </AvatarBoundary>
        </group>
        <Billboard position={[0, PLAYER_HEIGHT / 2 + 0.55, 0]}>
          <Label lines={[player.name]} position={[0, 0, 0]} size={[3, 0.6]} style={{ width: 512 }} />
        </Billboard>
      </group>
      {isFootprintSet(player.footprints) && (
        <FootprintTrail key={player.footprints} gunId={player.footprints} stepsRef={steps} />
      )}
      {petDef && (
        <group ref={pet} scale={1}>
          <PetModel pet={petDef} walkRef={petWalkRef} />
        </group>
      )}
    </>
  )
}

/** Everyone else in our lobby. */
export function RemotePlayers() {
  const players = useLobby((s) => s.players)
  return Object.entries(players).map(([id, player]) => <RemotePlayer key={id} id={id} player={player} />)
}

export default RemotePlayers
