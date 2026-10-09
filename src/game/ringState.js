import { create } from 'zustand'

import { RING_MAX_HP, RINGS } from './rings'

/**
 * What this client knows about the boxing rings, as the server last told it (see
 * net/lobbyClient.js and the server's rings.js).
 *
 * `rings[i]` is `{ f: [id | null, id | null], p: [id | null, id | null], hp: [a, b], s: state,
 * t: ms left, at, since, mh }`: the two fighters (red corner, blue corner), who is waiting
 * on its two pads, the fighters' health and their full health (it grows with level), the ring's state -
 * 'open' | 'countdown' | 'fight' | 'ko' - how long its clock had left at `at`
 * (`performance.now()` when the snapshot arrived), and since when it has been in
 * that state, as far as this client has seen.
 */
const empty = () => RINGS.map(() => ({ f: [null, null], p: [null, null], hp: [RING_MAX_HP, RING_MAX_HP], mh: [RING_MAX_HP, RING_MAX_HP], s: 'open', t: 0, at: 0, since: 0 }))

export const useRings = create(() => ({ rings: empty() }))

/** A fresh snapshot from the server. */
export function setRings(snapshot) {
  if (!Array.isArray(snapshot)) return
  const at = performance.now()
  const before = useRings.getState().rings
  useRings.setState({
    rings: RINGS.map((_, i) => {
      const r = snapshot[i] ?? empty()[i]
      const since = before[i]?.s === r.s ? before[i].since : at
      return { f: r.f, p: r.p ?? [null, null], hp: r.hp, mh: r.mh ?? [RING_MAX_HP, RING_MAX_HP], s: r.s, t: r.t, at, since }
    }),
  })
}

/** A punch landed: just the health moves. */
export function setRingHp(index, hp) {
  const { rings } = useRings.getState()
  if (!rings[index] || !Array.isArray(hp)) return
  const next = [...rings]
  next[index] = { ...next[index], hp }
  useRings.setState({ rings: next })
}

/** A fight is starting: these two are in the ring, off the pads, counting down. */
export function markRingStart(index, fighters, mh) {
  const { rings } = useRings.getState()
  if (!rings[index] || !Array.isArray(fighters)) return
  const next = [...rings]
  const at = performance.now()
  next[index] = { ...next[index], f: fighters, p: [null, null], hp: [...(mh ?? [RING_MAX_HP, RING_MAX_HP])], mh: mh ?? [RING_MAX_HP, RING_MAX_HP], s: 'countdown', t: 3000, at, since: at }
  useRings.setState({ rings: next })
}

/** Offline: nobody is in any ring as far as we can tell. */
export const clearRings = () => useRings.setState({ rings: empty() })

/** Whether ring `r` (a snapshot entry) has its ropes up: two fighters, fighting or about to. */
export const ringLocked = (r) => r.s === 'countdown' || r.s === 'fight' || r.s === 'ko'

/** Seconds left on ring `r`'s clock right now. */
export const ringSecondsLeft = (r, now = performance.now()) => Math.max(0, (r.t - (now - r.at)) / 1000)

/** Which ring `id` is fighting in, and in which corner: `{ index, slot }`, or null. */
export function ringOfPlayer(rings, id) {
  if (!id) return null
  for (let i = 0; i < rings.length; i++) {
    const slot = rings[i].f.indexOf(id)
    if (slot >= 0) return { index: i, slot }
  }
  return null
}

/** Which pad `id` is waiting on: `{ index, slot }`, or null. */
export function padOfPlayer(rings, id) {
  if (!id) return null
  for (let i = 0; i < rings.length; i++) {
    const slot = rings[i].p.indexOf(id)
    if (slot >= 0) return { index: i, slot }
  }
  return null
}

/**
 * What happens when the server reports a fight starting or cancelled, a hit, a
 * knockout or a refusal. Filled in by
 * RingDirector, which has the player's body and the effects to hand; lobbyClient
 * just calls them. No-ops until then.
 */
export const ringEvents = {
  start: () => {},
  cancel: () => {},
  hit: () => {},
  ko: () => {},
  deny: () => {},
  miss: () => {},
}
