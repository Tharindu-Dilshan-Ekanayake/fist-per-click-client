import { Component } from 'react'

/**
 * Plain blocky figure, feet at y=0, shown while the real avatar downloads and in its
 * place if it can't be loaded at all.
 *
 * @param {{ height?: number }} props
 */
export function StandInBody({ height = 1.8 }) {
  const u = height / 1.82
  return (
    <group scale={u}>
      {[-0.19, 0.19].map((x) => (
        <mesh key={x} position={[x, 0.35, 0]} castShadow>
          <boxGeometry args={[0.34, 0.7, 0.36]} />
          <meshStandardMaterial color="#3f7d3a" />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.76, 0.7, 0.4]} />
        <meshStandardMaterial color="#2f6fd6" />
      </mesh>
      {[-0.52, 0.52].map((x) => (
        <mesh key={x} position={[x, 1.05, 0]} castShadow>
          <boxGeometry args={[0.28, 0.7, 0.34]} />
          <meshStandardMaterial color="#f2c94c" />
        </mesh>
      ))}
      <mesh position={[0, 1.61, 0]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#f2c94c" />
      </mesh>
    </group>
  )
}

/**
 * Catches a failed avatar download (e.g. the base body can't be fetched) so it
 * can't take the whole 3D scene down with it; shows `fallback` instead and calls
 * `onError` once.
 */
export class AvatarBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    console.warn('[avatar] failed to load; using a stand-in body', error)
    this.props.onError?.()
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

export default AvatarBoundary
