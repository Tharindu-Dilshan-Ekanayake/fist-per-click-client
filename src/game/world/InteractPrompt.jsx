import { Html } from '@react-three/drei'

import { useGame } from '../gameStore'

const DETAIL_TONE = {
  normal: 'text-amber-200',
  warn: 'text-red-300',
  done: 'text-lime-300',
}

/** Circumference of the hold ring (radius 26 in its 60-unit box). */
export const HOLD_RING = 2 * Math.PI * 26

/**
 * "Press E" card floating by whatever the player can act on. Clicking the card does
 * the same as pressing E.
 *
 * With `hold`, E has to be held: a ring around the key fills as it's held. The
 * caller drives it every frame through `ringRef` (set its strokeDashoffset from
 * HOLD_RING, full, down to 0), and pressing and holding the card works too.
 *
 * @param {{ position: number[], action: string, title: string, detail?: string,
 *           tone?: 'normal' | 'warn' | 'done', hold?: boolean,
 *           ringRef?: React.MutableRefObject<SVGCircleElement | null> }} props
 */
export function InteractPrompt({ position, action, title, detail, tone = 'normal', hold = false, ringRef }) {
  const handlers = hold
    ? {
        onPointerDown: () => useGame.getState().interactStart(),
        onPointerUp: () => useGame.getState().interactEnd(),
        onPointerLeave: () => useGame.getState().interactEnd(),
      }
    : { onClick: () => useGame.getState().interactNow() }

  return (
    <Html position={position} center zIndexRange={[40, 0]} style={{ pointerEvents: 'none' }}>
      <button
        type="button"
        {...handlers}
        className="prompt-pop pointer-events-auto flex select-none items-center gap-3 whitespace-nowrap rounded-2xl border-2 border-white/40 bg-slate-900/80 px-3 py-2 text-left text-white shadow-xl backdrop-blur"
      >
        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          {hold && (
            <svg viewBox="0 0 60 60" aria-hidden="true" className="absolute -left-1.5 -top-1.5 h-15 w-15 -rotate-90">
              <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
              <circle
                ref={ringRef}
                cx="30"
                cy="30"
                r="26"
                fill="none"
                stroke="#a3ff5c"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={HOLD_RING}
                strokeDashoffset={HOLD_RING}
              />
            </svg>
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-b-4 border-slate-400 bg-white text-xl font-black text-slate-900">
            E
          </span>
        </span>
        <span className="leading-tight">
          <span className="block text-lg font-black">{action}</span>
          <span className="block text-sm font-semibold text-white/80">{title}</span>
          {detail && <span className={`block text-xs font-bold ${DETAIL_TONE[tone]}`}>{detail}</span>}
        </span>
      </button>
    </Html>
  )
}

export default InteractPrompt
