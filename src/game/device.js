import { useEffect, useState } from 'react'

/**
 * Whether this is a phone or a tablet - which is to say, whether the on-screen
 * controls should be there.
 *
 * The test is what the *primary* pointer can do, not whether a touchscreen exists
 * anywhere. `pointer: coarse` is true for a finger and false for a mouse or
 * trackpad, and a touchscreen laptop still reports `fine` because its main pointer
 * is the trackpad - so a desktop player never gets a thumbstick over their game,
 * while a tablet with a stylus or a keyboard case still does.
 *
 * `?touch=1` in the URL forces it on and `?touch=0` off, which is the only way to
 * try the other layout on the machine you are building it on.
 */
const forced = (() => {
  if (typeof location === 'undefined') return null
  const value = new URLSearchParams(location.search).get('touch')
  return value === null ? null : value !== '0'
})()

const QUERY = '(pointer: coarse)'

export function isTouchDevice() {
  if (forced !== null) return forced
  if (typeof matchMedia !== 'function') return false
  return matchMedia(QUERY).matches
}

/**
 * The same thing as React state, kept up to date. It can genuinely change mid-session
 * - a tablet gaining a mouse, a phone docked to a desk - and the controls should
 * follow rather than be decided once at load.
 */
export function useTouchDevice() {
  const [touch, setTouch] = useState(isTouchDevice)

  useEffect(() => {
    if (forced !== null || typeof matchMedia !== 'function') return
    const media = matchMedia(QUERY)
    const onChange = () => setTouch(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return touch
}
