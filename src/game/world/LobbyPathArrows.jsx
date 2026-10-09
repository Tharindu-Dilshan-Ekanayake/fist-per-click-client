import { useMemo } from 'react'
import { Shape, ShapeGeometry } from 'three'

const POSITIONS = [14, 6, -2, -10, -18, -26, -31.5]

/** Open chevron arrowhead pointing down the avenue toward the Stage 01 gate. */
function makeArrowGeometry() {
  const shape = new Shape()
  shape.moveTo(-0.78, -0.44)
  shape.lineTo(0, 0.46)
  shape.lineTo(0.78, -0.44)
  shape.lineTo(0.78, -0.82)
  shape.lineTo(0, -0.04)
  shape.lineTo(-0.78, -0.82)
  shape.closePath()
  return new ShapeGeometry(shape)
}

/** Decorative floor arrows; raised slightly above the avenue and never solid. */
export function LobbyPathArrows() {
  const arrow = useMemo(() => makeArrowGeometry(), [])

  return (
    <group>
      {POSITIONS.map((z, index) => (
        <group key={z} position={[0, 0.115, z]} rotation={[-Math.PI / 2, 0, 0]}>
          {[0, -0.86].map((offset, chevron) => (
            <group key={offset} position={[0, offset, 0]}>
              <mesh position={[0, 0, 0.007]} scale={[1.4, 1.35, 1]} geometry={arrow}>
                <meshBasicMaterial color="#15bfff" transparent opacity={0.2} depthWrite={false} toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, 0.014]} scale={[1.25, 1.2, 1]} geometry={arrow}>
                <meshBasicMaterial color="#123d70" toneMapped={false} />
              </mesh>
              <mesh position={[0, 0, 0.021]} scale={[0.95, 0.95, 1]} geometry={arrow}>
                <meshBasicMaterial
                  color={index === POSITIONS.length - 1 ? '#74e9ff' : chevron === 0 ? '#32cfff' : '#21b9f5'}
                  toneMapped={false}
                />
              </mesh>
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

export default LobbyPathArrows
