/**
 * Where the player is pointing their gun, for the shot effects.
 *
 * Plain mutable state rather than the store: it changes every frame and nothing
 * re-renders from it. Player writes `yaw` (the way the avatar faces); whatever the
 * player is currently shooting at - the target on their pad, the boss - writes its
 * world position into `target` while it is the thing being shot, and clears it after.
 * A stage wall needs no entry: the store's `nearWall` already says where it is.
 */
export const aim = {
  /** The avatar's facing, radians about +Y (0 looks down +Z). */
  yaw: Math.PI,
  /** `[x, y, z]` of what is being shot at, or null to shoot straight ahead. */
  target: null,
  /** The local gun's muzzle (an Object3D at the barrel tip), set by GunModel; shots start there. */
  muzzle: null,
}

/** Sets `aim.target` to a copy of `point`, reusing the array it already has. */
export function setAimTarget(point) {
  if (!point) {
    aim.target = null
    return
  }
  aim.target ??= [0, 0, 0]
  aim.target[0] = point[0]
  aim.target[1] = point[1]
  aim.target[2] = point[2]
}
