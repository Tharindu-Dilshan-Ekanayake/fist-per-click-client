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
  { id: 0, name: 'RING 1', x: -24, z: 76, mat: '#f6f4ee', skirt: '#2a64e8', accent: '#5cc4ff', ropes: ['#ff3b3b', '#ffffff', '#2a64e8'] },
  { id: 1, name: 'RING 2', x: -8, z: 76, mat: '#f4f8ff', skirt: '#1e9e58', accent: '#7dff9a', ropes: ['#ffd23f', '#ffffff', '#1e9e58'] },
  { id: 2, name: 'RING 3', x: 8, z: 76, mat: '#ff3b3b', skirt: '#2b2b33', accent: '#ff8a7a', ropes: ['#ffffff', '#2b2b33', '#ffffff'] },
  { id: 3, name: 'RING 4', x: 24, z: 76, mat: '#d86bff', skirt: '#3a1f6e', accent: '#ff7af5', ropes: ['#ff7af5', '#ffffff', '#7ff9ff'] },
]

/**
 * The two pads in front of every ring (its south side, facing the way in), red
 * corner to the west and blue to the east: stand on one, and when someone stands on
 * the other you are both taken into the ring.
 */
export const PAD_OFFSET = 2.7
/** How far in front of the ring's middle the pads are. */
export const PAD_FRONT = 8
export const PAD_RADIUS = 1.15
export const CORNER_COLORS = ['#ff4a4a', '#3f8cff']
export const CORNER_NAMES = ['RED CORNER', 'BLUE CORNER']

/** Where ring `ring`'s pad `slot` is: [x, z]. */
export const padOf = (ring, slot) => [ring.x + (slot === 0 ? -PAD_OFFSET : PAD_OFFSET), ring.z - PAD_FRONT]

/** Where a fighter is put to start: in their corner's half, facing the other. */
export const fightSpot = (ring, slot) => [ring.x + (slot === 0 ? -1.3 : 1.3), RING_FLOOR + 1.2, ring.z]

/** Where a fighter comes out when the fight is over: the ground beside their pad. */
export const exitSpot = (ring, slot) => {
  const [x, z] = padOf(ring, slot)
  return [x + (slot === 0 ? -2.4 : 2.4), 2, z]
}

/** Where anyone who somehow ends up on a canvas they should not be on is put. */
export const ringExit = (ring) => [ring.x, 2, ring.z - RING_PLATFORM_HALF - 2.4]
