/**
 * Every pair of boxing gloves in the game.
 *
 * cost:    Wins needed to buy them (Wins come from the Win pads at the end of each stage)
 * power:   Strength gained per punch while they're on
 * design:  which model they are built as (see GloveModel) - the silhouette and the
 *          extras bolted on:
 *            'classic'  plain leather glove with a striped cuff
 *            'pro'      laced pro glove with a stitched seam and a padded thumb
 *            'spiked'   studs across the knuckles and the back of the hand
 *            'flame'    flames licking back off the cuff
 *            'crystal'  a cluster of glowing shards on the back of the hand
 *            'tech'     glowing circuit lines and an energy core
 *            'thunder'  lightning bolts and a crackle of sparks
 *            'galaxy'   rings orbiting the fist, and stars
 *            'royal'    a gold crown plate and gems on the cuff
 *            'dragon'   horns swept back off the cuff and claws on the knuckles
 *            'divine'   a halo over the cuff and little wings
 * main / cuff / trim: the three colours. `trim` is the part that glows.
 * size:    model scale; later gloves are bigger
 * glow:    emissive strength of the trim
 *
 * vip:     set on the two VIP pairs. They cost Wins like everything else - a lot of
 *          them, well above where they would sit in the ladder - and stand on their
 *          own gold platform away from the rows (see world/layout.js).
 *
 * world:   2 on the pairs sold in Space World, which stand there rather than in the
 *          lobby's rows. Everything else is world 1.
 */
export const GLOVES = [
  { id: 'rookie', name: 'Rookie Gloves', design: 'classic', cost: 0, power: 1, main: '#e8352d', cuff: '#f4f4f4', trim: '#ffd23f', size: 1 },
  { id: 'bomber', name: 'Blue Bomber', design: 'classic', cost: 5, power: 2, main: '#2f7cff', cuff: '#ffffff', trim: '#8fe0ff', size: 1.02, glow: 0.2 },
  { id: 'golden-jab', name: 'Golden Jab', design: 'pro', cost: 25, power: 5, main: '#ffc21a', cuff: '#2b2b33', trim: '#fff3a0', size: 1.04, glow: 0.25 },
  { id: 'cyber', name: 'Cyber Fist', design: 'tech', cost: 100, power: 12, main: '#1d1f2b', cuff: '#28e0ff', trim: '#b45cff', size: 1.06, glow: 0.6 },
  { id: 'splash', name: 'Splash Puncher', design: 'pro', cost: 300, power: 30, main: '#ff8a1f', cuff: '#2fa8ff', trim: '#ffe14a', size: 1.08, glow: 0.3 },
  { id: 'brawler', name: 'Spiked Brawler', design: 'spiked', cost: 800, power: 75, main: '#d0202a', cuff: '#1b1b22', trim: '#ff6a3a', size: 1.1, glow: 0.4 },
  { id: 'slime', name: 'Slime Smasher', design: 'pro', cost: 2000, power: 180, main: '#4dd83a', cuff: '#1d2a1d', trim: '#a6ff4a', size: 1.12, glow: 0.6 },
  { id: 'banana', name: 'Banana Knuckles', design: 'classic', cost: 5000, power: 450, main: '#ffe14a', cuff: '#7a5a1a', trim: '#fff3a0', size: 1.14, glow: 0.4 },
  { id: 'toxic', name: 'Toxic Crusher', design: 'spiked', cost: 12000, power: 1100, main: '#3e4a2a', cuff: '#8dff3a', trim: '#c8ff3a', size: 1.16, glow: 0.7 },
  { id: 'frost', name: 'Frost Fist', design: 'crystal', cost: 28000, power: 2600, main: '#bfe9ff', cuff: '#3fb6ff', trim: '#e8fbff', size: 1.18, glow: 0.7 },
  { id: 'lava', name: 'Lava Hammers', design: 'flame', cost: 65000, power: 6000, main: '#3a1a10', cuff: '#ff6a1f', trim: '#ffd166', size: 1.2, glow: 0.8 },
  { id: 'plasma', name: 'Plasma Pounders', design: 'tech', cost: 150000, power: 14000, main: '#ff4fd8', cuff: '#2a2238', trim: '#ff9af0', size: 1.22, glow: 0.8 },
  { id: 'thunder', name: 'Thunder Fists', design: 'thunder', cost: 350000, power: 33000, main: '#3a4a8a', cuff: '#ffe94a', trim: '#ffffff', size: 1.24, glow: 0.8 },
  { id: 'shadow', name: 'Shadow Knuckles', design: 'spiked', cost: 800000, power: 78000, main: '#1b1630', cuff: '#8a5ac8', trim: '#b65cff', size: 1.26, glow: 0.9 },
  { id: 'crystal', name: 'Crystal Crushers', design: 'crystal', cost: 1800000, power: 180000, main: '#e0b3ff', cuff: '#ffffff', trim: '#f0d9ff', size: 1.28, glow: 0.7 },
  { id: 'solar', name: 'Solar Flares', design: 'flame', cost: 4000000, power: 420000, main: '#ffb12e', cuff: '#fff3b0', trim: '#fff6d0', size: 1.3, glow: 1 },
  { id: 'void', name: 'Void Gauntlets', design: 'tech', cost: 9000000, power: 1000000, main: '#14101f', cuff: '#6a1fff', trim: '#d9a6ff', size: 1.32, glow: 1 },
  { id: 'galaxy', name: 'Galaxy Gloves', design: 'galaxy', cost: 20000000, power: 2400000, main: '#4b3cff', cuff: '#ff7af5', trim: '#ff7af5', size: 1.34, glow: 1 },
  { id: 'prism', name: 'Prism Punchers', design: 'crystal', cost: 45000000, power: 5500000, main: '#ff4fd8', cuff: '#7ff9ff', trim: '#7ff9ff', size: 1.36, glow: 1 },
  { id: 'inferno', name: 'Inferno Fists', design: 'flame', cost: 100000000, power: 13000000, main: '#2a0d06', cuff: '#ff4a1f', trim: '#ffd166', size: 1.38, glow: 1 },
  { id: 'nebula', name: 'Nebula Knuckles', design: 'galaxy', cost: 250000000, power: 32000000, main: '#7a4fff', cuff: '#ff7af5', trim: '#d9c2ff', size: 1.4, glow: 1 },
  { id: 'eclipse', name: 'Eclipse Gauntlets', design: 'royal', cost: 600000000, power: 80000000, main: '#141428', cuff: '#ffd23f', trim: '#ffe9a8', size: 1.42, glow: 1 },
  { id: 'dragon', name: 'Dragon Fists', design: 'dragon', cost: 1500000000, power: 200000000, main: '#1f7a46', cuff: '#c8d4e0', trim: '#9fffd0', size: 1.44, glow: 0.9 },
  { id: 'divine', name: 'Divine Fists', design: 'divine', cost: 4000000000, power: 520000000, main: '#fff6d0', cuff: '#ffd23f', trim: '#ffffff', size: 1.46, glow: 1 },

  // --- VIP gloves. Stronger than their price in the ladder would buy, and priced
  // well above it: Phantom hits like something between Plasma and Thunder for the
  // cost of Shadow; Celestial like something between Solar and Void for Prism money.
  { id: 'phantom', name: 'Phantom Fists', design: 'tech', vip: true, cost: 1000000, power: 25000, main: '#1d1030', cuff: '#a45cff', trim: '#f0dcff', size: 1.3, glow: 0.95 },
  { id: 'celestial', name: 'Celestial Gauntlets', design: 'royal', vip: true, cost: 25000000, power: 700000, main: '#fff3cf', cuff: '#7ff9ff', trim: '#ffd76a', size: 1.36, glow: 1 },

  // --- Space World. Past the top of the lobby's ladder; only sold over there.
  { id: 'meteor', name: 'Meteor Fists', design: 'flame', world: 2, cost: 10000000000, power: 1200000000, main: '#3a2a20', cuff: '#ff8a3a', trim: '#ffd27a', size: 1.48, glow: 1 },
  { id: 'comet', name: 'Comet Crushers', design: 'crystal', world: 2, cost: 25000000000, power: 2500000000, main: '#1b2a4a', cuff: '#7fd8ff', trim: '#e0f7ff', size: 1.5, glow: 1 },
  { id: 'quasar', name: 'Quasar Gauntlets', design: 'galaxy', world: 2, cost: 60000000000, power: 5000000000, main: '#2a1050', cuff: '#ff4fd8', trim: '#7ff9ff', size: 1.52, glow: 1 },
  { id: 'supernova', name: 'Supernova Fists', design: 'divine', world: 2, cost: 150000000000, power: 10000000000, main: '#fff0f8', cuff: '#ff3b6b', trim: '#ffe94a', size: 1.54, glow: 1 },
]

/** The two pairs on the VIP platform, in shop order. */
export const VIP_GLOVES = GLOVES.filter((g) => g.vip)
/** Everything bought with Wins in the lobby - the long rows along the west wall. */
export const WINS_GLOVES = GLOVES.filter((g) => !g.vip && !g.world)
/** The pairs sold in Space World. */
export const SPACE_GLOVES = GLOVES.filter((g) => g.world === 2)

export const DEFAULT_GLOVE = GLOVES[0].id

/** The colour a pair glows in the shop. */
export const glowColor = (glove) => glove.trim

/** Every pair from weakest to strongest, by Strength per punch. */
const BY_POWER = [...GLOVES].sort((a, b) => a.power - b.power)
/** The highest tier there is: the strongest pair's. */
export const MAX_GLOVE_TIER = GLOVES.length - 1

/**
 * How far up the ladder a pair is, 0 for the rookies to MAX_GLOVE_TIER for the best.
 * The fancier extras on the model (see GloveModel) and their footprints
 * (footprintSets.js) switch on as this climbs.
 */
export const gloveTier = (glove) => BY_POWER.indexOf(glove)

/** Looks a pair up by id, falling back to the rookies (e.g. for an old save). */
export const getGlove = (id) => GLOVES.find((g) => g.id === id) ?? GLOVES[0]

/** Which punch sound a pair makes (see `punch` in sound.js). */
export const punchKind = (glove) =>
  ({ flame: 'fire', thunder: 'zap', tech: 'zap', crystal: 'crystal', galaxy: 'cosmic', divine: 'cosmic' })[glove.design] ??
  (glove.power >= 1000 ? 'heavy' : 'thud')
