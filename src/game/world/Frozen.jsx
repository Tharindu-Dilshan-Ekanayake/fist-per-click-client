import { useLayoutEffect, useRef } from 'react'

/**
 * A group whose contents never move: their matrices are worked out when `deps`
 * changes (things mounted or unmounted inside) and not again.
 *
 * three walks every object in the scene each frame to recompose its matrices,
 * whether it moved or not, and the map's signs and crystals are hundreds of objects
 * that never do. Nothing inside may animate its own transform.
 */
export function Frozen({ deps, children }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const g = ref.current
    if (!g) return
    g.updateMatrixWorld(true)
    g.matrixWorldAutoUpdate = false
  }, [deps])
  return <group ref={ref}>{children}</group>
}

export default Frozen
