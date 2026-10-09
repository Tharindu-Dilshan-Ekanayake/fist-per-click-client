import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Points, ShaderMaterial } from 'three'

/**
 * A small particle engine for the players' effects: auras, the gloves' trails, the
 * level-up burst and the flying punch's shockwave.
 *
 * Each pool is one `Points` object in world space - a few hundred soft, glowing dots,
 * drawn in a single call - with a ring buffer of particles. `emit` writes one into
 * the next slot (overwriting the oldest when full), `update` moves them on, fades
 * them and uploads only when something is alive. Everything is plain arrays: an
 * emitter running sixty times a second allocates nothing.
 *
 * Particles have a velocity, a drag, a gravity (negative rises), a life, a size that
 * can grow or shrink over that life, and a colour that can fade towards a second
 * one - which is the whole vocabulary a flame, a spark, a bubble and a star need.
 */

const VERTEX = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute vec3 aColor;
  varying float vAlpha;
  varying vec3 vColor;
  uniform float uScale;
  void main() {
    vAlpha = aAlpha;
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`

const FRAGMENT = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    // A hot core and a soft edge: reads as light, not as a disc.
    float glow = smoothstep(0.5, 0.0, d);
    float core = smoothstep(0.18, 0.0, d);
    gl_FragColor = vec4(vColor * (0.75 + core * 0.9), vAlpha * glow);
  }
`

/** One material for every pool: there is nothing per-pool in it. */
let sharedMaterial = null
function material() {
  sharedMaterial ??= new ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { uScale: { value: 400 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    toneMapped: false,
  })
  return sharedMaterial
}

const _c1 = new Color()
const _c2 = new Color()

/**
 * A pool of `count` particles.
 *
 * @returns {{ points: Points, emit: (o: object) => void, update: (dt: number) => void }}
 *   `emit({ x, y, z, vx, vy, vz, life, size, endSize, color, endColor, alpha, drag, gravity, spin })`
 *   - everything but the position is optional.
 */
export function createParticles(count) {
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const alphas = new Float32Array(count)
  const colors = new Float32Array(count * 3)
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new BufferAttribute(sizes, 1))
  geometry.setAttribute('aAlpha', new BufferAttribute(alphas, 1))
  geometry.setAttribute('aColor', new BufferAttribute(colors, 3))
  const points = new Points(geometry, material())
  points.frustumCulled = false
  points.renderOrder = 3

  // Per-particle state, kept off the GPU arrays.
  const vel = new Float32Array(count * 3)
  const age = new Float32Array(count).fill(1)
  const life = new Float32Array(count).fill(1)
  const size0 = new Float32Array(count)
  const size1 = new Float32Array(count)
  const col0 = new Float32Array(count * 3)
  const col1 = new Float32Array(count * 3)
  const alpha0 = new Float32Array(count)
  const drag = new Float32Array(count)
  const gravity = new Float32Array(count)
  const swirl = new Float32Array(count)
  let next = 0
  let alive = 0

  function emit(o) {
    const i = next
    next = (next + 1) % count
    if (age[i] >= life[i]) alive++
    const i3 = i * 3
    positions[i3] = o.x
    positions[i3 + 1] = o.y
    positions[i3 + 2] = o.z
    vel[i3] = o.vx ?? 0
    vel[i3 + 1] = o.vy ?? 0
    vel[i3 + 2] = o.vz ?? 0
    age[i] = 0
    life[i] = o.life ?? 0.8
    size0[i] = o.size ?? 0.3
    size1[i] = o.endSize ?? size0[i] * 0.2
    _c1.set(o.color ?? '#ffffff')
    _c2.set(o.endColor ?? o.color ?? '#ffffff')
    col0[i3] = _c1.r
    col0[i3 + 1] = _c1.g
    col0[i3 + 2] = _c1.b
    col1[i3] = _c2.r
    col1[i3 + 1] = _c2.g
    col1[i3 + 2] = _c2.b
    alpha0[i] = o.alpha ?? 1
    drag[i] = o.drag ?? 1.5
    gravity[i] = o.gravity ?? 0
    swirl[i] = o.spin ?? 0
  }

  function update(dt) {
    if (alive <= 0) {
      points.visible = false
      return
    }
    points.visible = true
    let still = 0
    const d = Math.min(dt, 0.05)
    for (let i = 0; i < count; i++) {
      if (age[i] >= life[i]) continue
      age[i] += d
      const i3 = i * 3
      if (age[i] >= life[i]) {
        alphas[i] = 0
        sizes[i] = 0
        continue
      }
      still++
      const k = age[i] / life[i]
      const damp = Math.exp(-drag[i] * d)
      let vx = vel[i3] * damp
      const vy = (vel[i3 + 1] - gravity[i] * d) * damp
      let vz = vel[i3 + 2] * damp
      // A swirl turns the velocity about the vertical, for spirals.
      if (swirl[i]) {
        const a = swirl[i] * d
        const cs = Math.cos(a)
        const sn = Math.sin(a)
        const rx = vx * cs - vz * sn
        vz = vx * sn + vz * cs
        vx = rx
      }
      vel[i3] = vx
      vel[i3 + 1] = vy
      vel[i3 + 2] = vz
      positions[i3] += vx * d
      positions[i3 + 1] += vy * d
      positions[i3 + 2] += vz * d
      sizes[i] = size0[i] + (size1[i] - size0[i]) * k
      // Pops in, then fades out over the back half.
      alphas[i] = alpha0[i] * Math.min(1, k * 8) * (k < 0.5 ? 1 : 1 - (k - 0.5) * 2)
      colors[i3] = col0[i3] + (col1[i3] - col0[i3]) * k
      colors[i3 + 1] = col0[i3 + 1] + (col1[i3 + 1] - col0[i3 + 1]) * k
      colors[i3 + 2] = col0[i3 + 2] + (col1[i3 + 2] - col0[i3 + 2]) * k
    }
    alive = still
    geometry.attributes.position.needsUpdate = true
    geometry.attributes.aSize.needsUpdate = true
    geometry.attributes.aAlpha.needsUpdate = true
    geometry.attributes.aColor.needsUpdate = true
  }

  function dispose() {
    geometry.dispose()
  }

  return { points, emit, update, dispose }
}
