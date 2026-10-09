import { FONT_WEIGHT, GAME_FONT } from '../game/font'

/**
 * The game's lettering, as the HUD draws it.
 *
 * Five files each kept their own copy of this, which was survivable while it was two
 * lines and became a problem the moment the outline had to change: the same fix in
 * five places, and one of them always gets missed.
 *
 * ## Why the outline is a shadow and not a stroke
 *
 * It used to be `-webkit-text-stroke`, which draws a line *centred on* the edge of
 * each letter - half of it outside the glyph and half of it eating into the glyph.
 * Arial Black survived that because its strokes are thick enough to lose a bit off
 * each side. Fredoka does not: at 1.5px the counters of a and e closed up, the thin
 * joins in R and B were cut through, and the bigger the text the more obviously
 * damaged the letters looked.
 *
 * `paint-order: stroke fill` is the proper answer to this and Firefox supports it
 * for HTML text. Chrome only honours it on SVG, which rules it out for a HUD.
 *
 * So the outline is eight offset copies of the text in `text-shadow`, which land
 * entirely *behind* the glyph and cannot touch its shape. It is the same trick the
 * signs in the world use (they stroke first and fill over the top - see
 * world/textures.js), arrived at from the other direction.
 */

/** Eight offsets: four square, four diagonal at ~0.7 so the corners stay round. */
const ring = (radius, color) => {
  const d = +(radius * 0.7).toFixed(2)
  return [
    `${radius}px 0 0 ${color}`,
    `-${radius}px 0 0 ${color}`,
    `0 ${radius}px 0 ${color}`,
    `0 -${radius}px 0 ${color}`,
    `${d}px ${d}px 0 ${color}`,
    `-${d}px ${d}px 0 ${color}`,
    `${d}px -${d}px 0 ${color}`,
    `-${d}px -${d}px 0 ${color}`,
  ]
}

const INK = '#111'

/**
 * Outlined HUD text.
 *
 * @param {number} radius how far the outline reaches, in px
 * @param {number} lift how far the drop shadow sits below the text, in px
 */
export const outlined = (radius = 1.5, lift = 3) => ({
  fontFamily: GAME_FONT,
  fontWeight: FONT_WEIGHT.heavy,
  textShadow: [
    ...ring(radius, INK),
    `0 ${lift}px 0 rgba(0,0,0,0.85)`,
    `0 0 ${lift + 5}px rgba(0,0,0,0.5)`,
  ].join(', '),
})

/** The everyday one: counters, prices, prompts. */
export const OUTLINE = outlined()

/** The loading screen's, which is bigger and wants a heavier edge to match. */
export const OUTLINE_BIG = outlined(2, 4)

/**
 * Chips, badges and anything small enough that an outline would close its letters
 * up. Same lettering, nothing drawn around it.
 */
export const CHIP = { fontFamily: GAME_FONT, fontWeight: FONT_WEIGHT.bold }

/**
 * Text on a dark solid card - toasts, mainly. It already has all the contrast it
 * needs from what is behind it, so it gets a soft drop shadow and no outline.
 */
export const SOFT = {
  fontFamily: GAME_FONT,
  fontWeight: FONT_WEIGHT.bold,
  textShadow: '0 2px 0 rgba(0,0,0,0.55)',
}
