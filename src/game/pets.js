/**
 * Pets hatched from eggs (see eggs.js — same id, one pet per egg). Hatching
 * cost/rarity still lives on the egg; this is the animal that comes out of it.
 *
 * species:   which animal it is. PetModel builds the whole body from this — its
 *            proportions, ears, tail, horns and gait all come from the SPECIES
 *            table there, so no two pets share a silhouette.
 * colors:    { body, belly, accent, eye }
 * glow:      emissive strength (defaults to 0)
 * winsBonus: while it's following you, every Win you earn is multiplied by this.
 *            It climbs with the egg's price, so the premium eggs are the ones
 *            worth saving for (see petWinsMultiplier).
 * spots:     optional patches on the coat, purely cosmetic.
 */
export const PETS = [
  {
    id: 'common',
    name: 'Bun',
    species: 'rabbit',
    winsBonus: 1.1,
    colors: { body: '#ffffff', belly: '#ffd7e6', accent: '#ff9fc2', eye: '#2a2a2a' },
  },
  {
    id: 'spotted',
    name: 'Pup',
    species: 'dog',
    winsBonus: 1.25,
    spots: true,
    colors: { body: '#f4f0e6', belly: '#ffffff', accent: '#2b2b33', eye: '#1a1a1a' },
  },
  {
    id: 'coral',
    name: 'Mochi',
    species: 'cat',
    winsBonus: 1.5,
    colors: { body: '#ffe3d6', belly: '#ffffff', accent: '#ff5c8a', eye: '#3a1a20' },
  },
  {
    id: 'jungle',
    name: 'Rex',
    species: 'dino',
    winsBonus: 1.8,
    colors: { body: '#46d160', belly: '#bff7c8', accent: '#1f7a36', eye: '#0a3a14' },
  },
  {
    id: 'frost',
    name: 'Fox',
    species: 'fox',
    winsBonus: 2.2,
    colors: { body: '#eaf9ff', belly: '#ffffff', accent: '#4fb6e8', eye: '#1c3a4a' },
    glow: 0.35,
  },
  {
    id: 'amber',
    name: 'Rango',
    species: 'bear',
    winsBonus: 2.8,
    colors: { body: '#c97a2b', belly: '#f0c98a', accent: '#6b3a12', eye: '#2a1608' },
    glow: 0.25,
  },
  {
    id: 'magma',
    name: 'Imp',
    species: 'dragon',
    winsBonus: 3.5,
    colors: { body: '#3a1208', belly: '#ff6a1f', accent: '#ffb347', eye: '#ffd23f' },
    glow: 0.6,
  },
  {
    id: 'crystal',
    name: 'Kit',
    species: 'deer',
    winsBonus: 5,
    colors: { body: '#b47cff', belly: '#e6d4ff', accent: '#5a2aa8', eye: '#2a1150' },
    glow: 0.6,
  },
  {
    id: 'galaxy',
    name: 'Fen',
    species: 'wolf',
    winsBonus: 8,
    colors: { body: '#3b2a8a', belly: '#6a54c8', accent: '#ff7af5', eye: '#ffe9ff' },
    glow: 0.75,
  },
  {
    id: 'rainbow',
    name: 'Iri',
    species: 'unicorn',
    winsBonus: 15,
    colors: { body: '#ff4fd8', belly: '#7ff9ff', accent: '#ffe94a', eye: '#2a2a2a' },
    glow: 0.9,
  },
  {
    id: 'exclusive',
    name: 'Tralaledon',
    species: 'dragon',
    // The VIP pet, so the best bonus in the game - but bonuses add up, so this is
    // a big lift on top of a full squad rather than a replacement for one.
    winsBonus: 20,
    colors: { body: '#5a8ad8', belly: '#eaf4ff', accent: '#ff3b5a', eye: '#1a1a2a' },
    glow: 0.9,
  },
]

/** @returns the pet, or undefined for an unknown id. */
export const getPet = (id) => PETS.find((p) => p.id === id)

/** How many pets can follow you at once: all of them, once they're all hatched. */
export const MAX_EQUIPPED = PETS.length

/**
 * What the pets following you multiply your Wins by — 1 with none out. Their
 * bonuses add up, so a whole squad beats any one of them alone: that's the
 * number the Pets panel shows at the top, and every payout goes through it
 * (see claimPad and breakCaveWall in gameStore).
 *
 * @param {string[]} ids the equipped pets' ids
 */
export const petWinsMultiplier = (ids) => {
  // A string, not a list, is progress saved before pets came in squads.
  const list = Array.isArray(ids) ? ids : ids ? [ids] : []
  const total = list.reduce((sum, id) => sum + (getPet(id)?.winsBonus ?? 0), 0)
  return total > 0 ? total : 1
}
