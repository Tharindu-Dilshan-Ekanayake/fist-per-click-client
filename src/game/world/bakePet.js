import { BufferAttribute, Matrix4, Mesh, MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Bakes a pet's many small parts into a few meshes.
 *
 * A pet is written as forty-odd parts - a sphere for the body, two for each eye,
 * cones for ears, a ring for the headband - which reads well and draws badly: forty
 * draw calls a pet, twice over with the shadow pass, and a lobby full of pets and
 * egg stands is most of a frame. Only a dozen of those parts ever move on their own
 * (the legs, the head, the ears, the eyes for a blink, the tail, the wings), so
 * everything that moves together is merged into one mesh, coloured per vertex, in
 * the group that moves it. The original parts stay in the tree, hidden, so React
 * can go on reconciling them; the baked meshes are added beside them.
 *
 * @param {import('three').Object3D} root   everything under it is baked
 * @param {Set<import('three').Object3D>} animated  the groups that move on their own
 * @param {number} glow  the pet's emissive strength
 * @returns {() => void} undoes the bake (for a change of pet, or unmounting)
 */
export function bakePet(root, animated, glow) {
  if (!root) return () => {}
  root.updateWorldMatrix(true, true)
  /** target group -> { parts: geometries, shadow } */
  const byTarget = new Map()
  const hidden = []
  root.traverse((o) => {
    if (!o.isMesh || o.userData.baked || !o.material?.color) return
    let target = o.parent
    while (target && target !== root && !animated.has(target)) target = target.parent
    if (!target) return
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name)
    g.clearGroups()
    g.applyMatrix4(_m.copy(target.matrixWorld).invert().multiply(o.matrixWorld))
    const c = o.material.color
    const colors = new Float32Array(g.attributes.position.count * 3)
    for (let i = 0; i < colors.length; i += 3) {
      colors[i] = c.r
      colors[i + 1] = c.g
      colors[i + 2] = c.b
    }
    g.setAttribute('color', new BufferAttribute(colors, 3))
    const entry = byTarget.get(target) ?? { parts: [], shadow: false }
    entry.parts.push(g)
    entry.shadow ||= o.castShadow
    byTarget.set(target, entry)
    o.visible = false
    o.matrixWorldAutoUpdate = false
    hidden.push(o)
  })

  const added = []
  for (const [target, { parts, shadow }] of byTarget) {
    const merged = mergeGeometries(parts)
    for (const g of parts) g.dispose()
    if (!merged) continue
    const mesh = new Mesh(merged, petMaterial(glow))
    mesh.castShadow = shadow
    mesh.userData.baked = true
    target.add(mesh)
    added.push(mesh)
  }

  return () => {
    for (const mesh of added) {
      mesh.parent?.remove(mesh)
      mesh.geometry.dispose()
    }
    for (const o of hidden) {
      o.visible = true
      o.matrixWorldAutoUpdate = true
    }
  }
}

const _m = new Matrix4()
const materials = new Map()

/**
 * One material for every pet at the same glow: colour from the vertices, and the glow
 * tinted by the same colour (a stock material's emissive is one colour for the lot).
 */
function petMaterial(glow) {
  const key = Math.round(glow * 100)
  let m = materials.get(key)
  if (!m) {
    m = new MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.02, emissive: '#ffffff', emissiveIntensity: glow })
    m.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 totalEmissiveRadiance = emissive;',
        'vec3 totalEmissiveRadiance = emissive * vColor.rgb;',
      )
    }
    m.customProgramCacheKey = () => 'pet-tinted-emissive'
    materials.set(key, m)
  }
  return m
}
