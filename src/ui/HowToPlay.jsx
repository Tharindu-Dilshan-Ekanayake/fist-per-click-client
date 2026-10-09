import { useEffect, useState } from 'react'

import { useTouchDevice } from '../game/device'
import { CHIP, OUTLINE } from './textStyle'

const SEEN_KEY = 'ppc:how-to-play:v1'
const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP', 'KeyR', 'KeyB', 'KeyC', 'KeyM'])

function shouldShow() {
  try {
    return localStorage.getItem(SEEN_KEY) !== '1'
  } catch {
    return true
  }
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, '1')
  } catch {
    // The guide still closes for this session if storage is unavailable.
  }
}

const STEPS = [
  ['01', 'Follow the blue floor arrows to the Stage 01 gate.'],
  ['02', 'Shoot to earn Ammo, then break walls to reach the next stage.'],
  ['03', 'Hold E on a Win pad to collect Wins. Spend them on stronger guns, pets and targets.'],
  ['04', 'Reach the level cap and Rebirth for permanent Power. Rebirth 1 opens the Boss; Rebirth 3 opens Space World.'],
]

function Key({ children }) {
  return (
    <span className="rounded-lg border-2 border-slate-900/20 bg-white px-2 py-1 text-xs font-black text-slate-900 shadow-[0_2px_0_rgba(15,23,42,0.18)]">
      {children}
    </span>
  )
}

/** One-time first-session guide, shown above the game after its loading screen. */
export function HowToPlay() {
  const touch = useTouchDevice()
  const [open, setOpen] = useState(shouldShow)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        markSeen()
        setOpen(false)
      } else if (GAME_KEYS.has(event.code)) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyDown, true)
    }
  }, [open])

  if (!open) return null

  const startPlaying = () => {
    markSeen()
    setOpen(false)
  }

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        className="my-auto w-full max-w-xl overflow-hidden rounded-[1.75rem] border-[5px] border-[#191827] bg-[#fff9ed] shadow-[0_10px_0_rgba(0,0,0,0.55),0_24px_70px_rgba(0,0,0,0.45)]"
      >
        <div className="relative px-5 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-7">
          <div className="pointer-events-none absolute inset-x-8 top-2 h-2 rounded-full bg-white/80" />
          <div className="mb-1 text-center text-xs font-black uppercase tracking-[0.2em] text-sky-700" style={CHIP}>
            Welcome to +1 Ammo
          </div>
          <h1 id="how-to-play-title" className="text-center text-3xl text-[#211b36] sm:text-4xl" style={OUTLINE}>
            How to Play
          </h1>
          <p className="mt-1 text-center text-sm font-semibold text-slate-600 sm:text-base">
            Break through the stages, earn Wins and build your Power.
          </p>

          <div className="mt-5 rounded-2xl border-2 border-slate-900/10 bg-[#f0e7d6] p-3 sm:p-4">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-600" style={CHIP}>
              {touch ? 'Touch controls' : 'Controls'}
            </div>
            {touch ? (
              <div className="grid grid-cols-2 gap-2 text-sm font-bold text-slate-800">
                <div><Key>Joystick</Key> <span className="ml-1">Move</span></div>
                <div><Key>Drag</Key> <span className="ml-1">Look around</span></div>
                <div><Key>JUMP</Key> <span className="ml-1">Jump</span></div>
                <div><Key>SHOOT</Key> <span className="ml-1">Fire</span></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm font-bold text-slate-800">
                <div><Key>W A S D</Key> <span className="ml-1">Move</span></div>
                <div><Key>Right-drag</Key> <span className="ml-1">Look around</span></div>
                <div><Key>Space</Key> <span className="ml-1">Jump</span></div>
                <div><Key>Shift</Key> <span className="ml-1">Sprint</span></div>
                <div><Key>Left-click</Key> <span className="ml-1">Shoot</span></div>
                <div><Key>E</Key> <span className="ml-1">Interact</span></div>
              </div>
            )}
          </div>

          <div className="mt-4 space-y-2.5">
            {STEPS.map(([number, text]) => (
              <div key={number} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 border-[#191827] bg-gradient-to-b from-sky-300 to-blue-500 text-xs font-black text-white shadow-[0_2px_0_rgba(0,0,0,0.25)]"
                  style={OUTLINE}
                >
                  {number}
                </span>
                <p className="pt-0.5 text-sm font-bold leading-snug text-[#25243a] sm:text-base">{text}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl border-2 border-sky-300 bg-sky-100 px-3 py-2 text-center text-sm font-extrabold text-sky-900">
            Tip: the blue arrows on the floor point to Stage 01.
          </div>

          <button
            type="button"
            autoFocus
            onClick={startPlaying}
            className="mx-auto mt-5 flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl border-[4px] border-[#191827] bg-gradient-to-b from-lime-300 to-green-500 px-5 py-2 text-2xl text-white shadow-[0_5px_0_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.45)]"
            style={OUTLINE}
          >
            Let&apos;s play!
          </button>
          <p className="mt-2 text-center text-xs font-semibold text-slate-500">
            You can review the controls later from the Controls button.
          </p>
        </div>
      </section>
    </div>
  )
}

export default HowToPlay
