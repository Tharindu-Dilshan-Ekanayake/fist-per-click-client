import { tidy } from './format'

/**
 * The Infinity Cave: past the last stage, one wall regenerates forever right where
 * it stands. Break it and the very next moment a fresh one takes its place in the
 * exact same spot, one number higher, a little tougher, and its look cycling
 * through the game's own stage themes. There is no far side to walk through to —
 * a magic door back in the room returns you to the lobby whenever you're done.
 */

/** How many walls in a row share one look before it cycles to the next theme. */
export const THEME_SPAN = 3

/**
 * A wall's health at `number` (1-based) into the cave. Grows forever but only
 * polynomially, not exponentially like the numbered stage walls — a session here
 * has no natural end, so the numbers must never explode into the trillions after
 * a short while; they stay a normal, ever-climbing size no matter how long you stay.
 */
export const caveWallHp = (number) => tidy(60 * (number + 1) ** 1.55)

/** Wins for breaking it: a steady fraction of its own health. */
export const caveWallReward = (number) => Math.max(1, tidy(caveWallHp(number) * 0.02))
