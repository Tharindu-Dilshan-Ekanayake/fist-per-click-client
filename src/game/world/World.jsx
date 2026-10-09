import { useFrame } from '@react-three/fiber'
import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Object3D, Vector3 } from 'three'

import { useGame } from '../gameStore'
import { playerPosition } from '../playerAnchor'
import { getGun } from '../guns'
import { qualityOf, useSettings } from '../settings'
import BossArena from './BossArena'
import Leaderboards from './Leaderboards'
import { Backdrop, Clouds, Crown, Crystal, GlowPad, Label, Sky } from './Effects'
import EggStand from './EggStand'
import GateSign from './GateSign'
import GunPad from './GunPad'
import GunStatue from './GunStatue'
import InfinityWall from './InfinityWall'
import LobbyPathArrows from './LobbyPathArrows'
import { buildLayout } from './layout'
import { ShaderWarmup, useBand, useNearField, WARMUP_VIEW } from './nearField'
import Portal, { CENTER_Y as PORTAL_Y, LIGHT_Z as PORTAL_LIGHT_Z } from './Portal'
import Roofs from './Roofs'
import SpaceDecor from './SpaceDecor'
import StageWall from './StageWall'
import StaticBlocks from './StaticBlocks'
import { GATE_Z } from './themes'
import TrainingDummy from './TrainingDummy'
import WinPad from './WinPad'

/**
 * This far into a lobby, every broken wall rebuilds. Space World's hub and the boss
 * arena both sit on the lobby's side of this line, so they count as lobbies too.
 */
const LOBBY_RESET_Z = GATE_Z + 6

/** Where each kind of thing sits, for the distance test. */
const atWall = (wall) => [wall.x ?? 0, 0, wall.zFront]
const atPosition = (item) => item.position

/**
 * One memoised list per kind of thing on the map.
 *
 * Crossing a band re-renders World, and without these that meant rebuilding every
 * React element in the map - several hundred of them - for the sake of the one wall
 * that came into range. `useNear` hands each list back its previous array when the
 * membership has not changed, and memo turns that into a skipped render: walking
 * down a corridor now re-renders the wall list and nothing else.
 *
 * The items are memoised too, so even a list that did change only does work for what
 * actually entered or left it. That holds because buildLayout() runs once and the
 * `pad`, `position`, `theme` and `gun` objects spread below are the same references
 * every time - anything added here has to keep that property, which means building
 * its props in the layout rather than in the JSX.
 */
/**
 * The parts of the map that never change, held still.
 *
 * World re-renders whenever the mounted set moves, and without this every one of
 * those renders rebuilt these too - StaticBlocks above all, which is a fixed body
 * holding *two and a half thousand* CuboidCollider elements. Recreating those was
 * the whole of the stutter: about 60ms in a frame, every sixteen metres, which is a
 * lurch every seven or eight steps at a walking pace. None of them take a prop that
 * ever changes, so none of them ever need to render twice.
 */
const StaticMap = memo(StaticBlocks)
const Ceilings = memo(Roofs)
const SkyDome = memo(Sky)
const CloudLayer = memo(Clouds)
const Ground = memo(Backdrop)
const Gate = memo(GateSign)
const Cave = memo(InfinityWall)
const Statue = memo(GunStatue)
const Arena = memo(BossArena)
const Boards = memo(Leaderboards)
const Space = memo(SpaceDecor)

const Wall = memo(StageWall)
const Win = memo(WinPad)
const PortalArch = memo(Portal)
const Glow = memo(GlowPad)
const Gold = memo(Crown)
const Shard = memo(Crystal)
const Sign = memo(Label)
const Gun = memo(GunPad)
const Dummy = memo(TrainingDummy)
const Egg = memo(EggStand)

const Walls = memo(function Walls({ items }) {
  return items.map((wall) => <Wall key={wall.number} {...wall} />)
})
const WinPads = memo(function WinPads({ items }) {
  return items.map((pad) => <Win key={`${pad.number}:${pad.pad.id}`} {...pad} />)
})
const Portals = memo(function Portals({ items }) {
  return items.map((portal) => <PortalArch key={`${portal.position}`} {...portal} />)
})
const GlowPads = memo(function GlowPads({ items }) {
  return items.map((pad) => <Glow key={`${pad.position}`} {...pad} />)
})
const Crowns = memo(function Crowns({ items }) {
  return items.map((crown) => <Gold key={`${crown.position}`} {...crown} />)
})
const Crystals = memo(function Crystals({ items }) {
  return items.map((crystal) => <Shard key={`${crystal.position}`} {...crystal} />)
})
const Labels = memo(function Labels({ items }) {
  return items.map((label) => <Sign key={`${label.position}`} {...label} />)
})
const GunPads = memo(function GunPads({ items }) {
  return items.map((pad) => <Gun key={pad.gun.id} {...pad} />)
})
const TrainerPads = memo(function TrainerPads({ items }) {
  return items.map((pad) => <Dummy key={pad.trainer.id} {...pad} />)
})
const EggStands = memo(function EggStands({ items }) {
  return items.map((stand) => <Egg key={stand.egg.id} {...stand} />)
})

/** How far the portal light reaches, and how far away it stops being worth lighting. */
const PORTAL_LIGHT_RANGE = 16
const PORTAL_LIGHT_INTENSITY = 25

/**
 * The one purple light every portal shares.
 *
 * It is here, and always mounted, for a reason worth stating plainly: three.js bakes
 * the number of lights into every shader it compiles, so a scene going from one point
 * light to none rebuilds the shader of every material in view - hundreds of
 * milliseconds, in one frame, on the spot. With a light on each portal that happened
 * every time the player walked out of range of one and again when they came back,
 * which is exactly the stutter-at-the-same-distance this map had.
 *
 * So there is exactly one, for the whole game, and it never leaves. It moves to
 * whichever portal is nearest and fades out when none is close, and fading is free:
 * intensity is a uniform, not part of the shader.
 */
function PortalLight({ portals, bodyRef }) {
  const light = useRef(null)

  useFrame(() => {
    const l = light.current
    const p = bodyRef.current?.translation()
    if (!l || !p) return

    let nearest = null
    let nearestSq = Infinity
    for (const portal of portals) {
      const dx = portal.position[0] - p.x
      const dz = portal.position[2] - p.z
      const d = dx * dx + dz * dz
      if (d < nearestSq) {
        nearestSq = d
        nearest = portal
      }
    }
    if (!nearest) return

    // The light hangs in front of the arch, so it follows the portal's own facing.
    const yaw = nearest.rotationY ?? 0
    l.position.set(
      nearest.position[0] + Math.sin(yaw) * PORTAL_LIGHT_Z,
      nearest.position[1] + PORTAL_Y,
      nearest.position[2] + Math.cos(yaw) * PORTAL_LIGHT_Z,
    )
    // Out of reach anyway: nothing to light, so stop paying for it.
    l.intensity = nearestSq > (PORTAL_LIGHT_RANGE * 2) ** 2 ? 0 : PORTAL_LIGHT_INTENSITY
  })

  return <pointLight ref={light} color="#b35cff" intensity={0} distance={PORTAL_LIGHT_RANGE} />
}

/**
 * Walking back into the lobby starts a short countdown (shown above stage 1's gate,
 * the only broken wall visible from there) before every broken wall rebuilds.
 *
 * Its own component so the check runs in one place, off the physics body, without
 * re-rendering anything.
 */
function WallReset({ bodyRef }) {
  useFrame(() => {
    const game = useGame.getState()
    if (game.wallsResetAt !== null && performance.now() / 1000 >= game.wallsResetAt) game.resetWalls()

    const p = bodyRef.current?.translation()
    if (!p) return
    if (p.z > LOBBY_RESET_Z) game.scheduleWallReset()
    else game.cancelWallReset()
  })
  return null
}

/**
 * The whole map: the lobby, the gate, and every stage corridor behind it.
 *
 * Only what is near the player is mounted (see nearField.js). The static blocks are
 * the exception - they are already merged down to a couple of dozen meshes by
 * material, so mounting them all costs less than re-merging them every time the
 * player walks sixteen metres.
 *
 * Must be rendered inside <Physics>. `bodyRef` is the player's body.
 */
export function World({ bodyRef }) {
  const layout = useMemo(() => buildLayout(), [])
  const quality = useSettings((s) => qualityOf(s.quality).view)
  const band = useBand(bodyRef)

  // The first frame mounts wide, so ShaderWarmup has one of everything to compile;
  // after that the graphics level's own distance takes over.
  const [warmed, setWarmed] = useState(false)
  const onWarm = useCallback(() => setWarmed(true), [])
  const view = warmed ? quality : Math.max(quality, WARMUP_VIEW)

  // Stable for the life of the component: buildLayout runs once.
  const fields = useMemo(
    () => [
      { key: 'walls', list: layout.walls, at: atWall },
      { key: 'winPads', list: layout.winPads, at: atPosition },
      { key: 'portals', list: layout.portals, at: atPosition },
      { key: 'pads', list: layout.pads, at: atPosition },
      { key: 'crowns', list: layout.crowns, at: atPosition },
      { key: 'crystals', list: layout.crystals, at: atPosition },
      { key: 'labels', list: layout.labels, at: atPosition },
      { key: 'gunPads', list: layout.gunPads, at: atPosition },
      { key: 'trainerPads', list: layout.trainerPads, at: atPosition },
      { key: 'eggStands', list: layout.eggStands, at: atPosition },
    ],
    [layout],
  )
  const near = useNearField(fields, band, view)
  // Looked up once: a fresh lookup every render would defeat Statue's memo.
  const statueGun = useMemo(() => getGun(layout.statue.gunId), [layout])

  return (
    <>
      <SkyDome />
      <CloudLayer />
      <Ground />
      <StaticMap blocks={layout.blocks} />
      <LobbyPathArrows />
      <Ceilings roofs={layout.roofs} />
      <WallReset bodyRef={bodyRef} />
      <Gate />
      <Boards {...layout.leaderboards} />
      <Cave position={layout.cave.position} />
      <Arena position={layout.boss.position} arenaHalf={layout.boss.arenaHalf} bodyRef={bodyRef} />
      <Space center={layout.space.center} />

      <Walls items={near.walls} />
      <WinPads items={near.winPads} />
      <Portals items={near.portals} />
      <PortalLight portals={layout.portals} bodyRef={bodyRef} />
      <GlowPads items={near.pads} />
      <Crowns items={near.crowns} />
      <Crystals items={near.crystals} />
      <Labels items={near.labels} />
      <GunPads items={near.gunPads} />
      <TrainerPads items={near.trainerPads} />
      <EggStands items={near.eggStands} />

      <Statue position={layout.statue.position} gun={statueGun} />
      {/* Mounted for good, not just until it is done: it holds the warm-up's shaders
          for the whole session, and unmounting it threw them all away the moment the
          world shrank back to its real view distance. */}
      <ShaderWarmup onDone={onWarm} />
    </>
  )
}

const _sun = new Vector3()

const SUN_OFFSET = [30, 50, 20]
const SHADOW_EXTENT = 45

/**
 * Directional sunlight whose shadow camera follows the player. The map is far bigger
 * than one shadow map can cover crisply, so only the area around the player casts.
 *
 * @param {{ bodyRef: React.MutableRefObject<any> }} props
 */
export function SunLight({ bodyRef, anchorRef }) {
  const light = useRef(null)
  const target = useMemo(() => new Object3D(), [])
  // Sized by the graphics level: a 2048 map is four times the fill of a 1024 one,
  // every frame, for a difference you have to stand still to notice.
  const size = useSettings((s) => qualityOf(s.quality).shadowMap)

  useFrame(() => {
    // The eased position again: a shadow camera stepping in physics ticks makes
    // every shadow edge in the scene crawl (see playerAnchor.js).
    if (!light.current || !playerPosition(anchorRef, bodyRef, _sun)) return
    light.current.position.set(_sun.x + SUN_OFFSET[0], _sun.y + SUN_OFFSET[1], _sun.z + SUN_OFFSET[2])
    target.position.copy(_sun)
    target.updateMatrixWorld()
  })

  return (
    <>
      <primitive object={target} />
      <directionalLight
        // Remounts the light when the level changes, which is what forces the
        // shadow map to be reallocated at the new size.
        key={size}
        ref={light}
        target={target}
        castShadow
        intensity={1.35}
        shadow-mapSize={[size, size]}
        shadow-camera-left={-SHADOW_EXTENT}
        shadow-camera-right={SHADOW_EXTENT}
        shadow-camera-top={SHADOW_EXTENT}
        shadow-camera-bottom={-SHADOW_EXTENT}
        shadow-camera-near={1}
        shadow-camera-far={160}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}

export default World
