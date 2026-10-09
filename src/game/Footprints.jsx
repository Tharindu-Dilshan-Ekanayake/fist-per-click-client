import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide } from 'three'

import { FOOTPRINT_S, footprintStyle, footprintTexture, pendingSteps } from './footprintSets'
import { useGame } from './gameStore'
import { getGun } from './guns'
import { radialGlowTexture } from './world/textures'

/** Prints on the ground at once. A sprint lands about four a second, each lasting one. */
const POOL = 12
/** Sparks per print, at most (see footprintStyle). */
const MAX_SPARKS = 9
/** A print's size before the style's scale, in metres. */
const PRINT_W = 0.36
const PRINT_L = 0.5
/** How far either foot lands from the middle of the body. */
const STRIDE_HALF_WIDTH = 0.17
/** Just off the ground, so it never fights the floor for the same pixels. */
const LIFT = 0.025
const POP_S = 0.08

/** Our own steps, from Player, in the same ref shape other players' trails use. */
const ownStepsRef = { current: pendingSteps }

const _c = new Color()
const _faded = new Color()

/**
 * The player's footprints, in the set they picked in the shop (see game/footprintSets.js).
 * Nothing is drawn, and nothing runs, while footprints are off.
 */
export function Footprints() {
  const id = useGame((s) => (s.footprints && s.ownedFootprints.includes(s.footprints) ? s.footprints : null))
  return id ? <FootprintTrail key={id} gunId={id} stepsRef={ownStepsRef} /> : null
}

/**
 * One player's trail: prints, glow, ripples and sparks in `gunId`'s style, laid where
 * each step in `stepsRef.current` (a queue of `{ x, y, z, yaw, side }`, drained
 * here) landed.
 * Our own trail is fed by Player; other players' by RemotePlayers, from their
 * played-back movement - so everyone sees everyone's footprints.
 */
export function FootprintTrail({ gunId, stepsRef }) {
  const gun = getGun(gunId)
  const style = useMemo(() => footprintStyle(gun), [gun])
  const map = footprintTexture(gunId)
  const glowMap = radialGlowTexture()

  const prints = useRef([])
  const glows = useRef([])
  const ripples = useRef([])
  const sparkPoints = useRef(null)
  const state = useRef({
    next: 0,
    slots: Array.from({ length: POOL }, () => ({ at: -Infinity, x: 0, y: 0, z: 0 })),
    sparks: Array.from({ length: POOL * MAX_SPARKS }, () => ({ x: 0, y: 0, z: 0, vy: 0, vx: 0, vz: 0 })),
  })

  const sparkGeometry = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(POOL * MAX_SPARKS * 3), 3))
    g.setAttribute('color', new BufferAttribute(new Float32Array(POOL * MAX_SPARKS * 3), 3))
    return g
  }, [])
  useEffect(() => () => sparkGeometry.dispose(), [sparkGeometry])
  // Steps queued before this set was switched on belong to nobody.
  useEffect(() => {
    stepsRef.current.length = 0
  }, [stepsRef])

  useFrame((_, delta) => {
    const now = performance.now() / 1000
    const s = state.current

    const steps = stepsRef.current
    while (steps.length) {
      const step = steps.shift()
      const i = s.next
      s.next = (i + 1) % POOL
      const slot = s.slots[i]
      // Out to the side of the body, square to the way it faces.
      slot.x = step.x + Math.cos(step.yaw) * STRIDE_HALF_WIDTH * step.side
      slot.z = step.z - Math.sin(step.yaw) * STRIDE_HALF_WIDTH * step.side
      slot.y = step.y + LIFT
      slot.at = now
      const print = prints.current[i]
      if (print) {
        print.position.set(slot.x, slot.y, slot.z)
        print.rotation.set(-Math.PI / 2, 0, step.yaw + Math.PI)
      }
      for (let k = 0; k < style.sparkles; k++) {
        const spark = s.sparks[i * MAX_SPARKS + k]
        spark.x = slot.x + (Math.random() - 0.5) * 0.35
        spark.y = slot.y + 0.05
        spark.z = slot.z + (Math.random() - 0.5) * 0.35
        spark.vx = (Math.random() - 0.5) * 0.4
        spark.vy = 0.6 + Math.random() * 0.9
        spark.vz = (Math.random() - 0.5) * 0.4
      }
    }

    // Through the ref, not the memo: the geometry is the points' to update.
    const pos = sparkPoints.current?.geometry.attributes.position
    const col = sparkPoints.current?.geometry.attributes.color
    _c.set(gun.trim)
    for (let i = 0; i < POOL; i++) {
      const slot = s.slots[i]
      const age = (now - slot.at) / FOOTPRINT_S
      const alive = age >= 0 && age < 1
      const fade = alive ? 1 - age * age : 0
      const print = prints.current[i]
      if (print) {
        print.visible = alive
        if (alive) {
          print.material.opacity = fade
          print.scale.setScalar(style.scale * Math.min(1, 0.6 + (now - slot.at) / POP_S * 0.4))
        }
      }
      const glow = glows.current[i]
      if (glow) {
        glow.visible = alive && style.glow > 0
        if (glow.visible) {
          glow.position.set(slot.x, slot.y - 0.005, slot.z)
          glow.material.opacity = fade * style.glow
        }
      }
      const ripple = ripples.current[i]
      if (ripple) {
        ripple.visible = alive && style.ripple && age < 0.6
        if (ripple.visible) {
          const k = age / 0.6
          ripple.position.set(slot.x, slot.y + 0.005, slot.z)
          ripple.scale.setScalar(style.scale * (0.3 + k * 1.1))
          ripple.material.opacity = (1 - k) * 0.9
        }
      }
      for (let k = 0; pos && k < MAX_SPARKS; k++) {
        const n = i * MAX_SPARKS + k
        const spark = s.sparks[n]
        if (alive && k < style.sparkles) {
          spark.x += spark.vx * delta
          spark.y += spark.vy * delta
          spark.z += spark.vz * delta
          pos.setXYZ(n, spark.x, spark.y, spark.z)
          // Additive, so fading to black is fading out.
          _faded.copy(_c).multiplyScalar(fade)
          col.setXYZ(n, _faded.r, _faded.g, _faded.b)
        } else {
          pos.setXYZ(n, 0, -1000, 0)
          col.setXYZ(n, 0, 0, 0)
        }
      }
    }
    if (pos) {
      pos.needsUpdate = true
      col.needsUpdate = true
    }
  })

  return (
    <group>
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i}>
          <mesh
            visible={false}
            renderOrder={1}
            ref={(el) => {
              prints.current[i] = el
            }}
          >
            <planeGeometry args={[PRINT_W, PRINT_L]} />
            <meshBasicMaterial map={map} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
          </mesh>
          <mesh
            visible={false}
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(el) => {
              glows.current[i] = el
            }}
          >
            <planeGeometry args={[1.1 * style.scale, 1.1 * style.scale]} />
            <meshBasicMaterial map={glowMap} color={gun.trim} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
          {style.ripple && (
            <mesh
              visible={false}
              rotation={[-Math.PI / 2, 0, 0]}
              ref={(el) => {
                ripples.current[i] = el
              }}
            >
              <ringGeometry args={[0.42, 0.5, 32]} />
              <meshBasicMaterial color={gun.accent} transparent side={DoubleSide} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}
      {style.sparkles > 0 && (
        <points ref={sparkPoints} geometry={sparkGeometry} frustumCulled={false}>
          <pointsMaterial
            map={glowMap}
            size={0.22}
            vertexColors
            transparent
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </points>
      )}
    </group>
  )
}

export default Footprints
