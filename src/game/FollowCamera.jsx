import { useFrame, useThree } from '@react-three/fiber'
import { useRapier } from '@react-three/rapier'
import { useEffect, useRef } from 'react'
import { Vector3 } from 'three'

import { readTurn } from './input'
import { playerPosition } from './playerAnchor'
import { useSettings } from './settings'

/** How high above the player's origin the camera aims. */
const LOOK_HEIGHT = 1.4

const MIN_DISTANCE = 3
const MAX_DISTANCE = 20
const START_DISTANCE = 8

// Pitch limits, in radians. Stops the camera flipping over the top or sinking
// under the track.
const MIN_PITCH = -0.15
const MAX_PITCH = 1.25
const START_PITCH = 0.32

/**
 * Radians turned per pixel of drag, before the portal's camera_sensitivity slider
 * scales it (see game/settings.js).
 *
 * At 0.016 a full turn is about 390px and 180 degrees about 195px. For scale, this
 * started at 0.005 (1300px just to look behind you) and three.js's own
 * OrbitControls defaults to about 0.008.
 *
 * This is the one number to retune it with. Vite hot-reloads the change, so `npm
 * run dev` and edit the line below to feel each step straight away:
 *   0.010  360 in 630px   sedate
 *   0.012  360 in 525px   gentle
 *   0.016  360 in 390px   <- here
 *   0.020  360 in 315px   relaxed
 *   0.024  360 in 260px   brisk
 *   0.030  360 in 210px   fast
 *   0.045  360 in 140px   twitchy
 *
 * The portal's camera_sensitivity multiplies whatever this is, and defaults to 1,
 * so this value is what a player gets unless they move that slider (see
 * game/settings.js - it is a multiplier, not a percentage, which is worth knowing
 * because reading it as one used to divide all of this by fifty).
 */
const DRAG_SENSITIVITY = 0.016
const ZOOM_SENSITIVITY = 0.01

/**
 * Radians per pixel for a finger.
 *
 * Lower than the mouse on purpose. A mouse can be picked up and put down, so a long
 * turn costs nothing; a thumb has about an inch of travel before it runs out of
 * screen, and at the mouse's rate that inch spun the camera most of the way round.
 */
const TOUCH_SENSITIVITY = 0.006
/** Pixels of pinch per unit of zoom. */
const PINCH_SENSITIVITY = 0.02

/**
 * Radians a second the arrow keys swing the view (see game/useKeyboard.js).
 *
 * A rate, not a step: held down this sweeps rather than ratcheting, and it does not
 * change with the frame rate. At 2.2 a full turn takes just under three seconds,
 * which is brisk enough to spin round and look behind you without overshooting what
 * you were trying to line up on. Scaled by the portal's camera_sensitivity, same as
 * the mouse, so one slider moves both.
 */
const KEY_TURN_RATE = 2.2

/**
 * How fast the camera catches up with the player. Higher = snappier;
 * framerate-independent via the pow() smoothing below.
 *
 * This eases the *pivot* (the point the camera orbits and looks at), never the
 * camera's own position. Smoothing the position as well used to lag the orbit
 * behind the mouse by about a third of a second, and because the look-at target
 * eased at a different rate the player slid off-centre for the whole of a drag -
 * which is what made right-dragging feel rubbery rather than heavy.
 */
const FOLLOW_SMOOTHING = 8

/** How fast the wheel's new distance is eased into. Snapping looks cheap. */
const ZOOM_SMOOTHING = 14

/** A jump bigger than this in one frame is a teleport: snap instead of easing. */
const TELEPORT_DISTANCE = 15

// --- Wall collision ---------------------------------------------------------------
/** Gap kept between the camera and whatever it backed into. */
const COLLIDE_PAD = 0.4
/** Never pull in closer than this, however tight the corner. */
const MIN_COLLIDE_DISTANCE = 1
/**
 * How fast the camera lets itself back out once the wall is gone. Pulling *in* is
 * instant - a frame spent inside a wall is a frame of black screen - but springing
 * straight back out reads as a lurch, so only that side is eased.
 */
const UNCLIP_SMOOTHING = 6

const _target = new Vector3()
const _lastTarget = new Vector3()
const _offset = new Vector3()

/**
 * Third-person orbit camera.
 *
 * Trails the player's rigid body, easing the point it orbits. Right-click drag
 * orbits, the mouse wheel zooms, and solid geometry pushes the view in rather than
 * letting it clip through.
 *
 * Reads the Rapier body directly rather than React state - the body is the
 * authoritative transform and updates every physics step, not every render. Must
 * live inside <Physics>, because the wall collision casts a ray into that world.
 *
 * @param {{ bodyRef: React.MutableRefObject<any>,
 *           anchorRef?: React.MutableRefObject<any> }} props
 *   Aims at `anchorRef` (the eased position - see playerAnchor.js) and still casts
 *   its wall ray against `bodyRef`, which is the thing physics actually knows.
 */
export function FollowCamera({ bodyRef, anchorRef }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const { world, rapier } = useRapier()

  // Spherical offset from the player. A ref, not state: pointer events write to it
  // every mousemove and the frame loop reads it - re-rendering would be wasteful.
  const orbit = useRef({ yaw: 0, pitch: START_PITCH, distance: START_DISTANCE })
  /** The eased point the camera orbits around and looks at: the player's head. */
  const pivot = useRef(new Vector3())
  /** `zoom` eases toward orbit.distance; `clipped` is that after walls have their say. */
  const shown = useRef({ zoom: START_DISTANCE, clipped: START_DISTANCE })
  const initialised = useRef(false)
  /** Reused across frames; a new Ray every frame would churn the heap. */
  const ray = useRef(null)

  useEffect(() => {
    const el = gl.domElement
    if (!el) return

    let dragging = false
    let lastX = 0
    let lastY = 0
    /**
     * Fingers currently on the view, by pointerId.
     *
     * One turns the camera; two pinch to zoom, which is the only way to reach the
     * zoom at all without a wheel. Tracked here rather than as a single "the" touch
     * because a second finger arriving has to stop the first one from turning, or
     * the view spins while you pinch.
     */
    const touches = new Map()
    let pinch = 0

    /** Distance between the first two fingers, which is what the pinch tracks. */
    const spread = () => {
      const [a, b] = [...touches.values()]
      return Math.hypot(a.x - b.x, a.y - b.y)
    }

    /** Whether the browser has actually taken the pointer for this drag. */
    const isLocked = () => document.pointerLockElement === el

    const onPointerDown = (e) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, { x: e.clientX, y: e.clientY })
        el.setPointerCapture?.(e.pointerId)
        if (touches.size === 2) pinch = spread()
        return
      }
      if (e.button !== 2) return // right button only
      dragging = true
      lastX = e.clientX
      lastY = e.clientY
      el.setPointerCapture?.(e.pointerId)

      // Pointer lock is what makes the drag feel like a game rather than a slider:
      // the cursor stops existing, so you can keep turning forever instead of
      // stopping dead at the edge of the window, and it reappears exactly where you
      // pressed.
      //
      // Deliberately WITHOUT `unadjustedMovement`. That asks for raw device counts
      // with the OS pointer curve stripped off, which is right for an FPS but wrong
      // here for two reasons: those counts are in a different unit to the clientX
      // deltas the fallback below works in, so the same flick turned by a different
      // amount depending on whether the lock happened to be granted; and with the
      // curve gone a quick flick no longer gets the speed-up the hand is expecting,
      // which is what made this feel sluggish. Plain movementX keeps the pointer
      // behaving like the pointer.
      //
      // The lock can be refused - a cross-origin iframe without allow="pointer-lock"
      // (which is how the portal embeds us), or Chrome's rate limit right after an
      // Escape. A refusal lands on the clientX fallback in onPointerMove, which is
      // how this behaved before pointer lock existed here, so nothing breaks.
      try {
        el.requestPointerLock?.()?.catch?.(() => {})
      } catch {
        /* stay on the fallback */
      }

    }

    const onTouchMove = (e) => {
      const previous = touches.get(e.pointerId)
      if (!previous) return
      const dx = e.clientX - previous.x
      const dy = e.clientY - previous.y
      previous.x = e.clientX
      previous.y = e.clientY

      if (touches.size >= 2) {
        const now = spread()
        const o = orbit.current
        o.distance = Math.min(
          MAX_DISTANCE,
          Math.max(MIN_DISTANCE, o.distance - (now - pinch) * PINCH_SENSITIVITY),
        )
        pinch = now
        return
      }

      const speed = TOUCH_SENSITIVITY * useSettings.getState().cameraSensitivity
      const o = orbit.current
      o.yaw -= dx * speed
      o.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, o.pitch + dy * speed))
    }

    const onPointerMove = (e) => {
      if (e.pointerType === 'touch') {
        onTouchMove(e)
        return
      }
      if (!dragging) return

      let dx
      let dy
      if (isLocked()) {
        // Locked: clientX is frozen, so the movement deltas are all there is.
        dx = e.movementX
        dy = e.movementY
      } else {
        dx = e.clientX - lastX
        dy = e.clientY - lastY
        lastX = e.clientX
        lastY = e.clientY
      }

      // Read per-drag rather than per-mount, so a slider change lands right away.
      const speed = DRAG_SENSITIVITY * useSettings.getState().cameraSensitivity
      const o = orbit.current
      o.yaw -= dx * speed
      o.pitch = Math.min(MAX_PITCH, Math.max(MIN_PITCH, o.pitch + dy * speed))
    }

    const endDrag = (e) => {
      if (e?.pointerType === 'touch') {
        touches.delete(e.pointerId)
        // Still pinching with the two that are left: re-seat it, or the next move
        // would be measured against a distance that included the finger that went.
        if (touches.size === 2) pinch = spread()
        return
      }
      if (!dragging) return
      dragging = false
      if (e?.pointerId !== undefined) el.releasePointerCapture?.(e.pointerId)
      if (isLocked()) document.exitPointerLock?.()
    }

    /**
     * The lock went away while the button was still down - Escape, the portal
     * opening its pause menu, or the tab losing focus. Carrying on would go back to
     * reading clientX, which has not moved since the lock began, and snap the view
     * round by however far the cursor "was". End the drag instead.
     */
    const onLockChange = () => {
      if (dragging && !isLocked()) endDrag()
    }

    /** The tab lost focus mid-gesture: drop every finger, not just the mouse. */
    const onBlur = () => {
      touches.clear()
      endDrag()
    }

    const onWheel = (e) => {
      // Without this the page scrolls behind the canvas.
      e.preventDefault()
      const o = orbit.current
      o.distance = Math.min(
        MAX_DISTANCE,
        Math.max(MIN_DISTANCE, o.distance + e.deltaY * ZOOM_SENSITIVITY),
      )
    }

    // Right-dragging otherwise opens the browser context menu mid-orbit.
    const onContextMenu = (e) => e.preventDefault()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', endDrag)
    el.addEventListener('pointercancel', endDrag)
    el.addEventListener('contextmenu', onContextMenu)
    // passive:false is required for preventDefault() on wheel to take effect.
    el.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('blur', onBlur)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', endDrag)
      el.removeEventListener('pointercancel', endDrag)
      el.removeEventListener('contextmenu', onContextMenu)
      el.removeEventListener('wheel', onWheel)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('blur', onBlur)
      if (document.pointerLockElement === el) document.exitPointerLock?.()
    }
  }, [gl])

  useFrame((_state, delta) => {
    const body = bodyRef.current
    if (!body) return

    // The eased position, not the raw one: see playerAnchor.js. Reading the body
    // here is what used to make the whole world judder against the avatar.
    if (!playerPosition(anchorRef, bodyRef, _target)) return
    _target.y += LOOK_HEIGHT

    // The arrow keys turn the view. Same sign as a drag to the right, which also
    // lowers yaw - see onPointerMove.
    const turn = readTurn()
    if (turn !== 0) {
      orbit.current.yaw -= turn * KEY_TURN_RATE * useSettings.getState().cameraSensitivity * delta
    }

    const teleported = _lastTarget.distanceTo(_target) > TELEPORT_DISTANCE
    _lastTarget.copy(_target)

    if (teleported && initialised.current) {
      // A portal (or a Win pad's trip home) drops you facing whatever way you
      // happened to be looking before - reset to dead behind, so you land looking
      // straight ahead (a stage gate, the Infinity Cave's wall) instead of sideways
      // or backwards.
      orbit.current.yaw = 0
      orbit.current.pitch = START_PITCH
    }

    const s = shown.current
    if (!initialised.current || teleported) {
      // Avoid a long swoop in from wherever the camera was (startup, or a portal).
      pivot.current.copy(_target)
      s.zoom = orbit.current.distance
      s.clipped = orbit.current.distance
      initialised.current = true
    } else {
      // 1 - pow(x, delta) keeps the easing rate consistent across framerates.
      pivot.current.lerp(_target, 1 - Math.pow(0.001, delta * (FOLLOW_SMOOTHING / 10)))
      s.zoom += (orbit.current.distance - s.zoom) * (1 - Math.pow(0.001, delta * (ZOOM_SMOOTHING / 10)))
    }

    // Spherical -> cartesian, as a unit direction off the eased pivot. Yaw and pitch
    // are used raw: whatever the mouse last set is where the camera points this
    // frame, so a drag turns the view by exactly the amount it moved and the player
    // stays dead centre.
    const { yaw, pitch } = orbit.current
    const horizontal = Math.cos(pitch)
    _offset.set(Math.sin(yaw) * horizontal, Math.sin(pitch), Math.cos(yaw) * horizontal)

    // Anything solid between the player and where the camera wants to be pulls it
    // in, so a stage wall never ends up between you and your own character.
    //
    // Sensors are excluded on purpose: Win pads, egg stands and training pads all
    // carry big ones, and they would otherwise yank the camera into the player's
    // back the moment you stepped on one. The player's own body is excluded too -
    // the ray starts inside it, which a solid cast would call an instant hit.
    if (!ray.current) ray.current = new rapier.Ray(pivot.current, _offset)
    ray.current.origin = pivot.current
    ray.current.dir = _offset
    const hit = world.castRay(
      ray.current,
      s.zoom + COLLIDE_PAD,
      true,
      rapier.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      body,
    )
    const wanted = hit ? Math.max(MIN_COLLIDE_DISTANCE, hit.timeOfImpact - COLLIDE_PAD) : s.zoom

    // In hard, out soft - see UNCLIP_SMOOTHING.
    s.clipped =
      wanted < s.clipped
        ? wanted
        : s.clipped + (wanted - s.clipped) * (1 - Math.pow(0.001, delta * (UNCLIP_SMOOTHING / 10)))

    const p = pivot.current
    camera.position.set(
      p.x + _offset.x * s.clipped,
      p.y + _offset.y * s.clipped,
      p.z + _offset.z * s.clipped,
    )
    camera.lookAt(p)
  })

  return null
}

export default FollowCamera
