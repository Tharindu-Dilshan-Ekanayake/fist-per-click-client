import { useEffect } from 'react'

import {
  releaseAll,
  setKeyboardJump,
  setKeyboardMove,
  setKeyboardSprint,
  setKeyboardTurn,
} from './input'

/**
 * Turns the keyboard into movement (see game/input.js).
 *
 * Nothing is returned and nothing re-renders: the keys are held in a module, which
 * is where the frame loop reads them, so a walk across the lobby costs no renders at
 * all. It is a hook only so that the listeners come and go with the scene.
 */
/**
 * Left and right turn the view; up and down walk.
 *
 * Both pairs do the same thing, so it does not matter which hand is where: A and the
 * left arrow swing the camera left, D and the right arrow swing it right, and W and S
 * walk the way the camera is pointing. Turn to face something, then walk at it - the
 * scheme nearly every game played with one hand uses.
 *
 * There is deliberately no strafe key. The first version of this kept A and D
 * stepping sideways and put turning on the arrows only, which reads sensibly written
 * down and is not what anyone's left hand expects: reaching for A to look left and
 * sliding sideways instead is wrong every single time. Sidestepping is the rarer move
 * and the mouse still covers it - hold right-drag and walk.
 *
 * Up and down have nothing to turn: the camera's pitch has a narrow range and is not
 * worth a key.
 */
const KEY_MAP = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'backward',
  ArrowDown: 'backward',
  KeyA: 'turnLeft',
  ArrowLeft: 'turnLeft',
  KeyD: 'turnRight',
  ArrowRight: 'turnRight',
  Space: 'jump',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
}

export function useKeyboard() {
  useEffect(() => {
    const held = { forward: false, backward: false, turnLeft: false, turnRight: false }

    const push = () => {
      // No sideways component: the keyboard only ever walks along the way it faces.
      setKeyboardMove(0, (held.backward ? 1 : 0) - (held.forward ? 1 : 0))
      setKeyboardTurn((held.turnRight ? 1 : 0) - (held.turnLeft ? 1 : 0))
    }

    const set = (code, value) => {
      const action = KEY_MAP[code]
      if (!action) return
      if (action === 'jump') setKeyboardJump(value)
      else if (action === 'sprint') setKeyboardSprint(value)
      else {
        held[action] = value
        push()
      }
    }

    const onKeyDown = (e) => {
      if (KEY_MAP[e.code]) e.preventDefault() // stop Space scrolling the page
      set(e.code, true)
    }
    const onKeyUp = (e) => set(e.code, false)
    // Alt-tabbing away mid-run otherwise leaves a key stuck down.
    const onBlur = () => {
      for (const action of Object.keys(held)) held[action] = false
      releaseAll()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      onBlur()
    }
  }, [])
}

export default useKeyboard
