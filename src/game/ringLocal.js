import { sendPadEnter, sendPadLeave } from '../net/lobbyClient'
import { useGame } from './gameStore'
import { padHooks } from './padHooks'

/**
 * The local player's side of the boxing rings, kept in a module so the rings' pads
 * (BoxingRing) and RingDirector can share it without a React round trip.
 *
 * `near` is the pad we are standing on, `{ r, slot }`, or null. `pad` is the pad we
 * have joined (pressed E on) - only then is the server asked for it. `askedAt` is when
 * we last asked; `homeAt` / `home` when and where to put us once a fight is over
 * (`performance.now()` seconds, 0 for never).
 */
export const ringLocal = { near: null, pad: null, askedAt: -Infinity, homeAt: 0, home: null }

const padId = (r, slot) => `${r}:${slot}`
const same = (a, r, slot) => a && a.r === r && a.slot === slot

function join(r, slot) {
  ringLocal.pad = { r, slot }
  ringLocal.askedAt = performance.now() / 1000
  sendPadEnter(r, slot, useGame.getState().strength)
}

function leave() {
  const pad = ringLocal.pad
  if (!pad) return
  ringLocal.pad = null
  sendPadLeave(pad.r, pad.slot)
}

/** A pad's sensor saw us step onto (or off) it: offer E, or take the offer away. */
export function ringPad(r, slot, on) {
  const game = useGame.getState()
  if (on) {
    ringLocal.near = { r, slot }
    game.setInteract('ringPad', padId(r, slot))
    return
  }
  if (same(ringLocal.near, r, slot)) ringLocal.near = null
  game.clearInteract('ringPad', padId(r, slot))
  // Walking off a pad you joined leaves the queue.
  if (same(ringLocal.pad, r, slot)) leave()
}

/** E on a pad: join it, or leave it if we already have. */
padHooks.toggle = (id) => {
  const [r, slot] = id.split(':').map(Number)
  if (same(ringLocal.pad, r, slot)) leave()
  else join(r, slot)
}
