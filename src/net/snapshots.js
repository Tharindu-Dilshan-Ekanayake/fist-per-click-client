/**
 * Smooth playback of another player from the positions they send 20 times a second.
 * Pure functions (no React, no sockets), so the timing can be tested on its own.
 *
 * Positions are kept on the *sender's* clock (`snaps`: `{ ts, p }`, oldest first),
 * exactly as they were stamped, so their spacing is always the real spacing. Our
 * estimate of how their clock lines up with ours only comes in at playback, and
 * eases in when it changes. (Mapping each position onto our clock as it arrived,
 * with whatever the estimate was at that moment, let a revised estimate squeeze
 * two positions 50 ms of walking apart into 1 ms: a visible teleport.)
 *
 * Other players are drawn a little in the past, so there's a received position on
 * either side of the moment being drawn to glide between. How far in the past
 * adapts per player: if their updates have been arriving late (their PC or ours
 * hung for a moment, a busy network), the delay grows enough to ride over the next
 * such gap instead of freezing them; when things are calm it shrinks back. Delay
 * and clock corrections change gradually, as a slight speed-up or slow-down, never
 * a jump.
 */

/** Their updates' spacing (the server's relay rate), in ms. */
const SEND_INTERVAL_MS = 50
/**
 * Playback delay limits. It never drops below 150 ms: measured with hitchy frames,
 * a smaller buffer makes other players snap and stall more than the lag it saves
 * is worth. It only grows above that after late updates.
 */
export const MIN_DELAY_MS = 150
export const MAX_DELAY_MS = 450
/** Extra headroom on top of the worst recent lateness. */
const DELAY_MARGIN_MS = 30
/** The delay may change by this fraction of elapsed time: at most ±10% playback speed. */
const DELAY_RATE = 0.1
/** A revised clock estimate is eased in at this fraction of elapsed time (±5% speed). */
const OFFSET_RATE = 0.05
/** How fast remembered lateness fades once updates are on time again (ms per second). */
const LATE_DECAY_PER_S = 40
/**
 * If updates stop, keep them moving along their last heading for at most this long.
 * Longer guesses drift further off when they're turning, and the correction when
 * the real positions land is a visible snap.
 */
export const MAX_EXTRAPOLATE_MS = 200
/** Two positions further apart than this (a portal, a respawn): jump, don't glide. */
export const SNAP_DISTANCE = 15

const MAX_SNAPS = 40
/**
 * A position arriving this long after the last one, from a player who was standing
 * still (only the occasional keepalive comes through then), is taken to start from
 * where they were standing just before, so they set off at once instead of sliding
 * over the gap. A player who was *moving* is glided across the gap instead:
 * treating them as having stood still would freeze them, then sprint.
 */
const RESUME_GAP_MS = 250
const RESUME_LEAD_MS = 50

/**
 * A track for a player last seen at `p` (from the lobby's welcome/join, which
 * carry no timestamp); it holds there until their first update arrives.
 */
export function newTrack(p, sw, now) {
  return {
    start: p,
    snaps: [],
    sw,
    // Our clock minus theirs: the estimate, and the value playback is using.
    offsetTarget: null,
    offset: null,
    late: 0,
    lateAt: now,
    delay: MIN_DELAY_MS,
  }
}

/**
 * Adds a position the player sent at `ts` on *their* clock, received at `now` on
 * ours. Without a timestamp (an old server) the arrival time stands in for it.
 */
export function addSnapshot(track, p, sw, ts, now) {
  const sent = typeof ts === 'number' ? ts : now

  // The smallest (arrival - send time) seen is the least delayed delivery, so it's
  // the best estimate of the clock offset; it creeps up slowly in case the route
  // got slower.
  const sample = now - sent
  track.offsetTarget =
    track.offsetTarget === null || sample < track.offsetTarget
      ? sample
      : track.offsetTarget + (sample - track.offsetTarget) * 0.01
  if (track.offset === null) track.offset = track.offsetTarget

  // How late this one is compared with the best case; the playback delay is sized
  // from the worst of these, fading slowly.
  const lateness = Math.max(0, sample - track.offsetTarget)
  const faded = track.late - ((now - track.lateAt) * LATE_DECAY_PER_S) / 1000
  track.late = Math.max(lateness, faded, 0)
  track.lateAt = now

  track.sw = sw
  const snaps = track.snaps
  const last = snaps[snaps.length - 1]
  if (last && sent <= last.ts) return
  const before = snaps[snaps.length - 2]
  const wasStill = !before || before.p.every((v, i) => Math.abs(v - last.p[i]) < 0.01)
  if (last && wasStill && sent - last.ts > RESUME_GAP_MS) {
    snaps.push({ ts: sent - RESUME_LEAD_MS, p: last.p })
  }
  snaps.push({ ts: sent, p })
  if (snaps.length > MAX_SNAPS) snaps.splice(0, snaps.length - MAX_SNAPS)
}

/**
 * Where the player is at `renderTs` (on *their* clock) and how fast they're moving
 * there, written into `out` as { x, y, z, vx, vy, vz } (velocity in units per
 * second). Interpolates between the positions either side of `renderTs`, briefly
 * extrapolates if they're late, and forgets positions that are fully in the past.
 */
export function sampleTrack(track, renderTs, out) {
  const snaps = track.snaps
  out.vx = 0
  out.vy = 0
  out.vz = 0
  if (snaps.length === 0) {
    ;[out.x, out.y, out.z] = track.start
    return out
  }

  while (snaps.length > 2 && snaps[1].ts <= renderTs) snaps.shift()
  const a = snaps[0]
  const b = snaps[1]
  if (!b || renderTs <= a.ts) {
    ;[out.x, out.y, out.z] = a.p
    return out
  }

  const dx = b.p[0] - a.p[0]
  const dy = b.p[1] - a.p[1]
  const dz = b.p[2] - a.p[2]
  if (Math.hypot(dx, dy, dz) > SNAP_DISTANCE) {
    ;[out.x, out.y, out.z] = renderTs < b.ts ? a.p : b.p
    return out
  }

  const span = b.ts - a.ts
  const u = Math.min((renderTs - a.ts) / span, 1 + MAX_EXTRAPOLATE_MS / span)
  out.x = a.p[0] + dx * u
  out.y = a.p[1] + dy * u
  out.z = a.p[2] + dz * u
  if (renderTs < b.ts + MAX_EXTRAPOLATE_MS) {
    out.vx = (dx / span) * 1000
    out.vy = (dy / span) * 1000
    out.vz = (dz / span) * 1000
  }
  return out
}

/**
 * One frame of playback at `now` (our clock), `dtMs` after the previous frame:
 * eases the clock offset toward its latest estimate and the delay toward what the
 * recent lateness calls for, then samples at `now - delay` (converted to their
 * clock). Returns `out` (see sampleTrack).
 */
export function playTrack(track, now, dtMs, out) {
  const dt = Math.min(dtMs, 100)
  if (track.offset !== null) {
    const step = OFFSET_RATE * dt
    track.offset += Math.max(-step, Math.min(step, track.offsetTarget - track.offset))
  }
  const target = Math.min(MAX_DELAY_MS, Math.max(MIN_DELAY_MS, SEND_INTERVAL_MS + track.late + DELAY_MARGIN_MS))
  const step = DELAY_RATE * dt
  track.delay += Math.max(-step, Math.min(step, target - track.delay))
  return sampleTrack(track, now - track.delay - (track.offset ?? 0), out)
}
