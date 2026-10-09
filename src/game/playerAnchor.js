/**
 * Where the player *looks* like they are, as opposed to where physics last put them.
 *
 * Rapier runs on a fixed step with an accumulator, so on any frame whose time does
 * not happen to fill that step, no step runs at all and `body.translation()` returns
 * exactly what it returned last frame. At 30Hz physics on a 60fps screen that is
 * every other frame; at 60Hz on a 144Hz screen it is most of them.
 *
 * The avatar never shows this, because @react-three/rapier eases its mesh between
 * the last two simulated positions (`accumulator / timeStep`) and so glides. But
 * everything that followed the player by reading the body directly - the camera
 * above all - moved in the raw steps instead: frozen for a frame, then a double-sized
 * jump. The avatar glides, the world lurches around it, and walking in a straight
 * line looks like it is skipping frames. That is what this exists to stop.
 *
 * So Player hangs an empty group off its rigid body, which @react-three/rapier eases
 * along with the mesh, and anything that follows the player reads that instead. The
 * body is still the right thing to ask about anything that is not on screen -
 * physics queries, network sync, which stage you are standing in.
 */

/**
 * Writes the player's smoothed world position into `out`.
 *
 * Falls back to the rigid body when the anchor has not mounted yet (the first frame,
 * and any caller that was not given one), so this is always safe to call.
 *
 * @param {React.MutableRefObject<import('three').Object3D | null> | undefined} anchorRef
 * @param {React.MutableRefObject<any>} bodyRef
 * @param {import('three').Vector3} out
 * @returns {import('three').Vector3 | null} `out`, or null if the player does not exist yet
 */
export function playerPosition(anchorRef, bodyRef, out) {
  const anchor = anchorRef?.current
  if (anchor) {
    // The physics step writes the eased position during its own frame callback, and
    // three only rebuilds world matrices at render time - so this frame's value is
    // still sitting in the local transform. Fold the parents in by hand rather than
    // read a matrix that is a frame out of date.
    anchor.updateWorldMatrix(true, false)
    return out.setFromMatrixPosition(anchor.matrixWorld)
  }

  const body = bodyRef?.current
  if (!body) return null
  const p = body.translation()
  return out.set(p.x, p.y, p.z)
}
