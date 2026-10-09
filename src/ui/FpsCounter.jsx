import { useEffect, useRef } from 'react'

import { useSettings } from '../game/settings'
import { CHIP } from './textStyle'

/** How often the readout updates. Per-frame would be unreadable. */
const SAMPLE_MS = 500

/**
 * Frames per second, top right, shown only while the portal's `show_fps` setting
 * is on (see game/settings.js).
 *
 * The count is written straight to the DOM node from a rAF loop rather than held
 * in React state - a twice-a-second re-render of the whole HUD to change two
 * digits is exactly the kind of overhead an FPS counter is supposed to help you
 * find, not cause.
 */
export function FpsCounter() {
  const show = useSettings((s) => s.showFps)
  const ref = useRef(null)

  useEffect(() => {
    if (!show) return
    let frames = 0
    let since = performance.now()
    let raf = 0

    const tick = (now) => {
      frames += 1
      if (now - since >= SAMPLE_MS) {
        if (ref.current) ref.current.textContent = `${Math.round((frames * 1000) / (now - since))} FPS`
        frames = 0
        since = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [show])

  if (!show) return null

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute right-4 top-4 z-20 rounded-lg border-2 px-2 py-0.5 text-lg text-lime-300"
      style={{
        borderColor: '#1b1b25',
        background: '#000000aa',
        ...CHIP,
      }}
    >
      — FPS
    </div>
  )
}

export default FpsCounter
