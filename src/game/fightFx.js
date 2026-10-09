/**
 * Reactions to the boxing rings, for the avatars to play: a flinch when a punch lands
 * on you, a fall to the canvas on a knockout, both gloves up on a win.
 *
 * Plain mutable state, like aim.js: written when the ring's messages arrive (see
 * net/lobbyClient.js and world/BoxingRing.jsx), read every frame by the avatars, and
 * nothing re-renders from it. Times are `performance.now()` seconds.
 */

/** How long each reaction plays, in seconds. */
export const HURT_S = 0.45
export const KO_S = 2.2
export const CHEER_S = 2.4

const fresh = () => ({ hurtAt: -Infinity, koAt: -Infinity, cheerAt: -Infinity })

/** The local player's. */
export const fightFx = fresh()

/** Everyone else's, by player id. */
const remote = new Map()

/** The reactions for `id`, or the local player's when `id` is ours / null. */
export function fxFor(id, selfId) {
  if (!id || id === selfId) return fightFx
  let fx = remote.get(id)
  if (!fx) {
    fx = fresh()
    remote.set(id, fx)
  }
  return fx
}

/** Forgets a player who left. */
export const dropFx = (id) => remote.delete(id)

/** 0..1 through a reaction that started at `at` and lasts `length`, else -1. */
export function progress(at, length, now = performance.now() / 1000) {
  const t = (now - at) / length
  return t >= 0 && t < 1 ? t : -1
}

/** Fills the reaction fields of an avatar's motion state from `fx`. */
export function applyFx(motion, fx, now = performance.now() / 1000) {
  motion.hurt = progress(fx.hurtAt, HURT_S, now)
  const ko = progress(fx.koAt, KO_S, now)
  motion.ko = ko >= 0 ? ko : 0
  const cheer = progress(fx.cheerAt, CHEER_S, now)
  motion.cheer = cheer >= 0 ? cheer : 0
}

/** Whether the local player is down on the canvas and should not move. */
export const knockedOut = (now = performance.now() / 1000) => progress(fightFx.koAt, KO_S, now) >= 0
