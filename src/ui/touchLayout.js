import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * The sizes the touch HUD and the on-screen controls have to agree on.
 *
 * They stack: the HUD panel sits flat along the bottom edge and the stick and
 * buttons ride above it. The first arrangement had it the other way round -
 * controls at the bottom, panel above them - and on a phone held upright that put
 * the panel across the middle of the screen, which is exactly where the camera keeps
 * the player. You could not see your own character behind your own Power counter.
 *
 * Kept here rather than in either component because each needs the other's height,
 * and a number that has drifted apart in two files is a layout that overlaps.
 */

/** Height of the HUD panel, and size of the thumbstick's pad, at full size. */
export const HUD_STRIP_H = 96
export const STICK_SIZE = 144
/** What every control keeps between itself and the edge of the screen. */
export const CONTROL_MARGIN = 10

/**
 * The screen these sizes were drawn for. Below it everything shrinks together.
 */
const REFERENCE_W = 640
const REFERENCE_H = 420
/**
 * Never smaller than this, however small the window. Past about here the buttons
 * stop being reliable to hit, and a control you miss is worse than one that covers
 * a little of the view.
 */
const MIN_SCALE = 0.62

const measure = () => {
  if (typeof window === 'undefined') return 1
  return Math.max(
    MIN_SCALE,
    Math.min(1, window.innerWidth / REFERENCE_W, window.innerHeight / REFERENCE_H),
  )
}

/**
 * How much to shrink the controls and the HUD panel for this screen.
 *
 * A phone is not one size. At full size the console is comfortable on a tablet and
 * swallows a small phone whole - the stick alone was more than a third of the width,
 * and the sword button sat on top of the player. Everything down there scales off
 * this one number so the proportions hold and the game keeps the middle of the
 * screen to itself.
 */
export function useTouchScale() {
  const [scale, setScale] = useState(measure)

  useEffect(() => {
    const onResize = () => setScale(measure())
    onResize()
    window.addEventListener('resize', onResize)
    // Turning the phone over is a resize on most browsers but not all of them.
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return scale
}

/**
 * How tall the HUD panel actually turned out to be.
 *
 * The controls have to sit above it, and its height is not something either side can
 * work out in advance: the panel grows a line when the player hits the level cap,
 * the boost row wraps differently at different widths, and the fonts are the
 * browser's to lay out. Guessing it produced exactly the overlap this is here to
 * stop - the Power counter printed across the jump button. So the panel measures
 * itself and says, and the controls follow.
 */
let stripHeight = HUD_STRIP_H
const listeners = new Set()

/** Called by the HUD panel whenever its size changes. */
export function reportStripHeight(height) {
  const next = Math.max(0, Math.round(height))
  if (next === stripHeight) return
  stripHeight = next
  for (const listener of listeners) listener()
}

const subscribe = (listener) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useStripHeight() {
  return useSyncExternalStore(
    subscribe,
    () => stripHeight,
    () => HUD_STRIP_H,
  )
}
