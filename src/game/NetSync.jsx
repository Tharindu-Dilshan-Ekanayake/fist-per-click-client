import { useAfterPhysicsStep } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { connectLobby, disconnectLobby, sendState, updateProfile } from '../net/lobbyClient'
import { useGame } from './gameStore'

/** One physics step, in ms (the default timeStep of <Physics>, 1/60 s). */
const STEP_MS = 1000 / 60
/** Send every 3rd step: 20 position updates a second, the server's relay rate. */
const STEPS_PER_SEND = 3
/** Even standing still, the position is resent this often (so late joiners see us). */
const KEEPALIVE_STEPS = 60
/**
 * The physics clock is re-synced to real time when it drifts this far (physics
 * pauses while the tab is hidden), so other players don't wait for timestamps that
 * are stuck in the past.
 */
const RESYNC_MS = 250

/**
 * Keeps us in a lobby on the server: connects on mount, sends our name, avatar,
 * gun, pet, footprints and active target whenever they change, and our position and
 * shots 20 times a second.
 *
 * Positions are read right after a physics step and stamped with the physics clock
 * (steps x 1/60 s), so each one is exactly where we were at the time it's labelled
 * with. Reading the body in a render frame instead gives a position up to a step
 * stale or fresh against the frame's time, which makes our walk look uneven to
 * everyone else. Must be rendered inside <Physics>. `bodyRef` is the player's body.
 */
export function NetSync({ bodyRef }) {
  const { identity, avatar, proportions } = useBloxity()
  const gun = useGame((s) => s.equipped)
  // Other players see the pet leading our squad; the wire format carries one.
  const pet = useGame((s) => s.equippedPets[0] ?? null)
  // The footprints we leave, so everyone else sees them too (only a set we own).
  const footprints = useGame((s) => (s.footprints && s.ownedFootprints.includes(s.footprints) ? s.footprints : null))
  const trainer = useGame((s) => s.activeTrainer)
  const name = identity?.displayName || identity?.username || 'Player'

  const profile = useMemo(
    () => ({ name, avatar: avatar ? { equipped: avatar, proportions } : null, gun, pet, trainer, footprints }),
    [name, avatar, proportions, gun, pet, trainer, footprints],
  )

  // Declared before the connect effect, so the first hello already carries it.
  useEffect(() => updateProfile(profile), [profile])
  useEffect(() => {
    connectLobby()
    return disconnectLobby
  }, [])

  // Every shot bumps a counter the other players watch.
  const shots = useRef(0)
  useEffect(
    () =>
      useGame.subscribe((state, prev) => {
        if (state.shotAt !== prev.shotAt) shots.current += 1
      }),
    [],
  )

  const clock = useRef({ steps: 0, origin: null, sentStep: -Infinity, p: null, sw: 0 })
  useAfterPhysicsStep(() => {
    const body = bodyRef.current
    if (!body) return
    const c = clock.current
    c.steps += 1
    if (c.steps - c.sentStep < STEPS_PER_SEND) return

    const t = body.translation()
    const p = [Math.round(t.x * 100) / 100, Math.round(t.y * 100) / 100, Math.round(t.z * 100) / 100]
    const moved = !c.p || p.some((v, i) => Math.abs(v - c.p[i]) > 0.01)
    if (!moved && shots.current === c.sw && c.steps - c.sentStep < KEEPALIVE_STEPS) return

    const now = performance.now()
    if (c.origin === null) c.origin = now - c.steps * STEP_MS
    const physicsNow = c.origin + c.steps * STEP_MS
    if (Math.abs(now - physicsNow) > RESYNC_MS) c.origin += now - physicsNow

    sendState(p, shots.current, c.origin + c.steps * STEP_MS)
    c.sentStep = c.steps
    c.p = p
    c.sw = shots.current
  })

  return null
}

export default NetSync
