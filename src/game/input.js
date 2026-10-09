/**
 * What the player is asking the character to do, from whichever input they have.
 *
 * Deliberately a plain module object rather than React state: it is written on every
 * keystroke and every frame of a thumbstick drag, and read once a frame inside
 * useFrame. Routing that through React would re-render the scene sixty times a
 * second to move a character that the renderer was going to move anyway.
 *
 * The two sources are kept apart and merged on read. Sharing one set of fields meant
 * whichever spoke last won, so lifting a thumb off the stick cancelled a key that was
 * still held, and vice versa - which matters on a tablet with a keyboard case, and
 * matters more in the moment a player switches between the two.
 */

/**
 * Movement is a vector, not four flags: a thumbstick can ask to go half speed.
 *
 * `turn` is separate from `x` because the two are different jobs. `x` steps the
 * character sideways without changing where they are looking; `turn` swings the
 * camera and leaves the character where it is. A and D do the first, the arrow keys
 * do the second, and a player who wants to sidestep round a training dummy and a
 * player who wants to look at what is behind them both get a key that does it.
 */
const keyboard = { x: 0, z: 0, turn: 0, jump: false, sprint: false }
const touch = { x: 0, z: 0, turn: 0, jump: false, sprint: false }

/**
 * @param {number} x -1 (left) to 1 (right), camera-relative
 * @param {number} z -1 (forward) to 1 (back), camera-relative
 */
export function setKeyboardMove(x, z) {
  keyboard.x = x
  keyboard.z = z
}

/** @param {number} turn -1 (swing the camera left) to 1 (right) */
export const setKeyboardTurn = (turn) => {
  keyboard.turn = turn
}

export const setKeyboardJump = (down) => {
  keyboard.jump = down
}
export const setKeyboardSprint = (down) => {
  keyboard.sprint = down
}

export function setTouchMove(x, z) {
  touch.x = x
  touch.z = z
}

export const setTouchJump = (down) => {
  touch.jump = down
}
export const setTouchSprint = (down) => {
  touch.sprint = down
}

/** Everything let go of at once - used when focus leaves the page. */
export function releaseAll() {
  for (const source of [keyboard, touch]) {
    source.x = 0
    source.z = 0
    source.turn = 0
    source.jump = false
    source.sprint = false
  }
}

/**
 * The merged request, written into `out` so the frame loop allocates nothing.
 *
 * The two movement vectors are added and then clamped to the unit circle, so holding
 * a key and pushing the stick the same way is not faster than either alone.
 */
export function readInput(out) {
  let x = keyboard.x + touch.x
  let z = keyboard.z + touch.z
  const length = Math.hypot(x, z)
  if (length > 1) {
    x /= length
    z /= length
  }
  out.x = x
  out.z = z
  out.jump = keyboard.jump || touch.jump
  out.sprint = keyboard.sprint || touch.sprint
  return out
}

/**
 * How hard the camera is being asked to swing, -1 (left) to 1 (right).
 *
 * Read by FollowCamera rather than by the player, because turning is a thing the
 * camera does. It is a rate, not an angle: the camera applies it per second, so
 * holding the key sweeps rather than jumping.
 */
export function readTurn() {
  return Math.max(-1, Math.min(1, keyboard.turn + touch.turn))
}

/**
 * Shots asked for by something that does not know where the player is - the
 * on-screen fire button, and a tap on the view.
 *
 * Queued rather than fired, because a shot needs the player's position (a stage
 * wall uses it to tell which side it was hit from) and the popup needs them on
 * screen, and only the frame loop has either. ShootInput drains this each frame.
 */
let pendingShots = 0

export const requestShot = () => {
  // A finger can out-run the frame rate; anything past a couple in one frame is
  // noise, and letting it build up would keep firing after the tapping stopped.
  pendingShots = Math.min(pendingShots + 1, 2)
}

export function takeShots() {
  const n = pendingShots
  pendingShots = 0
  return n
}
