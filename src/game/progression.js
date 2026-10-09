import { tidy } from './format'

/**
 * Levels, boosts, auto clickers and walk speed: the numbers behind the bottom HUD.
 */

export const MAX_LEVEL = 20

/** Strength needed to reach `level` (level 1 is free). */
export const levelStrength = (level) => (level <= 1 ? 0 : tidy(100 * 3 ** (level - 2)))

/** The level a Strength total has reached. */
export function levelFor(strength) {
  let level = 1
  while (level < MAX_LEVEL && strength >= levelStrength(level + 1)) level++
  return level
}

/** Click multiplier for a level: 1x at level 1, rising evenly to 5x at the max. */
export const levelMultiplier = (level) => 1 + ((level - 1) * 4) / (MAX_LEVEL - 1)

/**
 * Rebirth: trade all the Strength you have for a permanent multiplier on every click
 * you make afterwards. Strength goes back to zero and the climb starts again, but
 * faster each time - which is the only way a clicker keeps going once the last level
 * is reached and the bar has nowhere left to fill.
 *
 * Nothing else is touched. Wins, gloves, pets, bags and every pass
 * all survive a rebirth, because losing something that was paid for would make the
 * button a trap rather than a reward.
 *
 * `MAX_LEVEL` deliberately does not move. Raising the cap is what the games this one
 * borrows from do, and it does not survive the arithmetic here: the level curve is
 * `100 x 3^(level-2)`, so a cap of 40 would want 1.35e20 Strength and JavaScript stops
 * counting whole numbers exactly at 9.007e15. Everything past that silently rounds,
 * which shows up as a level bar that will not fill and a total that stops rising. The
 * multiplier grows instead of the cap, and the cap is never the thing that breaks.
 */

/** What the next rebirth costs, as a multiple of the one before. */
export const REBIRTH_STEP = 5

/**
 * Strength needed to rebirth, given how many have been done already. The first one is
 * the top of the level ladder - reach the last level and you may rebirth - and each
 * one after that asks for `REBIRTH_STEP` times more.
 *
 * It climbs because the reward does not climb as quickly. The multiplier goes 2x,
 * 3x, 4x, while a flat requirement would be met faster every single time: with the
 * best gloves and bag in the game the last level is about seven clicks away, so a
 * rebirth that only asked for the last level could be pressed again every few
 * seconds forever.
 */
export const rebirthStrength = (rebirths) => tidy(levelStrength(MAX_LEVEL) * REBIRTH_STEP ** rebirths)

/** Permanent click multiplier earned: 1x with none done, then 2x, 3x, and so on. */
export const rebirthMultiplier = (rebirths) => 1 + rebirths

/**
 * How many rebirths the game offers: seven, ending at x8.
 *
 * The limit is arithmetic, not taste. Each rebirth costs five times the last, and
 * JavaScript stops counting whole numbers exactly at 9.007e15; past there a total
 * silently rounds and the game quietly starts lying about it. The stop is one whole
 * step early on purpose - the test below asks whether the *next* price would still
 * fit - because a player does not stop clicking the instant they can afford it, and
 * the overshoot needs somewhere safe to land.
 *
 * Worked out rather than written down, so that changing MAX_LEVEL, the level curve
 * or REBIRTH_STEP moves this with them instead of leaving a stale number that lets
 * the game walk off the end of its own arithmetic.
 */
export const MAX_REBIRTHS = (() => {
  let n = 0
  while (levelStrength(MAX_LEVEL) * REBIRTH_STEP ** (n + 1) <= Number.MAX_SAFE_INTEGER) n++
  return n
})()

/** Whether the Rebirth button should do anything yet. */
export const canRebirth = (strength, rebirths) =>
  rebirths < MAX_REBIRTHS && strength >= rebirthStrength(rebirths)

/**
 * What rebirths open up, besides the multiplier: Space World, behind its portal in
 * the plaza, which refuses anyone short of the count (see world/Portal.jsx). With
 * MAX_REBIRTHS at seven, three puts it squarely mid-game rather than at the end.
 */
export const SPACE_REBIRTHS = 3

/** How long a bought power boost lasts. */
export const BOOST_S = 300

/** Power boosts, bought with Wins. Buying one again while it runs adds time. */
export const BOOSTS = [
  { multiplier: 2, cost: 100 },
  { multiplier: 4, cost: 1000 },
  { multiplier: 8, cost: 10000 },
]

/** `boost` (`{ multiplier, until }`, until in ms) if it's still running, else null. */
export const activeBoost = (boost, now = Date.now()) => (boost && boost.until > now ? boost : null)

/**
 * Auto clickers punch for you. The normal one is free; the OP one is much faster
 * and is unlocked once with Wins.
 */
export const AUTO_CLICKERS = {
  normal: { interval: 0.25 },
  op: { interval: 0.1, cost: 2500 },
}

/** Walk speed as shown on the HUD (Roblox-style units). */
export const WALK_SPEED = 16
