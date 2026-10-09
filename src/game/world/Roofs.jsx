import { useEffect, useMemo } from 'react'
import { PlaneGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { getMaterial } from './materials'

const ROOF_MATERIAL = 'floor:#4a4f6e,#40445f'

/**
 * Studded ceilings over the stage corridors and VIP rooms, merged into one mesh.
 * Each is a single downward-facing plane: solid from inside, but back-face culled
 * from above, so the follow camera can still see in when it rises over the top.
 *
 * @param {{ roofs: { x0: number, x1: number, z0: number, z1: number, y: number }[] }} props
 */
export function Roofs({ roofs }) {
  const { material, tile } = getMaterial(ROOF_MATERIAL)

  const geometry = useMemo(() => {
    const parts = roofs.map(({ x0, x1, z0, z1, y }) => {
      const plane = new PlaneGeometry(x1 - x0, z1 - z0)
      // Face down (+Z normal turned to -Y), then place it.
      plane.rotateX(Math.PI / 2)
      plane.translate((x0 + x1) / 2, y, (z0 + z1) / 2)
      // World-space UVs, so the studs line up across every roof.
      const pos = plane.attributes.position
      const uv = plane.attributes.uv
      for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile)
      return plane
    })
    const merged = mergeGeometries(parts)
    for (const part of parts) part.dispose()
    return merged
  }, [roofs, tile])

  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={material} />
}

export default Roofs
