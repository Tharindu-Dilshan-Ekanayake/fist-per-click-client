import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

import { getMaterial, worldBoxGeometry } from './materials'

/**
 * Renders the map's static boxes. Blocks sharing a material are merged into a single
 * mesh (their UVs are already world-space, so studs stay aligned), which keeps the
 * whole map to a couple of dozen draw calls. Solid blocks each get a cuboid collider
 * on one fixed body.
 *
 * @param {{ blocks: { p: number[], s: number[], m: string, c: boolean }[] }} props
 */
export function StaticBlocks({ blocks }) {
  const colliderHost = useRef(null)
  const meshes = useMemo(() => {
    const byMaterial = new Map()
    for (const block of blocks) {
      if (!byMaterial.has(block.m)) byMaterial.set(block.m, [])
      byMaterial.get(block.m).push(block)
    }
    return [...byMaterial].map(([key, list]) => {
      const { material, tile, shadow } = getMaterial(key)
      const parts = list.map((b) => worldBoxGeometry(b.s, b.p, tile))
      const geometry = mergeGeometries(parts)
      for (const part of parts) part.dispose()
      return { key, geometry, material, shadow }
    })
  }, [blocks])

  useEffect(() => () => meshes.forEach((m) => m.geometry.dispose()), [meshes])

  const solid = useMemo(() => blocks.filter((b) => b.c), [blocks])

  /**
   * Take the colliders out of the per-frame scene walk.
   *
   * Every <CuboidCollider> is also an Object3D, and there are two and a half
   * thousand of them - two thirds of everything in the scene. They draw nothing and
   * they never move, but three.js does not know that: it recomposed all of their
   * matrices in updateMatrixWorld and then walked them all again in the renderer's
   * culling pass, every single frame. That was the largest remaining cost in the
   * whole game once the shader thrash was gone.
   *
   * `matrixWorldAutoUpdate` stops the matrix walk descending here at all, and
   * `visible` does the same for the culling pass - three skips a hidden subtree
   * outright. Nothing is lost by hiding them because there was never anything here
   * to see; Rapier reads the collider shapes from its own world, not from these.
   *
   * A parent's effect runs after its children's, so the colliders are already built
   * by the time this fires.
   */
  useEffect(() => {
    const host = colliderHost.current
    if (!host) return
    host.updateMatrixWorld(true)
    host.matrixWorldAutoUpdate = false
    host.visible = false
  }, [solid])

  return (
    <>
      {meshes.map((m) => (
        <mesh
          key={m.key}
          geometry={m.geometry}
          material={m.material}
          castShadow={m.shadow}
          receiveShadow={m.shadow}
        />
      ))}
      <group ref={colliderHost}>
        <RigidBody type="fixed" colliders={false} name="map">
          {solid.map((b, i) => (
            <CuboidCollider key={i} args={[b.s[0] / 2, b.s[1] / 2, b.s[2] / 2]} position={b.p} />
          ))}
        </RigidBody>
      </group>
    </>
  )
}

export default StaticBlocks
