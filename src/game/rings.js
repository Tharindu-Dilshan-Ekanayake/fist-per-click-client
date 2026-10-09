/**
 * The four boxing rings behind the training zone, where two players fight.
 *
 * The server keeps who is in which ring and the fight itself (see the server's
 * rings.js, which holds a copy of the positions below to check that a player asking
 * to step in is actually standing there). Keep the two in step.
 *
 * Coordinates are the middle of each ring's canvas, at floor level.
 */

/** Half the width of the canvas inside the ropes. */
export const RING_HALF = 4.4
/** Half the width of the whole platform, apron and all. */
export const RING_PLATFORM_HALF = 5.2
/** Height of the canvas above the ground. */
export const RING_FLOOR = 1.1
/** Height of the corner posts above the canvas. */
export const RING_POST_H = 2.3
/** Every fighter steps in with this much health. */
export const RING_MAX_HP = 100

/** Row of rings, west to east. `mat` is the canvas, `skirt` the apron round it. */
export const RINGS = [
  { id: 0, name: 'RING 1', x: -22.5, z: 76, mat: '#f6f4ee', skirt: '#2a64e8', accent: '#5cc4ff', ropes: ['#ff3b3b', '#ffffff', '#2a64e8'] },
  { id: 1, name: 'RING 2', x: -7.5, z: 76, mat: '#f4f8ff', skirt: '#1e9e58', accent: '#7dff9a', ropes: ['#ffd23f', '#ffffff', '#1e9e58'] },
  { id: 2, name: 'RING 3', x: 7.5, z: 76, mat: '#ff3b3b', skirt: '#2b2b33', accent: '#ff8a7a', ropes: ['#ffffff', '#2b2b33', '#ffffff'] },
  { id: 3, name: 'RING 4', x: 22.5, z: 76, mat: '#d86bff', skirt: '#3a1f6e', accent: '#ff7af5', ropes: ['#ff7af5', '#ffffff', '#7ff9ff'] },
]

/** Where a fighter stands to start: the red corner (slot 0) and the blue (slot 1). */
export const cornerOf = (ring, slot) => [ring.x + (slot === 0 ? -2.6 : 2.6), ring.z]

/** Where you land when you step (or are pushed) out of a ring: the foot of its ramp. */
export const ringExit = (ring) => [ring.x, 2, ring.z - RING_PLATFORM_HALF - 4.8]

/** The ring whose canvas `[x, z]` is over, or null. `margin` widens the test. */
export function ringAt(x, z, margin = 0) {
  for (const ring of RINGS) {
    if (Math.abs(x - ring.x) <= RING_HALF + margin && Math.abs(z - ring.z) <= RING_HALF + margin) return ring
  }
  return null
}
