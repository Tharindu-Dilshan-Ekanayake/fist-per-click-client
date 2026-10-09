import { tidy } from './format'

/**
 * Stage wall balance. Every stage is a corridor of solid, numbered walls; you break
 * each by punching it, and every punch deals your current Strength as damage. Walls heal
 * between punches, so each needs roughly a tenth of its health in Strength to get
 * through. Broken walls stay down until you're back in the lobby.
 */

/** Stage N holds walls 10(N-1)+1 … 10N. */
export const WALLS_PER_STAGE = 10

/** The stage (1-based) wall `number` belongs to. */
export const wallStage = (number) => Math.ceil(number / WALLS_PER_STAGE)

/**
 * Space World's walls are numbered from here up (1001, 1002, ...), so they can share
 * `brokenWalls` and every wall component with the lobby's without ever colliding.
 */
export const SPACE_WALL_BASE = 1000
export const isSpaceWall = (number) => number > SPACE_WALL_BASE
/** How many walls the Space World corridor holds. */
export const SPACE_WALLS = 10

/**
 * Wall health: each lobby wall is a quarter tougher than the one before. Space
 * World's start where a third rebirth leaves you - about a hundred billion - and
 * climb faster.
 */
export const wallHp = (number) =>
  isSpaceWall(number)
    ? tidy(1e11 * 1.6 ** (number - SPACE_WALL_BASE - 1))
    : tidy(10 * 1.25 ** (number - 1))

/** Fraction of its full health a damaged wall recovers per second. */
export const WALL_REGEN = 0.5

/**
 * Seconds to wait, once you're back in the lobby, before every broken wall rebuilds.
 * A brief grace period rather than an instant snap shut, so it doesn't seal behind
 * you the moment you step through.
 */
export const WALL_RESET_DELAY_S = 10

/**
 * The two Win pads at the end of each stage's cabin, in front of the next stage's
 * first wall. side: -1 left, +1 right, seen walking in.
 *
 * Gold, on the right, is the normal pad: always open, pays the base Wins.
 *
 * Blue, on the left, is the VIP pad. It pays double and asks for no Strength at all,
 * but it stays shut until the player buys the VIP Wins Pad pass with Wins (see
 * game/passes.js) — one purchase opens the blue pad in front of every stage, for
 * good. `pass` is what makes a pad pass-gated; `strength` is then ignored.
 */
export const WIN_PADS = [
  { id: 'blue', side: -1, color: '#2fd4ff', fill: ['#e8fdff', '#35d8ff'], wins: 2, strength: 0, pass: 'vipWins' },
  { id: 'gold', side: 1, color: '#ffe14a', fill: ['#fff6a8', '#ffc21a'], wins: 1, strength: 0 },
]

/** Seconds to hold E on a Win pad to cash in. */
export const HOLD_S = 1.2

/**
 * What the gold pad at the end of each stage pays, stage 1 first.
 *
 * The first four are the ones the reference game opens with - 1, 5, 10, 50 - and are
 * meant to be felt: the first new gloves cost 5 Wins, so stage 2 buys them in one trip.
 * After that each stage pays four to five times the last, which is what keeps the
 * glove shop's prices (they climb about 2.4x a pair, two or three pairs a stage) within
 * reach of whoever is pushing deeper rather than whoever is grinding stage 1.
 */
export const STAGE_WINS = [
  1, 5, 10, 50, 250, 1000, 5000, 25000, 100000, 500000, 2500000, 10000000, 50000000, 250000000, 1000000000,
  5000000000, 25000000000, 100000000000,
]

/** Base Wins for clearing stage `stage` (1-based); past the table, the last entry. */
export const stageWins = (stage) => STAGE_WINS[Math.max(0, Math.min(stage, STAGE_WINS.length) - 1)]

/** What the gold pad past Space World's tenth wall pays: double the lobby's last stage. */
export const SPACE_STAGE_WINS = 200000000000

/**
 * Wins for cashing in at the pads in front of wall `number`, i.e. after breaking
 * the `number - 1` walls before it - which is the whole of the stage before it.
 */
export const padWins = (number, pad) =>
  (isSpaceWall(number) ? SPACE_STAGE_WINS : stageWins(wallStage(number - 1))) * pad.wins

/** Strength needed before a pad pays out. Zero for both of today's pads. */
export const padStrength = (number, pad) => wallHp(number) * pad.strength

/**
 * Whether this pad will pay out right now.
 *
 * A VIP pad opens on the pass and nothing else; a normal one opens on Strength. Takes
 * the game state rather than reading the store itself, so the pads' render path and
 * `claimPad` can both ask the same question of the same snapshot.
 *
 * @param {number} number the wall the pad stands before
 * @param {object} pad an entry of WIN_PADS
 * @param {{ strength: number, ownedPasses: string[] }} state
 */
export function padUnlocked(number, pad, state) {
  if (pad.pass) return state.ownedPasses.includes(pad.pass)
  return state.strength >= padStrength(number, pad)
}
