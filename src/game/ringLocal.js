import { sendRingEnter, sendRingLeave } from '../net/lobbyClient'
import { useGame } from './gameStore'

/**
 * The local player's side of the boxing rings, kept in a module so the rings'
 * sensors (BoxingRing) and RingDirector can share it without a React round trip.
 *
 * `inside` is the ring whose canvas we are standing on, or -1; `askedAt` when we last
 * asked the server to let us in; `koHome` when to send us back to the lobby after a
 * knockout (`performance.now()` seconds, 0 for never).
 */
export const ringLocal = { inside: -1, askedAt: -Infinity, koHome: 0 }

/** A ring's sensor saw us step onto (or off) its canvas. */
export function ringSensor(index, inside) {
  if (inside) {
    ringLocal.inside = index
    ringLocal.askedAt = performance.now() / 1000
    sendRingEnter(index, useGame.getState().strength)
  } else if (ringLocal.inside === index) {
    ringLocal.inside = -1
    sendRingLeave(index)
  }
}
