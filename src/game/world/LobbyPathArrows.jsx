import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

const POSITIONS = [14, 6, -2, -10, -18, -26, -31.5]
/** Each arrow is two chevrons, each drawn as three stacked layers. */
const CHEVRONS = [0, -0.86]
const Y = 0.115

/** Open chevron arrowhead pointing down the avenue toward the Stage 01 gate. */
function makeArrowShape() {
  const shape = new Shape()
  shape.moveTo(-0.78, -0.44)
  shape.lineTo(0, 0.46)
  shape.lineTo(0.78, -0.44)
  shape.lineTo(0.78, -0.82)
  shape.lineTo(0, -0.04)
  shape.lineTo(-0.78, -0.82)
  shape.closePath()
  return shape
}

/**
 * One layer of every chevron that `pick` chooses, merged into one flat geometry
 * lying on the avenue: one draw for the lot instead of one per chevron.
 */
function layer(shape, scale, lift, pick) {
  const parts = []
  POSITIONS.forEach((z, index) => {
    CHEVRONS.forEach((offset, chevron) => {
      if (!pick(index, chevron)) return
      const g = new ShapeGeometry(shape)
      g.scale(scale[0], scale[1], 1)
      g.translate(0, offset, lift)
      g.rotateX(-Math.PI / 2)
      g.translate(0, Y, z)
      parts.push(g)
    })
  })
  const merged = mergeGeometries(parts)
  for (const g of parts) g.dispose()
  return merged
}

/** Decorative floor arrows; raised slightly above the avenue and never solid. */
export function LobbyPathArrows() {
  const layers = useMemo(() => {
    const shape = makeArrowShape()
    const last = POSITIONS.length - 1
    return {
      halo: layer(shape, [1.4, 1.35], 0.007, () => true),
      outline: layer(shape, [1.25, 1.2], 0.014, () => true),
      front: layer(shape, [0.95, 0.95], 0.021, (i, c) => i !== last && c === 0),
      back: layer(shape, [0.95, 0.95], 0.021, (i, c) => i !== last && c === 1),
      end: layer(shape, [0.95, 0.95], 0.021, (i) => i === last),
    }
  }, [])

  return (
    <group>
      <mesh geometry={layers.halo}>
        <meshBasicMaterial color="#15bfff" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh geometry={layers.outline}>
        <meshBasicMaterial color="#123d70" toneMapped={false} />
      </mesh>
      <mesh geometry={layers.front}>
        <meshBasicMaterial color="#32cfff" toneMapped={false} />
      </mesh>
      <mesh geometry={layers.back}>
        <meshBasicMaterial color="#21b9f5" toneMapped={false} />
      </mesh>
      <mesh geometry={layers.end}>
        <meshBasicMaterial color="#74e9ff" toneMapped={false} />
      </mesh>
    </group>
  )
}

export default LobbyPathArrows
