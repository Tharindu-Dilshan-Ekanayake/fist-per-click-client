import { setCameraSensitivity, setQuality, setShowFps } from '../game/settings'
import { setMasterVolume } from '../game/sound'
import { safeCall, toUnsubscribe } from './sdk'

/**
 * The settings this game claims support for, and what each one does.
 *
 * Calling `settings.listen(key, …)` is what tells the portal to enable that
 * control in its in-game pause menu — keys nobody listens for stay greyed out
 * with a "this game doesn't support X" note. So this list is a promise: only add
 * a key here once something actually honours it, or players get a live slider
 * that does nothing.
 *
 * Deliberately absent:
 *   music_volume  - the game has no music, only synthesised effects (sound.js).
 *   enable_chat   - the portal handles chat itself and never delivers this key.
 *   fullscreen    - applied by the portal to the browser, not by the game.
 *
 * Every value arrives as a string ("80", "High", "true"), so each handler parses
 * before it applies.
 */
const HANDLERS = {
  /** 0-100 → a 0-1 scale on the master gain node. */
  master_volume: (value) => {
    const pct = parseInt(value, 10)
    setMasterVolume((Number.isFinite(pct) ? pct : 80) / 100)
  },
  /** 'Low' | 'Medium' | 'High' | 'Ultra' → render resolution, shadows, sparkles. */
  graphics_quality: (value) => setQuality(value),
  /** 'true' | 'false' → the FPS readout in the corner. */
  show_fps: (value) => setShowFps(value === 'true'),
  /**
   * A multiplier on the camera's drag speed, 1 being the game's own tuning.
   * parseFloat, not parseInt: the portal can send "0.5" and parseInt makes that 0.
   */
  camera_sensitivity: (value) => setCameraSensitivity(parseFloat(value)),
}

/**
 * Subscribes to every setting above. Each listener fires once immediately with
 * the current value (a default until the portal's real one lands) and again on
 * every change.
 *
 * Call this right after `init()` and before `loadingEnd()`, so the portal's first
 * push can't arrive before anyone is listening.
 *
 * @param {object} sdk the resolved `window.Legion.SDK`
 * @returns {() => void} unsubscribes every listener
 */
export function listenToPortalSettings(sdk) {
  const settings = sdk?.settings
  if (!settings?.listen) return () => {}

  const offs = Object.entries(HANDLERS).map(([key, apply]) =>
    toUnsubscribe(
      safeCall(settings.listen.bind(settings), key, (value) => {
        try {
          apply(value)
        } catch (err) {
          console.warn(`[bloxity] settings "${key}" failed to apply:`, err)
        }
      }),
    ),
  )

  return () => offs.forEach((off) => safeCall(off))
}

/**
 * Re-fires every listener with the values held right now.
 *
 * The audio graph, the renderer and the camera are all built after the portal's
 * first settings push arrives, so without this they'd start on defaults and only
 * pick up the player's real choices the next time they touched a slider.
 *
 * @param {object} sdk the resolved `window.Legion.SDK`
 */
export function applyPortalSettings(sdk) {
  safeCall(sdk?.settings?.triggerAll?.bind(sdk.settings))
}
