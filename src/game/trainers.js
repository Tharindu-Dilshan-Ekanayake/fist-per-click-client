/**
 * Punching bags. Standing on a bag's training pad multiplies the Strength each punch
 * gives, and punches it for you.
 *
 * cost:       Wins to unlock it for good (the first is free)
 * multiplier: Strength-per-punch multiplier while standing on its pad
 *
 * rebirths:   rebirths needed as well as the Wins, on the top three only. Both gates
 *             have to be open; the Wins alone will not do it. They are what the
 *             ladder points at once the level bar has nothing left to fill - without
 *             them a rebirth buys a bigger number and nothing to spend it on, and
 *             the last three bags are simply bought the day a player can afford
 *             them and never thought about again. See game/progression.js.
 *
 * vip:        set on the two VIP bags. They cost Wins - a lot of them, and no
 *             rebirths - and stand on their own gold platform away from the rows
 *             (see world/layout.js).
 *
 * world:      2 on the four bags in Space World, which stand there rather than in
 *             the lobby's training zone.
 *
 * color / band: the bag's leather and the stripe round its middle.
 *
 * Ids still say "trainer" in the store (`activeTrainer`, `unlockedTrainers`): that is
 * what a bag is to the game - a pad you stand on that trains your punches.
 */
export const TRAINERS = [
  { id: 'bag-1', name: 'Starter Bag', multiplier: 1.5, cost: 0, color: '#ff4a4a', band: '#ffffff' },
  { id: 'bag-2', name: 'Blue Bag', multiplier: 2, cost: 20, color: '#3fa9ff', band: '#ffffff' },
  { id: 'bag-3', name: 'Gold Bag', multiplier: 3, cost: 60, color: '#ffd23f', band: '#2b2b33' },
  { id: 'bag-4', name: 'Emerald Bag', multiplier: 5, cost: 200, color: '#46d160', band: '#ffffff' },
  { id: 'bag-5', name: 'Shadow Bag', multiplier: 10, cost: 600, color: '#a45cff', band: '#ffd23f' },
  { id: 'bag-6', name: 'Frost Bag', multiplier: 25, cost: 1500, color: '#7fe6fb', band: '#ffffff' },
  { id: 'bag-7', name: 'Fire Bag', multiplier: 50, cost: 4000, color: '#ff8f2e', band: '#2b1a10' },
  { id: 'bag-8', name: 'Hacker Bag', multiplier: 100, cost: 10000, rebirths: 1, color: '#2fe07a', band: '#101a14' },
  { id: 'bag-9', name: 'Crystal Bag', multiplier: 200, cost: 25000, rebirths: 2, color: '#ff5fb8', band: '#ffffff' },
  { id: 'bag-10', name: 'Rainbow Bag', multiplier: 450, cost: 60000, rebirths: 3, color: '#ff3b6b', band: '#ffe94a', rainbow: true },

  // --- VIP bags. Shortcuts rather than an end point: 250x slots between the
  // ladder's 200x and 450x, 1000x above both, and neither asks for rebirths - which
  // is what the steep price buys.
  { id: 'vip-1', name: 'VIP Bag', multiplier: 250, vip: true, cost: 250000, color: '#a45cff', band: '#ffd23f' },
  { id: 'vip-2', name: 'Golden VIP Bag', multiplier: 1000, vip: true, cost: 5000000, color: '#ffd23f', band: '#ffffff' },

  // --- Space World. Past both VIP bags; only found over there.
  { id: 'space-1', name: 'Moon Bag', multiplier: 750, cost: 1000000, world: 2, color: '#d8dce8', band: '#5a5f73' },
  { id: 'space-2', name: 'Mars Bag', multiplier: 1500, cost: 5000000, world: 2, color: '#ff6a3a', band: '#ffd27a' },
  { id: 'space-3', name: 'Nebula Bag', multiplier: 3000, cost: 25000000, world: 2, color: '#c07bff', band: '#7ff9ff' },
  { id: 'space-4', name: 'Black Hole Bag', multiplier: 6000, cost: 100000000, world: 2, color: '#5a3aff', band: '#ff7af5' },
]

/** The two bags on the VIP platform. */
export const VIP_TRAINERS = TRAINERS.filter((t) => t.vip)
/** The ten unlocked with Wins - the two rows in the training zone. */
export const WINS_TRAINERS = TRAINERS.filter((t) => !t.vip && !t.world)
/** The four in Space World. */
export const SPACE_TRAINERS = TRAINERS.filter((t) => t.world === 2)

/**
 * Where a bag hangs relative to its pad's centre, in the pad's own (rotated) frame.
 * The player faces local -Z to punch it; see `enterTrainer`'s `faceYaw`.
 */
export const BAG_OFFSET_Z = -1.55

/** @returns the bag, or undefined for an unknown / null id. */
export const getTrainer = (id) => TRAINERS.find((t) => t.id === id)

/** How many more rebirths this bag wants; 0 once it wants none. */
export const rebirthsShort = (trainer, rebirths) =>
  Math.max(0, (trainer?.rebirths ?? 0) - rebirths)
