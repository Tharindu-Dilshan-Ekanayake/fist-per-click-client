/**
 * Shooting targets. Standing on a target's pad multiplies the Ammo each click gives.
 *
 * cost:       Wins to unlock it for good (the first is free)
 * multiplier: Ammo-per-click multiplier while standing on its pad
 *
 * rebirths:   rebirths needed as well as the Wins, on the top three only. Both gates
 *             have to be open; the Wins alone will not do it. They are what the
 *             ladder points at once the level bar has nothing left to fill - without
 *             them a rebirth buys a bigger number and nothing to spend it on, and
 *             the last three targets are simply bought the day a player can afford
 *             them and never thought about again. See game/progression.js.
 *
 * vip:        set on the two VIP targets. They cost Wins - a lot of them, and no
 *             rebirths - and stand on their own gold platform away from the rows
 *             (see world/layout.js).
 *
 * world:      2 on the four targets in Space World, which stand there rather than in
 *             the lobby's training zone.
 *
 * Ids still say "trainer" in the store (`activeTrainer`, `unlockedTrainers`): that is
 * what a target is to the game - a pad you stand on that trains your clicks.
 */
export const TRAINERS = [
  { id: 'target-1', name: 'Basic Target', multiplier: 1.5, cost: 0, color: '#ff4a4a' },
  { id: 'target-2', name: 'Blue Target', multiplier: 2, cost: 20, color: '#3fa9ff' },
  { id: 'target-3', name: 'Noob Target', multiplier: 3, cost: 60, color: '#ffd23f' },
  { id: 'target-4', name: 'Emerald Target', multiplier: 5, cost: 200, color: '#46d160' },
  { id: 'target-5', name: 'Dark Target', multiplier: 10, cost: 600, color: '#a45cff' },
  { id: 'target-6', name: 'Frost Target', multiplier: 25, cost: 1500, color: '#7fe6fb' },
  { id: 'target-7', name: 'Fire Target', multiplier: 50, cost: 4000, color: '#ff8f2e' },
  { id: 'target-8', name: 'Hacker Target', multiplier: 100, cost: 10000, rebirths: 1, color: '#2fe07a' },
  { id: 'target-9', name: 'Crystal Target', multiplier: 200, cost: 25000, rebirths: 2, color: '#ff5fb8' },
  { id: 'target-10', name: 'Rainbow Target', multiplier: 450, cost: 60000, rebirths: 3, color: '#ff3b6b' },

  // --- VIP targets. Shortcuts rather than an end point: 250x slots between the
  // ladder's 200x and 450x, 1000x above both, and neither asks for rebirths - which
  // is what the steep price buys.
  { id: 'vip-1', name: 'VIP Target', multiplier: 250, vip: true, cost: 250000, color: '#a45cff' },
  { id: 'vip-2', name: 'Golden VIP Target', multiplier: 1000, vip: true, cost: 5000000, color: '#ffd23f' },

  // --- Space World. Past both VIP targets; only found over there.
  { id: 'space-1', name: 'Moon Target', multiplier: 750, cost: 1000000, world: 2, color: '#d8dce8' },
  { id: 'space-2', name: 'Mars Target', multiplier: 1500, cost: 5000000, world: 2, color: '#ff6a3a' },
  { id: 'space-3', name: 'Nebula Target', multiplier: 3000, cost: 25000000, world: 2, color: '#c07bff' },
  { id: 'space-4', name: 'Black Hole Target', multiplier: 6000, cost: 100000000, world: 2, color: '#5a3aff' },
]

/** The two targets on the VIP platform. */
export const VIP_TRAINERS = TRAINERS.filter((t) => t.vip)
/** The ten unlocked with Wins - the two rows in the training zone. */
export const WINS_TRAINERS = TRAINERS.filter((t) => !t.vip && !t.world)
/** The four in Space World. */
export const SPACE_TRAINERS = TRAINERS.filter((t) => t.world === 2)

/**
 * Where a target stands relative to its pad's centre, in the pad's own (rotated)
 * frame. The player faces local -Z to shoot it; see `enterTrainer`'s `faceYaw`.
 */
export const DUMMY_OFFSET_Z = -2.6

/** @returns the target, or undefined for an unknown / null id. */
export const getTrainer = (id) => TRAINERS.find((t) => t.id === id)

/** How many more rebirths this target wants; 0 once it wants none. */
export const rebirthsShort = (trainer, rebirths) =>
  Math.max(0, (trainer?.rebirths ?? 0) - rebirths)
