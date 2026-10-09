import { CanvasTexture, SRGBColorSpace } from 'three'

import { tidy } from './format'
import { getGlove, gloveTier, GLOVES, MAX_GLOVE_TIER } from './gloves'

/**
 * Footprints: a trail the player leaves behind, bought in the shop with Wins.
 *
 * Every pair of gloves has its own set, in its colours and shaped after its design,
 * and you can only buy a pair's set once you own the gloves. The further up the
 * ladder the pair is (see gloveTier), the fancier its prints - the rookies leave
 * plain shoe prints, the best pairs leave glowing, sparkling, rippling ones. Each
 * print is gone in a second.
 *
 * The prints themselves are drawn by Footprints.jsx; Player.jsx calls
 * leaveFootprint() each time a foot lands.
 */

/** Seconds a print takes to fade away. */
export const FOOTPRINT_S = 1

/** What a pair's footprints cost, in Wins. Cheap next to the gloves; a bit more for the stronger ones. */
export const footprintCost = (glove) => tidy(Math.max(10, glove.power * 4))

/** The shape of the print, by glove design. */
const SHAPE = {
  classic: 'shoe',
  pro: 'boot',
  spiked: 'paw',
  flame: 'flame',
  crystal: 'star',
  tech: 'bolt',
  thunder: 'bolt',
  galaxy: 'star',
  royal: 'star',
  dragon: 'paw',
  divine: 'star',
}

/**
 * How a pair's footprints look, from its tier:
 *
 *   scale     size of the print
 *   glow      0..1 strength of the soft light under it (0 = none)
 *   sparkles  sparks rising off each print
 *   ripple    a ring of light spreading out as the foot lands
 *   shine     a white highlight round the print's edge
 *   stars     little stars drawn inside the print
 */
export function footprintStyle(glove) {
  const tier = gloveTier(glove)
  return {
    tier,
    shape: SHAPE[glove.design] ?? 'shoe',
    scale: 1 + (tier / MAX_GLOVE_TIER) * 0.35,
    glow: tier >= 3 ? Math.min(1, 0.35 + tier * 0.025) : 0,
    sparkles: tier >= 24 ? 9 : tier >= 16 ? 6 : tier >= 7 ? 3 : 0,
    ripple: tier >= 12,
    shine: tier >= 9,
    stars: tier >= 20,
  }
}

/** How the shop ranks a set, from its tier: name and the colours of its frame. */
const RARITIES = [
  { name: 'Common', colors: ['#b8c0cc', '#6a7280'] },
  { name: 'Rare', colors: ['#5ac8ff', '#1a6fd8'] },
  { name: 'Epic', colors: ['#d07bff', '#7a2fe4'] },
  { name: 'Legendary', colors: ['#ffd84a', '#f07800'] },
  { name: 'Mythic', colors: ['#ff6ad5', '#ff3b3b'] },
]
export const footprintRarity = (glove) => RARITIES[Math.min(RARITIES.length - 1, Math.floor(gloveTier(glove) / 6))]

/** Every set in the shop, in ladder order. */
export const FOOTPRINT_SETS = [...GLOVES].sort((a, b) => gloveTier(a) - gloveTier(b))

/** Traces the print's outline into `ctx`, filling a `s` x `s` square (toe up). */
function tracePrint(ctx, shape, s) {
  ctx.beginPath()
  const c = s / 2
  if (shape === 'shoe' || shape === 'boot') {
    // A sole: round toe, pinched arch, round heel. Points as fractions of `s`.
    const k = shape === 'boot' ? 1.12 : 1
    const x = (v) => c + (v - 0.5) * s * k
    ctx.moveTo(x(0.5), s * 0.05)
    ctx.bezierCurveTo(x(0.76), s * 0.05, x(0.78), s * 0.36, x(0.67), s * 0.52)
    ctx.bezierCurveTo(x(0.62), s * 0.6, x(0.67), s * 0.66, x(0.66), s * 0.78)
    ctx.bezierCurveTo(x(0.65), s * 0.97, x(0.35), s * 0.97, x(0.34), s * 0.78)
    ctx.bezierCurveTo(x(0.33), s * 0.66, x(0.4), s * 0.6, x(0.35), s * 0.52)
    ctx.bezierCurveTo(x(0.24), s * 0.36, x(0.26), s * 0.05, x(0.5), s * 0.05)
    ctx.closePath()
  } else if (shape === 'paw') {
    ctx.ellipse(c, s * 0.64, s * 0.24, s * 0.2, 0, 0, Math.PI * 2)
    for (const [x, y] of [[-0.26, 0.36], [-0.1, 0.22], [0.1, 0.22], [0.26, 0.36]]) {
      ctx.moveTo(c + x * s + s * 0.08, y * s)
      ctx.ellipse(c + x * s, y * s, s * 0.08, s * 0.1, 0, 0, Math.PI * 2)
    }
  } else if (shape === 'star') {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const r = i % 2 ? s * 0.18 : s * 0.42
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    ctx.closePath()
  } else if (shape === 'flame') {
    ctx.moveTo(c, s * 0.06)
    ctx.bezierCurveTo(c + s * 0.12, s * 0.28, c + s * 0.36, s * 0.4, c + s * 0.3, s * 0.68)
    ctx.bezierCurveTo(c + s * 0.25, s * 0.92, c - s * 0.25, s * 0.92, c - s * 0.3, s * 0.68)
    ctx.bezierCurveTo(c - s * 0.34, s * 0.48, c - s * 0.12, s * 0.38, c - s * 0.04, s * 0.22)
    ctx.closePath()
  } else {
    // Bolt.
    const pts = [[0.58, 0.04], [0.24, 0.52], [0.46, 0.52], [0.36, 0.96], [0.76, 0.4], [0.54, 0.4], [0.7, 0.04]]
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)))
    ctx.closePath()
  }
}

/** A small four-point star at (x, y). */
function drawStar(ctx, x, y, r) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2
    const d = i % 2 ? r * 0.35 : r
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  ctx.closePath()
  ctx.fill()
}

const canvases = new Map()
const textures = new Map()

/** The print as a canvas: the gloves' colours, decorated to their tier. Shared by the shop's preview. */
export function footprintCanvas(gloveId) {
  let canvas = canvases.get(gloveId)
  if (canvas) return canvas
  const glove = getGlove(gloveId)
  const style = footprintStyle(glove)
  const s = 128
  canvas = document.createElement('canvas')
  canvas.width = canvas.height = s
  const ctx = canvas.getContext('2d')

  const fill = ctx.createLinearGradient(0, 0, 0, s)
  fill.addColorStop(0, glove.trim)
  fill.addColorStop(1, glove.cuff)

  tracePrint(ctx, style.shape, s)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineJoin = 'round'
  ctx.lineWidth = 7
  ctx.strokeStyle = glove.main
  ctx.stroke()
  // Tread: grooves cut across a boot, and the gap between a shoe's sole and heel.
  if (style.shape === 'boot' || style.shape === 'shoe') {
    ctx.save()
    ctx.globalCompositeOperation = 'destination-out'
    ctx.lineWidth = style.shape === 'boot' ? 5 : 7
    const grooves = style.shape === 'boot' ? [0.22, 0.32, 0.42, 0.7, 0.8] : [0.6]
    for (const y of grooves) {
      ctx.beginPath()
      ctx.moveTo(s * 0.2, y * s)
      ctx.lineTo(s * 0.8, y * s)
      ctx.stroke()
    }
    ctx.restore()
  }
  if (style.shine) {
    ctx.lineWidth = 2.5
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.stroke()
  }
  if (style.stars) {
    ctx.save()
    tracePrint(ctx, style.shape, s)
    ctx.clip()
    ctx.fillStyle = '#ffffff'
    for (const [x, y, r] of [[0.42, 0.3, 9], [0.6, 0.5, 6], [0.44, 0.7, 7]]) drawStar(ctx, x * s, y * s, r)
    ctx.restore()
  }
  canvases.set(gloveId, canvas)
  return canvas
}

/** The print as a texture, cached per pair. */
export function footprintTexture(gloveId) {
  let texture = textures.get(gloveId)
  if (!texture) {
    texture = new CanvasTexture(footprintCanvas(gloveId))
    texture.colorSpace = SRGBColorSpace
    textures.set(gloveId, texture)
  }
  return texture
}

/** Whether `id` names a pair of gloves, and so a footprint set - another player's profile is not trusted. */
export const isFootprintSet = (id) => typeof id === 'string' && GLOVES.some((glove) => glove.id === id)

/** Steps waiting to be drawn: `{ x, y, z, yaw, side }`. Drained by Footprints.jsx. */
export const pendingSteps = []

/**
 * A foot just landed at (x, y, z) - y being the ground - facing `yaw`, on `side`
 * (-1 left, 1 right). Cheap and safe to call with footprints switched off: the
 * queue is capped and simply dropped when nobody is drawing it.
 */
export function leaveFootprint(x, y, z, yaw, side) {
  if (pendingSteps.length >= 8) pendingSteps.shift()
  pendingSteps.push({ x, y, z, yaw, side })
}
