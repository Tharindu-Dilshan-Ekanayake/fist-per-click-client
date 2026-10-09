/**
 * Eggs in the lobby's egg zone. Hatching one spends Wins and gives its pet for good -
 * see pets.js.
 *
 * cost:   Wins to hatch one
 * colors: [base, accent] for the voxel egg
 * glow:   emissive strength
 *
 * vip:    set on the Exclusive egg. Its pet has the best bonus in the game, it
 *         costs far more than the Rainbow egg, and it sits on its own gold
 *         platform away from the rows (see world/layout.js).
 */
export const EGGS = [
  { id: 'common', name: 'Common Egg', cost: 50, colors: ['#f4f4f4', '#cfd8e3'] },
  { id: 'spotted', name: 'Spotted Egg', cost: 1000, colors: ['#ffd23f', '#2b2b33'] },
  { id: 'coral', name: 'Coral Egg', cost: 5000, colors: ['#ff9d76', '#ff5c8a'] },
  { id: 'jungle', name: 'Jungle Egg', cost: 12000, colors: ['#46d160', '#1f7a36'] },
  { id: 'frost', name: 'Frost Egg', cost: 50000, colors: ['#bff4ff', '#4fb6e8'], glow: 0.3 },
  { id: 'amber', name: 'Amber Egg', cost: 100000, colors: ['#f0a83a', '#6b3a12'], glow: 0.25 },
  { id: 'magma', name: 'Magma Egg', cost: 200000, colors: ['#ff6a1f', '#7a1a08'], glow: 0.5 },
  { id: 'crystal', name: 'Crystal Egg', cost: 600000, colors: ['#b47cff', '#5a2aa8'], glow: 0.5 },
  { id: 'galaxy', name: 'Galaxy Egg', cost: 2500000, colors: ['#3b2a8a', '#ff7af5'], glow: 0.7 },
  { id: 'rainbow', name: 'Rainbow Egg', cost: 10000000, colors: ['#ff4fd8', '#7ff9ff'], glow: 0.8 },

  // --- The VIP egg. Its pet carries the best Wins bonus in the game (see pets.js).
  { id: 'exclusive', name: 'Exclusive Egg', vip: true, cost: 50000000, colors: ['#bfe4ff', '#3f7cff'], glow: 0.9 },
]

/** The egg on the VIP platform. */
export const VIP_EGGS = EGGS.filter((e) => e.vip)
/** The eggs hatched with Wins - the two rows in the egg zone. */
export const WINS_EGGS = EGGS.filter((e) => !e.vip)

/** @returns the egg, or undefined for an unknown id. */
export const getEgg = (id) => EGGS.find((e) => e.id === id)
