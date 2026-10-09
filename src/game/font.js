/**
 * The game's lettering, in the one form both halves of the game can use.
 *
 * The HUD is HTML and could read the `--game-font` custom property straight from the
 * stylesheet. The signs in the world cannot: they are drawn with `ctx.font`, which
 * takes a plain string and silently ignores anything it cannot parse - a CSS
 * variable included. So the family lives here as a string, and index.css keeps the
 * matching custom property for the places where CSS is the better tool.
 *
 * The fallbacks matter more than they usually would. If the web font has not
 * arrived, canvas does not wait and does not tell anyone: it draws in whatever comes
 * next and the result is cached for the life of the page (see world/textures.js).
 * Trebuchet is there because it is the roundest thing installed on Windows and
 * macOS alike, so the wrong answer is at least the right shape.
 */
export const GAME_FONT = "'Fredoka', 'Trebuchet MS', system-ui, sans-serif"

/**
 * Weights, named rather than numbered at the call sites.
 *
 * Fredoka is a variable font that stops at 700. The old lettering was Arial Black,
 * which is a single very heavy weight, so everything asked for 900 and got it; asking
 * a 700 font for 900 does not fail, it quietly returns 700 on some browsers and a
 * smeared synthetic bold on others. Asking for what exists avoids both.
 */
export const FONT_WEIGHT = {
  /** Body text, prices, small print. */
  normal: 500,
  /** Buttons and labels. */
  bold: 600,
  /** Headlines, counters, anything with an outline around it. */
  heavy: 700,
}

/** A `ctx.font` string: `canvasFont(700, 88)` -> `700 88px 'Fredoka', ...`. */
export const canvasFont = (weight, px) => `${weight} ${px}px ${GAME_FONT}`

/**
 * Everything the page must have finished loading before a single sign is drawn.
 *
 * Canvas text does not wait for a web font, so this has to be awaited before the
 * world builds any of its textures - and it has to resolve either way, because a
 * font that fails to load must leave the game playable rather than stuck on a
 * loading screen for ever.
 */
export async function loadGameFont(timeoutMs = 3000) {
  if (typeof document === 'undefined' || !document.fonts) return false
  const wanted = Object.values(FONT_WEIGHT).map((w) => document.fonts.load(`${w} 16px Fredoka`))
  try {
    await Promise.race([
      Promise.all(wanted),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ])
  } catch {
    // A font that will not load is not a reason to refuse to start the game.
  }
  return document.fonts.check(`${FONT_WEIGHT.heavy} 16px Fredoka`)
}
