import { sendPadEnter, sendPadLeave } from '../net/lobbyClient'
import { useGame } from './gameStore'

/**
 * The local player's side of the boxing rings, kept in a module so the rings' pads
 * (BoxingRing) and RingDirector can share it without a React round trip.
 *
 * `pad` is the pad we are standing on, `{ r, slot }`, or null; `askedAt` when we last
 * asked the server for it; `homeAt` / `home` when and where to put us once a fight is
 * over (`performance.now()` seconds, 0 for never).
 */
export const ringLocal = { pad: null, askedAt: -Infinity, homeAt: 0, home: null }

/** A pad's sensor saw us step onto (or off) it. */
export function ringPad(r, slot, on) {
  if (on) {
    ringLocal.pad = { r, slot }
    ringLocal.askedAt = performance.now() / 1000
    sendPadEnter(r, slot, useGame.getState().strength)
  } else if (ringLocal.pad?.r === r && ringLocal.pad.slot === slot) {
    ringLocal.pad = null
    sendPadLeave(r, slot)
  }
}
