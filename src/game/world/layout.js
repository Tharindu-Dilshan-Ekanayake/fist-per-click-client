import { VIP_EGGS, WINS_EGGS } from '../eggs'
import { SPACE_GUNS, VIP_GUNS, WINS_GUNS } from '../guns'
import { BOSS_REBIRTHS, SPACE_REBIRTHS } from '../progression'
import { SPACE_TRAINERS, VIP_TRAINERS, WINS_TRAINERS } from '../trainers'
import { SPACE_WALL_BASE, SPACE_WALLS, WALLS_PER_STAGE, wallStage, WIN_PADS } from '../walls'
import { mulberry32 } from './textures'
import {
  BOSS_CENTER,
  BOSS_SPAWN,
  cabinEnd,
  cabinStart,
  CORRIDOR_HALF,
  DIVIDER_T,
  END_Z,
  GATE_Z,
  LOBBY_HALF,
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
 * The look of the three VIP platforms - one in the gun zone, one in the egg zone,
 * one in the training zone. Purple plinth, gold deck, neon lip: nothing else in the
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
    // Where the banner hangs along the back edge. It defaults to the middle, which
    // is right for the guns - they float low enough to pass under it. An egg or a
    // target is not: parked in the middle they sit square in front of the
    // text, and their own floating name boards land on it too. Those platforms give
    // the banner its own lane to one side instead.
    const signCx = sign.cx ?? cx
    const signW = sign.w ?? Math.min(9, halfX * 2 - 0.4)
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
    const backZ = cz - halfZ + 0.35
    for (const px of [signCx - signW / 2 + 0.4, signCx + signW / 2 - 0.4]) {
      box(px - 0.2, VIP_H, backZ - 0.2, px + 0.2, VIP_SIGN_Y - 0.9, backZ + 0.2, `panel:${VIP_TRIM}`, false)
    }
    for (const facing of [0, Math.PI]) {
      labels.push({
        lines: [
          { text: title, scale: 1.25, fill: ['#ffffff', '#e9c6ff'] },
          { text: 'THE BEST - FOR THE MOST WINS', scale: 0.55, fill: ['#d6f6ff', '#2fa8ff'] },
        ],
        position: [signCx, VIP_SIGN_Y, backZ + (facing === 0 ? 0.13 : -0.13)],
        rotationY: facing,
        size: [signW, 1.9],
        style: { bg: '#25123f', border: '#b06bff' },
      })
    }
    return VIP_H
  }

  // --- Lobby ground ---------------------------------------------------------------
  // Grass everywhere, with tan walkways and three themed zones laid on top: guns on
  // the west side, training (north) and eggs (south) on the east. Paths and zone
  // floors are visual only, a hair above the grass, so there is nothing to trip on.
  const L = LOBBY_HALF
  const outer = L + RING * 3
  box(-outer, -1, STAGE_START, outer, 0, outer, 'grass')

  const path = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.05, z1, 'path', false)
  const kerb = (x0, z0, x1, z1) => box(x0, 0, z0, x1, 0.12, z1, 'border', false)

  // Walkways: the main avenue from the north plaza to the gate (and on through its
  // tunnel), the plaza itself, and a cross path between the training and egg zones.
  // Half-width of the avenue: as wide as the gate's doorway (OPEN_HALF).
  const AVENUE = OPEN_HALF
  const K = AVENUE + 0.5
  const PLAZA_Z = L - 10
  const CROSS0 = -5
  const CROSS1 = 1
  path(-AVENUE, STAGE_START, AVENUE, PLAZA_Z)
  path(-L, PLAZA_Z, L, L)
  path(AVENUE, CROSS0, L, CROSS1)
  // A forecourt in front of the gate, as wide as the tower, between the zones' south
  // fences. The avenue's kerbs start where it ends.
  const FORECOURT = 4
  const towerHalf = CORRIDOR_HALF + WALL_T
  path(-towerHalf, GATE_Z, -AVENUE, GATE_Z + FORECOURT)
  path(AVENUE, GATE_Z, towerHalf, GATE_Z + FORECOURT)
  kerb(-K, GATE_Z + FORECOURT, -AVENUE, PLAZA_Z)
  kerb(AVENUE, GATE_Z + FORECOURT, K, CROSS0)
  kerb(AVENUE, CROSS1, K, PLAZA_Z)
  kerb(K, CROSS0 - 0.5, L, CROSS0)
  kerb(K, CROSS1, L, CROSS1 + 0.5)
  kerb(-L, PLAZA_Z - 0.5, -K, PLAZA_Z)
  kerb(K, PLAZA_Z - 0.5, L, PLAZA_Z)

  /** Lamp post with a glowing lantern, lining the walkways. */
  const lamp = (x, z) => {
    box(x - 0.15, 0, z - 0.15, x + 0.15, 3.6, z + 0.15, 'dark')
    box(x - 0.35, 3.6, z - 0.35, x + 0.35, 4.3, z + 0.35, 'neon:#fff1b8', false)
    box(x - 0.45, 4.3, z - 0.45, x + 0.45, 4.45, z + 0.45, 'dark', false)
  }
  // Placed clear of the zone entrances and the cross path.
  for (const z of [-26, -14, 8, 20]) lamp(-AVENUE - 1.2, z)
  // 12, not 20: the training arch's opening now runs z 14..21 (see ZONES.train).
  for (const z of [-27, -11, 5, 12]) lamp(AVENUE + 1.2, z)
  for (const x of [13, 27]) {
    lamp(x, CROSS0 - 1.2)
    lamp(x, CROSS1 + 1.2)
  }

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
   * Entrance arch in a fence that runs along Z at x = `at`, with the zone's name on a
   * board across the top. `dir` is the way it faces (+1 = +X, -1 = -X).
   */
  const archGate = (at, center, width, dir, zone) => {
    const z0 = center - width / 2
    const z1 = center + width / 2
    box(at - 0.4, 0, z0 - 0.8, at + 0.4, 5.8, z0, zone.post)
    box(at - 0.4, 0, z1, at + 0.4, 5.8, z1 + 0.8, zone.post)
    box(at - 0.4, 5, z0, at + 0.4, 5.8, z1, zone.post)
    box(at - 0.42, 4.8, z0, at + 0.42, 5, z1, `neon:${zone.neon}`, false)
    box(at - 0.2, 5.8, z0 - 0.5, at + 0.2, 7.8, z1 + 0.5, zone.board)
    labels.push({
      lines: [zone.title],
      position: [at + dir * 0.22, 6.8, center],
      rotationY: (dir * Math.PI) / 2,
      size: [width + 0.4, 1.6],
      style: { fill: zone.fill },
    })
  }

  // Each zone has its own colours: floor, fence, arch and billboards. Zones start a
  // grass verge (with the lamp posts) away from the avenue.
  const ZONE_IN = AVENUE + 2
  const ZONES = {
    guns: {
      x0: -L + 1, x1: -ZONE_IN, z0: GATE_Z + FORECOURT, z1: PLAZA_Z - 2,
      floor: 'floor:#9cc2ff,#86b1f7', rail: 'floor:#3d7be8,#3d7be8', post: 'floor:#23479a,#23479a',
      board: 'floor:#3d7be8,#2f68d0', neon: '#6fb8ff', title: 'GUNS', fill: ['#ffffff', '#cfe6ff'],
    },
    train: {
      x0: ZONE_IN, x1: L - 1, z0: CROSS1 + 2, z1: PLAZA_Z - 2,
      // The only zone whose arch is not in the middle of its frontage.
      //
      // Centred, its seven-wide opening landed square on the one strip of this zone
      // that nothing else stands in - the lane between the avenue and the front row
      // of dummies - which left the VIP platform nowhere to go but into the doorway.
      // It sat there, half behind an arch post, and you met it face-on the moment you
      // walked in. Moved to the north end the same lane is one clear eleven-metre
      // block instead, the platform has the south end of it to itself, and the way in
      // is a way in.
      gate: 5,
      floor: 'floor:#ffd494,#ffc477', rail: 'floor:#ff9f1c,#ff9f1c', post: 'floor:#a85a00,#a85a00',
      board: 'floor:#ff9f1c,#f08a0a', neon: '#ffd166', title: 'TRAIN', fill: ['#fff6a8', '#ffc21a'],
    },
    eggs: {
      x0: ZONE_IN, x1: L - 1, z0: GATE_Z + FORECOURT, z1: CROSS0 - 2,
      floor: 'floor:#ffc2e6,#ffadd9', rail: 'floor:#ff5fb8,#ff5fb8', post: 'floor:#a8286e,#a8286e',
      board: 'floor:#ff5fb8,#e64aa0', neon: '#ff8fd0', title: 'EGGS', fill: ['#ffffff', '#ffd6ee'],
    },
  }
  const ENTRANCE = 7
  const midZ = (zone) => (zone.z0 + zone.z1) / 2
  /** Plain opening onto the plaza or the cross path. */
  const SIDE_GAP = [17, 23]

  for (const [name, zone] of Object.entries(ZONES)) {
    const { x0, x1, z0, z1 } = zone
    box(x0, 0, z0, x1, 0.06, z1, zone.floor, false)

    // The arch faces the avenue; the side walls of the lobby need no fence.
    const west = name === 'guns'
    const inner = west ? x1 : x0
    const c = midZ(zone) + (zone.gate ?? 0)
    fence('z', inner, z0, z1, [[c - ENTRANCE / 2 - 0.8, c + ENTRANCE / 2 + 0.8]], zone.rail, zone.post)
    archGate(inner, c, ENTRANCE, west ? 1 : -1, zone)

    const northGaps = west ? [[-23, -17]] : [SIDE_GAP]
    const southGaps = name === 'train' ? [SIDE_GAP] : []
    fence('x', z1, x0, x1, northGaps, zone.rail, zone.post)
    fence('x', z0, x0, x1, southGaps, zone.rail, zone.post)
  }

  // --- Gun zone --------------------------------------------------------------------
  // Two staggered rows along the west wall: the first thirteen on the ground, the
  // bigger, pricier ones on a ledge behind, half a step along so each sign shows
  // through a gap. A giant gun turns over a rock in the middle of the zone.
  const GUN_Z = midZ(ZONES.guns)
  const GUN_STEP = 3.9
  // 13 on the ground and the rest on the ledge. This is as many as the zone holds:
  // one more in the front row and its bottom pad pushes through the south fence.
  const FRONT_COUNT = 13
  const LEDGE_H = 1.2
  const rowHalf = ((FRONT_COUNT - 1) * GUN_STEP) / 2
  const frontStart = GUN_Z + rowHalf
  const gunPads = WINS_GUNS.map((gun, i) => {
    const back = i >= FRONT_COUNT
    const slot = back ? i - FRONT_COUNT : i
    return {
      gun,
      position: back
        ? [-(L - 2.4), LEDGE_H, frontStart - GUN_STEP / 2 - slot * GUN_STEP]
        : [-(L - 6.8), 0, frontStart - slot * GUN_STEP],
    }
  })
  // The ledge is one easy jump high, and runs the length of the back row rather than
  // the front one - the two rows are different lengths, and sizing it off the front
  // row left the last few back-row pads hanging over the end.
  const backTop = frontStart - GUN_STEP / 2
  const backBottom = backTop - (WINS_GUNS.length - FRONT_COUNT - 1) * GUN_STEP
  hill(-L, backBottom - 2.5, -(L - 4.4), backTop + 2.5, LEDGE_H)

  // Between the zone's entrance and the front row of guns.
  const STATUE_X = -18.5
  box(STATUE_X - 2, 0, GUN_Z - 2, STATUE_X + 2, 1.2, GUN_Z + 2, 'portalStone')
  box(STATUE_X - 1.2, 1.2, GUN_Z - 1.2, STATUE_X + 1.2, 1.8, GUN_Z + 1.2, 'portalStone')
  const statue = { position: [STATUE_X, 1.8, GUN_Z], gunId: 'divine' }
  for (const [dx, dz] of [[-2.6, 1.8], [2.4, -2.2], [1.8, 2.6]]) {
    crystals.push({ position: [STATUE_X + dx, 0, GUN_Z + dz], color: '#7fdcff', scale: 0.8 })
  }

  // The two VIP guns, on their own platform at the south end of the zone - past
  // the bottom of both shop rows, so there is no mistaking them for part of the
  // ladder.
  //
  // Sized and placed for the gaps AROUND it, not just for what stands on it. The
  // first cut was 13 wide and left half a unit between its edge and the front row's
  // pads, which is narrower than the player - you could not walk down your own shop.
  // Now there is a 3.5 lane on the row side and 3 on the fence side.
  const GUN_VIP = [-17.5, -23]
  const GUN_VIP_SPREAD = 2.4
  const gunVipY = vipPlatform(GUN_VIP[0], GUN_VIP[1], 4.5, 4.5, 'VIP GUNS')
  VIP_GUNS.forEach((gun, i) => {
    const dx = i === 0 ? -GUN_VIP_SPREAD : GUN_VIP_SPREAD
    gunPads.push({ gun, position: [GUN_VIP[0] + dx, gunVipY, GUN_VIP[1]] })
  })

  // --- Training zone ---------------------------------------------------------------
  // Two rows of four facing the avenue, the pricier row along the wall with its signs
  // raised. Pads are turned to face -X, which puts each dummy (DUMMY_OFFSET_Z in the
  // pad's own frame) on the wall side of its pad.
  const TRAIN_Z = midZ(ZONES.train)
  // Five a row at 3.8 apart is the most this zone takes: a wider step runs the end
  // pads through the fences, a sixth pad has them overlapping each other.
  const TRAINER_STEP = 3.8
  const PER_ROW = 5
  /** Z of the first pad in each row; both rows are centred on the zone. */
  const TRAINER_START = TRAIN_Z + ((PER_ROW - 1) * TRAINER_STEP) / 2
  const trainerPads = WINS_TRAINERS.map((trainer, i) => {
    const front = i < PER_ROW
    const slot = front ? i : i - PER_ROW
    return {
      trainer,
      // Both rows sit 0.8 further east than they used to. That spare room existed
      // between the back row's dummies and the lobby wall and was doing nothing,
      // while the lane on the other side had no room for the VIP deck AND a path.
      position: [front ? L - 12.4 : L - 4.4, 0, TRAINER_START - slot * TRAINER_STEP],
      rotationY: -Math.PI / 2,
      // The rows line up now rather than being staggered half a step - there is no
      // room left to stagger them - so the back row's signs ride higher instead.
      labelY: front ? 4.9 : 6.4,
    }
  })

  // The two VIP targets, on their own platform at the south end of the lane between
  // the avenue and the front row of Wins dummies.
  //
  // The deck's centre sits east of its pads on purpose: turned the same way as the
  // Wins rows, each dummy stands 2.6 further out in +X than its own pad, so centring
  // the pads would hang both dummies over the edge.
  //
  // What bounds it:
  //   west   the zone's fence, with the arch now well north of here (z 14..21)
  //   east   the front row of Wins dummies, whose pads start at x 19.8
  //   south  the gap cut in the south fence (x 17..23), a path in from the cross walk
  //   north  nothing until the arch - which is the point of having moved it
  const TRAIN_VIP = [15.1, 8.5]
  /** Pad centres, west of the deck's middle: each dummy stands 2.6 further east. */
  const TRAIN_VIP_PAD_X = 14.4
  const TRAIN_VIP_SPREAD = 2.1
  const trainVipY = vipPlatform(TRAIN_VIP[0], TRAIN_VIP[1], 2.9, 4.5, 'VIP TRAINING', { cx: 14, w: 3.2 })
  VIP_TRAINERS.forEach((trainer, i) => {
    trainerPads.push({
      trainer,
      position: [
        TRAIN_VIP_PAD_X,
        trainVipY,
        TRAIN_VIP[1] + (i === 0 ? -TRAIN_VIP_SPREAD : TRAIN_VIP_SPREAD),
      ],
      // Same turn as the Wins rows: the dummy ends up on the far side of its pad
      // from the walkway, and you face it with your back to the zone.
      rotationY: -Math.PI / 2,
      labelY: 4.9,
    })
  })

  // --- Egg zone --------------------------------------------------------------------
  // Two rows of five (one per egg), the pricier row on a ledge along the wall, the
  // back row offset half a step so each sign shows through the gap in front of it.
  const EGG_Z = midZ(ZONES.eggs)
  const EGG_PER_ROW = 5
  const EGG_STEP = 3.6
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

  // The VIP egg, on its own platform in the strip between the zone's arch and the
  // front row, at the south end where neither reaches.
  // Pushed south of the zone's arch opening (z -22..-15), which it used to sit in
  // the mouth of, and pulled in off both the fence and the front row.
  const EGG_VIP = [15.4, -26]
  /** The egg sits on the east half of the deck; the banner gets the west lane. */
  const EGG_VIP_X = 17.3
  const eggVipY = vipPlatform(EGG_VIP[0], EGG_VIP[1], 3.8, 3, 'VIP EGG', { cx: 13.2, w: 3.6 })
  for (const egg of VIP_EGGS) eggStands.push({ egg, position: [EGG_VIP_X, eggVipY, EGG_VIP[1]] })

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
  // [offset from the zone centre, is the big middle board]
  for (const [dz, big] of [[12, false], [0, true], [-12, false]]) {
    sideBillboard(-WALL_FACE, 1, GUN_Z + dz, big ? 9.2 : 8.4, big ? 11 : 9, big ? 4 : 3.5,
      ZONES.guns.board, 'GUNS', ZONES.guns.fill)
  }
  for (const dz of [5, -5]) {
    sideBillboard(WALL_FACE, -1, TRAIN_Z + dz, 7.6, 8, 3.4, ZONES.train.board, 'TRAIN', ZONES.train.fill)
    sideBillboard(WALL_FACE, -1, EGG_Z + dz * 1.1, 8, 8, 3.4, ZONES.eggs.board, 'EGGS', ZONES.eggs.fill)
  }

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
    const strips = [
      ...segments(-s1, s1).map(([a, b]) => [a, s0, b, s1]),
      ...[
        [-s1, -gateHalf],
        [gateHalf, s1],
      ].flatMap(([a0, a1]) => segments(a0, a1).map(([a, b]) => [a, -s1, b, -s0])),
      ...segments(-s0, s0).map(([a, b]) => [s0, a, s1, b]),
      ...segments(-s0, s0).map(([a, b]) => [-s1, a, -s0, b]),
    ]
    for (const [x0, z0, x1, z1] of strips) {
      const h = ringHeight[r]()
      hill(x0, z0, x1, z1, h)
      const cx = (x0 + x1) / 2 + (rand() - 0.5) * 2
      const cz = (z0 + z1) / 2 + (rand() - 0.5) * 2
      if (r > 0 && rand() < (r === 1 ? 0.2 : 0.45)) tree(cx, h, cz, pick([0.9, 1, 1.15]))
      else if (r < 2 && rand() < 0.12) crystals.push({ position: [cx, h, cz], color: '#7fdcff', scale: 0.8 })
    }
  }

  // --- Gate tower (holds wall 1) --------------------------------------------------
  const GZ0 = STAGE_START
  const GZ1 = GATE_Z
  box(-gateHalf, -1, GZ0, -OPEN_HALF, 14, GZ1, 'dark')
  box(OPEN_HALF, -1, GZ0, gateHalf, 14, GZ1, 'dark')
  box(-OPEN_HALF, OPEN_H, GZ0, OPEN_HALF, 14, GZ1, 'dark')
  box(-12, 14, GZ0 + 1, 12, 16, GZ1 - 1, 'dark')
  box(-9, 16, GZ0 + 1.5, 9, 18, GZ1 - 1.5, 'dark')
  box(-6, 18, GZ0 + 2, 6, 20, GZ1 - 2, 'dark')
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

  // --- Portals ---------------------------------------------------------------------
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

  // --- The Infinity Cave -------------------------------------------------------
  // One wall that never stays broken for long: past it there's no far side, just
  // the same spot, one number higher and a little tougher, forever. Its own small
  // room, well clear of the stage corridor; a magic door inside brings you back.
  const CAVE_X = 400
  const CAVE_LEN = 30
  const CAVE_HALF = CORRIDOR_HALF
  // You only ever arrive by portal, never by walking up to it, so the room has no
  // need of a real doorway anywhere - it's sealed solid on every side.
  const CAVE_FRONT = 2
  const cbox = (x0, y0, z0, x1, y1, z1, m, c) => box(CAVE_X + x0, y0, z0, CAVE_X + x1, y1, z1, m, c)
  const caveTheme = { floor: ['#c9b3ff', '#b79cf2'], side: '#5a3a9a', neon: '#b65cff' }
  const caveWallFront = -(CAVE_LEN - 3)
  const caveWallPosition = [CAVE_X, 0, caveWallFront]
  const caveEntrance = -2
  const caveSpawn = [CAVE_X, 2, caveEntrance - 3]

  cbox(-CAVE_HALF, -1, -CAVE_LEN, CAVE_HALF, 0, CAVE_FRONT, `floor:${caveTheme.floor.join(',')}`)
  for (const side of [-1, 1]) {
    const xin = side * CAVE_HALF
    const xout = side * (CAVE_HALF + WALL_T)
    const [xa, xb] = side < 0 ? [xout, xin] : [xin, xout]
    const [na, nb] = side < 0 ? [xin, xin + 0.12] : [xin - 0.12, xin]
    cbox(xa, -1, -CAVE_LEN, xb, WALL_H, CAVE_FRONT, `panel:${caveTheme.side}`)
    cbox(na, 0, -CAVE_LEN, nb, 0.25, CAVE_FRONT, `neon:${caveTheme.neon}`, false)
    cbox(na, WALL_H - 0.6, -CAVE_LEN, nb, WALL_H - 0.4, CAVE_FRONT, `neon:${caveTheme.neon}`, false)
  }
  // Seals the one side that would otherwise open onto nothing.
  cbox(-CAVE_HALF - WALL_T, -1, CAVE_FRONT - 1, CAVE_HALF + WALL_T, WALL_H, CAVE_FRONT, `panel:${caveTheme.side}`)
  // The wall itself is only as wide as its doorway (OPEN_HALF), narrower than the
  // room (CAVE_HALF) - this dark frame fills the gap on both sides and above it, the
  // same way `divider` does for every numbered stage wall, so there's no sliver of
  // daylight showing past its edges.
  cbox(-CAVE_HALF, -1, caveWallFront - 1, -OPEN_HALF, WALL_H, caveWallFront + 1, 'dark')
  cbox(OPEN_HALF, -1, caveWallFront - 1, CAVE_HALF, WALL_H, caveWallFront + 1, 'dark')
  cbox(-OPEN_HALF, OPEN_H, caveWallFront - 1, OPEN_HALF, WALL_H, caveWallFront + 1, 'dark')
  // A solid backstop directly behind the wall's own slab: it regenerates the
  // instant it breaks, but this guarantees nothing can ever be walked into.
  cbox(-OPEN_HALF, -1, caveWallFront - 1.6, OPEN_HALF, WALL_H, caveWallFront - 0.9, 'dark')
  roofs.push({ x0: CAVE_X - CAVE_HALF, x1: CAVE_X + CAVE_HALF, z0: -CAVE_LEN, z1: CAVE_FRONT, y: WALL_H - 0.01 })
  // On both side walls, not over the wall itself - it already shows its own
  // number and health bar, and the sign was fighting with them for the same spot.
  for (const side of [-1, 1]) {
    labels.push({
      lines: [
        { text: 'INFINITY CAVE', scale: 1.3, fill: ['#f3dcff', '#c07bff'] },
        { text: 'The wall keeps coming back - hit it for Wins!', scale: 0.55, fill: '#e2b8ff' },
      ],
      position: [CAVE_X + side * (CAVE_HALF - 0.05), 7, (caveWallFront + CAVE_FRONT) / 2],
      rotationY: -side * (Math.PI / 2),
      size: [12, 2.6],
      style: { bg: '#1c1230', border: '#c07bff' },
    })
  }

  // The magic door home, just inside the entrance.
  arch(CAVE_X, caveEntrance, 'z')
  portals.push({ position: [CAVE_X, 0, caveEntrance], rotationY: 0, target: SPAWN })
  labels.push({
    lines: ['MAGIC DOOR - BACK TO LOBBY'],
    position: [CAVE_X, 8.2, caveEntrance - 1.05],
    size: [9.6, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  // --- Portals -------------------------------------------------------------------
  // At the north end of the central path, behind the spawn, facing the gate. Open
  // to anyone at any time - no wall to break first.
  arch(0, L - 3, 'z')
  portals.push({ position: [0, 0, L - 3], rotationY: Math.PI, target: caveSpawn })
  labels.push({
    lines: ['INFINITY CAVE'],
    position: [0, 8.2, L - 4.05],
    rotationY: Math.PI,
    size: [8.4, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  arch(0, END_Z + 1, 'z')
  portals.push({ position: [0, 0, END_Z + 1], rotationY: 0, target: SPAWN })
  labels.push({
    lines: ['BACK TO LOBBY'],
    position: [0, 8.2, END_Z + 2.05],
    size: [8.4, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })

  // --- Welcome board at the north end, beside the portal ---------------------------
  // Posts sit behind the board so their faces don't fight with its front.
  box(10.4, 0, L - 2.4, 11.2, 9, L - 1.8, 'trunk')
  box(20.8, 0, L - 2.4, 21.6, 9, L - 1.8, 'trunk')
  box(10, 2.6, L - 3, 22, 8.6, L - 2.4, 'trunk')
  labels.push({
    lines: [
      { text: 'WELCOME!', scale: 1.5, fill: ['#fff6a8', '#ffc21a'] },
      'WASD run  -  Shift sprint  -  Space jump',
      `Click to shoot! Break ${WALLS_PER_STAGE} walls to clear a stage`,
      'Hold E on a Win pad to cash in',
      { text: `Rebirth ${BOSS_REBIRTHS}: Boss  -  Rebirth ${SPACE_REBIRTHS}: Space World`, fill: '#ffd0d0' },
      { text: 'Purple portal = Infinity Cave, open any time', fill: '#e2b8ff' },
    ],
    position: [16, 5.6, L - 3.04],
    rotationY: Math.PI,
    size: [11.4, 5.9],
    style: { bg: '#6b4424', border: '#4a2c14' },
  })

  // --- Leaderboards, east of the welcome board -------------------------------------
  // Three boards on one frame, the same height as the welcome board and built the
  // same way: posts and a backing beam behind, so nothing fights with their faces.
  box(23.2, 0, L - 2.4, 23.8, 9.6, L - 1.8, 'trunk')
  box(32.4, 0, L - 2.4, 33, 9.6, L - 1.8, 'trunk')
  box(22.6, 2.4, L - 3, 33.4, 8.8, L - 2.4, 'trunk')
  labels.push({
    lines: [{ text: 'LEADERBOARDS', fill: ['#fff6a8', '#ffc21a'] }],
    position: [28, 9.45, L - 3.04],
    rotationY: Math.PI,
    size: [7, 1.1],
    style: { bg: '#6b4424', border: '#4a2c14' },
  })
  const leaderboards = { center: [28, 5.6, L - 3.04], rotationY: Math.PI, width: 3.4, height: 3.4 * (900 / 512), gap: 0.15 }

  // --- Boss and Space World portals ----------------------------------------------
  // Side by side on the north plaza, west of the cave's, facing the gate - the same
  // walk from the spawn as the cave. Each refuses anyone short of its rebirths and
  // says how many more it wants.
  const BOSS_PORTAL_X = -13
  const SPACE_PORTAL_X = -26
  arch(BOSS_PORTAL_X, L - 3, 'z')
  arch(SPACE_PORTAL_X, L - 3, 'z')
  portals.push({
    position: [BOSS_PORTAL_X, 0, L - 3],
    rotationY: Math.PI,
    target: BOSS_SPAWN,
    requiresRebirths: BOSS_REBIRTHS,
    name: 'The Boss Arena',
    color: '#ff4a4a',
  })
  portals.push({
    position: [SPACE_PORTAL_X, 0, L - 3],
    rotationY: Math.PI,
    target: SPACE_SPAWN,
    requiresRebirths: SPACE_REBIRTHS,
    name: 'Space World',
    color: '#4fd8ff',
  })
  for (const [x, title, fill, need] of [
    [BOSS_PORTAL_X, 'BOSS FIGHT', ['#ffffff', '#ff6a6a'], BOSS_REBIRTHS],
    [SPACE_PORTAL_X, 'SPACE WORLD', ['#ffffff', '#ff7af5'], SPACE_REBIRTHS],
  ]) {
    labels.push({
      lines: [
        { text: title, scale: 1.2, fill },
        { text: `Rebirth ${need}`, scale: 0.85, fill: ['#ff9a9a', '#ff3030'] },
      ],
      position: [x, 9.9, L - 4.05],
      rotationY: Math.PI,
      size: [9, 2.6],
      style: {},
    })
  }

  // --- The Boss Arena -------------------------------------------------------------
  // A walled pit far to the north, open to the sky, with the boss at the south end
  // and the way home at the north. You only arrive by portal.
  const ARENA_Z = BOSS_CENTER[2]
  const ARENA_HALF = 24
  const ARENA_H = 14
  const ab = (x0, y0, z0, x1, y1, z1, m, c) => box(x0, y0, ARENA_Z + z0, x1, y1, ARENA_Z + z1, m, c)
  ab(-ARENA_HALF, -1, -ARENA_HALF, ARENA_HALF, 0, ARENA_HALF, 'floor:#5a3a3a,#4a2e30')
  for (const [x0, z0, x1, z1] of [
    [-ARENA_HALF - 2, -ARENA_HALF - 2, ARENA_HALF + 2, -ARENA_HALF],
    [-ARENA_HALF - 2, ARENA_HALF, ARENA_HALF + 2, ARENA_HALF + 2],
    [-ARENA_HALF - 2, -ARENA_HALF, -ARENA_HALF, ARENA_HALF],
    [ARENA_HALF, -ARENA_HALF, ARENA_HALF + 2, ARENA_HALF],
  ]) {
    ab(x0, -1, z0, x1, ARENA_H, z1, 'panel:#3a2030')
  }
  // Neon round the foot and the top of the walls, and a ring of pillars.
  for (const [x0, z0, x1, z1] of [
    [-ARENA_HALF, -ARENA_HALF, ARENA_HALF, -ARENA_HALF + 0.12],
    [-ARENA_HALF, ARENA_HALF - 0.12, ARENA_HALF, ARENA_HALF],
    [-ARENA_HALF, -ARENA_HALF, -ARENA_HALF + 0.12, ARENA_HALF],
    [ARENA_HALF - 0.12, -ARENA_HALF, ARENA_HALF, ARENA_HALF],
  ]) {
    ab(x0, 0, z0, x1, 0.25, z1, 'neon:#ff3b3b', false)
    ab(x0, ARENA_H - 0.6, z0, x1, ARENA_H - 0.4, z1, 'neon:#ff3b3b', false)
  }
  for (const [px, pz] of [[-16, -16], [16, -16], [-16, 8], [16, 8]]) {
    ab(px - 1, 0, pz - 1, px + 1, 7, pz + 1, 'portalStone')
    ab(px - 1.3, 7, pz - 1.3, px + 1.3, 7.5, pz + 1.3, 'neon:#ff6a3a', false)
  }
  // The boss's plinth.
  ab(-7, 0, -18, 7, 0.6, -6, 'panel:#2a1420')
  ab(-7, 0.6, -18, 7, 0.75, -17.8, 'neon:#ff3b3b', false)
  // The way home stands against the east wall, facing in, rather than behind the
  // arrival point: there, the camera would start the fight looking through it.
  const homeX = ARENA_HALF - 2
  const homeZ = ARENA_Z + 10
  arch(homeX, homeZ, 'x')
  portals.push({ position: [homeX, 0, homeZ], rotationY: -Math.PI / 2, target: SPAWN })
  labels.push({
    lines: ['MAGIC DOOR - BACK TO LOBBY'],
    position: [homeX - 1.05, 8.2, homeZ],
    rotationY: -Math.PI / 2,
    size: [9.6, 1],
    style: { fill: ['#f3dcff', '#c07bff'] },
  })
  for (const side of [-1, 1]) {
    labels.push({
      lines: [
        { text: 'BOSS ARENA', scale: 1.3, fill: ['#ffffff', '#ff6a6a'] },
        { text: 'Shoot the boss before the clock runs out!', scale: 0.55, fill: '#ffd0d0' },
      ],
      position: [side * (ARENA_HALF - 0.05), 9, ARENA_Z - 6],
      rotationY: -side * (Math.PI / 2),
      size: [14, 2.8],
      style: { bg: '#2a1018', border: '#ff4a4a' },
    })
  }

  // --- Space World ----------------------------------------------------------------
  // Its own small hub with its own gun shop and targets, and a corridor of ten walls
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

  // Space guns down the west side, space targets down the east.
  SPACE_GUNS.forEach((gun, i) => {
    gunPads.push({ gun, position: [SX - HUB_HALF + 8, 0, 14 - i * 8] })
  })
  SPACE_TRAINERS.forEach((trainer, i) => {
    trainerPads.push({
      trainer,
      position: [SX + HUB_HALF - 8, 0, 14 - i * 8],
      rotationY: -Math.PI / 2,
      labelY: 5.2,
    })
  })
  for (const [x, text, fill] of [
    [SX - HUB_HALF + 0.06, 'SPACE GUNS', ['#ffffff', '#ffd27a']],
    [SX + HUB_HALF - 0.06, 'SPACE TARGETS', ['#ffffff', '#7ff9ff']],
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
    cave: { position: caveWallPosition },
    boss: { position: BOSS_CENTER, arenaHalf: ARENA_HALF },
    leaderboards,
    space: { center: [SX, 0, 0], hubHalf: HUB_HALF, north: HUB_N },
    pads,
    crowns,
    crystals,
    labels,
    gunPads,
    trainerPads,
    eggStands,
    statue,
  }
}
