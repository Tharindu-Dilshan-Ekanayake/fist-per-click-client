import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide, PlaneGeometry } from 'three'

import { qualityOf, useSettings } from '../settings'
import { Sparkle } from './Effects'
import { geometry } from './geometry'
import { NEON_INSET, neonOutlineTexture, radialGlowTexture } from './textures'

/** Seconds for one ring to rise from the pad to the top and fade away. */
const RISE_S = 2.4
/** A ring shrinks to this fraction of its size by the time it reaches the top. */
const TOP_SCALE = 0.72

const wrap = (x) => ((x % 1) + 1) % 1

/**
 * A unit plane lying flat, shared by every halo, outline and ring on the map. Each
 * mesh scales it to the size it wants, so one geometry covers all of them instead of
 * the two hundred and fifty separate ones the JSX elements used to build.
 */
const flatPlane = () =>
  geometry('pad-glow-plane', () => {
    const g = new PlaneGeometry(1, 1)
    g.rotateX(-Math.PI / 2)
    return g
  })

/**
 * Hologram-style glow for a shop or training pad: a neon outline hugging its rim
 * and a soft halo on the floor, while rings the pad's shape keep rising off it,
 * shrinking a little and fading out at the top, one after another. Everything is
 * additive and unlit: a handful of cheap draws, no lights.
 *
 * @param {{ color: string, shape?: 'square' | 'hex', size: number, y?: number,
 *           rise?: number, level?: number, sparkles?: number,
 *           phase?: number }} props
 *   `size`: the outline's width (a square's side, or a hex's corner-to-corner).
 *   `y`: height of the outline, just above the pad's top. `rise`: how high the rings
 *   climb. `level`: brightness, about 0.4 (locked) to 1.2 (in use). `phase` offsets
 *   the pulse and rings so neighbouring pads don't move in step.
 */
export function PadGlow({
  color,
  shape = 'square',
  size,
  y = 0.24,
  rise = 2.6,
  level = 1,
  sparkles = 6,
  phase = 0,
}) {
  const outline = useRef(null)
  const halo = useRef(null)
  const ringMeshes = useRef([])
  // How many rings is the graphics level's call, not the caller's: they are the most
  // expensive thing on the pad and the least load-bearing.
  const rings = useSettings((s) => qualityOf(s.quality).rings)
  // Sized so the outline, NEON_INSET in from the texture's edge, lands on the rim.
  const plane = size / (1 - 2 * NEON_INSET)
  const map = neonOutlineTexture(color, shape)
  const geom = flatPlane()

  useFrame(({ clock }) => {
    const time = clock.elapsedTime
    const pulse = 0.82 + 0.18 * Math.sin(time * 2.4 + phase)
    if (outline.current) outline.current.opacity = Math.min(1, level * pulse)
    if (halo.current) halo.current.opacity = 0.32 * level * pulse

    ringMeshes.current.forEach((mesh, i) => {
      if (!mesh) return
      // Evenly spaced in time: one leaves the pad as the one above fades away.
      const t = wrap(time / RISE_S + i / rings + phase * 0.137)
      const fade = Math.min(1, t / 0.12) * (1 - t) ** 1.4
      mesh.position.y = y + 0.02 + t * rise
      // The shared unit plane means the pad's own size has to go back in here.
      mesh.scale.setScalar(plane * (1 - (1 - TOP_SCALE) * t))
      mesh.material.opacity = Math.min(1, level) * 0.9 * fade
    })
  })

  const glow = { transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false }

  return (
    <group>
      <mesh position={[0, 0.03, 0]} geometry={geom} scale={size * 2.1}>
        <meshBasicMaterial ref={halo} map={radialGlowTexture()} color={color} opacity={0.32} {...glow} />
      </mesh>

      <mesh position={[0, y, 0]} geometry={geom} scale={plane} renderOrder={1}>
        <meshBasicMaterial ref={outline} map={map} {...glow} />
      </mesh>

      {/* Seen from below as well, since the camera can be lower than the top ones. */}
      {Array.from({ length: rings }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            ringMeshes.current[i] = el
          }}
          position={[0, y, 0]}
          geometry={geom}
          scale={plane}
          renderOrder={1}
        >
          {/* forceSinglePass: see the note in world/Effects.jsx. */}
          <meshBasicMaterial map={map} opacity={0} side={DoubleSide} forceSinglePass {...glow} />
        </mesh>
      ))}

      {sparkles > 0 && (
        <Sparkle
          count={sparkles}
          scale={[size * 0.8, rise, size * 0.8]}
          position={[0, y + rise / 2, 0]}
          size={3.5}
          speed={0.5}
          opacity={Math.min(1, 0.3 + level * 0.5)}
          color={color}
        />
      )}
    </group>
  )
}

export default PadGlow
