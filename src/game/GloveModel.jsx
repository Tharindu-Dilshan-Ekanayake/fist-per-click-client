import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import {
  AdditiveBlending,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  ExtrudeGeometry,
  OctahedronGeometry,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from 'three'

import { gloveTier } from './gloves'
import { Sparkle } from './world/Effects'
import { geometry, merge } from './world/geometry'
import { radialGlowTexture } from './world/textures'

/** How much brighter the trim flares on a punch. */
const FLASH_BOOST = 1.8

/**
 * A boxing glove, built from a handful of shared shapes.
 *
 * Authored for the left hand, in the frame of the hand holder on the avatar's forearm
 * (see avatarRig's attachHandHolder): the hand is at the origin, the knuckles point
 * down -Y (the way the fist travels when the arm swings forward), the thumb lies
 * along +Z, the back of the hand faces +X (the outside of a left hand) and the cuff
 * runs up +Y over the wrist. The right glove is the same model mirrored across X
 * (`side` -1).
 *
 * At `size` 1 the fist is about as big as the avatar's head - big, the way the
 * reference game draws them - and the `size` of the later pairs grows from there.
 * The cuff is wider than the avatar's arm, so it wraps the wrist rather than
 * vanishing inside it.
 */

/** The padded fist: a sphere swollen at the knuckles and drawn in at the wrist. */
const FIST = { rx: 0.19, ry: 0.255, rz: 0.215, y: -0.23 }
/** The cuff: radius at its bottom (by the fist) and top, and its span up the arm. */
const CUFF = { r0: 0.19, r1: 0.18, y0: -0.06, y1: 0.17 }

function fistGeometry() {
  return geometry('glove3-fist', () => {
    const g = new SphereGeometry(1, 32, 24)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      let x = pos.getX(i)
      const y = pos.getY(i)
      let z = pos.getZ(i)
      // 0 at the knuckles, 1 at the wrist.
      const t = (y + 1) / 2
      // Narrower towards the wrist, so the cuff reads as a separate piece.
      const taper = 1 - 0.22 * Math.max(0, (t - 0.45) / 0.55) ** 1.4
      x *= taper
      z *= taper
      // Squarer across the knuckles - the punching face is broad and flat-ish - and
      // a flatter back of the hand.
      const square = 1 + 0.12 * Math.max(0, 1 - t * 2)
      if (x > 0) x *= 0.9
      // The fingers curl under towards the palm at the knuckle end.
      const curl = -0.05 * (1 - t) ** 2
      pos.setXYZ(i, x * FIST.rx * square + curl, y * FIST.ry, z * FIST.rz * square)
    }
    g.translate(0, FIST.y, 0)
    g.computeVertexNormals()
    return g
  })
}

/** The thumb: a fat padded roll folded down the front of the fist, towards the palm. */
function thumbGeometry() {
  return geometry('glove3-thumb', () => {
    const g = new CapsuleGeometry(0.088, 0.2, 8, 16)
    g.scale(1.1, 1, 0.95)
    // Tip down towards the knuckles and in towards the palm.
    g.rotateX(-0.42)
    g.rotateZ(0.32)
    g.translate(-0.075, FIST.y + 0.03, FIST.rz * 0.86)
    return g
  })
}

/** The cuff over the wrist, and the band and rim on it. */
function cuffGeometry() {
  return geometry('glove3-cuff', () => {
    const h = CUFF.y1 - CUFF.y0
    const cuff = new CylinderGeometry(CUFF.r1, CUFF.r0, h, 28, 1, true)
    cuff.translate(0, (CUFF.y0 + CUFF.y1) / 2, 0)
    const top = new CylinderGeometry(CUFF.r1, CUFF.r1, 0.02, 28)
    top.translate(0, CUFF.y1, 0)
    // A padded roll round the opening.
    const rim = new TorusGeometry(CUFF.r1 + 0.004, 0.03, 10, 28)
    rim.rotateX(Math.PI / 2)
    rim.translate(0, CUFF.y1, 0)
    return merge([cuff, top, rim])
  })
}
function bandGeometry() {
  return geometry('glove3-band', () => {
    const band = new CylinderGeometry(CUFF.r0 + 0.008, CUFF.r0 + 0.008, 0.07, 28, 1, true)
    band.translate(0, (CUFF.y0 + CUFF.y1) / 2, 0)
    return band
  })
}

/** A five-pointed star, raised off the back of the hand. */
function emblemGeometry() {
  return geometry('glove2-emblem', () => {
    const shape = new Shape()
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 === 0 ? 0.09 : 0.038
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r)
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r)
    }
    shape.closePath()
    const g = new ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.008, bevelSize: 0.006, bevelSegments: 1 })
    g.rotateY(Math.PI / 2)
    g.rotateX(Math.PI)
    g.translate(FIST.rx * 0.93, FIST.y + 0.01, 0)
    return g
  })
}

/** Laces down the palm side of the cuff, for the pro gloves. */
function lacesGeometry() {
  return geometry('glove2-laces', () => {
    const parts = []
    const strip = new CylinderGeometry(0.014, 0.014, CUFF.y1 - CUFF.y0, 6)
    strip.translate(-CUFF.r0, (CUFF.y0 + CUFF.y1) / 2, 0)
    parts.push(strip)
    for (let i = 0; i < 4; i++) {
      const tie = new CapsuleGeometry(0.014, 0.085, 2, 6)
      tie.rotateX(Math.PI / 2)
      tie.rotateY(i % 2 ? 0.5 : -0.5)
      tie.translate(-CUFF.r0 - 0.004, CUFF.y0 + 0.04 + i * 0.055, 0)
      parts.push(tie)
    }
    return merge(parts)
  })
}

/** Studs: five across the back of the hand and three on the knuckles. */
function spikesGeometry() {
  return geometry('glove2-spikes', () => {
    const parts = []
    const stud = (x, y, z, rz, s = 1) => {
      const g = new ConeGeometry(0.04 * s, 0.12 * s, 7)
      g.rotateZ(rz)
      g.translate(x, y, z)
      parts.push(g)
    }
    for (const [y, z] of [[0.05, -0.08], [0.05, 0.08], [-0.06, -0.1], [-0.06, 0.1], [-0.005, 0]]) {
      stud(FIST.rx + 0.035, FIST.y + y, z, -Math.PI / 2)
    }
    for (const z of [-0.09, 0, 0.09]) stud(0.06, FIST.y - FIST.ry - 0.025, z, Math.PI, 0.85)
    return merge(parts)
  })
}

/** Flames licking back off the cuff, for the fire pairs. */
function flamesGeometry() {
  return geometry('glove2-flames', () => {
    const parts = []
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const h = i % 2 ? 0.24 : 0.36
      const g = new ConeGeometry(0.06, h, 6)
      g.translate(0, h / 2, 0)
      g.rotateZ(Math.cos(a) * 0.35)
      g.rotateX(-Math.sin(a) * 0.35)
      g.translate(Math.cos(a) * 0.14, CUFF.y1 - 0.02, Math.sin(a) * 0.14)
      parts.push(g)
    }
    // Two more swept back along the back of the hand.
    for (const [y, h] of [[0.06, 0.26], [-0.08, 0.2]]) {
      const g = new ConeGeometry(0.05, h, 6)
      g.translate(0, h / 2, 0)
      g.rotateZ(-0.5)
      g.translate(FIST.rx * 0.85, FIST.y + y, 0)
      parts.push(g)
    }
    return merge(parts)
  })
}

/** A cluster of shards on the back of the hand. */
function shardsGeometry() {
  return geometry('glove2-shards', () => {
    const parts = []
    for (const [y, z, s, tilt] of [[0, 0, 1, 0], [0.09, 0.08, 0.65, 0.4], [-0.09, -0.07, 0.7, -0.35], [0.1, -0.08, 0.5, -0.5]]) {
      const g = new OctahedronGeometry(1, 0)
      g.scale(0.05 * s, 0.13 * s, 0.05 * s)
      g.translate(0, 0.1 * s, 0)
      g.rotateZ(-Math.PI / 2 + 0.35)
      g.rotateX(tilt)
      g.translate(FIST.rx * 0.82, FIST.y + y, z)
      parts.push(g)
    }
    const merged = merge(parts)
    merged.computeVertexNormals()
    return merged
  })
}

/** Glowing circuit lines round the fist, for the tech pairs. */
function circuitGeometry() {
  return geometry('glove2-circuit', () => {
    const parts = []
    for (const [r, y] of [[FIST.rx * 1.01, FIST.y + 0.09], [FIST.rx * 1.04, FIST.y - 0.06]]) {
      const g = new TorusGeometry(1, 0.013, 4, 36)
      g.rotateX(Math.PI / 2)
      g.scale(r, 1, r * 1.06)
      g.translate(0, y, 0)
      parts.push(g)
    }
    const spine = new TorusGeometry(1, 0.012, 4, 30, Math.PI)
    spine.rotateZ(Math.PI / 2)
    spine.scale(FIST.rx * 1.03, FIST.ry * 1.03, 1)
    spine.translate(0, FIST.y, 0)
    parts.push(spine)
    return merge(parts)
  })
}

/** Two zig-zag bolts down the back of the hand. */
function boltsGeometry() {
  return geometry('glove2-bolts', () => {
    const shape = new Shape()
    const pts = [[0, 0.13], [0.042, 0.13], [0.014, 0.024], [0.054, 0.024], [-0.024, -0.13], [0.0, -0.012], [-0.036, -0.012]]
    pts.forEach(([x, y], i) => (i ? shape.lineTo(x, y) : shape.moveTo(x, y)))
    shape.closePath()
    const parts = []
    for (const [z, s, flip] of [[-0.06, 1, 1], [0.075, 0.75, -1]]) {
      const g = new ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false })
      g.scale(s * flip, s, 1)
      g.rotateY(Math.PI / 2)
      g.translate(FIST.rx * 0.95, FIST.y + 0.02, z)
      parts.push(g)
    }
    return merge(parts)
  })
}

/** A crown of points round the top of the cuff. */
function crownGeometry() {
  return geometry('glove2-crown', () => {
    const parts = []
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      const g = new ConeGeometry(0.035, 0.11, 4)
      g.translate(Math.cos(a) * CUFF.r1, CUFF.y1 + 0.065, Math.sin(a) * CUFF.r1)
      parts.push(g)
    }
    const ring = new TorusGeometry(CUFF.r1 + 0.01, 0.026, 6, 28)
    ring.rotateX(Math.PI / 2)
    ring.translate(0, CUFF.y1, 0)
    parts.push(ring)
    return merge(parts)
  })
}
/** A gem on the back of the hand. */
function gemGeometry() {
  return geometry('glove2-gem', () => {
    const g = new OctahedronGeometry(0.075, 0)
    g.scale(0.7, 1, 1)
    g.translate(FIST.rx + 0.012, FIST.y + 0.03, 0)
    return g
  })
}

/** Horns swept back off the cuff, and claws over the knuckles. */
function hornsGeometry() {
  return geometry('glove2-horns', () => {
    const parts = []
    for (const [z, h] of [[-0.09, 0.24], [0.09, 0.24], [0, 0.32]]) {
      const g = new ConeGeometry(0.042, h, 6)
      g.translate(0, h / 2, 0)
      g.rotateZ(-0.75)
      g.translate(CUFF.r1 * 0.8, CUFF.y1 - 0.04, z)
      parts.push(g)
    }
    for (const z of [-0.1, -0.035, 0.035, 0.1]) {
      const g = new ConeGeometry(0.026, 0.11, 5)
      g.rotateZ(Math.PI)
      g.rotateX(-0.4)
      g.translate(0.025, FIST.y - FIST.ry - 0.02, z + 0.02)
      parts.push(g)
    }
    return merge(parts)
  })
}

/** Little wings either side of the cuff, for the divine pairs. */
function wingsGeometry() {
  return geometry('glove2-wings', () => {
    const shape = new Shape()
    shape.moveTo(0, 0)
    shape.quadraticCurveTo(0.1, 0.19, 0.29, 0.24)
    shape.quadraticCurveTo(0.2, 0.15, 0.24, 0.07)
    shape.quadraticCurveTo(0.14, 0.06, 0.17, -0.01)
    shape.quadraticCurveTo(0.08, 0.01, 0, 0)
    const parts = []
    for (const flip of [1, -1]) {
      const g = new ExtrudeGeometry(shape, { depth: 0.014, bevelEnabled: false })
      g.rotateY(-Math.PI / 2)
      g.scale(1, 1, flip)
      g.translate(0.03, CUFF.y0 + 0.08, flip * (CUFF.r0 - 0.01))
      parts.push(g)
    }
    return merge(parts)
  })
}

/**
 * The extras a pair earns as it climbs the ladder (see gloveTier). The rookies are
 * plain; the best pairs glow, orbit and sparkle.
 */
const gloveExtras = (tier) => ({
  aura: tier >= 14,
})

/**
 * One boxing glove.
 *
 * @param {{ glove: import('./gloves').GLOVES[number], side?: 1 | -1, minGlow?: number,
 *           flashRef?: React.MutableRefObject<number>, sparkles?: boolean }} props
 *   `side` 1 is the left hand, -1 the right (mirrored). `minGlow` lights up even a
 *   plain pair's trim a little (the shop display uses it). `flashRef`, when given,
 *   is read every frame (not passed as a prop, so a punch doesn't re-render the
 *   glove 60 times a second): its `.current` (0-1) flares the trim, fading back as
 *   the punch lands.
 */
export function GloveModel({ glove, side = 1, minGlow = 0, flashRef, sparkles = true }) {
  const baseGlow = Math.max(glove.glow ?? 0, minGlow)
  const design = glove.design
  const extras = gloveExtras(gloveTier(glove))
  const trimMat = useRef(null)
  const fxMat = useRef(null)
  const flames = useRef(null)
  const orbit = useRef(null)
  const halo = useRef(null)
  const core = useRef(null)
  // Each glove animates a little out of step with the rest, by its id and hand.
  const phase = [...glove.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) * 0.37 + side

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime + phase
    const boost = flashRef?.current || 0
    if (trimMat.current) trimMat.current.emissiveIntensity = baseGlow * 0.6 + boost * FLASH_BOOST
    if (fxMat.current) fxMat.current.emissiveIntensity = 0.8 + baseGlow + 0.35 * Math.sin(t * 4) + boost * FLASH_BOOST
    if (flames.current) {
      const f = 1 + 0.18 * Math.sin(t * 17) + 0.1 * Math.sin(t * 29) + boost * 0.4
      flames.current.scale.set(1, f, 1)
    }
    if (orbit.current) {
      orbit.current.rotation.y += delta * 2.4
      orbit.current.rotation.z = 0.4 + Math.sin(t * 0.7) * 0.2
    }
    if (halo.current) halo.current.position.y = 0.4 + Math.sin(t * 2) * 0.025
    if (core.current) core.current.rotation.y += delta * 2
  })

  const trim = glove.trim
  return (
    <group scale={[glove.size * side, glove.size, glove.size]}>
      {/* Glossy leather, the way a new glove shines. */}
      <mesh geometry={fistGeometry()} castShadow>
        <meshPhysicalMaterial color={glove.main} roughness={0.42} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
      <mesh geometry={thumbGeometry()} castShadow>
        <meshPhysicalMaterial color={glove.main} roughness={0.42} clearcoat={0.7} clearcoatRoughness={0.25} />
      </mesh>
      <mesh geometry={cuffGeometry()} castShadow>
        <meshStandardMaterial color={glove.cuff} roughness={0.55} />
      </mesh>
      <mesh geometry={bandGeometry()}>
        <meshStandardMaterial ref={trimMat} color={trim} emissive={trim} emissiveIntensity={baseGlow * 0.6} roughness={0.35} metalness={0.2} />
      </mesh>
      {design !== 'spiked' && design !== 'crystal' && design !== 'thunder' && (
        <mesh geometry={emblemGeometry()}>
          <meshStandardMaterial color={trim} emissive={trim} emissiveIntensity={0.25 + baseGlow * 0.6} metalness={0.4} roughness={0.3} />
        </mesh>
      )}

      {design === 'pro' && (
        <mesh geometry={lacesGeometry()}>
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
      )}
      {design === 'spiked' && (
        <mesh geometry={spikesGeometry()} castShadow>
          <meshStandardMaterial color="#d9dde6" metalness={0.85} roughness={0.25} emissive={trim} emissiveIntensity={baseGlow * 0.25} />
        </mesh>
      )}
      {design === 'flame' && (
        <group ref={flames}>
          <mesh geometry={flamesGeometry()}>
            <meshStandardMaterial ref={fxMat} color={glove.cuff} emissive={trim} emissiveIntensity={1} toneMapped={false} transparent opacity={0.92} />
          </mesh>
        </group>
      )}
      {design === 'crystal' && (
        <mesh geometry={shardsGeometry()} castShadow>
          <meshStandardMaterial ref={fxMat} color={trim} emissive={trim} emissiveIntensity={1} roughness={0.1} flatShading />
        </mesh>
      )}
      {design === 'tech' && (
        <>
          <mesh geometry={circuitGeometry()}>
            <meshStandardMaterial ref={fxMat} color={trim} emissive={trim} emissiveIntensity={1} toneMapped={false} />
          </mesh>
          <mesh ref={core} position={[FIST.rx + 0.02, FIST.y + 0.01, 0]}>
            <icosahedronGeometry args={[0.055, 0]} />
            <meshStandardMaterial color={glove.cuff} emissive={trim} emissiveIntensity={1.4} toneMapped={false} flatShading />
          </mesh>
        </>
      )}
      {design === 'thunder' && (
        <mesh geometry={boltsGeometry()}>
          <meshStandardMaterial ref={fxMat} color={glove.cuff} emissive={glove.cuff} emissiveIntensity={1} toneMapped={false} />
        </mesh>
      )}
      {design === 'royal' && (
        <>
          <mesh geometry={crownGeometry()} castShadow>
            <meshStandardMaterial color="#ffd23f" metalness={0.9} roughness={0.2} emissive="#ffb000" emissiveIntensity={0.25} />
          </mesh>
          <mesh geometry={gemGeometry()}>
            <meshStandardMaterial ref={fxMat} color={trim} emissive={trim} emissiveIntensity={1} roughness={0.1} flatShading />
          </mesh>
        </>
      )}
      {design === 'dragon' && (
        <mesh geometry={hornsGeometry()} castShadow>
          <meshStandardMaterial color={glove.cuff} roughness={0.35} metalness={0.3} emissive={trim} emissiveIntensity={baseGlow * 0.3} />
        </mesh>
      )}
      {design === 'divine' && (
        <>
          <mesh geometry={wingsGeometry()}>
            <meshStandardMaterial color="#ffffff" emissive={trim} emissiveIntensity={0.5} roughness={0.4} side={2} />
          </mesh>
          <mesh ref={halo} position={[0, 0.4, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.15, 0.02, 8, 32]} />
            <meshBasicMaterial color={glove.cuff} toneMapped={false} />
          </mesh>
        </>
      )}
      {design === 'galaxy' && (
        <group ref={orbit} position={[0, FIST.y, 0]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.33, 0.014, 6, 40]} />
            <meshBasicMaterial color={trim} toneMapped={false} />
          </mesh>
          <mesh rotation={[Math.PI / 2 + 0.9, 0.5, 0]}>
            <torusGeometry args={[0.37, 0.01, 6, 40]} />
            <meshBasicMaterial color={glove.cuff} toneMapped={false} />
          </mesh>
          <mesh position={[0.33, 0, 0]}>
            <icosahedronGeometry args={[0.035, 0]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      )}

      {/* A soft halo round the better pairs, brightest on a punch. */}
      {baseGlow >= 0.6 && (
        <sprite position={[0, FIST.y, 0]} scale={0.9}>
          <spriteMaterial map={radialGlowTexture()} color={trim} transparent opacity={0.28} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      )}
      {sparkles && extras.aura && <Sparkle count={8} scale={[0.5, 0.6, 0.5]} position={[0, FIST.y, 0]} size={2.5} speed={0.6} color={trim} />}
    </group>
  )
}

export default GloveModel
