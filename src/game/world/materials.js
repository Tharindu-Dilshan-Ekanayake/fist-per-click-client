import { BoxGeometry, MeshBasicMaterial, MeshStandardMaterial } from 'three'

import { PANEL_TILE, panelTexture, STUD, studTexture } from './textures'

/**
 * Named block materials. Keys may also be parametric:
 *   'panel:#hex'     panelled wall tinted by the colour
 *   'neon:#hex'      unlit strip light
 *   'floor:#a,#b'    two-colour studded checker
 */
const NAMED = {
  path: { stud: ['#f3e2bd', '#e5cea1'] },
  grass: { stud: ['#5ccb4f', '#4fbd45'] },
  dirt: { stud: ['#80502d', '#704426'] },
  border: { stud: ['#8b5a33'], cells: 1 },
  trunk: { stud: ['#7b4b27'], cells: 1 },
  leaves: { stud: ['#46c33d'], cells: 1 },
  leavesLight: { stud: ['#6fd851'], cells: 1 },
  dark: { stud: ['#2d2e37', '#26272f'] },
  portalStone: { stud: ['#43306a', '#3a2a5c'] },
  red: { stud: ['#ff4a4a'], cells: 1 },
  yellow: { stud: ['#ffd23f'], cells: 1 },
  blue: { stud: ['#3fa9ff'], cells: 1 },
  purple: { stud: ['#a45cff'], cells: 1 },
  green: { stud: ['#46d160'], cells: 1 },
  orange: { stud: ['#ff8f2e'], cells: 1 },
  mushroomCap: { color: '#e8392d' },
  stem: { color: '#f5efe2' },
  // The spawn plaza: pale paving, and the gold and red rings round the statue.
  plaza: { stud: ['#ece7f4', '#ded8ec'] },
  plazaRing: { stud: ['#ffd76a', '#f5c242'] },
  plazaInner: { stud: ['#ff6a5a', '#f05545'] },
  statueBase: { stud: ['#3a2a5c'], cells: 1 },
  statueTop: { stud: ['#ffd23f'], cells: 1 },
  flowerRed: { stud: ['#ff4a6a'], cells: 1 },
  flowerYellow: { stud: ['#ffd23f'], cells: 1 },
  flowerPink: { stud: ['#ff8ad8'], cells: 1 },
  // The arena gate into the stages.
  gateRed: { stud: ['#b3202a', '#a51d27'] },
  gateGold: { stud: ['#ffcf3a', '#f2bb24'] },
  gateDark: { stud: ['#3a0d14', '#320b11'] },
  bannerRed: { stud: ['#e8352d'], cells: 1 },
  bannerBlue: { stud: ['#2f6ee8'], cells: 1 },
  carpet: { stud: ['#d7262f', '#cc222b'] },
  // The fight district's stands.
  standStep: { stud: ['#3a3f6a', '#343960'] },
  seatRed: { stud: ['#ff3b3b'], cells: 1 },
  seatBlue: { stud: ['#2f7cff'], cells: 1 },
  seatYellow: { stud: ['#ffd23f'], cells: 1 },
}

function studMaterial(colors, cells = 2, studsPerCell = 4) {
  return {
    material: new MeshStandardMaterial({
      map: studTexture(colors, { cells, studsPerCell }),
      roughness: 0.85,
    }),
    tile: cells * studsPerCell * STUD,
    shadow: true,
  }
}

function createMaterial(key) {
  const [kind, arg] = key.split(':')
  if (kind === 'neon') {
    return { material: new MeshBasicMaterial({ color: arg, toneMapped: false }), tile: 1, shadow: false }
  }
  if (kind === 'panel') {
    return {
      material: new MeshStandardMaterial({ map: panelTexture(), color: arg, roughness: 0.8 }),
      tile: PANEL_TILE,
      shadow: true,
    }
  }
  if (kind === 'floor') return studMaterial(arg.split(','))

  const def = NAMED[key]
  if (!def) throw new Error(`Unknown block material "${key}"`)
  if (def.color) {
    return { material: new MeshStandardMaterial({ color: def.color, roughness: 0.7 }), tile: 1, shadow: true }
  }
  return studMaterial(def.stud, def.cells)
}

const materialCache = new Map()

/** @returns {{ material: import('three').Material, tile: number, shadow: boolean }} */
export function getMaterial(key) {
  let entry = materialCache.get(key)
  if (!entry) {
    entry = createMaterial(key)
    materialCache.set(key, entry)
  }
  return entry
}

/**
 * A box placed at `position` with UVs in *world* space (one texture repeat per
 * `tile` units). Neighbouring blocks therefore line their studs up seamlessly, and
 * any number of blocks sharing a material can be merged into one mesh.
 */
export function worldBoxGeometry([w, h, d], [px, py, pz], tile) {
  const geometry = new BoxGeometry(w, h, d)
  const pos = geometry.attributes.position
  const normal = geometry.attributes.normal
  const uv = geometry.attributes.uv
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + px
    const y = pos.getY(i) + py
    const z = pos.getZ(i) + pz
    const nx = normal.getX(i)
    const ny = normal.getY(i)
    const nz = normal.getZ(i)
    let u
    let v
    if (Math.abs(ny) > 0.5) {
      u = x
      v = -z * Math.sign(ny)
    } else if (Math.abs(nx) > 0.5) {
      u = -z * Math.sign(nx)
      v = y
    } else {
      u = x * Math.sign(nz)
      v = y
    }
    uv.setXY(i, u / tile, v / tile)
  }
  geometry.translate(px, py, pz)
  return geometry
}
