import { useEffect } from 'react'

import { useTouchDevice } from '../game/device'
import { useGame } from '../game/gameStore'
import { CHIP, OUTLINE } from './textStyle'

/** [key, what it does] — the whole control scheme, in the order you meet it. */
const ROWS = [
  ['W  S', 'walk forward / back'],
  ['A  D', 'turn the camera'],
  ['Space', 'jump'],
  ['Shift', 'sprint'],
  ['Left-click', 'punch / smash walls / fight in the rings'],
  ['E', 'buy / unlock / equip / open'],
  ['Hold E', 'cash in at a Win pad'],
  ['Right-drag', 'turn the camera'],
  ['Scroll', 'zoom'],
  ['M', 'sound on / off'],
  ['N', 'music on / off'],
  ['P', 'open / close Pets'],
  ['R', 'open / close Rebirth'],
  ['B', 'open / close Shop'],
  ['C', 'open / close Controls'],
  ['G', 'open / close the Guide'],
]

const INK = '#1b1b25'

/**
 * The controls list, in a popup rather than pinned to the screen.
 *
 * It used to sit down the left edge for the whole session - quiet, but permanent,
 * and permanent is what ten rows of a game's own instructions should not be once a
 * player has read them once. This is the same list, opened by the same kind of
 * button as Pets and Rebirth (see ControlsButton below) and closed the same way
 * every other panel in this game closes: the ✕, a click outside, or Escape.
 */
function ControlsDialog() {
  const touch = useTouchDevice()
  const close = () => useGame.getState().toggleControlsPanel(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className={`w-full rounded-2xl border-4 ${touch ? 'max-w-xs p-3' : 'max-w-sm p-4'}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: INK,
          background: 'linear-gradient(to bottom, #5a4a7a, #3a2f52)',
          boxShadow: '0 10px 0 rgba(0,0,0,0.45)',
        }}
      >
        <div className={`flex items-center justify-between ${touch ? 'mb-2' : 'mb-3'}`}>
          <span className={`text-white ${touch ? 'text-xl' : 'text-3xl'}`} style={OUTLINE}>
            Controls
          </span>
          <button
            type="button"
            onClick={close}
            className={`pointer-events-auto relative cursor-pointer rounded-lg border-4 text-white transition duration-100 hover:brightness-110 active:translate-y-0.5 ${
              touch ? 'px-2 py-0.5 text-base' : 'px-3 py-1 text-xl'
            }`}
            style={{
              ...OUTLINE,
              borderColor: INK,
              background: 'linear-gradient(to bottom, #ff6a6a, #d02b2b)',
              boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.22), 0 3px 0 rgba(0,0,0,0.45)',
            }}
          >
            &#10006;
          </button>
        </div>

        <div className={`flex flex-col ${touch ? 'gap-1' : 'gap-1.5'}`}>
          {ROWS.map(([key, action]) => (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`rounded border-2 bg-black/35 text-center font-semibold text-white ${
                  touch ? 'min-w-16 px-1 py-0.5 text-xs' : 'min-w-24 px-1.5 py-0.5 text-sm'
                }`}
                style={{ borderColor: 'rgba(255,255,255,0.25)' }}
              >
                {key}
              </span>
              <span className={`text-white/85 ${touch ? 'text-xs' : 'text-sm'}`}>{action}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Mounted once, wherever the other panels are: only draws the dialog while open. */
export function ControlsPanel() {
  const open = useGame((s) => s.controlsOpen)
  return open ? <ControlsDialog /> : null
}

/** The keyboard emoji, drop-shadowed to match the other icon buttons in this rail. */
const EMOJI = { filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(0,0,0,0.35))' }

/**
 * The left-rail button that opens the panel - same slot Pets and Rebirth sit in,
 * so a player scanning that row for "how do I..." finds it in the same place.
 *
 * Not shown on a phone: there is no keyboard to explain there, and TouchControls
 * already draws the on-screen stick and buttons in their place.
 */
export function ControlsButton() {
  const touch = useTouchDevice()
  if (touch) return null

  return (
    <button
      type="button"
      onClick={() => useGame.getState().toggleControlsPanel()}
      className="pointer-events-auto relative flex h-[4.5rem] w-[4.5rem] cursor-pointer flex-col items-center justify-center rounded-xl border-4 transition duration-100 hover:-translate-y-0.5 hover:scale-[1.03] hover:brightness-110 active:translate-y-0.5 active:scale-[0.98]"
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #6fb8ff, #2f7ad6)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35" />
      <span className="pointer-events-none absolute -left-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border-2 px-1 text-[11px] text-white" style={{ ...CHIP, borderColor: INK, background: '#2879f0' }}>C</span>
      <span className="text-4xl" style={EMOJI} aria-hidden>
        ⌨️
      </span>
      <span className="text-[11px] leading-none text-white" style={CHIP}>
        Controls
      </span>
    </button>
  )
}
