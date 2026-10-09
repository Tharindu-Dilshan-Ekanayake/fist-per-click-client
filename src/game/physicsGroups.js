import { interactionGroups } from '@react-three/rapier'

/**
 * Collision groups, for the one place the defaults are not enough: the boxing
 * rings' rope walls stop players but not the camera. With the camera's ray stopped
 * by them, a fighter's view was squeezed into the ring and nobody outside could be
 * seen; now the camera looks straight through, both ways.
 */

/** The rope walls: a group of their own (still solid to everything else). */
export const SEE_THROUGH = interactionGroups(2)

/** What the follow camera's ray tests against: every group but SEE_THROUGH's. */
export const CAMERA_RAY = interactionGroups(0, [0, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
