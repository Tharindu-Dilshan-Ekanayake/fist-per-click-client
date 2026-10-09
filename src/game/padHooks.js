/**
 * What E does on a boxing ring's pad, filled in by ringLocal.js.
 *
 * Its own module, with nothing imported, so the store can call it without the store
 * and the ring code importing each other.
 */
export const padHooks = {
  /** E on pad `id` ("ring:slot"): join it, or leave it if already on it. */
  toggle: null,
}
