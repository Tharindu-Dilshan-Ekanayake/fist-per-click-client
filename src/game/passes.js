/**
 * Passes: bought once with Wins and kept forever, the way a Roblox game pass works -
 * not spent, they just flip something on. They are the most expensive things in the
 * lobby's shop, because each one multiplies everything that comes after it.
 *
 * `cost` is in Wins.
 */
export const PASSES = [
  {
    id: 'vipWins',
    name: 'VIP Wins Pad',
    cost: 100000,
    blurb: 'Unlocks the blue VIP pad at every stage. Double Wins, no Ammo needed.',
    color: '#2fd4ff',
    emoji: '🏆',
  },
  {
    id: 'power2x',
    name: '2x Power',
    cost: 500000,
    blurb: 'Every click gives twice the Ammo. Forever, on top of everything else.',
    color: '#3fb6ff',
    emoji: '⚡',
  },
  {
    id: 'wins2x',
    name: '2x Wins',
    cost: 1000000,
    blurb: 'Every Win pad, boss and cave wall pays double. Forever.',
    color: '#ffd23f',
    emoji: '🏆',
  },
  {
    id: 'autoWins',
    name: 'Auto Wins',
    cost: 2500000,
    blurb: 'Collects your best stage’s Wins every 10 seconds while it is switched on.',
    color: '#ff5fb8',
    emoji: '🤖',
  },
]

export const getPass = (id) => PASSES.find((p) => p.id === id)

/** Multiplier from the 2x passes, for whichever of them `ownedPasses` holds. */
export const passMultiplier = (ownedPasses, id) => (ownedPasses?.includes(id) ? 2 : 1)
