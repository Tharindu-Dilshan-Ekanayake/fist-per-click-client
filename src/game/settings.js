import { create } from 'zustand'

import { isTouchDevice } from './device'

/**
 * Player settings, pushed in from the Bloxity portal's pause menu.
 *
 * The portal owns the UI — we never draw a settings screen. We register the keys
 * we actually honour (see bloxity/portalSettings.js), which is also what un-greys
 * their controls in that menu, and apply whatever it sends. Registering a key we
 * then ignore would be worse than leaving its control greyed out, so this file
 * and that registration list have to stay in step.
 *
 * Every value the portal sends is a string ("80", "High", "true"), so parsing
 * happens at the edge and everything below is already typed.
 */

/**
 * What each graphics level actually changes.
 *
 * `dpr` - render resolution, and the biggest single lever on a weak GPU, because it
 * is the only one that changes how many pixels get shaded. The two slow levels give
 * it as a plain number, a multiplier on CSS pixels. A `[min, max]` pair, which is
 * what all four used to be, does something quite different: R3F clamps the
 * *display's* devicePixelRatio into that range. On the 1x monitor almost every
 * low-end PC has, `[0.6, 1]` therefore resolved to 1 - identical to Ultra's
 * `[1, 2]`. Every level rendered at native resolution and the lever did nothing at
 * all for the machines it exists for. The two fast levels keep a range, where
 * clamping a Retina display down is the useful behaviour and rendering below native
 * would only throw detail away.
 *
 * `view` - how far from the player the world mounts anything at all (see
 * world/nearField.js), and the biggest lever on the CPU: an unmounted stage costs
 * nothing to cull, matrix-update or shadow-test. It is deliberately never small
 * enough to see, because the stage corridors are walled on both sides and anything
 * this cuts is already behind something. Below about 60 it starts to show at the far
 * end of a cabin.
 *
 * `shadows` / `shadowMap` - whether there is a shadow pass, and how big its texture
 * is. A 2048 map is four times the fill of a 1024 one, every frame.
 *
 * `sparkles` / `rings` - the decorative particle systems on glowing pets, eggs and
 * pads, and how many hologram rings rise off each shop pad. There are forty-nine of
 * those pads, every ring is a blended quad, and blending is what an integrated GPU
 * is worst at.
 *
 * `antialias` - whether the canvas gets a multisampled buffer. Off below High, and
 * it is the one setting here that cannot be changed without reloading: the sample
 * count belongs to the drawing buffer, which is fixed when the renderer is built
 * (see game/GameScene.jsx). Off costs nothing on the slow levels anyway - they
 * already render below native resolution, so the edges are soft before any of the
 * samples are spent, and four samples per pixel of bandwidth is exactly what an
 * integrated GPU has least of.
 *
 * `physicsHz` / `solverIterations` - the CPU side. Rapier runs on a fixed step with
 * an accumulator, so a machine that drops a frame owes that time back and pays it as
 * extra steps on the *next* frame, which makes that frame slower still. A weak CPU
 * can fall into that loop and never climb out, which is the difference between a
 * game that runs badly and one that locks up. Halving the rate costs half the work
 * per second and leaves twice the headroom before the loop can start. What the
 * player actually controls is velocity (see game/Player.jsx), and velocities do not
 * care what the step size is: the jump clears the 1.2-unit terrace steps either way.
 */
export const QUALITY = {
  Low: { dpr: 0.6, view: 70, shadows: false, shadowMap: 512, sparkles: false, rings: 1, physicsHz: 30, solverIterations: 2, antialias: false },
  Medium: { dpr: 0.85, view: 90, shadows: true, shadowMap: 1024, sparkles: false, rings: 2, physicsHz: 30, solverIterations: 4, antialias: false },
  High: { dpr: [1, 1.5], view: 110, shadows: true, shadowMap: 2048, sparkles: true, rings: 3, physicsHz: 60, solverIterations: 4, antialias: true },
  Ultra: { dpr: [1, 2], view: 140, shadows: true, shadowMap: 2048, sparkles: true, rings: 3, physicsHz: 60, solverIterations: 4, antialias: true },
}

/**
 * The level to start at, and to fall back to for an unknown value from the portal.
 *
 * Phones and tablets start on Low. They are the machines this matters most for -
 * a mid-range phone has a fraction of a desktop's fill rate and is throttled for
 * heat besides - and a player who finds it too plain can move it up in the portal's
 * menu, which is a far better first impression than one who finds it unplayable.
 */
const DEFAULT_QUALITY = isTouchDevice() ? 'Low' : 'High'

/**
 * The last level this player chose, remembered locally.
 *
 * The portal is still the owner of the setting and still pushes the real value -
 * this is only a guess at what that value will be, and it is overwritten the moment
 * the push lands. It exists because of the one thing the push is too late for: the
 * renderer's multisample buffer is built with the canvas, before any setting has
 * arrived (see game/GameScene.jsx). Without this, a player on a slow machine who
 * had chosen Low was handed a High renderer on every single visit, and the only
 * setting that could have spared them was the one that could never reach it in time.
 *
 * Wrapped because storage is not always there to be read: a private window, blocked
 * site data, or an embedding the browser treats as third-party all throw here.
 */
const QUALITY_KEY = 'ppc:quality'

const rememberedQuality = () => {
  try {
    const saved = localStorage.getItem(QUALITY_KEY)
    return QUALITY[saved] ? saved : DEFAULT_QUALITY
  } catch {
    return DEFAULT_QUALITY
  }
}

export const useSettings = create(() => ({
  /** One of the QUALITY keys. */
  quality: rememberedQuality(),
  /** Whether to draw the FPS counter. */
  showFps: false,
  /** Multiplies the camera's right-drag speed; 1 is the game's own default. */
  cameraSensitivity: 1,
}))

/** The knobs for the current level, for components that render from it. */
export const qualityOf = (level) => QUALITY[level] ?? QUALITY[DEFAULT_QUALITY]

/** `'Low' | 'Medium' | 'High' | 'Ultra'`; anything else keeps the current level. */
export function setQuality(level) {
  if (!QUALITY[level]) return
  useSettings.setState({ quality: level })
  try {
    localStorage.setItem(QUALITY_KEY, level)
  } catch {
    // Storage is a convenience here; the portal remembers the real setting.
  }
}

export const setShowFps = (showFps) => useSettings.setState({ showFps: Boolean(showFps) })

/** Sanity bounds on the portal's multiplier, so one bad value can't freeze or spin the view. */
const MIN_SENSITIVITY = 0.1
const MAX_SENSITIVITY = 5

/**
 * The portal sends a plain multiplier on the game's own DRAG_SENSITIVITY, where 1
 * means "as the game tuned it".
 *
 * Not a percentage. The SDK's defaults table spells the difference out - it ships
 * `master_volume: "80"` on a 0-100 scale right next to `camera_sensitivity: "1"`.
 * This used to read it as 1-100 around a midpoint of 50, so the SDK's default of
 * "1" arrived as x0.02 and the camera crawled no matter what the game set. Values
 * are parsed as floats for the same reason: parseInt("0.5") is 0.
 */
export function setCameraSensitivity(multiplier) {
  const m = Number.isFinite(multiplier) ? multiplier : 1
  useSettings.setState({
    cameraSensitivity: Math.min(MAX_SENSITIVITY, Math.max(MIN_SENSITIVITY, m)),
  })
}
