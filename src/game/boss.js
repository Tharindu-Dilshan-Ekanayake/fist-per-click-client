import { tidy } from './format'

/**
 * Boss balance. The arena (world/BossArena.jsx) holds one boss at a time; beat it
 * before the clock runs out and the next one is a level higher, tougher and better
 * paid. Lose, and the same boss heals and waits for another go.
 *
 * Every shot deals the Ammo that shot earned - the same number that flies up to the
 * counter - so the things that make clicks bigger (guns, rebirths, levels, boosts,
 * the 2x Power pass) are the things that win fights. Targets do not: you cannot
 * stand on a target's pad inside the arena.
 */

/** Seconds a fight lasts from the first shot. */
export const BOSS_TIME_S = 60

/** Seconds before the next boss steps in after one falls. */
export const BOSS_RESPAWN_S = 6

/**
 * Health at `level`. Level 1 falls to a fresh rebirth's gun on auto-click inside the
 * minute; each level after wants about three times the damage.
 */
export const bossHp = (level) => tidy(2000000 * 3 ** (level - 1))

/** Wins for beating the boss at `level`, before pets and the 2x Wins pass. */
export const bossReward = (level) => tidy(2000 * 3.2 ** (level - 1))

/**
 * The look of the boss at `level`: the colours cycle so each level reads as new.
 * `fire` is the colour of everything it throws at you; `horn` its horns and claws.
 */
const SKINS = [
  { name: 'Inferno Brute', body: '#8a1a14', armor: '#241014', eye: '#ffcf3a', horn: '#e8dcc0', fire: '#ff5a1a' },
  { name: 'Toxic Titan', body: '#2f7a24', armor: '#16200f', eye: '#e4ff3a', horn: '#d8e8b0', fire: '#7dff2a' },
  { name: 'Frost Demon', body: '#3a7aa8', armor: '#0f1e30', eye: '#d6f6ff', horn: '#ffffff', fire: '#5ad8ff' },
  { name: 'Void Lord', body: '#4a1a8a', armor: '#120a22', eye: '#ff4fd8', horn: '#2a1a3a', fire: '#c05aff' },
  { name: 'Magma King', body: '#b8420f', armor: '#2a0c04', eye: '#fff07a', horn: '#1a0a06', fire: '#ff7a1a' },
]
export const bossSkin = (level) => SKINS[(level - 1) % SKINS.length]

/**
 * How hard the boss at `level` fights back. Everything climbs with the level, so a
 * boss that is merely tougher to kill is also harder to stand in front of:
 *
 *   damage    per hit taken, out of the player's 100 (BOSS_PLAYER_MAX_HP)
 *   cooldown  seconds of rest between attacks
 *   windup    seconds of warning before an attack lands - the time you have to react
 *   speed     how fast its fire rings fly
 *   volley    rings per throw
 *   lead      0..1, how far ahead of a running player it aims
 *   attacks   what it knows: level 1 only throws; the slam comes at 2, the rapid
 *             barrage at 4, meteors at 6
 *
 * Each is clamped, so even a level 50 boss can still be dodged by someone watching.
 */
export function bossStats(level) {
  const n = level - 1
  return {
    damage: Math.min(60, 14 + 5 * n),
    cooldown: Math.max(0.9, 3 - 0.2 * n),
    windup: Math.max(0.45, 0.95 - 0.05 * n),
    speed: Math.min(28, 12 + 1.5 * n),
    volley: Math.min(7, 1 + Math.floor(n / 2) * 2),
    lead: Math.min(0.8, 0.12 * n),
    barrage: Math.min(9, 3 + Math.floor(n / 2)),
    meteors: Math.min(9, 3 + Math.floor(n / 2)),
    waves: level >= 5 ? 2 : 1,
    attacks: ['throw', ...(level >= 2 ? ['slam'] : []), ...(level >= 4 ? ['barrage'] : []), ...(level >= 6 ? ['meteor'] : [])],
  }
}
