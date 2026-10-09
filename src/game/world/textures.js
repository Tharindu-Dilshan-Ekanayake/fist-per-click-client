import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three'

import { formatNumber } from '../format'
import { FONT_WEIGHT, GAME_FONT } from '../font'

/**
 * Procedural canvas textures. Everything is drawn at runtime, so the map ships with
 * no image assets, and each texture is generated once and shared.
 */

/** One stud, in world units. Studded textures are authored against this pitch. */
export const STUD = 0.35

/** World size of one repeat of the panel texture. */
export const PANEL_TILE = 4

const FONT = GAME_FONT

const textureCache = new Map()

function cached(key, make) {
  let texture = textureCache.get(key)
  if (!texture) {
    texture = make()
    textureCache.set(key, texture)
  }
  return texture
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return [canvas, canvas.getContext('2d')]
}

function finish(canvas, { repeat = true } = {}) {
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.anisotropy = 8
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping
  return texture
}

/** Small deterministic PRNG, so the map and its textures look the same every load. */
export function mulberry32(seed) {
  let a = seed | 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Lighten (amount > 0) or darken (amount < 0) a hex colour; returns a CSS colour. */
export function shade(hex, amount) {
  const f = (c) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount))
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${f(r)},${f(g)},${f(b)})`
}

function disc(ctx, x, y, r, fill) {
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
}

// --- Studded plates -------------------------------------------------------------

/**
 * Brick-toy studs on a plate. With two colours the cells alternate as a checker.
 * One repeat covers `cells * studsPerCell * STUD` world units.
 */
export function studTexture(colors, { cells = 2, studsPerCell = 4 } = {}) {
  return cached(`stud:${colors.join()}:${cells}:${studsPerCell}`, () => {
    const px = 512
    const [canvas, ctx] = makeCanvas(px, px)
    const cell = px / cells
    const pitch = cell / studsPerCell
    const bevel = Math.max(2, px / 170)

    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const base = colors[(cx + cy) % colors.length]
        const x0 = cx * cell
        const y0 = cy * cell
        ctx.fillStyle = base
        ctx.fillRect(x0, y0, cell, cell)
        // Plate bevel: lit top-left, shaded bottom-right.
        ctx.fillStyle = shade(base, 0.1)
        ctx.fillRect(x0, y0, cell, bevel)
        ctx.fillRect(x0, y0, bevel, cell)
        ctx.fillStyle = shade(base, -0.14)
        ctx.fillRect(x0, y0 + cell - bevel, cell, bevel)
        ctx.fillRect(x0 + cell - bevel, y0, bevel, cell)

        for (let sy = 0; sy < studsPerCell; sy++) {
          for (let sx = 0; sx < studsPerCell; sx++) {
            const x = x0 + (sx + 0.5) * pitch
            const y = y0 + (sy + 0.5) * pitch
            const r = pitch * 0.3
            disc(ctx, x + pitch * 0.05, y + pitch * 0.08, r * 1.05, 'rgba(0,0,0,0.28)')
            disc(ctx, x, y, r, shade(base, 0.05))
            ctx.lineWidth = pitch * 0.07
            ctx.strokeStyle = 'rgba(255,255,255,0.45)'
            ctx.beginPath()
            ctx.arc(x, y, r * 0.78, Math.PI, Math.PI * 1.55)
            ctx.stroke()
            ctx.strokeStyle = 'rgba(0,0,0,0.18)'
            ctx.beginPath()
            ctx.arc(x, y, r * 0.85, Math.PI * 0.05, Math.PI * 0.6)
            ctx.stroke()
          }
        }
      }
    }
    return finish(canvas)
  })
}

/**
 * Light-grey panelled wall with recessed windows. Drawn neutral so a material
 * colour can tint it per stage.
 */
export function panelTexture() {
  return cached('panel', () => {
    const px = 512
    const [canvas, ctx] = makeCanvas(px, px)
    const cells = 2
    const cell = px / cells
    ctx.fillStyle = '#d6d6d6'
    ctx.fillRect(0, 0, px, px)
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const x0 = cx * cell
        const y0 = cy * cell
        ctx.fillStyle = '#e8e8e8'
        ctx.fillRect(x0, y0, cell, 6)
        ctx.fillRect(x0, y0, 6, cell)
        ctx.fillStyle = '#a8a8a8'
        ctx.fillRect(x0, y0 + cell - 6, cell, 6)
        ctx.fillRect(x0 + cell - 6, y0, 6, cell)

        const m = cell * 0.18
        ctx.fillStyle = '#7c7c7c'
        ctx.fillRect(x0 + m, y0 + m, cell - 2 * m, cell - 2 * m)
        ctx.fillStyle = '#5e5e5e'
        ctx.fillRect(x0 + m, y0 + m, cell - 2 * m, 8)
        ctx.fillRect(x0 + m, y0 + m, 8, cell - 2 * m)

        for (const [sx, sy] of [[0.09, 0.09], [0.91, 0.09], [0.09, 0.91], [0.91, 0.91]]) {
          disc(ctx, x0 + sx * cell + 2, y0 + sy * cell + 3, 9, 'rgba(0,0,0,0.25)')
          disc(ctx, x0 + sx * cell, y0 + sy * cell, 9, '#e2e2e2')
        }
      }
    }
    return finish(canvas)
  })
}

// --- Stage wall surfaces --------------------------------------------------------

/** Voronoi rock: cobbles, ice, crystal and lava are all this with different palettes. */
function voronoi(ctx, w, h, { palette, gap, gapWidth = 3, bevel = 0.4, cols = 10, rows = 6, facets = false, seed }) {
  const rand = mulberry32(seed)
  const cw = w / cols
  const ch = h / rows
  const gw = cols + 2
  const size = Math.min(cw, ch)

  // One jittered site per grid cell, with a one-cell border so edge pixels always
  // have a full 3x3 neighbourhood to search.
  const sites = []
  for (let j = -1; j <= rows; j++) {
    for (let i = -1; i <= cols; i++) {
      sites.push({
        x: (i + 0.2 + rand() * 0.6) * cw,
        y: (j + 0.2 + rand() * 0.6) * ch,
        c: hexToRgb(palette[Math.floor(rand() * palette.length)]),
      })
    }
  }

  const gapRgb = hexToRgb(gap)
  const img = ctx.createImageData(w, h)
  const data = img.data

  for (let y = 0; y < h; y++) {
    const gj = Math.floor(y / ch) + 1
    for (let x = 0; x < w; x++) {
      const gi = Math.floor(x / cw) + 1
      let d1 = Infinity
      let d2 = Infinity
      let best = null
      for (let dj = -1; dj <= 1; dj++) {
        const row = (gj + dj) * gw
        for (let di = -1; di <= 1; di++) {
          const s = sites[row + gi + di]
          const d = (x - s.x) ** 2 + (y - s.y) ** 2
          if (d < d1) {
            d2 = d1
            d1 = d
            best = s
          } else if (d < d2) {
            d2 = d
          }
        }
      }

      const edge = (Math.sqrt(d2) - Math.sqrt(d1)) / 2
      const o = (y * w + x) * 4
      if (edge < gapWidth) {
        const k = 0.8 + 0.2 * (edge / gapWidth)
        data[o] = gapRgb[0] * k
        data[o + 1] = gapRgb[1] * k
        data[o + 2] = gapRgb[2] * k
      } else {
        const inner = edge - gapWidth
        const t = Math.min(1, inner / (size * 0.3))
        const dx = (x - best.x) / size
        const dy = (y - best.y) / size
        // Chiselled rim: each stone's upper-left edge catches the light and its
        // lower-right edge falls into shadow.
        const rimW = size * 0.08
        const rim = inner < rimW ? (dx + dy < 0 ? 0.32 : -0.28) * (1 - inner / rimW) : 0
        // Crystal: every cell splits into a light and a dark facet.
        const facet = facets ? (dx * 0.8 - dy > 0 ? 0.14 : -0.06) : 0
        // Domed stones, lit from the top-left.
        const light = (1 - bevel + bevel * t - (dx + dy) * 0.12 + rim + facet) * (0.96 + rand() * 0.08)
        data[o] = best.c[0] * light
        data[o + 1] = best.c[1] * light
        data[o + 2] = best.c[2] * light
      }
      data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}

/**
 * One chunky, bevelled block: lit along its top and left edges, shaded along the
 * bottom and right, with speckles, the odd crack, and a soft shadow into the mortar.
 */
function drawBlock(ctx, x, y, bw, bh, color, rand, { radius = 0.22, bevel = 0.1, outline = null } = {}) {
  const r = Math.min(bw, bh) * radius
  const d = Math.min(bw, bh) * bevel
  const shape = (sx, sy, sw, sh) => {
    ctx.beginPath()
    ctx.roundRect(sx, sy, sw, sh, r)
  }

  shape(x + d * 0.4, y + d * 0.6, bw, bh)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()

  ctx.save()
  shape(x, y, bw, bh)
  ctx.clip()
  // Dark base, a lit copy shifted up-left over it, then the face inset on top: what
  // shows of the first two is the bevel.
  ctx.fillStyle = shade(color, -0.3)
  ctx.fillRect(x, y, bw, bh)
  shape(x - d, y - d, bw, bh)
  ctx.fillStyle = shade(color, 0.3)
  ctx.fill()
  const face = ctx.createLinearGradient(0, y, 0, y + bh)
  face.addColorStop(0, shade(color, 0.08))
  face.addColorStop(1, shade(color, -0.1))
  shape(x + d, y + d, bw - 2 * d, bh - 2 * d)
  ctx.fillStyle = face
  ctx.fill()

  for (let i = 0; i < 5; i++) {
    const sx = x + d + rand() * (bw - 2 * d)
    const sy = y + d + rand() * (bh - 2 * d)
    disc(ctx, sx, sy, 1.5 + rand() * 2.5, shade(color, rand() < 0.5 ? -0.14 : 0.12))
  }
  if (rand() < 0.3) {
    let cx = x + bw * (0.2 + rand() * 0.6)
    let cy = y + d
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    for (let k = 0; k < 3; k++) {
      cx += (rand() - 0.5) * bw * 0.2
      cy += bh * 0.22
      ctx.lineTo(cx, cy)
    }
    ctx.lineWidth = 2
    ctx.strokeStyle = shade(color, -0.35)
    ctx.stroke()
  }
  ctx.restore()

  if (outline) {
    shape(x, y, bw, bh)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = outline
    ctx.stroke()
  }
}

/** Big rounded stone blocks in staggered rows, like a castle wall. */
function stones(ctx, w, h, { palette, gap, seed, rows = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const rh = h / rows
  const m = rh * 0.07
  for (let r = 0; r < rows; r++) {
    let x = -rand() * rh
    while (x < w) {
      const bw = rh * (1.3 + rand() * 1.1)
      const color = palette[Math.floor(rand() * palette.length)]
      drawBlock(ctx, x + m, r * rh + m, bw - 2 * m, rh - 2 * m, color, rand, {
        radius: 0.28,
        bevel: 0.09,
        outline: shade(gap, -0.3),
      })
      x += bw
    }
  }
}

function bricks(ctx, w, h, { palette, gap, seed, rows = 8, cols = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const rh = h / rows
  const bw = w / cols
  const m = rh * 0.06
  for (let r = 0; r < rows; r++) {
    const offset = r % 2 ? bw / 2 : 0
    for (let c = -1; c <= cols; c++) {
      const color = palette[Math.floor(rand() * palette.length)]
      drawBlock(ctx, c * bw + offset + m, r * rh + m, bw - 2 * m, rh - 2 * m, color, rand, {
        radius: 0.18,
        bevel: 0.12,
        outline: shade(gap, -0.25),
      })
    }
  }
}

function planks(ctx, w, h, { palette, gap, seed, rows = 7 }) {
  const rand = mulberry32(seed)
  const rh = h / rows
  for (let r = 0; r < rows; r++) {
    const color = palette[Math.floor(rand() * palette.length)]
    const y0 = r * rh
    ctx.fillStyle = color
    ctx.fillRect(0, y0, w, rh)

    ctx.strokeStyle = shade(color, -0.15)
    ctx.lineWidth = 1.5
    for (let i = 0; i < 5; i++) {
      const gy = y0 + 5 + rand() * (rh - 10)
      const phase = rand() * 10
      ctx.beginPath()
      ctx.moveTo(0, gy)
      for (let x = 0; x <= w; x += 16) ctx.lineTo(x, gy + Math.sin(x * 0.02 + phase) * 2)
      ctx.stroke()
    }

    let x = rand() * w * 0.4
    while (x < w) {
      ctx.fillStyle = gap
      ctx.fillRect(x, y0, 3, rh)
      disc(ctx, x + 9, y0 + 8, 2.5, '#3a2a1a')
      disc(ctx, x + 9, y0 + rh - 8, 2.5, '#3a2a1a')
      x += w * 0.35 + rand() * w * 0.4
    }

    ctx.fillStyle = gap
    ctx.fillRect(0, y0, w, 3)
    ctx.fillStyle = shade(color, 0.18)
    ctx.fillRect(0, y0 + 3, w, 2)
  }
}

/** Clusters of little leaves, mostly hanging along the top edge. */
function leaves(ctx, w, h, seed) {
  const rand = mulberry32(seed + 99)
  const unit = w / 512
  for (let i = 0; i < 15; i++) {
    const cx = rand() * w
    const cy = rand() < 0.55 ? rand() * h * 0.14 : rand() * h
    const n = 4 + Math.floor(rand() * 3)
    const base = rand() * Math.PI * 2
    for (let k = 0; k < n; k++) {
      const len = (12 + rand() * 10) * unit
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(base + (k / n) * Math.PI * 2 + (rand() - 0.5) * 0.5)
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, 0)
      ctx.quadraticCurveTo(len * 0.5, len * 0.42, 0, 0)
      ctx.fillStyle = rand() < 0.5 ? '#6cc044' : '#4fa233'
      ctx.fill()
      ctx.lineWidth = 1.6 * unit
      ctx.strokeStyle = '#2c5c1b'
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(len * 0.15, 0)
      ctx.lineTo(len * 0.8, 0)
      ctx.lineWidth = 1.2 * unit
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'
      ctx.stroke()
      ctx.restore()
    }
  }
}

/**
 * A bevelled block of any outline - the polygon version of drawBlock: a drop shadow,
 * a dark base, a lit copy nudged up-left, and the face inset over both.
 */
function drawPolyBlock(ctx, pts, color, rand, outline) {
  const cx = pts.reduce((sum, [x]) => sum + x, 0) / pts.length
  const cy = pts.reduce((sum, [, y]) => sum + y, 0) / pts.length
  const size = Math.max(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)))
  const path = (k, dx = 0, dy = 0) => {
    ctx.beginPath()
    pts.forEach(([x, y], i) => {
      const px = cx + (x - cx) * k + dx
      const py = cy + (y - cy) * k + dy
      if (i) ctx.lineTo(px, py)
      else ctx.moveTo(px, py)
    })
    ctx.closePath()
  }
  path(1, size * 0.05, size * 0.08)
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fill()
  ctx.save()
  path(1)
  ctx.clip()
  ctx.fillStyle = shade(color, -0.32)
  ctx.fill()
  path(1, -size * 0.1, -size * 0.1)
  ctx.fillStyle = shade(color, 0.3)
  ctx.fill()
  const face = ctx.createLinearGradient(0, cy - size, 0, cy + size)
  face.addColorStop(0, shade(color, 0.1))
  face.addColorStop(1, shade(color, -0.12))
  path(0.8)
  ctx.fillStyle = face
  ctx.fill()
  for (let i = 0; i < 4; i++) {
    const a = rand() * Math.PI * 2
    const r = rand() * size * 0.5
    disc(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 1.5 + rand() * 2.5, shade(color, rand() < 0.5 ? -0.14 : 0.12))
  }
  ctx.restore()
  if (outline) {
    path(1)
    ctx.lineWidth = 2.5
    ctx.strokeStyle = outline
    ctx.stroke()
  }
}

/**
 * Chunky square blocks in a straight grid - eight across and five up, two metres a
 * side, which is also how the wall comes apart (see StageWall's debris).
 */
function blocks(ctx, w, h, { palette, gap, seed, cols = 8, rows = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const bw = w / cols
  const bh = h / rows
  const m = bh * 0.05
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const color = palette[Math.floor(rand() * palette.length)]
      drawBlock(ctx, c * bw + m, r * bh + m, bw - 2 * m, bh - 2 * m, color, rand, {
        radius: 0.14,
        bevel: 0.13,
        outline: shade(gap, -0.3),
      })
      // A recessed square in each, like a stamped paving slab.
      ctx.strokeStyle = 'rgba(0,0,0,0.16)'
      ctx.lineWidth = 3
      ctx.strokeRect(c * bw + bw * 0.3, r * bh + bh * 0.3, bw * 0.4, bh * 0.4)
    }
  }
}

/** A honeycomb of bevelled hexagons. */
function hexes(ctx, w, h, { palette, gap, seed, rows = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const r = h / (rows * Math.sqrt(3))
  const hexH = Math.sqrt(3) * r
  for (let col = -1; col * 1.5 * r < w + r; col++) {
    const cx = col * 1.5 * r
    const offset = col % 2 ? hexH / 2 : 0
    for (let row = -1; row * hexH < h + hexH; row++) {
      const cy = row * hexH + offset
      const pts = []
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 3) * i
        pts.push([cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92])
      }
      drawPolyBlock(ctx, pts, palette[Math.floor(rand() * palette.length)], rand, shade(gap, -0.3))
    }
  }
}

/** Diamonds set point to point, like a harlequin floor stood on end. */
function diamonds(ctx, w, h, { palette, gap, seed, cols = 7, rows = 5 }) {
  const rand = mulberry32(seed)
  ctx.fillStyle = gap
  ctx.fillRect(0, 0, w, h)
  const dw = w / cols
  const dh = (h / rows) * 1.0
  for (let j = -1; j <= rows * 2 + 1; j++) {
    const cy = (j * dh) / 2
    const offset = j % 2 ? dw / 2 : 0
    for (let i = -1; i <= cols; i++) {
      const cx = i * dw + offset
      const k = 0.46
      const pts = [
        [cx, cy - dh * k],
        [cx + dw * k, cy],
        [cx, cy + dh * k],
        [cx - dw * k, cy],
      ]
      drawPolyBlock(ctx, pts, palette[Math.floor(rand() * palette.length)], rand, shade(gap, -0.3))
    }
  }
}

/** The breakable-looking surface for stage wall `id`, drawn from its theme. */
export function wallTexture(id, def) {
  return cached(`wall:${id}`, () => {
    // 48px per world unit across the 16 x 10 doorway.
    const w = 768
    const h = 480
    const px = w / 512
    const [canvas, ctx] = makeCanvas(w, h)
    const seed = id * 7919
    if (def.style === 'blocks') blocks(ctx, w, h, { ...def, seed })
    else if (def.style === 'hex') hexes(ctx, w, h, { ...def, seed })
    else if (def.style === 'diamond') diamonds(ctx, w, h, { ...def, seed })
    else if (def.style === 'stones') stones(ctx, w, h, { ...def, seed })
    else if (def.style === 'bricks') bricks(ctx, w, h, { ...def, seed })
    else if (def.style === 'planks') planks(ctx, w, h, { ...def, seed })
    else if (def.style === 'lava') voronoi(ctx, w, h, { ...def, seed, cols: 9, gapWidth: 5 * px, bevel: 0.45 })
    else if (def.style === 'crystal') voronoi(ctx, w, h, { ...def, seed, gapWidth: 2.5 * px, bevel: 0.5, facets: true })
    else voronoi(ctx, w, h, { ...def, seed, gapWidth: 3 * px })
    if (def.moss) leaves(ctx, w, h, seed)
    return finish(canvas, { repeat: false })
  })
}

/**
 * The wall's number on a transparent canvas laid over its surface: a dark badge with
 * "WALL" over a big number in the stage's colour. Not cached: there are over a
 * hundred walls, so each mounted wall owns (and disposes) its own.
 */
export function createWallNumber(number, accent = '#62f3ff') {
  const w = 384
  const h = 240
  const [canvas, ctx] = makeCanvas(w, h)
  const text = String(number)
  const x = w / 2
  const y = h * 0.29
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'

  // The badge behind it: a rounded plate with a glowing rim in the stage colour.
  ctx.font = `${FONT_WEIGHT.heavy} 76px ${FONT}`
  const textW = ctx.measureText(text).width
  const bw = Math.max(118, textW + 64)
  const bh = 104
  const bx = x - bw / 2
  const by = y - bh / 2 - 8
  ctx.fillStyle = 'rgba(12, 14, 30, 0.72)'
  ctx.beginPath()
  ctx.roundRect(bx, by, bw, bh, 22)
  ctx.fill()
  ctx.lineWidth = 5
  ctx.strokeStyle = accent
  ctx.shadowColor = accent
  ctx.shadowBlur = 12
  ctx.stroke()
  ctx.shadowBlur = 0

  ctx.font = `${FONT_WEIGHT.heavy} 20px ${FONT}`
  ctx.fillStyle = shade(accent, 0.35)
  ctx.fillText('WALL', x, by + 18)

  ctx.font = `${FONT_WEIGHT.heavy} 70px ${FONT}`
  ctx.lineWidth = 12
  ctx.strokeStyle = '#0b0b14'
  ctx.strokeText(text, x, y + 12)
  const grad = ctx.createLinearGradient(0, y - 22, 0, y + 46)
  grad.addColorStop(0, '#ffffff')
  grad.addColorStop(1, shade(accent, 0.15))
  ctx.fillStyle = grad
  ctx.fillText(text, x, y + 12)
  return finish(canvas, { repeat: false })
}

/** Canvas size of a health bar; its plane should keep this aspect. */
export const HP_BAR_ASPECT = 512 / 84

/**
 * A wall's health bar: a fist badge on the left and a segmented pill that empties
 * from green through yellow to red, with "hp / max" on it. Redraw it with
 * `draw(hp, max)` whenever the health changes.
 */
export function createHpBar() {
  const w = 512
  const h = 84
  const [canvas, ctx] = makeCanvas(w, h)
  const texture = finish(canvas, { repeat: false })
  const outline = '#0c0f1c'

  const draw = (hp, max) => {
    const f = Math.max(0, Math.min(1, hp / max))
    ctx.clearRect(0, 0, w, h)
    // Frame.
    ctx.fillStyle = outline
    ctx.beginPath()
    ctx.roundRect(46, 10, w - 52, h - 20, (h - 20) / 2)
    ctx.fill()
    ctx.fillStyle = '#1f2440'
    ctx.beginPath()
    ctx.roundRect(54, 17, w - 68, h - 34, (h - 34) / 2)
    ctx.fill()

    const ix = 54
    const iy = 17
    const ih = h - 34
    const full = w - 68
    const iw = full * f
    if (iw > 0) {
      const [top, bottom] = f > 0.5 ? ['#b4ff6e', '#22b81a'] : f > 0.25 ? ['#fff07a', '#e09400'] : ['#ffa08a', '#d62a1a']
      const grad = ctx.createLinearGradient(0, iy, 0, iy + ih)
      grad.addColorStop(0, top)
      grad.addColorStop(1, bottom)
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(ix, iy, full, ih, ih / 2)
      ctx.clip()
      ctx.fillStyle = grad
      ctx.fillRect(ix, iy, iw, ih)
      ctx.fillStyle = 'rgba(255,255,255,0.35)'
      ctx.fillRect(ix, iy + 3, iw, ih * 0.24)
      ctx.restore()
    }
    // Ticks every tenth, so a hit reads as a bite.
    ctx.fillStyle = 'rgba(12,15,28,0.45)'
    for (let i = 1; i < 10; i++) ctx.fillRect(ix + (full * i) / 10 - 1.5, iy + 4, 3, ih - 8)

    // The fist badge, over the bar's left end.
    ctx.fillStyle = outline
    ctx.beginPath()
    ctx.arc(42, h / 2, 38, 0, Math.PI * 2)
    ctx.fill()
    const badge = ctx.createLinearGradient(0, 8, 0, h - 8)
    badge.addColorStop(0, '#3b4472')
    badge.addColorStop(1, '#1c2140')
    ctx.fillStyle = badge
    ctx.beginPath()
    ctx.arc(42, h / 2, 32, 0, Math.PI * 2)
    ctx.fill()
    drawIcon(ctx, 'fist', 16, h / 2 - 26, 52)

    const label = `${formatNumber(hp)} / ${formatNumber(max)}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `${FONT_WEIGHT.heavy} 36px ${FONT}`
    ctx.lineWidth = 9
    ctx.strokeStyle = outline
    ctx.strokeText(label, 54 + full / 2, h / 2 + 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(label, 54 + full / 2, h / 2 + 2)
    texture.needsUpdate = true
  }

  return { texture, draw }
}

/** How many different crack patterns there are; walls take them in turn. */
export const CRACK_VARIANTS = 5

/**
 * Cracks for a stage wall, as an alpha map that is also a timeline.
 *
 * Every line's green value says how damaged the wall has to be before it shows: the
 * first cracks out of the three punch points are near white, the late spider-web is
 * near black. A material with this as its `alphaMap` and `alphaTest` set to
 * `1 - damage` then shows exactly the cracks earned so far, and they grow out from
 * where you punch as the wall weakens - and close up again as it heals - with no
 * redrawing at all. One shared map per pattern, for every wall that uses it.
 */
export function crackTexture(variant) {
  return cached(`crack:${variant}`, () => {
    const w = 512
    const h = 320
    const [canvas, ctx] = makeCanvas(w, h)
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, w, h)
    // Where lines cross, keep the earlier one.
    ctx.globalCompositeOperation = 'lighten'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    const rand = mulberry32(9001 + variant * 131)
    const segs = []

    const crack = (x, y, angle, len, t0, span, width, depth) => {
      let px = x
      let py = y
      let a = angle
      let travelled = 0
      while (travelled < len) {
        a += (rand() - 0.5) * 0.8
        const step = 9 + rand() * 11
        const nx = px + Math.cos(a) * step
        const ny = py + Math.sin(a) * step
        const t = t0 + span * (travelled / len)
        segs.push([px, py, nx, ny, t, Math.max(1.4, width * (1 - (travelled / len) * 0.65))])
        travelled += step
        px = nx
        py = ny
        if (depth < 2 && rand() < 0.15) {
          const turn = (rand() < 0.5 ? 1 : -1) * (0.5 + rand() * 0.7)
          crack(px, py, a + turn, len * (0.25 + rand() * 0.3), t, span * 0.6, width * 0.6, depth + 1)
        }
        if (px < -12 || px > w + 12 || py < -12 || py > h + 12) break
      }
    }

    // Three punch points along chest height (canvas y grows downwards), cracks
    // fanning out of each, mostly up and to the sides.
    const origins = [
      [0.5, 0.8],
      [0.22, 0.83],
      [0.78, 0.81],
    ].map(([ox, oy]) => [ox + (rand() - 0.5) * 0.06, oy + (rand() - 0.5) * 0.04])
    origins.forEach(([ox, oy], o) => {
      const n = 6 + Math.floor(rand() * 3)
      for (let k = 0; k < n; k++) {
        const angle = -Math.PI / 2 + (k / (n - 1) - 0.5) * Math.PI * 1.6 + (rand() - 0.5) * 0.4
        const t0 = 0.03 + o * 0.05 + k * 0.03 + rand() * 0.05
        crack(ox * w, oy * h, angle, h * (0.35 + rand() * 0.6), t0, 0.5 + rand() * 0.3, 8.5, 0)
      }
    })
    // Near the end, a web of short cracks right across it.
    for (let i = 0; i < 46; i++) {
      crack(rand() * w, rand() * h, rand() * Math.PI * 2, 24 + rand() * 46, 0.62 + rand() * 0.33, 0.08, 3.4, 2)
    }

    for (const [x0, y0, x1, y1, t, width] of segs) {
      ctx.strokeStyle = `rgb(0,${Math.round(250 * (1 - Math.min(1, t)))},0)`
      ctx.lineWidth = width
      ctx.beginPath()
      ctx.moveTo(x0, y0)
      ctx.lineTo(x1, y1)
      ctx.stroke()
    }
    // A crumbled dent at each punch point, there from the first hit.
    for (const [ox, oy] of origins) {
      ctx.fillStyle = 'rgb(0,240,0)'
      ctx.beginPath()
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        const r = 7 + rand() * 7
        ctx.lineTo(ox * w + Math.cos(a) * r, oy * h + Math.sin(a) * r)
      }
      ctx.closePath()
      ctx.fill()
    }

    // Data, not colour: no sRGB, and no mipmaps to blur the thresholds together.
    const texture = new CanvasTexture(canvas)
    texture.generateMipmaps = false
    texture.minFilter = LinearFilter
    return texture
  })
}

/** A spiky white starburst for a punch landing; tint it with the material colour. */
export function impactStarTexture() {
  return cached('impact-star', () => {
    const s = 192
    const [canvas, ctx] = makeCanvas(s, s)
    const c = s / 2
    const spikes = 14
    ctx.beginPath()
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2
      const r = i % 2 === 0 ? c * (i % 4 === 0 ? 0.98 : 0.78) : c * 0.36
      ctx.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    ctx.closePath()
    const grad = ctx.createRadialGradient(c, c, 0, c, c, c)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,250,210,0.95)')
    grad.addColorStop(0.7, 'rgba(255,200,90,0.55)')
    grad.addColorStop(1, 'rgba(255,140,40,0)')
    ctx.fillStyle = grad
    ctx.fill()
    return finish(canvas, { repeat: false })
  })
}

/** A soft ring, for the shock wave off a landing punch. */
export function impactRingTexture() {
  return cached('impact-ring', () => {
    const s = 128
    const [canvas, ctx] = makeCanvas(s, s)
    const c = s / 2
    const grad = ctx.createRadialGradient(c, c, c * 0.55, c, c, c)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.55, 'rgba(255,255,255,0.95)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, s, s)
    return finish(canvas, { repeat: false })
  })
}

// --- Effects --------------------------------------------------------------------

/**
 * Blurred neon rectangle for the glow around a stage-wall frame. The canvas is
 * 32px per world unit: a `frameW x frameH` rectangle with `margin` of halo around it.
 */
export function glowFrameTexture(color, frameW, frameH, margin) {
  return cached(`glowframe:${color}:${frameW}:${frameH}:${margin}`, () => {
    const s = 32
    const w = Math.round((frameW + margin * 2) * s)
    const h = Math.round((frameH + margin * 2) * s)
    const [canvas, ctx] = makeCanvas(w, h)
    const m = margin * s
    ctx.shadowColor = color
    ctx.strokeStyle = color
    for (const [blur, width] of [[64, 26], [40, 18], [20, 12]]) {
      ctx.shadowBlur = blur
      ctx.lineWidth = width
      ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    }
    ctx.shadowBlur = 10
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(m, m, w - 2 * m, h - 2 * m)
    return finish(canvas, { repeat: false })
  })
}

/** How far in from each edge of a neonOutlineTexture its outline sits (a fraction). */
export const NEON_INSET = 0.1875

/**
 * Neon outline for the pads: a `shape` ('square' | 'hex' | 'circle') in `color`,
 * with a white-hot core and a soft halo on either side, on a transparent canvas.
 * The outline sits NEON_INSET in from each edge; the rest is room for the halo.
 * A hex has corners on the canvas's ±x, like a 6-sided cylinder turned by 30°.
 */
export function neonOutlineTexture(color, shape) {
  return cached(`neon:${color}:${shape}`, () => {
    const s = 256
    const [canvas, ctx] = makeCanvas(s, s)
    const c = s / 2
    const r = c - s * NEON_INSET
    const path = () => {
      ctx.beginPath()
      if (shape === 'square') ctx.rect(c - r, c - r, r * 2, r * 2)
      else if (shape === 'hex') {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i
          ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a))
        }
        ctx.closePath()
      } else ctx.arc(c, c, r, 0, Math.PI * 2)
    }
    ctx.lineJoin = 'round'
    ctx.shadowColor = color
    ctx.strokeStyle = color
    for (const [blur, width] of [[26, 14], [14, 9]]) {
      ctx.shadowBlur = blur
      ctx.lineWidth = width
      path()
      ctx.stroke()
    }
    ctx.shadowBlur = 6
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4
    path()
    ctx.stroke()
    return finish(canvas, { repeat: false })
  })
}

/** Spiral for the portal disc. */
export function swirlTexture() {
  return cached('swirl', () => {
    const s = 256
    const [canvas, ctx] = makeCanvas(s, s)
    const img = ctx.createImageData(s, s)
    const data = img.data
    for (let y = 0; y < s; y++) {
      for (let x = 0; x < s; x++) {
        const dx = ((x + 0.5) / s) * 2 - 1
        const dy = ((y + 0.5) / s) * 2 - 1
        const r = Math.hypot(dx, dy)
        const a = Math.atan2(dy, dx)
        const arm = 0.5 + 0.5 * Math.sin(a * 4 + r * 14)
        const core = Math.max(0, 1 - r * 2.4)
        const o = (y * s + x) * 4
        data[o] = 90 + arm * 150 + core * 200
        data[o + 1] = 20 + arm * 90 + core * 200
        data[o + 2] = 200 + arm * 55
        data[o + 3] = Math.max(0, Math.min(1, (1 - r) * 8)) * 255
      }
    }
    ctx.putImageData(img, 0, 0)
    return finish(canvas, { repeat: false })
  })
}

/** Soft white radial falloff; tint it with the material colour. */
export function radialGlowTexture() {
  return cached('radial', () => {
    const s = 128
    const [canvas, ctx] = makeCanvas(s, s)
    const grad = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    grad.addColorStop(0, 'rgba(255,255,255,1)')
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, s, s)
    return finish(canvas, { repeat: false })
  })
}

/** Bullseye on a transparent background, its rings in `color` and white. */
export function targetTexture(color = '#e8392d') {
  return cached(`target:${color}`, () => {
    const s = 256
    const [canvas, ctx] = makeCanvas(s, s)
    const rings = [color, '#ffffff', color, '#ffffff', color]
    rings.forEach((color, i) => disc(ctx, s / 2, s / 2, s * 0.48 * (1 - i / rings.length), color))
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.beginPath()
    ctx.arc(s / 2, s / 2, s * 0.48, 0, Math.PI * 2)
    ctx.stroke()
    return finish(canvas, { repeat: false })
  })
}

/** Vertical fade for light beams: opaque at the bottom, clear at the top. */
export function beamTexture() {
  return cached('beam', () => {
    const [canvas, ctx] = makeCanvas(4, 128)
    const grad = ctx.createLinearGradient(0, 0, 0, 128)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(1, 'rgba(255,255,255,0.9)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 128)
    return finish(canvas, { repeat: false })
  })
}

/** Sky dome gradient, zenith at the top of the canvas. */
export function skyTexture() {
  return cached('sky', () => {
    const [canvas, ctx] = makeCanvas(4, 256)
    const grad = ctx.createLinearGradient(0, 0, 0, 256)
    grad.addColorStop(0, '#1264e8')
    grad.addColorStop(0.3, '#2879f0')
    grad.addColorStop(0.49, '#a6d6ff')
    grad.addColorStop(1, '#e6f5ff')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 4, 256)
    return finish(canvas, { repeat: false })
  })
}

/** Small outlined icon in an `s`-sized square at (x, y): 'trophy', 'fist' or 'star'. */
function drawIcon(ctx, kind, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s / 100, s / 100)
  ctx.lineJoin = 'round'
  const outline = '#2a1a00'

  if (kind === 'trophy') {
    // Handles: a thick dark stroke with a thinner gold one on top.
    ctx.beginPath()
    ctx.arc(18, 30, 13, Math.PI * 0.5, Math.PI * 1.5)
    ctx.moveTo(82, 17)
    ctx.arc(82, 30, 13, -Math.PI * 0.5, Math.PI * 0.5)
    ctx.lineWidth = 16
    ctx.strokeStyle = outline
    ctx.stroke()
    ctx.lineWidth = 7
    ctx.strokeStyle = '#ffd23f'
    ctx.stroke()

    const gold = ctx.createLinearGradient(0, 0, 0, 100)
    gold.addColorStop(0, '#fff3a0')
    gold.addColorStop(1, '#f0a800')
    ctx.beginPath()
    ctx.moveTo(18, 8)
    ctx.lineTo(82, 8)
    ctx.lineTo(76, 44)
    ctx.quadraticCurveTo(50, 66, 24, 44)
    ctx.closePath()
    ctx.rect(43, 58, 14, 18)
    ctx.rect(26, 76, 48, 16)
    ctx.lineWidth = 8
    ctx.strokeStyle = outline
    ctx.stroke()
    ctx.fillStyle = gold
    ctx.fill()
  } else if (kind === 'fist') {
    // A red boxing glove, knuckles up, on a white cuff with a gold stripe - the
    // game's Strength, the way the HUD draws it.
    const red = ctx.createLinearGradient(10, 0, 90, 90)
    red.addColorStop(0, '#ff9a88')
    red.addColorStop(0.5, '#f0302a')
    red.addColorStop(1, '#b0140f')
    ctx.lineWidth = 8
    ctx.strokeStyle = outline
    ctx.beginPath()
    ctx.roundRect(28, 66, 46, 28, 6)
    ctx.stroke()
    ctx.fillStyle = '#f4f4f4'
    ctx.fill()
    ctx.fillStyle = '#ffd23f'
    ctx.fillRect(31, 74, 40, 8)
    ctx.beginPath()
    ctx.moveTo(30, 70)
    ctx.bezierCurveTo(16, 58, 14, 26, 34, 12)
    ctx.bezierCurveTo(50, 2, 78, 4, 86, 22)
    ctx.bezierCurveTo(95, 40, 90, 62, 74, 70)
    ctx.closePath()
    ctx.stroke()
    ctx.fillStyle = red
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(31, 47, 12, 17, -0.25, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(62, 22, 14, 6, -0.35, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fill()
  } else if (kind === 'star') {
    // The rebirth star, to mark a price paid in rebirths rather than in a currency.
    const gold = ctx.createLinearGradient(0, 0, 0, 100)
    gold.addColorStop(0, '#fff3b0')
    gold.addColorStop(1, '#f0a000')
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      // Alternate between the points and the valleys between them, starting at the
      // top so the star sits upright.
      const angle = -Math.PI / 2 + (i * Math.PI) / 5
      const r = i % 2 === 0 ? 46 : 19
      ctx[i === 0 ? 'moveTo' : 'lineTo'](50 + Math.cos(angle) * r, 50 + Math.sin(angle) * r)
    }
    ctx.closePath()
    ctx.lineWidth = 12
    ctx.strokeStyle = outline
    ctx.stroke()
    ctx.fillStyle = gold
    ctx.fill()
  }
  ctx.restore()
}

/**
 * Text sign. `lines` are strings or `{ text, scale, fill, icon }`; `fill` may be a
 * list of colours for a vertical gradient, and `icon` ('trophy' | 'fist' | 'star') is
 * drawn before the text.
 */
export function labelTexture({
  lines,
  aspect,
  fill = '#ffffff',
  stroke = '#1b1b25',
  bg = null,
  border = null,
  width = 1024,
}) {
  const key = `label:${JSON.stringify([lines, aspect, fill, stroke, bg, border, width])}`
  return cached(key, () => {
    const w = width
    const h = Math.max(32, Math.round(w / aspect))
    const [canvas, ctx] = makeCanvas(w, h)
    drawLabel(ctx, w, h, { lines, fill, stroke, bg, border })
    return finish(canvas, { repeat: false })
  })
}

/**
 * A label you redraw in place, for text that changes on every use (damage numbers),
 * where caching a texture per value would grow without limit.
 * `draw({ lines, fill, stroke })` takes the same options as `labelTexture`.
 */
export function createDynamicLabel({ aspect, width = 256 }) {
  const w = width
  const h = Math.max(32, Math.round(w / aspect))
  const [canvas, ctx] = makeCanvas(w, h)
  const texture = finish(canvas, { repeat: false })
  return {
    texture,
    draw(options) {
      ctx.clearRect(0, 0, w, h)
      drawLabel(ctx, w, h, options)
      texture.needsUpdate = true
    },
  }
}

function drawLabel(ctx, w, h, { lines, fill = '#ffffff', stroke = '#1b1b25', bg = null, border = null }) {
  const short = Math.min(w, h)
  const pad = short * 0.1

  if (bg) {
    ctx.fillStyle = bg
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, short * 0.12)
    ctx.fill()
  }
  if (border) {
    const lw = short * 0.05
    ctx.lineWidth = lw
    ctx.strokeStyle = border
    ctx.beginPath()
    ctx.roundRect(lw / 2, lw / 2, w - lw, h - lw, short * 0.1)
    ctx.stroke()
  }

  const items = lines.map((line) => (typeof line === 'string' ? { text: line } : line))
  const totalWeight = items.reduce((sum, item) => sum + (item.scale ?? 1), 0)
  const unit = (h - pad * 2) / totalWeight
  let y = pad
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  for (const item of items) {
    const lineH = unit * (item.scale ?? 1)
    let size = lineH * 0.78
    ctx.font = `${FONT_WEIGHT.heavy} ${size}px ${FONT}`
    // An icon is drawn one text-height square, plus a small gap, left of the text.
    const iconRatio = item.icon ? 1.15 : 0
    const measured = ctx.measureText(item.text).width + size * iconRatio
    const maxW = w - pad * 2
    if (measured > maxW) {
      size *= maxW / measured
      ctx.font = `${FONT_WEIGHT.heavy} ${size}px ${FONT}`
    }
    const iconW = size * iconRatio
    const x = (w - ctx.measureText(item.text).width - iconW) / 2 + iconW
    const cy = y + lineH / 2
    if (item.icon) drawIcon(ctx, item.icon, x - iconW, cy - size * 0.55, size)
    ctx.textAlign = 'left'
    if (stroke) {
      ctx.lineWidth = size * 0.2
      ctx.strokeStyle = stroke
      ctx.strokeText(item.text, x, cy)
    }
    const color = item.fill ?? fill
    if (Array.isArray(color)) {
      const grad = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2)
      color.forEach((c, i) => grad.addColorStop(i / (color.length - 1), c))
      ctx.fillStyle = grad
    } else {
      ctx.fillStyle = color
    }
    ctx.fillText(item.text, x, cy)
    y += lineH
  }
}
