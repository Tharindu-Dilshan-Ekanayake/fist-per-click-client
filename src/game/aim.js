/**
 * What the player is punching at, for the punch effects and for turning to face it.
 *
 * Plain mutable state rather than the store: it changes every frame and nothing
 * re-renders from it. Player writes `yaw` (the way the avatar faces); whatever the
 * player is currently punching - the bag on their pad, their opponent in a ring -
 * writes its world position into `target` while it is the thing being hit,
 * and clears it after. A stage wall needs no entry: the store's `nearWall` already
 * says where it is.
 */
export const aim = {
  /** The avatar's facing, radians about +Y (0 looks down +Z). */
  yaw: Math.PI,
  /** `[x, y, z]` of what is being punched, or null to punch straight ahead. */
  target: null,
  /** How far the near face of the target is from its `target` point. */
  radius: 0.5,
  /** Set while the target is an opponent in a boxing ring (see world/BoxingRing.jsx). */
  ring: false,
}

/**
 * Sets `aim.target` to a copy of `point`, reusing the array it already has.
 * `radius` is how far its near face is from that point; `ring` marks an opponent.
 */
export function setAimTarget(point, radius = 0.5, ring = false) {
  if (!point) {
    aim.target = null
    aim.ring = false
    return
  }
  aim.target ??= [0, 0, 0]
  aim.target[0] = point[0]
  aim.target[1] = point[1]
  aim.target[2] = point[2]
  aim.radius = radius
  aim.ring = ring
}
