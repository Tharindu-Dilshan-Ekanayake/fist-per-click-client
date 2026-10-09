/**
 * Every gun in the game.
 *
 * cost:   Wins needed to buy it (Wins come from the Win pads at the end of each stage)
 * ammo:   Ammo gained per click while it's equipped
 * type:   which model it is built as - 'pistol' | 'blaster' | 'rifle' | 'shotgun' |
 *         'launcher' | 'minigun' (see GunModel). The type also picks the shot sound:
 *         blasters and rays go "pew", everything else goes "bang".
 * body / accent / trim: its three colours. `trim` is the part that glows.
 * size:   model scale; later guns are bigger
 * glow:   emissive strength of the trim
 * laser:  fires a laser rather than bullets (the sound and the tracer colour)
 *
 * vip:    set on the two VIP guns. They cost Wins like everything else - a lot of
 *         them, well above where they would sit in the ladder - and stand on their
 *         own gold platform away from the rows (see world/layout.js).
 *
 * world:  2 on the guns sold in Space World, which stand there rather than in the
 *         lobby's rows. Everything else is world 1.
 */
export const GUNS = [
  { id: 'starter', name: 'Starter Pistol', type: 'pistol', cost: 0, ammo: 1, body: '#3a3f4a', accent: '#c9ced8', trim: '#ffb23a', size: 1 },
  { id: 'space', name: 'Space Blaster', type: 'blaster', cost: 5, ammo: 2, body: '#f2f2f7', accent: '#7b3fe4', trim: '#c07bff', size: 1.03, glow: 0.3, laser: true },
  { id: 'eagle', name: 'Golden Eagle', type: 'pistol', cost: 25, ammo: 5, body: '#f4f4f4', accent: '#ffcf3a', trim: '#ffe680', size: 1.06, glow: 0.2 },
  { id: 'cyber', name: 'Cyber Blaster', type: 'blaster', cost: 100, ammo: 12, body: '#1d1f2b', accent: '#28e0ff', trim: '#b45cff', size: 1.1, glow: 0.6, laser: true },
  { id: 'splash', name: 'Splash Blaster', type: 'blaster', cost: 300, ammo: 30, body: '#ff8a1f', accent: '#2fa8ff', trim: '#ffe14a', size: 1.14, glow: 0.3, laser: true },
  { id: 'redshot', name: 'Red Shotgun', type: 'shotgun', cost: 800, ammo: 75, body: '#d0202a', accent: '#1b1b22', trim: '#ff6a3a', size: 1.18, glow: 0.4 },
  { id: 'slime', name: 'Slime Gun', type: 'blaster', cost: 2000, ammo: 180, body: '#1d2a1d', accent: '#4dff3a', trim: '#a6ff4a', size: 1.22, glow: 0.7, laser: true },
  { id: 'banana', name: 'Banana Gun', type: 'pistol', cost: 5000, ammo: 450, body: '#ffe14a', accent: '#7a5a1a', trim: '#fff3a0', size: 1.26, glow: 0.4 },
  { id: 'toxic', name: 'Toxic Gun', type: 'rifle', cost: 12000, ammo: 1100, body: '#4a4f55', accent: '#8dff3a', trim: '#c8ff3a', size: 1.3, glow: 0.7 },
  { id: 'freeze', name: 'Freeze Gun', type: 'blaster', cost: 28000, ammo: 2600, body: '#eaf6ff', accent: '#3fb6ff', trim: '#9ff3ff', size: 1.34, glow: 0.7, laser: true },
  { id: 'lava', name: 'Lava Launcher', type: 'launcher', cost: 65000, ammo: 6000, body: '#3a1a10', accent: '#ff6a1f', trim: '#ffd166', size: 1.38, glow: 0.8 },
  { id: 'plasma', name: 'Plasma Rifle', type: 'rifle', cost: 150000, ammo: 14000, body: '#2a2238', accent: '#ff4fd8', trim: '#ff9af0', size: 1.42, glow: 0.8, laser: true },
  { id: 'thunder', name: 'Thunder Gun', type: 'blaster', cost: 350000, ammo: 33000, body: '#3a4a8a', accent: '#ffe94a', trim: '#ffffff', size: 1.46, glow: 0.8, laser: true },
  { id: 'shadow', name: 'Shadow Shotgun', type: 'shotgun', cost: 800000, ammo: 78000, body: '#1b1630', accent: '#8a5ac8', trim: '#b65cff', size: 1.5, glow: 0.9 },
  { id: 'crystal', name: 'Crystal Cannon', type: 'launcher', cost: 1800000, ammo: 180000, body: '#e0b3ff', accent: '#ffffff', trim: '#f0d9ff', size: 1.54, glow: 0.7 },
  { id: 'solar', name: 'Solar Ray', type: 'blaster', cost: 4000000, ammo: 420000, body: '#ffb12e', accent: '#fff3b0', trim: '#fff6d0', size: 1.58, glow: 1, laser: true },
  { id: 'void', name: 'Void Rifle', type: 'rifle', cost: 9000000, ammo: 1000000, body: '#14101f', accent: '#6a1fff', trim: '#d9a6ff', size: 1.62, glow: 1, laser: true },
  { id: 'galaxy', name: 'Galaxy Blaster', type: 'blaster', cost: 20000000, ammo: 2400000, body: '#4b3cff', accent: '#ff7af5', trim: '#ff7af5', size: 1.66, glow: 1, laser: true },
  { id: 'prism', name: 'Prism Ray', type: 'blaster', cost: 45000000, ammo: 5500000, body: '#ff4fd8', accent: '#7ff9ff', trim: '#7ff9ff', size: 1.7, glow: 1, laser: true },
  { id: 'inferno', name: 'Inferno Minigun', type: 'minigun', cost: 100000000, ammo: 13000000, body: '#2a0d06', accent: '#ff4a1f', trim: '#ffd166', size: 1.74, glow: 1 },
  { id: 'nebula', name: 'Nebula Rifle', type: 'rifle', cost: 250000000, ammo: 32000000, body: '#7a4fff', accent: '#ff7af5', trim: '#d9c2ff', size: 1.78, glow: 1, laser: true },
  { id: 'eclipse', name: 'Eclipse Cannon', type: 'launcher', cost: 600000000, ammo: 80000000, body: '#141428', accent: '#ffd23f', trim: '#ffe9a8', size: 1.82, glow: 1 },
  { id: 'titan', name: 'Titan Minigun', type: 'minigun', cost: 1500000000, ammo: 200000000, body: '#4a5a6a', accent: '#c8d4e0', trim: '#9fd8ff', size: 1.86, glow: 0.9 },
  { id: 'divine', name: 'Divine Ray', type: 'blaster', cost: 4000000000, ammo: 520000000, body: '#fff6d0', accent: '#ffd23f', trim: '#ffffff', size: 1.9, glow: 1, laser: true },

  // --- VIP guns. Stronger than their price in the ladder would buy, and priced
  // well above it: Phantom hits like something between Plasma and Thunder for the
  // cost of Shadow; Celestial like something between Solar and Void for Prism money.
  { id: 'phantom', name: 'Phantom Blaster', type: 'blaster', vip: true, cost: 1000000, ammo: 25000, body: '#1d1030', accent: '#a45cff', trim: '#f0dcff', size: 1.48, glow: 0.95, laser: true },
  { id: 'celestial', name: 'Celestial Minigun', type: 'minigun', vip: true, cost: 25000000, ammo: 700000, body: '#fff3cf', accent: '#7ff9ff', trim: '#ffd76a', size: 1.64, glow: 1 },

  // --- Space World. Past the top of the lobby's ladder; only sold over there.
  { id: 'meteor', name: 'Meteor Rifle', type: 'rifle', world: 2, cost: 10000000000, ammo: 1200000000, body: '#3a2a20', accent: '#ff8a3a', trim: '#ffd27a', size: 1.94, glow: 1 },
  { id: 'comet', name: 'Comet Cannon', type: 'launcher', world: 2, cost: 25000000000, ammo: 2500000000, body: '#1b2a4a', accent: '#7fd8ff', trim: '#e0f7ff', size: 1.98, glow: 1 },
  { id: 'quasar', name: 'Quasar Ray', type: 'blaster', world: 2, cost: 60000000000, ammo: 5000000000, body: '#2a1050', accent: '#ff4fd8', trim: '#7ff9ff', size: 2.02, glow: 1, laser: true },
  { id: 'supernova', name: 'Supernova Minigun', type: 'minigun', world: 2, cost: 150000000000, ammo: 10000000000, body: '#fff0f8', accent: '#ff3b6b', trim: '#ffe94a', size: 2.06, glow: 1 },
]

/** The two guns on the VIP platform, in shop order. */
export const VIP_GUNS = GUNS.filter((g) => g.vip)
/** Everything bought with Wins in the lobby - the long rows along the west wall. */
export const WINS_GUNS = GUNS.filter((g) => !g.vip && !g.world)
/** The guns sold in Space World. */
export const SPACE_GUNS = GUNS.filter((g) => g.world === 2)

export const DEFAULT_GUN = GUNS[0].id

/** The colour a gun glows in the shop. */
export const glowColor = (gun) => gun.trim

/** Every gun from weakest to strongest, by Ammo per click. */
const BY_POWER = [...GUNS].sort((a, b) => a.ammo - b.ammo)
/** The highest tier there is: the strongest gun's. */
export const MAX_GUN_TIER = GUNS.length - 1

/**
 * How far up the ladder a gun is, 0 for the starter to MAX_GUN_TIER for the best.
 * The fancier extras on the model (see GunModel) and its footprints (footprintSets.js)
 * switch on as this climbs.
 */
export const gunTier = (gun) => BY_POWER.indexOf(gun)

/** Looks a gun up by id, falling back to the starter (e.g. for an old save). */
export const getGun = (id) => GUNS.find((g) => g.id === id) ?? GUNS[0]

/** Which shot sound a gun makes (see `shoot` in sound.js). */
export const shotKind = (gun) =>
  gun.laser
    ? 'laser'
    : ({ shotgun: 'shotgun', launcher: 'heavy', minigun: 'minigun' })[gun.type] ?? 'bang'
