import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { useGame } from './gameStore'
import { getGlove, punchKind } from './gloves'
import { takePunches } from './input'
import { AUTO_CLICKERS } from './progression'
import { playSound } from './sound'

/** Seconds between automatic punches while standing on a bag's pad. */
const AUTO_TRAIN_S = 0.4
/**
 * How far a finger may slide and still count as a tap rather than the start of a
 * camera drag. Generous: a thumb never lands perfectly still.
 *
 * Distance only, with no time limit on purpose. A limit is the obvious thing to add
 * and it was the first thing here, at a generous-looking 400ms - and it made taps go
 * missing on exactly the machines this is for. A finger is down for as long as the
 * page takes to notice it, so on a phone that is busy drawing a frame the gap
 * between the two events is the jank, not the player: the first measurement of it
 * here came out at 624ms for what was meant to be an instant tap. Nothing else on
 * the view wants a long press, so resting a finger and lifting it can simply be a
 * punch, however long the rest lasted.
 */
const TAP_SLOP_PX = 14
const _screen = new Vector3()

/**
 * A click popup's start point and how far it flies to reach the HUD's Strength
 * counter, in screen pixels.
 */
function popupPath(x, y) {
  const counter = document.querySelector('[data-strength-counter]')?.getBoundingClientRect()
  const tx = counter ? counter.left + counter.width / 2 : window.innerWidth / 2
  const ty = counter ? counter.top + counter.height / 2 : window.innerHeight - 60
  return { x, y, dx: tx - x, dy: ty - y }
}

/** The gloves' whoosh, quieter for the punches nobody clicked for. */
function punchSound(gain) {
  playSound('punch', { kind: punchKind(getGlove(useGame.getState().equipped)), gain })
}

/**
 * Punching. Left-click on the game view throws one (right-click stays with the
 * camera, and HUD elements sit above the canvas so they never reach this); standing
 * on a bag's pad punches automatically, as do the auto clickers. Each punch sends a
 * "+N Strength" popup to the Strength counter: from the click, or from the player
 * for automatic punches.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function PunchInput({ bodyRef }) {
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const autoTimer = useRef(0)

  useEffect(() => {
    const el = gl.domElement
    /** The touch that might turn out to be a tap, if it does not become a drag. */
    let tap = null

    const punchAt = (clientX, clientY) => {
      // The player's position lets a stage wall tell which side it was hit from.
      const p = bodyRef.current?.translation()
      useGame.getState().punch(popupPath(clientX, clientY), p && [p.x, p.y, p.z])
      punchSound(1)
    }

    const onPointerDown = (e) => {
      // A finger has to wait: the same gesture that punches also turns the camera
      // (see FollowCamera), and which one it was is only known when it ends.
      if (e.pointerType === 'touch') {
        tap = { id: e.pointerId, x: e.clientX, y: e.clientY }
        return
      }
      if (e.button !== 0) return
      punchAt(e.clientX, e.clientY)
    }

    const onPointerMove = (e) => {
      if (!tap || tap.id !== e.pointerId) return
      if (Math.hypot(e.clientX - tap.x, e.clientY - tap.y) > TAP_SLOP_PX) tap = null
    }

    const onPointerUp = (e) => {
      if (!tap || tap.id !== e.pointerId) return
      const { x, y } = tap
      tap = null
      // It never became a drag, so it was a tap.
      punchAt(x, y)
    }

    const onPointerCancel = () => {
      tap = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerCancel)
    }
  }, [gl, bodyRef])

  useFrame((_state, delta) => {
    // Training and the auto clickers both fire on a timer; the fastest one wins.
    const game = useGame.getState()
    // Punches from the on-screen punch button, which knows nothing about where the
    // player is standing (see game/input.js).
    const tapped = takePunches()
    let asked = tapped
    let interval = Infinity
    if (game.activeTrainer) interval = AUTO_TRAIN_S
    if (game.autoClick !== 'off') interval = Math.min(interval, AUTO_CLICKERS[game.autoClick].interval)
    if (interval !== Infinity) {
      autoTimer.current += delta
      if (autoTimer.current >= interval) {
        autoTimer.current = 0
        asked += 1
      }
    } else {
      autoTimer.current = 0
    }
    if (asked === 0) return

    // Start the popup at the player's chest on screen.
    const rect = gl.domElement.getBoundingClientRect()
    let x = rect.left + rect.width / 2
    let y = rect.top + rect.height * 0.55
    const p = bodyRef.current?.translation()
    if (p) {
      _screen.set(p.x, p.y + 1.2, p.z).project(camera)
      x = rect.left + ((_screen.x + 1) / 2) * rect.width
      y = rect.top + ((1 - _screen.y) / 2) * rect.height
    }
    for (let i = 0; i < asked; i++) {
      useGame.getState().punch(popupPath(x + (Math.random() - 0.5) * 90, y - Math.random() * 30), p && [p.x, p.y, p.z])
    }
    // A tap on the punch button is a punch the player threw and should sound like
    // one; the automatic ones repeat for as long as you train, so they sit back a little.
    punchSound(tapped > 0 ? 1 : 0.45)
  })

  return null
}

export default PunchInput
