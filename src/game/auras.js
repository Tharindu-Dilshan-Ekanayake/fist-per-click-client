/**
 * Auras: a glow round the player, worn one at a time, seen by everyone in the lobby.
 *
 * Some come free with the levels - reach `level` (on any run; a rebirth does not
 * take them back) and the aura is yours. The rest are bought in the shop with Wins
 * (`cost`). Either way it is kept for good; the Shop's Auras tab wears or takes it
 * off.
 *
 * style:  how its particles move (see PlayerFx):
 *           'spark'   glittering points drifting up
 *           'flame'   fire licking up round the body
 *           'swirl'   a spiral of light turning round the player
 *           'bubbles' wobbling bubbles rising and fading
 *           'lightning' crackling bolts and flashes
 *           'galaxy'  stars orbiting on tilted rings
 *           'rainbow' every colour, spiralling
 *           'crown'   a halo of gold with light pouring down from it
 * colors: [main, second] - the particles fade from one to the other
 * rarity: what the shop calls it, and the colour its tile wears
 */
export const AURAS = [
  { id: 'spark', name: 'Spark Aura', style: 'spark', colors: ['#fff6a8', '#ffb31a'], level: 3, rarity: 'Common' },
  { id: 'ember', name: 'Ember Aura', style: 'flame', colors: ['#ffd166', '#ff3b1a'], level: 6, rarity: 'Rare' },
  { id: 'frost', name: 'Frost Aura', style: 'swirl', colors: ['#e8fbff', '#3fb6ff'], level: 10, rarity: 'Rare' },
  { id: 'toxic', name: 'Toxic Aura', style: 'bubbles', colors: ['#e2ff80', '#2fd43a'], level: 14, rarity: 'Epic' },
  { id: 'champion', name: 'Champion Aura', style: 'crown', colors: ['#fff3a0', '#ffb000'], level: 20, rarity: 'Legendary' },

  { id: 'love', name: 'Love Aura', style: 'bubbles', colors: ['#ffd0e8', '#ff4fb8'], cost: 2500, rarity: 'Common' },
  { id: 'thunder', name: 'Thunder Aura', style: 'lightning', colors: ['#ffffff', '#ffe94a'], cost: 25000, rarity: 'Rare' },
  { id: 'shadow', name: 'Shadow Aura', style: 'flame', colors: ['#d9a6ff', '#5a1fb0'], cost: 150000, rarity: 'Epic' },
  { id: 'ocean', name: 'Ocean Aura', style: 'swirl', colors: ['#7ff9ff', '#2a64e8'], cost: 600000, rarity: 'Epic' },
  { id: 'galaxy', name: 'Galaxy Aura', style: 'galaxy', colors: ['#ff7af5', '#6a54ff'], cost: 2500000, rarity: 'Legendary' },
  { id: 'inferno', name: 'Inferno Aura', style: 'flame', colors: ['#fff3a0', '#ff2a00'], cost: 12000000, rarity: 'Legendary', big: true },
  { id: 'rainbow', name: 'Rainbow Aura', style: 'rainbow', colors: ['#ff3b6b', '#7ff9ff'], cost: 50000000, rarity: 'Mythic' },
  { id: 'divine', name: 'Divine Aura', style: 'crown', colors: ['#ffffff', '#7ff9ff'], cost: 250000000, rarity: 'Mythic', big: true },
]

/** The shop's tile colours, by rarity. */
export const AURA_RARITY = {
  Common: ['#b8c0cc', '#6a7280'],
  Rare: ['#5ac8ff', '#1a6fd8'],
  Epic: ['#d07bff', '#7a2fe4'],
  Legendary: ['#ffd84a', '#f07800'],
  Mythic: ['#ff6ad5', '#ff3b3b'],
}

/** @returns the aura, or undefined for an unknown / null id. */
export const getAura = (id) => AURAS.find((a) => a.id === id)

/** The auras the levels give, lowest first. */
export const LEVEL_AURAS = AURAS.filter((a) => a.level)

/** The ids of every level aura that reaching `level` has earned. */
export const aurasForLevel = (level) => LEVEL_AURAS.filter((a) => a.level <= level).map((a) => a.id)
