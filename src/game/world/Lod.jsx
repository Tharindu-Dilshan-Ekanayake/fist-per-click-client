import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { Vector3 } from 'three'

const _at = new Vector3()

/** Every this many frames each Lod checks its distance again: often enough to be unseen. */
const CHECK_EVERY = 6
let counter = 0

/**
 * Draws its children only while the camera is within `distance` of it.
 *
 * For the detail on things the map has dozens of - the gloves turning over every
 * shop pad, the pets on the egg stands, the glow rising off every pad - which is
 * a few pixels across from the far end of a row and the bulk of the draw calls.
 * The things that say what a spot is (the pad, its sign) stay outside a Lod, so the
 * map still reads from a distance; the detail arrives as you walk up to it.
 *
 * Hidden, not unmounted: nothing is rebuilt on the way back in.
 */
export function Lod({ distance = 32, children }) {
  const ref = useRef(null)
  // Spread the checks over the frames, so they never all land on the same one.
  const phase = useRef(counter++ % CHECK_EVERY)
  const frame = useRef(0)
  useFrame(({ camera }) => {
    const g = ref.current
    if (!g || frame.current++ % CHECK_EVERY !== phase.current) return
    g.getWorldPosition(_at)
    const near = _at.distanceToSquared(camera.position) < distance * distance
    if (near === g.visible) return
    g.visible = near
    // Hidden, its matrices need not be worked out every frame either: three walks
    // the whole tree for those, seen or not. Brought up to date on the way back.
    g.matrixWorldAutoUpdate = near
    if (near) g.updateMatrixWorld(true)
  })
  return <group ref={ref}>{children}</group>
}

export default Lod
