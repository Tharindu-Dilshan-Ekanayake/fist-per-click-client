import { WALLS_PER_STAGE } from '../walls'

/**
 * Map dimensions and per-stage themes.
 *
 * Coordinates: +Y up, the lobby is centred on the origin, and the stages run off
 * towards -Z behind the gate. One unit is roughly one metre (the player is 1.8 tall).
 */

/** Half-size of the flat lobby plaza. */
export const LOBBY_HALF = 34
/** Depth of each terrace ring around the lobby. */
export const RING = 6

/** Inner half-width of the stage corridor. */
export const CORRIDOR_HALF = 12
/** Thickness of the corridor side walls. */
export const WALL_T = 2
/** Height of corridor walls. */
export const WALL_H = 12

/** The doorway every stage wall sits in. */
export const OPEN_HALF = 8
export const OPEN_H = 10

/** Z of the gate tower's front face (the lobby's south edge); wall 1 lives here. */
export const GATE_Z = -LOBBY_HALF
/** Z where stage 1's corridor begins (the back of the gate tower). */
export const STAGE_START = GATE_Z - 6
/*
 * Each stage is a tunnel of WALLS_PER_STAGE walls, one straight after another, that
 * opens into the stage's cabin: an open room with a small room either side. The
 * first wall sits in the gate at the tunnel's mouth (the lobby's gate tower for
 * stage 1, the far end of the previous cabin after that).
 */
/** Front-to-front distance between consecutive walls in a tunnel. */
export const WALL_GAP = 4.5
/** Depth of the dark frame each wall sits in. */
export const DIVIDER_T = 2
/** Floor between the back of a stage's gate and its second wall (as between the rest). */
export const TUNNEL_LEAD = WALL_GAP - DIVIDER_T
/** Length of a stage's cabin. */
export const CABIN_LEN = 44
/** From one stage's gate (back face) to the next's. */
export const STAGE_LEN = TUNNEL_LEAD + (WALLS_PER_STAGE - 2) * WALL_GAP + DIVIDER_T + CABIN_LEN + DIVIDER_T

/** Near the north end of the central path, facing the gate. */
export const SPAWN = [0, 2, LOBBY_HALF - 12]

/**
 * Where the boss fight is: the middle of an arena far north of everything else.
 * You arrive at its north end, facing the boss in the south.
 */
export const BOSS_CENTER = [0, 0, 420]
export const BOSS_SPAWN = [0, 2, BOSS_CENTER[2] + 14]

/** Space World's hub is four hundred metres west of the lobby; you arrive in it here. */
export const SPACE_SPAWN = [-400, 2, 18]

/** Cyan used for every stage-wall frame. */
export const FRAME_COLOR = '#6ff7ff'

const DEFAULT_FLOOR = ['#c9ccdb', '#abafc4']

/**
 * One entry per stage; all ten of a stage's walls share its look.
 *
 * wall.style: 'cobble' | 'crystal' | 'lava' (voronoi rock), 'stones' (big rounded
 *             blocks), 'bricks', 'planks'
 * wall.glow:  emissive strength of the wall surface (0 = none)
 * wall.moss:  leaves growing over it
 * side:       tint for the corridor's panelled walls
 * neon:       strip-light colour along the corridor
 */
export const THEMES = [
  {
    name: 'Stone',
    wall: { style: 'stones', palette: ['#b9c0cc', '#a7afbd', '#c8ced9', '#9aa2b1'], gap: '#474c57', moss: true },
    side: '#6a70a8',
    neon: '#62f3ff',
  },
  {
    name: 'Wood',
    wall: { style: 'planks', palette: ['#b07540', '#a0662f', '#c0844b', '#8f5a2a'], gap: '#4a2a12' },
    side: '#8a6fb0',
    neon: '#ffd166',
  },
  {
    name: 'Sandstone',
    wall: { style: 'bricks', palette: ['#e8c784', '#dcb86f', '#f0d396', '#d1ab60'], gap: '#a47d3e' },
    side: '#b08a58',
    neon: '#ffe08a',
    floor: ['#f2e6c9', '#e2d2ad'],
  },
  {
    name: 'Ice',
    wall: { style: 'cobble', palette: ['#cdefff', '#b5e3fb', '#e4f7ff', '#a6d8f5'], gap: '#5aa7d6', glow: 0.25 },
    side: '#6aa6d8',
    neon: '#9ff3ff',
    floor: ['#e8f6ff', '#cfe8f7'],
  },
  {
    name: 'Jungle',
    wall: { style: 'cobble', palette: ['#5e9e46', '#6fb34f', '#4f8c3c', '#7cc05a'], gap: '#2f4d24', moss: true },
    side: '#5c9a5a',
    neon: '#8dff6a',
  },
  {
    name: 'Brick',
    wall: { style: 'bricks', palette: ['#c0492f', '#b23f27', '#cf5637', '#a3391f'], gap: '#e2d3c0' },
    side: '#b0605a',
    neon: '#ff7b6b',
  },
  {
    name: 'Gold',
    wall: { style: 'bricks', palette: ['#f5c542', '#e8b52f', '#ffd457', '#dba623'], gap: '#9c7415', glow: 0.2 },
    side: '#c2a24a',
    neon: '#fff08a',
    floor: ['#fbf1d2', '#eedfae'],
  },
  {
    name: 'Amethyst',
    wall: { style: 'crystal', palette: ['#9b5de5', '#b47cff', '#7f47d1', '#c79bff'], gap: '#f0d9ff', glow: 0.35 },
    side: '#8a5ac8',
    neon: '#d59bff',
  },
  {
    name: 'Obsidian',
    wall: { style: 'cobble', palette: ['#2a2238', '#342a46', '#231c30', '#3b2f52'], gap: '#b44cff', glow: 0.6 },
    side: '#4a3a6a',
    neon: '#b65cff',
    floor: ['#b9b3c9', '#a39cb6'],
  },
  {
    name: 'Emerald',
    wall: { style: 'bricks', palette: ['#2fbf71', '#27a862', '#3ad07f', '#219457'], gap: '#0f5a33', glow: 0.15 },
    side: '#3f9a86',
    neon: '#5affc8',
  },
  {
    name: 'Lava',
    wall: { style: 'lava', palette: ['#e2531f', '#ef6a2a', '#d6441a', '#f47b33'], gap: '#7a1a08', glow: 0.7 },
    side: '#7a3d5a',
    neon: '#ff9b3d',
    floor: ['#c9bfc4', '#b2a7ad'],
  },
  {
    name: 'Diamond',
    wall: { style: 'crystal', palette: ['#9ff3ff', '#7fe6fb', '#bff8ff', '#6cd3f0'], gap: '#ffffff', glow: 0.45 },
    side: '#5a8ad0',
    neon: '#7ff9ff',
  },
  {
    name: 'Coral',
    wall: { style: 'bricks', palette: ['#ff6f91', '#ff8fa3', '#ff4d6d', '#ffb3c1'], gap: '#7a1f3d' },
    side: '#ff8fa3',
    neon: '#ff4d6d',
    floor: ['#ffe3ea', '#ffc2d1'],
  },
  {
    name: 'Toxic',
    wall: { style: 'crystal', palette: ['#aaff00', '#c6ff33', '#7acc00', '#e2ff80'], gap: '#2f4d0a', glow: 0.5 },
    side: '#7acc00',
    neon: '#c6ff33',
  },
  {
    name: 'Blood Moon',
    wall: { style: 'stones', palette: ['#5c0a0a', '#7a1414', '#4a0808', '#8f1f1f'], gap: '#1a0202', glow: 0.3 },
    side: '#7a1414',
    neon: '#ff3b3b',
    floor: ['#2a1010', '#1a0808'],
  },
  {
    name: 'Tundra',
    wall: { style: 'cobble', palette: ['#8fd0ff', '#6bb8f0', '#a6e0ff', '#5aa7d6'], gap: '#3a6a8a', glow: 0.3 },
    side: '#5a8ad0',
    neon: '#8fd0ff',
    floor: ['#d8f0ff', '#b8e0f5'],
  },
  {
    name: 'Ash Volcano',
    wall: { style: 'lava', palette: ['#4a2020', '#6a2a1a', '#3a1515', '#8a3a20'], gap: '#1a0808', glow: 0.8 },
    side: '#5a3030',
    neon: '#ff5a2e',
    floor: ['#3a3538', '#2a2528'],
  },
  {
    name: 'Celestial',
    wall: { style: 'crystal', palette: ['#ff7af5', '#7ff9ff', '#ffe94a', '#b65cff'], gap: '#ffffff', glow: 0.9 },
    side: '#8a5ac8',
    neon: '#ff7af5',
    floor: ['#e8d8ff', '#d0b8f0'],
  },
].map((theme) => ({ floor: DEFAULT_FLOOR, ...theme }))

export const STAGE_COUNT = THEMES.length

/** Z where stage `k` (1-based) begins: the back face of the gate holding its first wall. */
export const stageStart = (k) => STAGE_START - (k - 1) * STAGE_LEN

/** Z where stage `k`'s tunnel of walls opens into its cabin. */
export const cabinStart = (k) => stageStart(k) - (TUNNEL_LEAD + (WALLS_PER_STAGE - 2) * WALL_GAP + DIVIDER_T)

/** Z of the far end of stage `k`'s cabin: the front face of the next stage's gate. */
export const cabinEnd = (k) => cabinStart(k) - CABIN_LEN

/** Front face of the closed wall at the far end of the last cabin. */
export const END_Z = cabinEnd(STAGE_COUNT)
