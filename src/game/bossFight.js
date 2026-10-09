import { create } from 'zustand'

export const BOSS_PLAYER_MAX_HP = 100

/**
 * The boss fight as the HUD sees it, written by the arena (world/BossArena.jsx).
 *
 * The arena keeps the exact health in a ref, changing every shot; this is a copy it
 * publishes a few times a second, which is all a health bar and a countdown need and
 * keeps the HUD from re-rendering at the auto clicker's rate.
 *
 * phase: 'waiting' - the boss is up and nobody has fired yet; the clock has not started
 *        'fighting' - the clock is running
 *        'down'     - beaten; the next one steps in at `nextAt`
 */
export const useBossFight = create(() => ({
  phase: 'waiting',
  level: 1,
  hp: 0,
  maxHp: 1,
  /** `performance.now()` ms the clock runs out, while fighting. */
  endsAt: 0,
  /** `performance.now()` ms the next boss arrives, while down. */
  nextAt: 0,
  /** `performance.now()` ms of the boss's next attack. */
  attackAt: 0,
  /** While an attack is winding up: when it lands, and what the HUD shouts. */
  warningUntil: 0,
  warningText: '',
  /** Local player's health in the boss arena; restored when they re-enter. */
  playerHp: BOSS_PLAYER_MAX_HP,
  maxPlayerHp: BOSS_PLAYER_MAX_HP,
  /** `performance.now()` ms of the latest fireball hit, for HUD feedback. */
  playerHitAt: 0,
  /** Brief movement lock after a hit, so the knockback can be felt. */
  staggerUntil: 0,
}))
