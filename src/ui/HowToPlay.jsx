import { useEffect } from 'react'

import { useTouchDevice } from '../game/device'
import { useGame } from '../game/gameStore'
import { CHIP, OUTLINE } from './textStyle'

const GAME_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyP', 'KeyR', 'KeyB', 'KeyC', 'KeyG', 'KeyM', 'KeyN'])

const STEPS = [
  ['01', 'Click to punch! Every punch gives you Strength.'],
  ['02', 'Follow the blue arrows to the Stage 1 gate and smash the walls - break 10 to clear a stage.'],
  ['03', 'Hold E on a Win pad to cash in your Wins. Spend them on bigger gloves, pets and punching bags.'],
  ['04', 'Step onto a punching bag\u2019s pad to train on it: it multiplies your Strength.'],
  ['05', 'Reach the level cap and Rebirth for permanent Power. Rebirth 3 opens Space World.'],
]

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
      className="relative mt-5 overflow-hidden rounded-2xl border-[4px] border-[#191827] shadow-[0_5px_0_rgba(0,0,0,0.35)]"
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

function Key({ children }) {
  return (
    <span className="rounded-lg border-2 border-slate-900/20 bg-white px-2 py-1 text-xs font-black text-slate-900 shadow-[0_2px_0_rgba(15,23,42,0.18)]">
      {children}
    </span>
  )
}

/**
 * The Guide: how to play, on top of the game when it starts and again whenever the
 * Guide button in the left rail is pressed (see GuideButton). The ✕, Escape or
 * "Let's play!" close it.
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
          <button
            type="button"
            aria-label="Close the guide"
            onClick={close}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl border-[3px] border-[#191827] bg-gradient-to-b from-red-400 to-red-600 text-lg text-white shadow-[0_3px_0_rgba(0,0,0,0.45)] transition hover:brightness-110 active:translate-y-0.5"
            style={OUTLINE}
          >
            &#10006;
          </button>
          <div className="mb-1 text-center text-xs font-black uppercase tracking-[0.2em] text-sky-700" style={CHIP}>
            Welcome to +1 Fist
          </div>
          <h1 id="how-to-play-title" className="text-center text-3xl text-[#ffffff] sm:text-4xl" style={OUTLINE}>
            Guide
          </h1>
          <p className="mt-1 text-center text-sm font-semibold text-slate-600 sm:text-base">
            Punch, smash the walls, earn Wins - and become the strongest fist in the lobby.
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
                <div><Key>👊</Key> <span className="ml-1">Punch</span></div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm font-bold text-slate-800">
                <div><Key>W A S D</Key> <span className="ml-1">Move</span></div>
                <div><Key>Right-drag</Key> <span className="ml-1">Look around</span></div>
                <div><Key>Space</Key> <span className="ml-1">Jump</span></div>
                <div><Key>Shift</Key> <span className="ml-1">Sprint</span></div>
                <div><Key>Left-click</Key> <span className="ml-1">Punch</span></div>
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

          <RingsCard touch={touch} />

          <button
            type="button"
            autoFocus
            onClick={close}
            className="mx-auto mt-5 flex min-h-14 w-full max-w-xs items-center justify-center rounded-2xl border-[4px] border-[#191827] bg-gradient-to-b from-lime-300 to-green-500 px-5 py-2 text-2xl text-white shadow-[0_5px_0_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:brightness-105 active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.45)]"
            style={OUTLINE}
          >
            Let&apos;s play!
          </button>
          <p className="mt-2 text-center text-xs font-semibold text-slate-500">
            Open this again any time with the Guide button (G).
          </p>
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
