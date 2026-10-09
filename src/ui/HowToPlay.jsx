import { useEffect } from 'react'

import { useTouchDevice } from '../game/device'
import { useGame } from '../game/gameStore'
import { CHIP, OUTLINE } from './textStyle'

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP', 'KeyR', 'KeyB', 'KeyC', 'KeyG', 'KeyM', 'KeyN'])

/** The boxing rings, step by step: [icon, title, what happens]. */
const RING_STEPS = [
  ['🏟️', 'Find the rings', 'Four rings wait behind the training zone, past the BOXING RINGS arch.'],
  ['🥊', 'Pick a corner', 'Stand on the RED or BLUE pad in front of a ring and press E to join.'],
  ['🔔', 'Into the ring', 'When someone joins the other pad, you are both taken in. 3, 2, 1... FIGHT!'],
  ['👊', 'Punch to win', 'Click fast! The stronger fist hits harder. Knock them out to win Wins.'],
]

/** The rules worth knowing before stepping in, as chips. */
const RING_RULES = [
  ['⏱️', '45s rounds'],
  ['❤️', 'HP grows with level'],
  ['💪', 'Strength = damage'],
  ['🏆', 'Winner takes Wins'],
]

/**
 * The boxing rings get a card of their own: they are the one place you fight other
 * players, and the way in (a pad, E, wait for an opponent) is not obvious.
 */
function RingsCard({ touch }) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border-[4px] border-[#191827] shadow-[0_5px_0_rgba(0,0,0,0.35)]"
      style={{ background: 'linear-gradient(135deg, #2a1240 0%, #1b1d4a 55%, #10284f 100%)' }}
    >
      {/* Red corner and blue corner glowing in from either side. */}
      <div className="pointer-events-none absolute -left-10 top-6 h-32 w-32 rounded-full bg-red-500/35 blur-2xl" />
      <div className="pointer-events-none absolute -right-10 top-6 h-32 w-32 rounded-full bg-blue-500/35 blur-2xl" />

      <div className="relative px-4 pb-4 pt-3 sm:px-5">
        <div className="flex justify-center">
          <span className="rounded-full border-2 border-[#191827] bg-gradient-to-b from-yellow-200 to-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-widest text-[#3a2200]">
            ★ Special ★
          </span>
        </div>
        <div className={`mt-1 text-center text-white ${touch ? 'text-2xl' : 'text-3xl'}`} style={OUTLINE}>
          🥊 Boxing Rings 🥊
        </div>
        <div className="text-center text-xs font-bold text-pink-200 sm:text-sm">Fight other players live - everyone can watch!</div>

        {/* A little picture of it: the red pad, the ring, the blue pad. */}
        <div className="mx-auto mt-3 flex max-w-xs items-end justify-center gap-3">
          <div className="flex flex-col items-center">
            <div className="h-4 w-12 rounded-full border-2 border-[#191827] bg-gradient-to-b from-red-400 to-red-600 shadow-[0_0_12px_rgba(255,74,74,0.8)]" />
            <span className="mt-1 text-[10px] font-black text-red-300" style={CHIP}>
              RED
            </span>
          </div>
          <div className="relative h-16 w-24 rounded-md border-2 border-[#191827] bg-gradient-to-b from-slate-100 to-slate-300">
            {[18, 34, 50].map((top) => (
              <div key={top} className="absolute inset-x-1 h-[3px] rounded bg-rose-500/80" style={{ top: `${top}%` }} />
            ))}
            <div className="absolute -left-1 -top-1 h-3 w-3 rounded-full border-2 border-[#191827] bg-red-500" />
            <div className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#191827] bg-blue-500" />
            <div className="absolute inset-x-0 bottom-1 text-center text-lg leading-none">⚔️</div>
          </div>
          <div className="flex flex-col items-center">
            <div className="h-4 w-12 rounded-full border-2 border-[#191827] bg-gradient-to-b from-sky-400 to-blue-600 shadow-[0_0_12px_rgba(63,140,255,0.8)]" />
            <span className="mt-1 text-[10px] font-black text-sky-300" style={CHIP}>
              BLUE
            </span>
          </div>
        </div>

        <div className={`mt-3 grid gap-2 ${touch ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {RING_STEPS.map(([icon, title, text], i) => (
            <div key={title} className="flex items-start gap-2 rounded-xl border-2 border-white/15 bg-white/10 p-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-[#191827] bg-gradient-to-b from-pink-400 to-fuchsia-600 text-base">
                {icon}
              </span>
              <div className="min-w-0">
                <div className="text-sm text-white" style={OUTLINE}>
                  {i + 1}. {title}
                </div>
                <div className="text-xs font-semibold leading-snug text-slate-200">{text}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {RING_RULES.map(([icon, text]) => (
            <span
              key={text}
              className="rounded-full border-2 border-[#191827] bg-gradient-to-b from-amber-200 to-yellow-400 px-2.5 py-0.5 text-[11px] font-black text-[#3a2200]"
            >
              {icon} {text}
            </span>
          ))}
        </div>

        <div className="mt-2 text-center text-[11px] font-bold text-slate-300">
          Knocked out? You land back in the lobby - train up and try again!
        </div>
      </div>
    </div>
  )
}

/** The main steps: [icon, title, text, colours of the icon tile]. */
const STEPS = [
  ['👊', 'Punch', 'Click to punch! Every punch gives you Strength.', ['#ff8a7a', '#e8352d']],
  ['🧱', 'Smash the walls', 'Follow the blue arrows to Stage 1. Break 10 walls to clear a stage.', ['#9fe8ff', '#2f7cff']],
  ['🏆', 'Cash in', 'Hold E on a Win pad for Wins. Spend them on gloves, pets and bags.', ['#fff3a0', '#f0a000']],
  ['🎯', 'Train', 'Stand on a punching bag’s pad - it multiplies your Strength.', ['#b4ff8a', '#2fb24a']],
  ['🔄', 'Rebirth', 'Max your level and Rebirth for more Power. Rebirth 3 opens Space World.', ['#e6c9ff', '#8a4dff']],
]

/** One control: the key and what it does. */
function Control({ k, does }) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[3.25rem] rounded-lg border-2 border-[#191827] bg-white px-1.5 py-0.5 text-center text-[11px] font-black text-[#191827] shadow-[0_2px_0_rgba(0,0,0,0.35)]">
        {k}
      </span>
      <span className="text-xs font-bold text-slate-200">{does}</span>
    </div>
  )
}

/**
 * The Guide: how to play, on top of the game when it starts and again whenever the
 * Guide button in the left rail is pressed (see GuideButton). The ✕, Escape or
 * "Let's play!" close it.
 *
 * Laid out to fit one screen on a desktop - the basics on the left, the boxing rings
 * on the right - and as one column on a phone.
 */
export function HowToPlay() {
  const touch = useTouchDevice()
  const open = useGame((s) => s.guideOpen)
  const close = () => useGame.getState().toggleGuide(false)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        useGame.getState().toggleGuide(false)
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

  const controls = touch
    ? [['Stick', 'Move'], ['Drag', 'Look around'], ['JUMP', 'Jump'], ['👊', 'Punch']]
    : [['WASD', 'Move'], ['Space', 'Jump'], ['Shift', 'Sprint'], ['Click', 'Punch'], ['E', 'Interact'], ['R-drag', 'Look around']]

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-5"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="how-to-play-title"
        className="guide-pop relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[1.75rem] border-[5px] border-[#191827] shadow-[0_10px_0_rgba(0,0,0,0.55),0_30px_80px_rgba(0,0,0,0.55)]"
        style={{ background: 'linear-gradient(160deg, #241a4a 0%, #16183a 55%, #0f1f3d 100%)' }}
      >
        {/* Header: a red-and-gold fight-poster banner. */}
        <div
          className="relative shrink-0 overflow-hidden border-b-[4px] border-[#191827] px-5 py-3 text-center sm:py-4"
          style={{ background: 'linear-gradient(90deg, #c81e2a 0%, #ff5a3a 50%, #2f6ee8 100%)' }}
        >
          <div className="pointer-events-none absolute inset-x-6 top-1.5 h-1.5 rounded-full bg-white/40" />
          <div className="pointer-events-none absolute left-4 top-1/2 hidden -translate-y-1/2 -rotate-12 text-5xl opacity-40 sm:block">🥊</div>
          <div className="pointer-events-none absolute right-16 top-1/2 hidden -translate-y-1/2 rotate-12 -scale-x-100 text-5xl opacity-40 sm:block">🥊</div>
          <div className="text-[10px] font-black uppercase tracking-[0.35em] text-yellow-100 sm:text-xs" style={CHIP}>
            Welcome to +1 Fist Per Click
          </div>
          <h1 id="how-to-play-title" className={`leading-none text-white ${touch ? 'text-3xl' : 'text-5xl'}`} style={OUTLINE}>
            GUIDE
          </h1>
          <div className="mt-1 text-xs font-bold text-white/90 sm:text-sm" style={CHIP}>
            Punch, smash the walls, earn Wins - and become the strongest fist in the lobby!
          </div>
          <button
            type="button"
            aria-label="Close the guide"
            onClick={close}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border-[3px] border-[#191827] bg-gradient-to-b from-red-400 to-red-600 text-lg text-white shadow-[0_3px_0_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-0.5"
            style={OUTLINE}
          >
            &#10006;
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
          <div className={`grid gap-4 ${touch ? 'grid-cols-1' : 'md:grid-cols-2'}`}>
            {/* The basics. */}
            <div className="flex flex-col gap-2.5">
              <div className="text-sm text-yellow-200 sm:text-base" style={OUTLINE}>
                ⭐ How to play
              </div>
              {STEPS.map(([icon, title, text, colors], i) => (
                <div
                  key={title}
                  className="flex items-center gap-3 rounded-2xl border-2 border-white/10 bg-white/[0.07] p-2.5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]"
                >
                  <span
                    className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-[3px] border-[#191827] text-2xl shadow-[0_3px_0_rgba(0,0,0,0.4)]"
                    style={{ background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})` }}
                  >
                    {icon}
                    <span
                      className="absolute -left-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#191827] bg-white text-[10px] font-black text-[#191827]"
                    >
                      {i + 1}
                    </span>
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm text-white sm:text-base" style={OUTLINE}>
                      {title}
                    </div>
                    <div className="text-xs font-semibold leading-snug text-slate-300 sm:text-[13px]">{text}</div>
                  </div>
                </div>
              ))}

              <div className="mt-1 rounded-2xl border-2 border-white/10 bg-black/25 p-3">
                <div className="mb-2 text-xs text-sky-200" style={OUTLINE}>
                  🎮 {touch ? 'Touch controls' : 'Controls'}
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                  {controls.map(([k, does]) => (
                    <Control key={k} k={k} does={does} />
                  ))}
                </div>
              </div>
            </div>

            {/* The rings. */}
            <RingsCard touch={touch} />
          </div>
        </div>

        <div className="shrink-0 border-t-2 border-white/10 bg-black/20 px-4 pb-3 pt-3 text-center">
          <button
            type="button"
            autoFocus
            onClick={close}
            className="mx-auto flex min-h-12 w-full max-w-xs items-center justify-center rounded-2xl border-[4px] border-[#191827] bg-gradient-to-b from-lime-300 to-green-500 px-5 py-1.5 text-2xl text-white shadow-[0_5px_0_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.45)]"
            style={OUTLINE}
          >
            Let&apos;s play!
          </button>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-400">Open this again any time with the Guide button (G).</p>
        </div>
      </section>
    </div>
  )
}

export default HowToPlay

/** The book emoji, drop-shadowed to match the other icon buttons in the rail. */
const EMOJI = { filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(0,0,0,0.35))' }
const INK = '#1b1b25'

/** The left-rail button that opens the Guide, under Controls. */
export function GuideButton() {
  const touch = useTouchDevice()
  const size = touch ? 'h-12 w-12' : 'h-[4.5rem] w-[4.5rem]'
  return (
    <button
      type="button"
      onClick={() => useGame.getState().toggleGuide()}
      className={`pointer-events-auto relative flex ${size} cursor-pointer flex-col items-center justify-center rounded-xl border-4 transition duration-100 hover:-translate-y-0.5 hover:scale-[1.03] hover:brightness-110 active:translate-y-0.5 active:scale-[0.98]`}
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #8dff7a, #2fb24a)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35" />
      {!touch && (
        <span
          className="pointer-events-none absolute -left-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border-2 px-1 text-[11px] text-white"
          style={{ ...CHIP, borderColor: INK, background: '#22a83c' }}
        >
          G
        </span>
      )}
      <span className={touch ? 'text-2xl' : 'text-4xl'} style={EMOJI} aria-hidden>
        📖
      </span>
      {!touch && (
        <span className="text-[11px] leading-none text-white" style={CHIP}>
          Guide
        </span>
      )}
    </button>
  )
}
