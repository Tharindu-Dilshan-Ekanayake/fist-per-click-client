import { VIP_EGGS, WINS_EGGS } from '../eggs'
import { SPACE_GLOVES, VIP_GLOVES, WINS_GLOVES } from '../gloves'
import { SPACE_REBIRTHS } from '../progression'
import { RINGS } from '../rings'
import { SPACE_TRAINERS, VIP_TRAINERS, WINS_TRAINERS } from '../trainers'
import { SPACE_WALL_BASE, SPACE_WALLS, WALLS_PER_STAGE, wallStage, WIN_PADS } from '../walls'
import { mulberry32 } from './textures'
import {
  cabinEnd,
  cabinStart,
  CORRIDOR_HALF,
  DIVIDER_T,
  END_Z,
  GATE_Z,
  LOBBY_HALF,
  LOBBY_NORTH,
  OPEN_H,
  OPEN_HALF,
  RING,
  SPACE_SPAWN,
  SPAWN,
  STAGE_COUNT,
  STAGE_LEN,
  STAGE_START,
  stageStart,
  THEMES,
  TUNNEL_LEAD,
  WALL_GAP,
  WALL_H,
  WALL_T,
} from './themes'

/**
 * The look of the three VIP platforms - one in the spawn plaza for the gloves, one
 * in the egg zone, one in the training zone. Purple plinth, gold deck, neon lip: nothing else in the
 * lobby is coloured like this, which is the point. The ladder stands in the zone's
 * own rows; the VIP items - the priciest of all - stand up here, well clear of them.
 */
const VIP_TRIM = '#3a1f6e'
const VIP_DECK = 'floor:#ffd76a,#e0a11e'
const VIP_NEON = '#b06bff'
/** Deck height. Same as the shop ledges, so it is one easy jump up. */
const VIP_H = 1.2
/**
 * Centre height of a VIP platform's banner. The game's camera sits low (about y 3.9,
 * looking slightly down), so a banner much above this walks off the top of the
 * screen as you approach - which is why the crowded platforms move their banner
 * sideways, clear of their items, rather than lifting it over them.
 */
const VIP_SIGN_Y = 4.4

/** The two small rooms off either side of every stage's cabin, and their doors' half-width. */
const VIP_DOOR = 5
const VIP_ROOMS = [
  { side: 1, title: 'SUPER VIP', floor: ['#b57cff', '#9d5cf0'], wall: '#7a4cc8', neon: '#d59bff', pad: '#4fd8ff' },
  { side: -1, title: 'VIP ZONE', floor: ['#ffb347', '#f59b25'], wall: '#c07a2a', neon: '#ffd166', pad: '#ffe14a' },
]

/** Splits [a, b] into chunks of at most `len`. */
function segments(a, b, len = 8) {
  const out = []
  for (let s = a; s < b - 0.01; s += len) out.push([s, Math.min(b, s + len)])
  return out
}

/**
 * Builds the whole map as plain data. Static geometry is a flat list of boxes
 * (merged into a handful of meshes at render time); everything animated is listed
 * separately for its own component.
 */
export function buildLayout() {
  const rand = mulberry32(1337)
  const pick = (list) => list[Math.floor(rand() * list.length)]

  /** `{ p: centre, s: size, m: material key, c: has a collider }` */
  const blocks = []
  const walls = []
  const portals = []
  const pads = []
  const crowns = []
  const crystals = []
  const labels = []
  const winPads = []
  /** Rectangles `{ x0, x1, z0, z1, y }` with a ceiling over them (see Roofs). */
  const roofs = []

  /**
   * Win pads in the corners in front of a wall face at `zFront`, paying out for wall
   * `number`. `x` shifts them for Space World's corridor, and `home` is where they
   * send you once paid.
   */
  const addPads = (number, zFront, x = 0, home = SPAWN) => {
    for (const pad of WIN_PADS) winPads.push({ number, pad, position: [x + pad.side * 9.9, 0, zFront + 2], home })
  }
  /** Stage wall `number` with its front face at `zFront`. */
  const addWall = (number, zFront) => {
    const stage = wallStage(number)
    walls.push({ number, stage, theme: THEMES[stage - 1], zFront })
  }
  /** Dark frame across a stage corridor centred on `z`, around the doorway a wall fills. */
  const divider = (z, x = 0) => {
    box(x - CORRIDOR_HALF, -1, z - 1, x - OPEN_HALF, WALL_H, z + 1, 'dark')
    box(x + OPEN_HALF, -1, z - 1, x + CORRIDOR_HALF, WALL_H, z + 1, 'dark')
    box(x - OPEN_HALF, OPEN_H, z - 1, x + OPEN_HALF, WALL_H, z + 1, 'dark')
  }
  /** The two small rooms opening off either side of a cabin, centred on `vipZ`. */
  const sideRooms = (vipZ) => {
    for (const room of VIP_ROOMS) {
      const s = room.side
      const [x0, x1] = s > 0 ? [CORRIDOR_HALF + WALL_T, 26] : [-26, -CORRIDOR_HALF - WALL_T]
      const [bx0, bx1] = s > 0 ? [26, 27] : [-27, -26]
      const za = vipZ - 7
      const zb = vipZ + 7
      box(x0, -1, za, x1, 0, zb, `floor:${room.floor.join(',')}`)
      box(bx0, -1, za - 1, bx1, 10, zb + 1, `panel:${room.wall}`)
      box(Math.min(x0, x1), -1, za - 1, Math.max(x0, x1), 10, za, `panel:${room.wall}`)
      box(Math.min(x0, x1), -1, zb, Math.max(x0, x1), 10, zb + 1, `panel:${room.wall}`)
      const nx = s > 0 ? [bx0 - 0.12, bx0] : [bx1, bx1 + 0.12]
      box(nx[0], 0, za, nx[1], 0.25, zb, `neon:${room.neon}`, false)
      box(nx[0], 9.4, za, nx[1], 9.6, zb, `neon:${room.neon}`, false)
      roofs.push({ x0: Math.min(x0, bx0), x1: Math.max(x1, bx1), z0: za - 1, z1: zb + 1, y: 9.99 })

      pads.push({ position: [s * 20, 0, vipZ], color: room.pad })
      crowns.push({ position: [s * 20, 4.2, vipZ] })
      labels.push({
        lines: [room.title],
        position: [s * 25.9, 7.2, vipZ],
        rotationY: -s * (Math.PI / 2),
        size: [10, 2],
        style: { fill: ['#ffffff', room.neon] },
      })
    }
  }

  const box = (x0, y0, z0, x1, y1, z1, m, c = true) => {
    blocks.push({
      p: [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2],
      s: [x1 - x0, y1 - y0, z1 - z0],
      m,
      c,
    })
  }

  /** Voxel tree: trunk plus two stacked leaf cubes. All solid, so you can climb it. */
  const tree = (x, y, z, s = 1) => {
    const top = y + 3 * s
    box(x - 0.45 * s, y, z - 0.45 * s, x + 0.45 * s, top, z + 0.45 * s, 'trunk')
    box(x - 1.7 * s, top - 0.4 * s, z - 1.7 * s, x + 1.7 * s, top + 2 * s, z + 1.7 * s, 'leaves')
    box(x - 1.1 * s, top + 2 * s, z - 1.1 * s, x + 1.1 * s, top + 3.4 * s, z + 1.1 * s, 'leavesLight')
  }

  /** A column of terrain: dirt sides with a grass cap. */
  const hill = (x0, z0, x1, z1, h) => {
    box(x0, -2, z0, x1, h - 0.5, z1, 'dirt')
    box(x0, h - 0.5, z0, x1, h, z1, 'grass')
  }

  /**
   * A raised VIP platform centred on (cx, cz). Solid up to VIP_H so you can stand
   * on it, with a neon kerb round the lip (no collider - it is a 0.14 step, nothing
   * to trip on) and a floating double-sided sign above so it reads from either way
   * you walk up to it.
   *
   * @returns {number} the y the items on it sit at
   */
  const vipPlatform = (cx, cz, halfX, halfZ, title, sign = {}) => {
    // Where the banner hangs: along one edge (`sign.edge`, '-z' by default), in the
    // middle of it unless `sign.cx` moves it to one side - which a platform whose
    // items would otherwise sit square in front of the text wants.
    const edge = sign.edge ?? '-z'
    const alongX = edge === '-z' || edge === '+z'
    const signCx = sign.cx ?? cx
    const signW = sign.w ?? Math.min(9, (alongX ? halfX : halfZ) * 2 - 0.4)
    const [x0, x1] = [cx - halfX, cx + halfX]
    const [z0, z1] = [cz - halfZ, cz + halfZ]
    box(x0, -1, z0, x1, VIP_H - 0.25, z1, `panel:${VIP_TRIM}`)
    box(x0, VIP_H - 0.25, z0, x1, VIP_H, z1, VIP_DECK)
    // Neon kerb: four strips round the edge rather than one slab, so the deck shows.
    box(x0, VIP_H, z0, x1, VIP_H + 0.14, z0 + 0.3, `neon:${VIP_NEON}`, false)
    box(x0, VIP_H, z1 - 0.3, x1, VIP_H + 0.14, z1, `neon:${VIP_NEON}`, false)
    box(x0, VIP_H, z0, x0 + 0.3, VIP_H + 0.14, z1, `neon:${VIP_NEON}`, false)
    box(x1 - 0.3, VIP_H, z0, x1, VIP_H + 0.14, z1, `neon:${VIP_NEON}`, false)
    // Banner across the back of the platform, on two posts, with a face either side.
    //
    // It went over the middle at first, hung high enough to clear the item boards
    // underneath it - and at the height the game's own camera actually sits (about
    // y 3.9, looking slightly down) it was straight off the top of the screen. Back
    // here it is in shot the whole time you are walking up, and the items read in
    // front of it rather than through it.
    const lines = [
      { text: title, scale: 1.25, fill: ['#ffffff', '#e9c6ff'] },
      { text: 'THE BEST - FOR THE MOST WINS', scale: 0.55, fill: ['#d6f6ff', '#2fa8ff'] },
    ]
    if (alongX) {
      const backZ = edge === '-z' ? cz - halfZ + 0.35 : cz + halfZ - 0.35
      for (const px of [signCx - signW / 2 + 0.4, signCx + signW / 2 - 0.4]) {
        box(px - 0.2, VIP_H, backZ - 0.2, px + 0.2, VIP_SIGN_Y - 0.9, backZ + 0.2, `panel:${VIP_TRIM}`, false)
      }
      for (const facing of [0, Math.PI]) {
        labels.push({
          lines,
          position: [signCx, VIP_SIGN_Y, backZ + (facing === 0 ? 0.13 : -0.13)],
          rotationY: facing,
          size: [signW, 1.9],
          style: { bg: '#25123f', border: '#b06bff' },
        })
      }
    } else {
      const backX = edge === '-x' ? cx - halfX + 0.35 : cx + halfX - 0.35
      const signCz = sign.cz ?? cz
      for (const pz of [signCz - signW / 2 + 0.4, signCz + signW / 2 - 0.4]) {
        box(backX - 0.2, VIP_H, pz - 0.2, backX + 0.2, VIP_SIGN_Y - 0.9, pz + 0.2, `panel:${VIP_TRIM}`, false)
      }
      for (const facing of [1, -1]) {
        labels.push({
          lines,
          position: [backX + facing * 0.13, VIP_SIGN_Y, signCz],
          rotationY: (facing * Math.PI) / 2,
          size: [signW, 1.9],
          style: { bg: '#25123f', border: '#b06bff' },
        })
      }
    }
    return VIP_H
  }

  /** Stone arch around a portal. `facing` is the axis the portal's front faces along (+). */
  const arch = (cx, cz, facing) => {
    const place = (u0, u1, y0, y1, d0, d1) =>
      facing === 'x'
        ? box(cx + d0, y0, cz + u0, cx + d1, y1, cz + u1, 'portalStone')
        : box(cx + u0, y0, cz + d0, cx + u1, y1, cz + d1, 'portalStone')
    place(-5, -3.6, 0, 8.8, -1, 1)
    place(3.6, 5, 0, 8.8, -1, 1)
    place(-5, 5, 7.6, 8.8, -1, 1)
    place(-5.6, -3, 0, 1.4, -1.4, 1.4)
    place(3, 5.6, 0, 1.4, -1.4, 1.4)
  }


  // --- Lobby ground ---------------------------------------------------------------
  // From the gate in the south to the boxing rings in the north:
  //
  //   z -34..16   the front lobby: the avenue down the middle to the gate, the glove
  //               shop on its west side and the egg (pet) zone on its east
  //   z  16..36   the spawn plaza: the glove statue, the VIP gloves, Space World's
  //               portal and the leaderboards
  //   z  38..62   the training zone: two rows of punching bags, VIP bags at the end
  //   z  64..90   the fight district: four boxing rings and the stands behind them
  //
  // Paths and zone floors are visual only, a hair above the grass, so there is
  // nothing to trip on.
  const L = LOBBY_HALF
  const N = LOBBY_NORTH
  const outer = L + RING * 3
  box(-outer, -1, STAGE_START, outer, 0, N + RING * 3, 'grass')

  const path = (x0, z0, x1, z1, m = 'path') => box(x0, 0, z0, x1, 0.05, z1, m, false)
  const kerb = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.12, z1, 'border', false)

  // Half-width of the avenue: as wide as the gate's doorway (OPEN_HALF).
  const AVENUE = OPEN_HALF
  const K = AVENUE + 0.5
  const FRONT_N = 16
  const PLAZA_N = 36
  const TRAIN_S = 38
  const TRAIN_N = 62
  const FIGHT_S = 64
  path(-AVENUE, STAGE_START, AVENUE, FRONT_N)
  // The plaza, paved right across, and the cross walk along its north edge.
  path(-L, FRONT_N, L, PLAZA_N, 'plaza')
  path(-L, PLAZA_N, L, TRAIN_S)
  // A forecourt in front of the gate, as wide as the tower, between the zones' south
  // fences. The avenue's kerbs start where it ends.
  const FORECOURT = 3
  const towerHalf = CORRIDOR_HALF + WALL_T
  path(-towerHalf, GATE_Z, -AVENUE, GATE_Z + FORECOURT)
  path(AVENUE, GATE_Z, towerHalf, GATE_Z + FORECOURT)
  kerb(-K, GATE_Z + FORECOURT, -AVENUE, FRONT_N)
  kerb(AVENUE, GATE_Z + FORECOURT, K, FRONT_N)
  kerb(-L, FRONT_N - 0.5, -K, FRONT_N)
  kerb(K, FRONT_N - 0.5, L, FRONT_N)

  // A ring of coloured tiles round the statue, set into the plaza. The statue has the
  // west half of the plaza to itself, well clear of the way through to training.
  const STATUE = [-22, 26]
  // Each ring a good step above the last: a few millimetres apart, they flickered
  // through each other from any distance.
  for (const [r, m, top] of [[6, 'plazaRing', 0.09], [5.1, 'plaza', 0.12], [4, 'plazaInner', 0.15]]) {
    box(STATUE[0] - r, 0, STATUE[1] - r, STATUE[0] + r, top, STATUE[1] + r, m, false)
  }

  /** Lamp post with a glowing lantern, lining the walkways. */
  const lamp = (x, z) => {
    box(x - 0.15, 0, z - 0.15, x + 0.15, 3.6, z + 0.15, 'dark')
    box(x - 0.35, 3.6, z - 0.35, x + 0.35, 4.3, z + 0.35, 'neon:#fff1b8', false)
    box(x - 0.45, 4.3, z - 0.45, x + 0.45, 4.45, z + 0.45, 'dark', false)
  }
  // Placed clear of the zone entrances.
  for (const z of [-27, -19, 4, 12]) {
    lamp(-AVENUE - 1.2, z)
    lamp(AVENUE + 1.2, z)
  }
  for (const x of [-9, 9]) lamp(x, FRONT_N + 1.5)

  /**
   * Low fence along an axis-aligned line, with gaps for entrances. `axis` is the
   * direction it runs ('x' or 'z'), `at` its fixed coordinate, `gaps` sorted
   * [from, to] ranges to leave open. One jump high, so it never traps anyone.
   */
  const fence = (axis, at, from, to, gaps, rail, post) => {
    const pieces = []
    let s = from
    for (const [g0, g1] of gaps) {
      if (g0 > s) pieces.push([s, g0])
      s = Math.max(s, g1)
    }
    if (s < to) pieces.push([s, to])
    const put = (a0, a1, y0, y1, t, m) =>
      axis === 'x' ? box(a0, y0, at - t, a1, y1, at + t, m) : box(at - t, y0, a0, at + t, y1, a1, m)
    for (const [a, b] of pieces) {
      put(a, b, 0.75, 0.95, 0.1, rail)
      put(a, b, 0.35, 0.5, 0.08, rail)
      const n = Math.max(1, Math.round((b - a) / 2.2))
      for (let k = 0; k <= n; k++) {
        const c = a + ((b - a) * k) / n
        put(c - 0.18, c + 0.18, 0, 1.1, 0.18, post)
      }
    }
  }

  /**
   * Entrance arch in a fence, with the zone's name on a board across the top.
   * `axis` is the way the fence runs: 'z' for a fence at x = `at` (the arch faces
   * along X, towards `dir`), 'x' for one at z = `at` (facing along Z).
   */
  const archGate = (at, center, width, dir, zone, axis = 'z') => {
    const a0 = center - width / 2
    const a1 = center + width / 2
    const put = (u0, u1, y0, y1, t0, t1, m, c) =>
      axis === 'z' ? box(at + t0, y0, u0, at + t1, y1, u1, m, c) : box(u0, y0, at + t0, u1, y1, at + t1, m, c)
    put(a0 - 0.8, a0, 0, 5.8, -0.4, 0.4, zone.post)
    put(a1, a1 + 0.8, 0, 5.8, -0.4, 0.4, zone.post)
    put(a0, a1, 5, 5.8, -0.4, 0.4, zone.post)
    put(a0, a1, 4.8, 5, -0.42, 0.42, `neon:${zone.neon}`, false)
    put(a0 - 0.5, a1 + 0.5, 5.8, 7.8, -0.2, 0.2, zone.board)
    for (const facing of axis === 'x' ? [1, -1] : [dir]) {
      labels.push({
        lines: [zone.title],
        position: axis === 'z' ? [at + facing * 0.22, 6.8, center] : [center, 6.8, at + facing * 0.22],
        rotationY: axis === 'z' ? (facing * Math.PI) / 2 : facing > 0 ? 0 : Math.PI,
        size: [width + 0.4, 1.6],
        style: { fill: zone.fill },
      })
    }
  }

  // The two shops either side of the avenue. Each has its own colours: floor, fence,
  // arch and billboards, and starts a grass verge (with the lamp posts) away from it.
  const ZONE_IN = AVENUE + 2
  const ZONES = {
    gloves: {
      x0: -L + 1, x1: -ZONE_IN, z0: GATE_Z + FORECOURT, z1: FRONT_N - 1,
      floor: 'floor:#ffb4a8,#ffa092', rail: 'floor:#e8352d,#e8352d', post: 'floor:#8a1a14,#8a1a14',
      board: 'floor:#e8352d,#c92a22', neon: '#ff8a7a', title: 'GLOVES', fill: ['#ffffff', '#ffd6d0'],
    },
    eggs: {
      x0: ZONE_IN, x1: L - 1, z0: GATE_Z + FORECOURT, z1: FRONT_N - 1,
      floor: 'floor:#ffc2e6,#ffadd9', rail: 'floor:#ff5fb8,#ff5fb8', post: 'floor:#a8286e,#a8286e',
      board: 'floor:#ff5fb8,#e64aa0', neon: '#ff8fd0', title: 'PETS', fill: ['#ffffff', '#ffd6ee'],
    },
  }
  const ENTRANCE = 7
  const midZ = (zone) => (zone.z0 + zone.z1) / 2

  for (const [name, zone] of Object.entries(ZONES)) {
    const { x0, x1, z0, z1 } = zone
    box(x0, 0, z0, x1, 0.06, z1, zone.floor, false)
    // The arch faces the avenue; the side walls of the lobby need no fence.
    const west = name === 'gloves'
    const inner = west ? x1 : x0
    const c = midZ(zone)
    fence('z', inner, z0, z1, [[c - ENTRANCE / 2 - 0.8, c + ENTRANCE / 2 + 0.8]], zone.rail, zone.post)
    archGate(inner, c, ENTRANCE, west ? 1 : -1, zone)
    // A way in from the plaza too, at the north end.
    const gap = west ? [x0 + 5, x0 + 11] : [x1 - 11, x1 - 5]
    fence('x', z1, x0, x1, [gap], zone.rail, zone.post)
    // The south fence stops short of the west ledge, which runs right past it.
    fence('x', z0, west ? -(L - 4.6) : x0, x1, [], zone.rail, zone.post)
  }

  // --- Glove shop --------------------------------------------------------------------
  // Two staggered rows along the west wall: the first twelve on the ground, the
  // bigger, pricier ones on a ledge behind, half a step along so each sign shows
  // through a gap.
  const GLOVE_Z = midZ(ZONES.gloves)
  const GLOVE_STEP = 3.6
  const FRONT_COUNT = 12
  const LEDGE_H = 1.2
  const rowHalf = ((FRONT_COUNT - 1) * GLOVE_STEP) / 2
  const frontStart = GLOVE_Z + rowHalf
  const glovePads = WINS_GLOVES.map((glove, i) => {
    const back = i >= FRONT_COUNT
    const slot = back ? i - FRONT_COUNT : i
    return {
      glove,
      position: back
        ? [-(L - 2.4), LEDGE_H, frontStart - GLOVE_STEP / 2 - slot * GLOVE_STEP]
        : [-(L - 7.4), 0, frontStart - slot * GLOVE_STEP],
    }
  })
  // The ledge is one easy jump high, and runs the length of the back row.
  const backTop = frontStart - GLOVE_STEP / 2
  const backBottom = backTop - (WINS_GLOVES.length - FRONT_COUNT - 1) * GLOVE_STEP
  hill(-L, backBottom - 2.2, -(L - 4.4), backTop + 2.2, LEDGE_H)

  // --- Egg zone ---------------------------------------------------------------------
  // Two rows of five (one per egg), the pricier row on a ledge along the wall, the
  // back row offset half a step so each sign shows through the gap in front of it.
  // The VIP egg has the south end of the zone to itself.
  const EGG_PER_ROW = 5
  const EGG_STEP = 3.6
  const EGG_Z = midZ(ZONES.eggs) + 5
  const eggRowHalf = ((EGG_PER_ROW - 1) * EGG_STEP) / 2
  const eggRowTop = EGG_Z + eggRowHalf + EGG_STEP / 2
  const eggStands = WINS_EGGS.map((egg, i) => {
    const front = i < EGG_PER_ROW
    const slot = front ? i : i - EGG_PER_ROW
    return {
      egg,
      position: front
        ? [L - 12, 0, eggRowTop - EGG_STEP / 2 - slot * EGG_STEP]
        : [L - 4, LEDGE_H, eggRowTop - slot * EGG_STEP],
    }
  })
  hill(L - 8, EGG_Z - eggRowHalf - 2.5, L, EGG_Z + eggRowHalf + EGG_STEP + 2.5, LEDGE_H)
  const EGG_VIP = [L - 9, GATE_Z + 9.5]
  const eggVipY = vipPlatform(EGG_VIP[0], EGG_VIP[1], 3.8, 3, 'VIP EGG', { cx: EGG_VIP[0] - 2.2, w: 3.6 })
  for (const egg of VIP_EGGS) eggStands.push({ egg, position: [EGG_VIP[0] + 1.9, eggVipY, EGG_VIP[1]] })

  /**
   * Checkered billboard on two tall black posts, standing against a side wall.
   * `fx` is the x of its front face and `dir` the way it faces (+1 = +X, -1 = -X).
   */
  const sideBillboard = (fx, dir, cz, y0, w, h, material, text, fill) => {
    /** x-range from `a` to `b` units behind the front face. */
    const behind = (a, b) => {
      const p = fx - dir * a
      const q = fx - dir * b
      return [Math.min(p, q), Math.max(p, q)]
    }
    const [bx0, bx1] = behind(0, 0.3)
    const [fx0, fx1] = behind(0.3, 0.6)
    const [px0, px1] = behind(0.6, 1.1)
    for (const pz of [cz - w / 2 + 0.7, cz + w / 2 - 0.7]) {
      box(px0, 0, pz - 0.3, px1, y0 + h, pz + 0.3, 'dark')
    }
    box(fx0, y0 - 0.3, cz - w / 2 - 0.3, fx1, y0 + h + 0.3, cz + w / 2 + 0.3, 'dark')
    box(bx0, y0, cz - w / 2, bx1, y0 + h, cz + w / 2, material)
    labels.push({
      lines: [text],
      position: [fx + dir * 0.02, y0 + h / 2, cz],
      rotationY: (dir * Math.PI) / 2,
      size: [w * 0.9, h * 0.8],
      style: { fill },
    })
  }

  // Billboards against the side walls, raised clear of the signs in front of them.
  const WALL_FACE = L - 0.6
  for (const [dz, big] of [[12, false], [0, true], [-12, false]]) {
    sideBillboard(-WALL_FACE, 1, GLOVE_Z + dz, big ? 9.4 : 8.6, big ? 11 : 9, big ? 4 : 3.5,
      ZONES.gloves.board, 'GLOVES', ZONES.gloves.fill)
  }
  for (const dz of [8, -6]) {
    sideBillboard(WALL_FACE, -1, EGG_Z + dz, 8, 8, 3.4, ZONES.eggs.board, 'PETS', ZONES.eggs.fill)
  }

  // --- Spawn plaza ------------------------------------------------------------------
  // The middle is kept clear, from the spawn straight up to the training zone's arch.
  // The statue stands in the west half; the VIP gloves, Space World's portal and the
  // leaderboards are in the east.
  box(STATUE[0] - 2.6, 0, STATUE[1] - 2.6, STATUE[0] + 2.6, 1.2, STATUE[1] + 2.6, 'statueBase')
  box(STATUE[0] - 1.8, 1.2, STATUE[1] - 1.8, STATUE[0] + 1.8, 1.9, STATUE[1] + 1.8, 'statueTop')
  // A neon band round the plinth's lip, its top a centimetre under the plinth's own so
  // the two never share a plane.
  box(STATUE[0] - 2.67, 1.08, STATUE[1] - 2.67, STATUE[0] + 2.67, 1.19, STATUE[1] + 2.67, 'neon:#ffd23f', false)
  const statue = { position: [STATUE[0], 1.9, STATUE[1]] }
  // Its name on all four sides of the plinth.
  for (const [dx, dz, rotationY] of [[0, -2.62, Math.PI], [0, 2.62, 0], [-2.62, 0, -Math.PI / 2], [2.62, 0, Math.PI / 2]]) {
    labels.push({
      lines: [{ text: '+1 FIST PER CLICK', fill: ['#fff6a8', '#ffb31a'] }],
      position: [STATUE[0] + dx * 1.012, 0.55, STATUE[1] + dz * 1.012],
      rotationY,
      size: [5, 0.9],
      style: {},
    })
  }
  for (const [dx, dz] of [[-4.2, -3.4], [4, -3.6], [-3.8, 4], [4.1, 3.7]]) {
    crystals.push({ position: [STATUE[0] + dx, 0, STATUE[1] + dz], color: '#ffd23f', scale: 0.7 })
  }

  // The two VIP pairs, on their own platform in the plaza's east half, the banner
  // behind them so it reads from the path.
  const GLOVE_VIP = [16, 23]
  const GLOVE_VIP_SPREAD = 2.4
  const gloveVipY = vipPlatform(GLOVE_VIP[0], GLOVE_VIP[1], 4.5, 4, 'VIP GLOVES', { edge: '+x' })
  VIP_GLOVES.forEach((glove, i) => {
    const dz = i === 0 ? -GLOVE_VIP_SPREAD : GLOVE_VIP_SPREAD
    glovePads.push({ glove, position: [GLOVE_VIP[0] - 0.8, gloveVipY, GLOVE_VIP[1] + dz] })
  })

  // Planters with a tree in the corners of the plaza.
  for (const [x, z] of [[-31, 18.6], [-31, 33], [31, 33]]) {
    box(x - 1.6, 0, z - 1.6, x + 1.6, 0.7, z + 1.6, 'border')
    box(x - 1.35, 0.7, z - 1.35, x + 1.35, 0.8, z + 1.35, 'grass', false)
    tree(x, 0.8, z, 0.85)
  }
  // Flower beds either side of the path up to training.
  for (const side of [-1, 1]) {
    const x = side * 7
    box(x - 1.2, 0, 29.5, x + 1.2, 0.35, 35.5, 'border')
    for (let i = 0; i < 4; i++) {
      const z = 30.3 + i * 1.45
      box(x - 0.9, 0.35, z - 0.45, x + 0.9, 0.62, z + 0.45, ['flowerRed', 'flowerYellow', 'flowerPink'][i % 3], false)
    }
  }

  // --- Training zone ------------------------------------------------------------------
  // Two rows of five punching bags across the zone, the cheaper row in front. Each
  // pad is turned so its bag hangs on the far (north) side: you walk onto the pad and
  // punch with your back to the plaza. The VIP bags have a gold platform at the east
  // end, and a dumbbell rack fills the west end.
  const TRAIN = {
    x0: -L + 1, x1: L - 1, z0: TRAIN_S, z1: TRAIN_N,
    floor: 'floor:#ffd494,#ffc477', rail: 'floor:#ff9f1c,#ff9f1c', post: 'floor:#a85a00,#a85a00',
    board: 'floor:#ff9f1c,#f08a0a', neon: '#ffd166', title: 'TRAINING', fill: ['#fff6a8', '#ffc21a'],
  }
  box(TRAIN.x0, 0, TRAIN.z0, TRAIN.x1, 0.06, TRAIN.z1, TRAIN.floor, false)
  fence('x', TRAIN.z0, TRAIN.x0, TRAIN.x1, [[-ENTRANCE / 2 - 0.8, ENTRANCE / 2 + 0.8], [-26, -20], [20, 26]], TRAIN.rail, TRAIN.post)
  archGate(TRAIN.z0, 0, ENTRANCE, -1, TRAIN, 'x')
  fence('x', TRAIN.z1, TRAIN.x0, TRAIN.x1, [[-ENTRANCE / 2 - 0.8, ENTRANCE / 2 + 0.8], [-17, -13], [13, 17]], TRAIN.rail, TRAIN.post)

  const BAG_STEP = 9.5
  const BAG_ROWS = [43.2, 53.4]
  const PER_ROW = 5
  const trainerPads = WINS_TRAINERS.map((trainer, i) => {
    const row = Math.floor(i / PER_ROW)
    const slot = i % PER_ROW
    return {
      trainer,
      position: [(slot - (PER_ROW - 1) / 2) * BAG_STEP, 0, BAG_ROWS[row]],
      rotationY: Math.PI,
      labelY: 5.6,
    }
  })
  const TRAIN_VIP = [28.75, 50]
  const trainVipY = vipPlatform(TRAIN_VIP[0], TRAIN_VIP[1], 4.25, 10.5, 'VIP BAGS', { edge: '+x' })
  VIP_TRAINERS.forEach((trainer, i) => {
    trainerPads.push({
      trainer,
      position: [TRAIN_VIP[0] - 0.6, trainVipY, TRAIN_VIP[1] + (i === 0 ? -6 : 3.5)],
      rotationY: Math.PI,
      labelY: 5.6,
    })
  })
  // Dumbbell rack at the west end: a bench and a row of weights, for the look of it.
  box(-31.5, 0, 44, -27.5, 0.9, 56, 'dark')
  for (let i = 0; i < 6; i++) {
    const z = 45 + i * 2
    const m = ['red', 'blue', 'yellow'][i % 3]
    box(-31.2, 0.9, z - 0.3, -27.8, 1.1, z + 0.3, 'dark', false)
    box(-31.4, 0.75, z - 0.55, -30.8, 1.3, z + 0.55, m, false)
    box(-28.2, 0.75, z - 0.55, -27.6, 1.3, z + 0.55, m, false)
  }
  sideBillboard(-WALL_FACE, 1, 50, 7.6, 10, 3.6, TRAIN.board, 'TRAIN HERE', TRAIN.fill)

  // --- Fight district -----------------------------------------------------------------
  // Four boxing rings in a row on a dark arena floor, a banner arch in from the
  // training zone, spotlight towers at the corners and tiered stands behind for
  // anyone watching. The rings themselves are built by BoxingRing (they have ropes
  // that go solid, scoreboards and fighters), from RINGS in game/rings.js.
  box(-L + 1, 0, FIGHT_S, L - 1, 0.06, N - 1, 'floor:#2c2f5a,#262950', false)
  // Walkway down the middle and along the front of the rings.
  path(-3, TRAIN_N, 3, FIGHT_S)
  box(-L + 1, 0.06, FIGHT_S + 0.6, L - 1, 0.08, FIGHT_S + 1.2, 'neon:#7f6bff', false)
  // The banner over the way in.
  const FIGHT = {
    post: 'dark', neon: '#ff4fd8', board: 'floor:#2b2b44,#232338', title: 'BOXING RINGS',
    fill: ['#ffffff', '#ff8af0'],
  }
  archGate(FIGHT_S - 0.5, 0, 10, -1, FIGHT, 'x')
  // Tiered stands along the north edge, open at both ends.
  const STAND_Z = N - 7
  for (let t = 0; t < 3; t++) {
    const z0 = STAND_Z + t * 1.6
    const h = 0.6 + t * 0.6
    box(-L + 2, 0, z0, L - 2, h, N - 1, 'standStep')
    box(-L + 2, h, z0, L - 2, h + 0.08, z0 + 0.25, `neon:${t % 2 ? '#ff4fd8' : '#5cc4ff'}`, false)
  }
  // Seats: little coloured blocks along each step.
  for (let t = 0; t < 3; t++) {
    const z = STAND_Z + t * 1.6 + 0.8
    const y = 0.6 + t * 0.6
    for (let x = -L + 3.5; x < L - 3; x += 2.2) {
      const m = ['seatRed', 'seatBlue', 'seatYellow'][(((Math.round(x / 2.2) + t) % 3) + 3) % 3]
      box(x - 0.55, y, z - 0.45, x + 0.55, y + 0.35, z + 0.45, m, false)
    }
  }
  // Spotlight towers on the corners of the district.
  for (const [x, z] of [[-L + 2, FIGHT_S + 2], [L - 2, FIGHT_S + 2], [-L + 2, N - 9], [L - 2, N - 9]]) {
    box(x - 0.35, 0, z - 0.35, x + 0.35, 11, z + 0.35, 'dark')
    box(x - 1.3, 11, z - 0.5, x + 1.3, 12, z + 0.5, 'dark')
    for (const dx of [-0.8, 0, 0.8]) box(x + dx - 0.32, 11.1, z - 0.55, x + dx + 0.32, 11.9, z - 0.5, 'neon:#fff6d0', false)
  }
  // A big board over the stands.
  box(-9, 0, N - 1.6, -8.4, 13.6, N - 1, 'dark')
  box(8.4, 0, N - 1.6, 9, 13.6, N - 1, 'dark')
  box(-10, 8, N - 2, 10, 13.6, N - 1.6, 'dark')
  labels.push({
    lines: [
      { text: 'FIGHT CLUB', scale: 1.3, fill: ['#ffffff', '#ff7af5'] },
      { text: 'Two step in - the stronger fist wins!', scale: 0.55, fill: '#d6f6ff' },
      { text: 'Knocked out? Back to the lobby', scale: 0.5, fill: '#ffd0d0' },
    ],
    position: [0, 10.8, N - 2.03],
    rotationY: Math.PI,
    size: [19, 5.2],
    style: { bg: '#141433', border: '#ff4fd8' },
  })
  const rings = RINGS

  // --- Terraces around the lobby --------------------------------------------------
  // Three rings: two low steps you can jump up, then a tall cliff that bounds the map.
  const ringHeight = [
    () => pick([1.0, 1.2, 1.2]),
    () => pick([2.2, 2.4, 2.4]),
    () => pick([7, 8, 9, 10, 11, 12]),
  ]
  const gateHalf = CORRIDOR_HALF + WALL_T
  for (let r = 0; r < 3; r++) {
    const s0 = LOBBY_HALF + r * RING
    const s1 = s0 + RING
    const n0 = N + r * RING
    const n1 = n0 + RING
    const strips = [
      // North, right across.
      ...segments(-s1, s1).map(([a, b]) => [a, n0, b, n1]),
      // South, either side of the gate.
      ...[
        [-s1, -gateHalf],
        [gateHalf, s1],
      ].flatMap(([a0, a1]) => segments(a0, a1).map(([a, b]) => [a, -s1, b, -s0])),
      // East and west, the whole depth of the lobby.
      ...segments(-s0, n0).map(([a, b]) => [s0, a, s1, b]),
      ...segments(-s0, n0).map(([a, b]) => [-s1, a, -s0, b]),
    ]
    for (const [x0, z0, x1, z1] of strips) {
      const h = ringHeight[r]()
      hill(x0, z0, x1, z1, h)
      const cx = (x0 + x1) / 2 + (rand() - 0.5) * 2
      const cz = (z0 + z1) / 2 + (rand() - 0.5) * 2
      if (r > 0 && rand() < (r === 1 ? 0.25 : 0.5)) tree(cx, h, cz, pick([0.9, 1, 1.15]))
      else if (r < 2 && rand() < 0.12) crystals.push({ position: [cx, h, cz], color: '#7fdcff', scale: 0.8 })
    }
  }

  // --- The arena gate (holds wall 1) -------------------------------------------------
  // The way into the stages, dressed as the entrance to a fight: a red and gold
  // facade with a cornice of marquee bulbs, a gold pillar either side of the door
  // with a giant glove on top of each (red corner, blue corner - see GateGloves),
  // banners, and a red carpet up to the first wall.
  const GZ0 = STAGE_START
  const GZ1 = GATE_Z
  box(-gateHalf, -1, GZ0, -OPEN_HALF, 14, GZ1, 'gateRed')
  box(OPEN_HALF, -1, GZ0, gateHalf, 14, GZ1, 'gateRed')
  box(-OPEN_HALF, OPEN_H, GZ0, OPEN_HALF, 14, GZ1, 'gateRed')
  // A dark plinth along the foot of the facade.
  box(-gateHalf - 0.2, 0, GZ1 - 0.2, -OPEN_HALF - 0.6, 1, GZ1 + 0.25, 'gateDark')
  box(OPEN_HALF + 0.6, 0, GZ1 - 0.2, gateHalf + 0.2, 1, GZ1 + 0.25, 'gateDark')
  // Gold cornice, a red upper storey, and a gold crown.
  box(-gateHalf - 0.6, 14, GZ0 - 0.2, gateHalf + 0.6, 15, GZ1 + 0.45, 'gateGold')
  box(-11, 15, GZ0 + 0.8, 11, 18.4, GZ1 - 0.4, 'gateRed')
  box(-11.5, 18.4, GZ0 + 0.4, 11.5, 19.1, GZ1, 'gateGold')
  box(-5, 19.1, GZ0 + 1.6, 5, 20.4, GZ1 - 1.2, 'gateRed')
  box(-5.4, 20.4, GZ0 + 1.2, 5.4, 20.9, GZ1 - 0.8, 'gateGold')
  labels.push({
    lines: [{ text: 'FIGHT YOUR WAY THROUGH', fill: ['#fff6a8', '#ffc21a'] }],
    position: [0, 16.7, GZ1 - 0.37],
    size: [20, 2.2],
    style: {},
  })
  // Marquee bulbs along the cornice's face and round the door.
  for (let x = -gateHalf; x <= gateHalf + 0.01; x += 1.4) {
    box(x - 0.17, 14.33, GZ1 + 0.45, x + 0.17, 14.67, GZ1 + 0.6, 'neon:#fff1b8', false)
  }
  for (let y = 1.5; y < OPEN_H; y += 1.4) {
    for (const side of [-1, 1]) {
      const x = side * (OPEN_HALF + 0.95)
      box(x - 0.15, y - 0.15, GZ1, x + 0.15, y + 0.15, GZ1 + 0.12, 'neon:#fff1b8', false)
    }
  }
  // The two pillars, gold on dark feet, each capped for its glove.
  for (const side of [-1, 1]) {
    const [x0, x1] = side < 0 ? [-OPEN_HALF - 4, -OPEN_HALF - 1.6] : [OPEN_HALF + 1.6, OPEN_HALF + 4]
    box(x0 - 0.2, 0, GZ1 - 0.2, x1 + 0.2, 1.2, GZ1 + 1.6, 'gateDark')
    box(x0, 1.2, GZ1, x1, 12.6, GZ1 + 1.4, 'gateGold')
    box(x0 - 0.25, 12.6, GZ1 - 0.25, x1 + 0.25, 13.3, GZ1 + 1.65, 'gateRed')
    const cx = (x0 + x1) / 2
    // A neon stripe up the front of each, in its corner's colour.
    box(cx - 0.18, 1.6, GZ1 + 1.4, cx + 0.18, 12.2, GZ1 + 1.48, `neon:${side < 0 ? '#ff4a4a' : '#4f9dff'}`, false)
    // A banner on the facade beside it.
    const bx = side * (gateHalf - 1)
    box(bx - 0.9, 3.5, GZ1, bx + 0.9, 11.5, GZ1 + 0.12, side < 0 ? 'bannerRed' : 'bannerBlue', false)
    box(bx - 1.05, 11.5, GZ1 - 0.05, bx + 1.05, 11.8, GZ1 + 0.25, 'gateGold', false)
    labels.push({
      lines: side < 0 ? ['PUNCH', 'TO', 'WIN'] : ['SMASH', 'THE', 'WALLS'],
      position: [bx, 7.5, GZ1 + 0.14],
      size: [1.7, 7],
      style: { fill: ['#ffffff', '#ffe9a8'] },
    })
  }
  // The red carpet, gold-edged, from the forecourt to the door.
  box(-4, 0, GZ1, 4, 0.09, GZ1 + 12, 'carpet', false)
  for (const side of [-1, 1]) box(side * 4 - 0.25, 0, GZ1, side * 4 + 0.25, 0.1, GZ1 + 12, 'gateGold', false)
  // The first of stage 1's ten walls. No Win pads out here: they're in the cabins.
  // Its "STAGE 1" sign is drawn live (see GateSign), so it can also show the
  // walls-rebuild countdown; not pushed onto the static `labels` list.
  addWall(1, GATE_Z)

  // --- Stage corridors --------------------------------------------------------------
  const CH = CORRIDOR_HALF
  for (let k = 1; k <= STAGE_COUNT; k++) {
    const theme = THEMES[k - 1]
    const z0 = stageStart(k)
    const z1 = z0 - STAGE_LEN
    // Doors in both side walls, halfway along the cabin, into its two small rooms.
    const vipZ = (cabinStart(k) + cabinEnd(k)) / 2
    const opening = [vipZ - VIP_DOOR, vipZ + VIP_DOOR]

    /** Calls fn(za, zb) for the stretches of this stage's side wall not cut by a door. */
    const alongWall = (fn) => {
      if (!opening) return fn(z1, z0)
      fn(z1, opening[0])
      fn(opening[1], z0)
    }

    box(-CH, -1, z1, CH, 0, z0, `floor:${theme.floor.join(',')}`)

    for (const side of [-1, 1]) {
      const xin = side * CH
      const xout = side * (CH + WALL_T)
      const [xa, xb] = side < 0 ? [xout, xin] : [xin, xout]
      const [na, nb] = side < 0 ? [xin, xin + 0.12] : [xin - 0.12, xin]
      alongWall((za, zb) => {
        box(xa, -1, za, xb, WALL_H, zb, `panel:${theme.side}`)
        box(na, 0, za, nb, 0.25, zb, `neon:${theme.neon}`, false)
        box(na, WALL_H - 0.6, za, nb, WALL_H - 0.4, zb, `neon:${theme.neon}`, false)
      })
      // Wall over the door into the side room, and a floor under it: the door is cut
      // through the whole thickness of the side wall, which would otherwise leave a
      // hole between the corridor floor and the room's.
      box(xa, 8, opening[0], xb, WALL_H, opening[1], `panel:${theme.side}`)
      box(xa, -1, opening[0], xb, 0, opening[1], `floor:${theme.floor.join(',')}`)
      box(xa - 0.2, WALL_H, z1, xb + 0.2, WALL_H + 0.6, z0, 'dark')

      // Terrain beyond the corridor walls, so it reads as a canyon from above.
      const [hx0, hx1] = side < 0 ? [-26, -14] : [14, 26]
      const hillTop = Math.min(z0, -(LOBBY_HALF + RING * 3))
      const ranges = [
        [z1, vipZ - 8],
        [vipZ + 8, hillTop],
      ]
      for (const [ra, rb] of ranges) {
        for (const [a, b] of segments(ra, rb)) {
          const h = pick([13, 14, 15, 16, 17])
          hill(hx0, a, hx1, b, h)
          if (rand() < 0.35) tree((hx0 + hx1) / 2 + (rand() - 0.5) * 4, h, (a + b) / 2, pick([1, 1.2]))
        }
      }

      crystals.push({ position: [side * (CH - 2), 0, cabinStart(k) - 3], color: theme.neon, scale: 0.9 })
    }

    // A ceiling over it all. The tunnel: the stage's first wall sits in the gate it's
    // entered through, and the other nine follow straight after, one every WALL_GAP.
    roofs.push({ x0: -CH, x1: CH, z0: z1, z1: z0, y: WALL_H - 0.01 })
    for (let j = 1; j < WALLS_PER_STAGE; j++) {
      const front = z0 - TUNNEL_LEAD - (j - 1) * WALL_GAP
      divider(front - 1)
      addWall((k - 1) * WALLS_PER_STAGE + 1 + j, front)
    }

    // Past the tenth wall: the cabin, with a small room either side.
    sideRooms(vipZ)

    if (k < STAGE_COUNT) {
      // The next stage's gate closes the far end of the cabin; in front of it, the
      // Win pads for cashing in this stage's walls.
      const gateFront = cabinEnd(k)
      divider(gateFront - 1)
      addWall(k * WALLS_PER_STAGE + 1, gateFront)
      addPads(k * WALLS_PER_STAGE + 1, gateFront)
      labels.push({
        lines: [`STAGE ${k + 1}`],
        position: [0, 11, gateFront + 0.12],
        size: [9, 1.6],
        style: { fill: ['#fff6a8', '#ffc21a'] },
      })
    }
  }

  // --- The end of the line ----------------------------------------------------------
  box(-CH - WALL_T, -1, END_Z - 2, CH + WALL_T, WALL_H, END_Z, 'dark')
  // One last pair of Win pads, for clearing every wall.
  addPads(STAGE_COUNT * WALLS_PER_STAGE + 1, END_Z)
  for (const [a, b] of segments(-26, 26)) hill(a, END_Z - 14, b, END_Z - 2, pick([14, 15, 16]))
  labels.push({
    lines: ['MORE STAGES', 'COMING SOON'],
    position: [0, 10.4, END_Z + 0.05],
    size: [14, 3],
    style: { fill: ['#ffffff', '#bfe9ff'] },
  })

  // --- Space World's portal and the leaderboards ------------------------------------
  // The portal stands against the east side of the plaza, facing in; it refuses
  // anyone short of its rebirths. The leaderboards close the plaza's north-east corner.
  const SPACE_PORTAL = [L - 4.5, 23]
  arch(SPACE_PORTAL[0], SPACE_PORTAL[1], 'x')
  portals.push({
    position: [SPACE_PORTAL[0], 0, SPACE_PORTAL[1]],
    rotationY: -Math.PI / 2,
    target: SPACE_SPAWN,
    requiresRebirths: SPACE_REBIRTHS,
    name: 'Space World',
    color: '#4fd8ff',
  })
  labels.push({
    lines: [
      { text: 'SPACE WORLD', scale: 1.2, fill: ['#ffffff', '#ff7af5'] },
      { text: `Rebirth ${SPACE_REBIRTHS}`, scale: 0.85, fill: ['#ff9a9a', '#ff3030'] },
    ],
    position: [SPACE_PORTAL[0] - 1.05, 9.9, SPACE_PORTAL[1]],
    rotationY: -Math.PI / 2,
    size: [9, 2.6],
    style: {},
  })

  arch(0, END_Z + 1, 'z')
  portals.push({ position: [0, 0, END_Z + 1], rotationY: 0, target: SPAWN })
  labels.push({
    lines: ['BACK TO LOBBY'],
    position: [0, 8.2, END_Z + 2.05],
    size: [8.4, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  // Three boards on one frame, built the same way: posts and a backing beam behind.
  const BOARDS_Z = 34
  const BOARDS_X = 24
  box(BOARDS_X - 4.8, 0, BOARDS_Z + 0.6, BOARDS_X - 4.2, 9.6, BOARDS_Z + 1.2, 'trunk')
  box(BOARDS_X + 4.4, 0, BOARDS_Z + 0.6, BOARDS_X + 5, 9.6, BOARDS_Z + 1.2, 'trunk')
  box(BOARDS_X - 5.4, 2.4, BOARDS_Z, BOARDS_X + 5.4, 8.8, BOARDS_Z + 0.6, 'trunk')
  labels.push({
    lines: [{ text: 'LEADERBOARDS', fill: ['#fff6a8', '#ffc21a'] }],
    position: [BOARDS_X, 9.45, BOARDS_Z - 0.04],
    rotationY: Math.PI,
    size: [7, 1.1],
    style: { bg: '#6b4424', border: '#4a2c14' },
  })
  const leaderboards = { center: [BOARDS_X, 5.6, BOARDS_Z - 0.04], rotationY: Math.PI, width: 3.4, height: 3.4 * (900 / 512), gap: 0.15 }

  // --- Space World ----------------------------------------------------------------
  // Its own small hub with its own glove shop and bags, and a corridor of ten walls
  // behind a gate, laid out like the lobby's first stage but four hundred metres
  // west. The hub reaches as far south as the lobby does, so the same "back in a
  // lobby" line (see World.jsx's WallReset) rebuilds its walls too.
  const SX = SPACE_SPAWN[0]
  const HUB_HALF = 30
  const HUB_N = 30
  const sb = (x0, y0, z0, x1, y1, z1, m, c) => box(SX + x0, y0, z0, SX + x1, y1, z1, m, c)
  const spaceTheme = {
    name: 'Space',
    wall: { style: 'crystal', palette: ['#3a2a8a', '#4b3cff', '#2a1f6a', '#6a54c8'], gap: '#7ff9ff', glow: 0.55 },
    side: '#2a2050',
    neon: '#7ff9ff',
    floor: ['#3a3460', '#302a52'],
  }
  sb(-HUB_HALF, -1, STAGE_START, HUB_HALF, 0, HUB_N, 'floor:#3a3460,#2c2650')
  sb(-HUB_HALF - 2, -1, HUB_N, HUB_HALF + 2, 16, HUB_N + 2, 'panel:#2a2050')
  sb(-HUB_HALF - 2, -1, GATE_Z, -HUB_HALF, 16, HUB_N, 'panel:#2a2050')
  sb(HUB_HALF, -1, GATE_Z, HUB_HALF + 2, 16, HUB_N, 'panel:#2a2050')
  // The south wall, with the gate tower in the middle of it.
  sb(-HUB_HALF - 2, -1, STAGE_START, -CORRIDOR_HALF - WALL_T, 16, GATE_Z, 'panel:#2a2050')
  sb(CORRIDOR_HALF + WALL_T, -1, STAGE_START, HUB_HALF + 2, 16, GATE_Z, 'panel:#2a2050')
  sb(-gateHalf, -1, STAGE_START, -OPEN_HALF, 16, GATE_Z, 'dark')
  sb(OPEN_HALF, -1, STAGE_START, gateHalf, 16, GATE_Z, 'dark')
  sb(-OPEN_HALF, OPEN_H, STAGE_START, OPEN_HALF, 16, GATE_Z, 'dark')
  for (const [x0, z0, x1, z1] of [
    [-HUB_HALF, HUB_N - 0.12, HUB_HALF, HUB_N],
    [-HUB_HALF, GATE_Z, -HUB_HALF + 0.12, HUB_N],
    [HUB_HALF - 0.12, GATE_Z, HUB_HALF, HUB_N],
  ]) {
    sb(x0, 0, z0, x1, 0.25, z1, 'neon:#7ff9ff', false)
    sb(x0, 15.4, z0, x1, 15.6, z1, 'neon:#c07bff', false)
  }
  roofs.push({ x0: SX - HUB_HALF - 2, x1: SX + HUB_HALF + 2, z0: GATE_Z, z1: HUB_N + 2, y: 15.99 })
  labels.push({
    lines: [
      { text: 'SPACE WORLD', scale: 1.4, fill: ['#ffffff', '#ff7af5'] },
      { text: `Break the ${SPACE_WALLS} space walls - the Win pads pay huge!`, scale: 0.55, fill: '#bfe9ff' },
    ],
    position: [SX, 12.4, GATE_Z + 0.12],
    size: [16, 3],
    style: {},
  })

  // Space gloves down the west side, space bags down the east.
  SPACE_GLOVES.forEach((glove, i) => {
    glovePads.push({ glove, position: [SX - HUB_HALF + 8, 0, 14 - i * 8] })
  })
  SPACE_TRAINERS.forEach((trainer, i) => {
    trainerPads.push({
      trainer,
      position: [SX + HUB_HALF - 8, 0, 14 - i * 8],
      rotationY: -Math.PI / 2,
      labelY: 5.6,
    })
  })
  for (const [x, text, fill] of [
    [SX - HUB_HALF + 0.06, 'SPACE GLOVES', ['#ffffff', '#ffd27a']],
    [SX + HUB_HALF - 0.06, 'SPACE BAGS', ['#ffffff', '#7ff9ff']],
  ]) {
    const east = x > SX
    labels.push({
      lines: [text],
      position: [x, 11, 2],
      rotationY: east ? -Math.PI / 2 : Math.PI / 2,
      size: [14, 2],
      style: { fill },
    })
  }
  for (const [dx, dz] of [[-12, 24], [12, 24], [-4, -14], [6, -20]]) {
    crystals.push({ position: [SX + dx, 0, dz], color: '#7ff9ff', scale: 1.1 })
  }

  // The way home, behind the spawn.
  arch(SX, HUB_N - 3, 'z')
  portals.push({ position: [SX, 0, HUB_N - 3], rotationY: Math.PI, target: SPAWN })
  labels.push({
    lines: ['MAGIC DOOR - BACK TO LOBBY'],
    position: [SX, 8.2, HUB_N - 4.05],
    rotationY: Math.PI,
    size: [9.6, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  // The corridor: a gate holding the first wall, nine more behind it, then a cabin
  // with the Win pads and a closed end.
  const spaceWall = (number, zFront) => walls.push({ number, stage: 101, theme: spaceTheme, zFront, x: SX })
  spaceWall(SPACE_WALL_BASE + 1, GATE_Z)
  const tunnelEnd = STAGE_START - TUNNEL_LEAD - (SPACE_WALLS - 2) * WALL_GAP - DIVIDER_T
  const spaceEnd = tunnelEnd - 30
  sb(-CORRIDOR_HALF, -1, spaceEnd, CORRIDOR_HALF, 0, STAGE_START, `floor:${spaceTheme.floor.join(',')}`)
  for (const side of [-1, 1]) {
    const xin = side * CORRIDOR_HALF
    const xout = side * (CORRIDOR_HALF + WALL_T)
    const [xa, xb] = side < 0 ? [xout, xin] : [xin, xout]
    const [na, nb] = side < 0 ? [xin, xin + 0.12] : [xin - 0.12, xin]
    sb(xa, -1, spaceEnd, xb, WALL_H, STAGE_START, `panel:${spaceTheme.side}`)
    sb(na, 0, spaceEnd, nb, 0.25, STAGE_START, `neon:${spaceTheme.neon}`, false)
    sb(na, WALL_H - 0.6, spaceEnd, nb, WALL_H - 0.4, STAGE_START, `neon:${spaceTheme.neon}`, false)
  }
  roofs.push({ x0: SX - CORRIDOR_HALF, x1: SX + CORRIDOR_HALF, z0: spaceEnd, z1: STAGE_START, y: WALL_H - 0.01 })
  for (let j = 1; j < SPACE_WALLS; j++) {
    const front = STAGE_START - TUNNEL_LEAD - (j - 1) * WALL_GAP
    divider(front - 1, SX)
    spaceWall(SPACE_WALL_BASE + 1 + j, front)
  }
  sb(-CORRIDOR_HALF - WALL_T, -1, spaceEnd - 2, CORRIDOR_HALF + WALL_T, WALL_H, spaceEnd, 'dark')
  addPads(SPACE_WALL_BASE + SPACE_WALLS + 1, spaceEnd, SX, SPACE_SPAWN)
  labels.push({
    lines: ['MORE PLANETS', 'COMING SOON'],
    position: [SX, 9.6, spaceEnd + 0.05],
    size: [14, 3],
    style: { fill: ['#ffffff', '#bfe9ff'] },
  })

  return {
    blocks,
    walls,
    winPads,
    roofs,
    portals,
    leaderboards,
    space: { center: [SX, 0, 0], hubHalf: HUB_HALF, north: HUB_N },
    pads,
    crowns,
    crystals,
    labels,
    glovePads,
    trainerPads,
    eggStands,
    statue,
    rings,
  }
}
