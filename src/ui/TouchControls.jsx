import { useEffect, useRef } from 'react'

import { useTouchDevice } from '../game/device'
import { useGame } from '../game/gameStore'
import { requestShot, setTouchJump, setTouchMove, setTouchSprint } from '../game/input'
import { CONTROL_MARGIN, STICK_SIZE, useStripHeight, useTouchScale } from './touchLayout'

/**
 * On-screen controls, for phones and tablets only.
 *
 * The whole thing renders nothing at all on a desktop (see game/device.js): a
 * thumbstick over a game played with a keyboard is just something in the way.
 *
 * Laid out for thumbs rather than for looks - stick bottom-left, actions
 * bottom-right, nothing important in the middle where a hand would cover it, and
 * every target comfortably past the 44px everyone's guidelines land on. The camera
 * is not here: dragging the view itself turns it (see FollowCamera), which is what
 * a hand expects and what leaves the screen clear.
 *
 * Everything is see-through. They sit over the game rather than beside it, and on a
 * phone there is not enough screen for a control that takes its space away from the
 * thing it is controlling - so they tint the view instead of hiding it, and darken
 * as they are pressed so a thumb still gets an answer. They also ride above the HUD
 * panel rather than sharing the bottom edge with it (see touchLayout.js).
 */

/**
 * How much of the pad's radius the knob may travel, and how big the knob is as a
 * fraction of the pad. Both are fractions rather than pixels because the pad itself
 * is sized off the screen (see useTouchScale) - measuring the throw from the element
 * is what lets one set of numbers work on a small phone and a tablet alike.
 */
const THROW = 0.72
const KNOB = 0.3
/** Push past this fraction of the way out and the character runs. */
const SPRINT_AT = 0.85

/**
 * Left thumbstick. Springs back to the middle when released, and starts wherever the
 * thumb first lands inside its pad rather than at a fixed point, so it works without
 * looking down at it.
 */
function Thumbstick({ size }) {
  const pad = useRef(null)
  const knob = useRef(null)
  const drag = useRef({ id: null, cx: 0, cy: 0, r: 1 })

  useEffect(() => () => setTouchMove(0, 0), [])

  const move = (clientX, clientY) => {
    const d = drag.current
    let dx = clientX - d.cx
    let dy = clientY - d.cy
    const distance = Math.hypot(dx, dy)
    if (distance > d.r) {
      dx = (dx / distance) * d.r
      dy = (dy / distance) * d.r
    }
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`

    // Screen down is +Y and "backwards" is +Z, so the two already agree.
    setTouchMove(dx / d.r, dy / d.r)
    setTouchSprint(Math.min(1, distance / d.r) > SPRINT_AT)
  }

  const onPointerDown = (e) => {
    if (drag.current.id !== null) return
    const box = pad.current.getBoundingClientRect()
    const r = (box.width / 2) * THROW
    drag.current = {
      id: e.pointerId,
      r,
      // Centred on the thumb, but never so near the edge that half the throw is
      // off the pad.
      cx: Math.min(Math.max(e.clientX, box.left + r), box.right - r),
      cy: Math.min(Math.max(e.clientY, box.top + r), box.bottom - r),
    }
    pad.current.setPointerCapture?.(e.pointerId)
    if (knob.current) {
      knob.current.style.left = `${drag.current.cx - box.left}px`
      knob.current.style.top = `${drag.current.cy - box.top}px`
    }
    move(e.clientX, e.clientY)
  }

  const onPointerMove = (e) => {
    if (drag.current.id !== e.pointerId) return
    move(e.clientX, e.clientY)
  }

  const end = (e) => {
    if (drag.current.id !== e.pointerId) return
    drag.current.id = null
    setTouchMove(0, 0)
    setTouchSprint(false)
    if (knob.current) knob.current.style.transform = 'translate(0px, 0px)'
  }

  return (
    <div
      ref={pad}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      className="pointer-events-auto relative touch-none rounded-full border-2 border-white/40 bg-black/30"
      style={{ touchAction: 'none', width: size, height: size }}
      aria-label="Move"
    >
      <div
        ref={knob}
        className="pointer-events-none absolute rounded-full border-2 border-white/80 bg-white/70 shadow"
        style={{
          left: '50%',
          top: '50%',
          width: size * KNOB,
          height: size * KNOB,
          marginLeft: (-size * KNOB) / 2,
          marginTop: (-size * KNOB) / 2,
        }}
      />
    </div>
  )
}

/** A round action button. Held buttons report both edges; tapped ones just fire. */
function ActionButton({ label, hint, onDown, onUp, size, scale, tone, disabled }) {
  const held = useRef(null)

  const down = (e) => {
    if (disabled || held.current !== null) return
    held.current = e.pointerId
    e.currentTarget.setPointerCapture?.(e.pointerId)
    onDown?.()
  }
  const up = (e) => {
    if (held.current !== e.pointerId) return
    held.current = null
    onUp?.()
  }

  return (
    <button
      type="button"
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      className={`pointer-events-auto flex touch-none select-none flex-col items-center justify-center rounded-full border font-black leading-none shadow transition active:scale-95 active:brightness-75 ${tone} ${
        disabled ? 'opacity-30' : 'opacity-85'
      }`}
      style={{ touchAction: 'none', width: size, height: size }}
    >
      <span style={{ fontSize: Math.round(18 * scale) }}>{label}</span>
      {hint && (
        <span className="mt-0.5 font-bold opacity-80" style={{ fontSize: Math.round(10 * scale) }}>
          {hint}
        </span>
      )}
    </button>
  )
}

export function TouchControls() {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const stripH = useStripHeight()
  // E does different things in different places; the button follows the same prompt
  // the world shows, and greys out when there is nothing in reach.
  const interact = useGame((s) => s.interact)

  if (!touch) return null

  const stick = Math.round(STICK_SIZE * scale)
  const small = Math.round(64 * scale)
  const big = Math.round(96 * scale)
  const margin = Math.round(CONTROL_MARGIN * scale)
  const raised = `calc(${stripH + margin}px + var(--safe-bottom))`

  return (
    <div
      className="pointer-events-none absolute inset-0 z-20 select-none"
      style={{ paddingLeft: 'var(--safe-left)', paddingRight: 'var(--safe-right)' }}
    >
      {/* Clear of the HUD panel, which owns the bottom edge, and of the home bar. */}
      <div className="absolute" style={{ bottom: raised, left: margin }}>
        <Thumbstick size={stick} />
      </div>

      <div
        className="absolute flex items-end"
        style={{ bottom: raised, right: margin, gap: margin }}
      >
        <div className="flex flex-col" style={{ gap: margin }}>
          <ActionButton
            label="E"
            hint={interact ? 'USE' : null}
            size={small}
            scale={scale}
            disabled={!interact}
            tone="border-white/70 bg-lime-400 text-slate-900"
            onDown={() => useGame.getState().interactStart()}
            onUp={() => useGame.getState().interactEnd()}
          />
          <ActionButton
            label="▲"
            hint="JUMP"
            size={small}
            scale={scale}
            tone="border-white/70 bg-sky-400 text-white"
            onDown={() => setTouchJump(true)}
            onUp={() => setTouchJump(false)}
          />
        </div>

        {/* The big one, because in a clicker this is the whole game. */}
        <ActionButton
          label="🔫"
          hint="SHOOT"
          size={big}
          scale={scale}
          tone="border-white/70 bg-amber-300 text-slate-900"
          onDown={requestShot}
        />
      </div>
    </div>
  )
}

export default TouchControls
