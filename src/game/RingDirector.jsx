import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { AdditiveBlending, CanvasTexture, SRGBColorSpace, Vector3 } from 'three'

import { useBloxity } from '../bloxity/BloxityContext'
import { remotePositions, sendPadEnter, sendRingPunch, useLobby } from '../net/lobbyClient'
import { aim, setAimTarget } from './aim'
import { fightFx, fxFor, KO_S } from './fightFx'
import { FONT_WEIGHT, GAME_FONT } from './font'
import { formatNumber } from './format'
import { useGame } from './gameStore'
import { ringLocal as local } from './ringLocal'
import { ringEvents, ringOfPlayer, useRings } from './ringState'
import { CORNER_COLORS, exitSpot, fightSpot, RING_FLOOR, RING_HALF, RING_MAX_HP, ringExit, RINGS } from './rings'
import { playSound } from './sound'
import { SPAWN } from './world/themes'
import { createDynamicLabel, impactRingTexture, impactStarTexture } from './world/textures'

/** How long to wait before asking again for a pad the server has not given us. */
const RETRY_PAD_S = 1.2
/** How far from the camera a fight's knockout bell and crowd can be heard. */
const HEAR_DISTANCE = 45
/** A punch burst on whoever was hit, and the damage number over them. */
const POOL = 6
const BURST_S = 0.25
const NUMBER_S = 0.9
/** Chest height above a player's body centre. */
const CHEST = 0.35
/** The health bar over a fighter's head: its height above their centre and its size. */
const BAR_Y = 2.2
const BAR_W = 1.9
const BAR_H = 0.42

const _from = new Vector3()

/** Draws a fighter's name and health bar onto `ctx` (256 x 56). */
function drawBar(ctx, name, hp, slot) {
  const w = 256
  const h = 56
  ctx.clearRect(0, 0, w, h)
  ctx.font = `${FONT_WEIGHT.heavy} 18px ${GAME_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.lineJoin = 'round'
  ctx.lineWidth = 5
  ctx.strokeStyle = '#12131f'
  ctx.strokeText(name, w / 2, 12)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(name, w / 2, 12)
  const f = Math.max(0, Math.min(1, hp / RING_MAX_HP))
  ctx.fillStyle = '#12131f'
  ctx.beginPath()
  ctx.roundRect(6, 26, w - 12, 26, 13)
  ctx.fill()
  ctx.fillStyle = CORNER_COLORS[slot]
  ctx.beginPath()
  ctx.roundRect(8, 28, 22, 22, 11)
  ctx.fill()
  if (f > 0) {
    const grad = ctx.createLinearGradient(0, 30, 0, 50)
    const [top, bottom] = f > 0.5 ? ['#b4ff6e', '#22b81a'] : f > 0.25 ? ['#fff07a', '#e09400'] : ['#ffa08a', '#d62a1a']
    grad.addColorStop(0, top)
    grad.addColorStop(1, bottom)
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.roundRect(34, 30, (w - 44) * f, 18, 9)
    ctx.fill()
  }
}

/**
 * Runs the local half of the boxing rings, every frame and on every message:
 *
 *   - standing on a pad asks the server for it (again, now and then, if the server
 *     has not had our position yet); when two are on a ring's pads they are put in
 *     their corners and the fight starts
 *   - punches thrown while fighting go to the server, which says what they did
 *   - while fighting, the player turns to face the opponent
 *   - a hit flinches whoever took it, with a burst and a damage number over them;
 *     a knockout drops the loser, the winner cheers; then the loser goes back to the
 *     lobby and the winner steps out beside the ring
 *   - over every fighter's head, for everyone in the lobby, a name and a health bar
 *   - anyone on a canvas without being in its fight is put back outside
 *
 * Must be rendered inside <Physics>, with the player's body.
 */
export function RingDirector({ bodyRef }) {
  const { identity } = useBloxity()
  const myName = identity?.displayName || identity?.username || 'You'
  const myNameRef = useRef(myName)
  useEffect(() => {
    myNameRef.current = myName
  }, [myName])
  const nameOf = (id) => (id === useLobby.getState().selfId ? myNameRef.current : useLobby.getState().players[id]?.name ?? 'Player')

  const bursts = useRef([])
  const rings = useRef([])
  const numbers = useRef([])
  const labels = useRef(null)
  const bars = useRef([])
  const barLabels = useRef(null)
  const fx = useRef({
    next: 0,
    hits: Array.from({ length: POOL }, () => ({ at: -Infinity, pos: new Vector3(), big: false })),
    /** What each overhead bar last showed, so it is only redrawn on a change. */
    shown: [],
  })
  useEffect(() => {
    labels.current = Array.from({ length: POOL }, () => createDynamicLabel({ aspect: 2.4, width: 256 }))
    barLabels.current = Array.from({ length: RINGS.length * 2 }, () => {
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 56
      const texture = new CanvasTexture(canvas)
      texture.colorSpace = SRGBColorSpace
      return { ctx: canvas.getContext('2d'), texture }
    })
    return () => {
      labels.current?.forEach((label) => label.texture.dispose())
      barLabels.current?.forEach((bar) => bar.texture.dispose())
    }
  }, [])

  /** Where `id` is being drawn: our own body, or their played-back position. */
  const positionOf = (id, out) => {
    if (id === useLobby.getState().selfId) {
      const p = bodyRef.current?.translation()
      if (!p) return false
      out.set(p.x, p.y, p.z)
      return true
    }
    const p = remotePositions.get(id)
    if (!p) return false
    out.set(p.x, p.y, p.z)
    return true
  }

  const teleport = ([x, y, z]) => {
    const body = bodyRef.current
    if (!body) return
    body.setTranslation({ x, y, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  const cameraPos = useRef(new Vector3())
  const nearRing = (r) => {
    const ring = RINGS[r]
    return ring && Math.hypot(cameraPos.current.x - ring.x, cameraPos.current.z - ring.z) < HEAR_DISTANCE
  }

  // The server's news, wired into ringEvents for lobbyClient to call.
  useEffect(() => {
    ringEvents.start = (message) => {
      const selfId = useLobby.getState().selfId
      const slot = message.f.indexOf(selfId)
      if (slot >= 0) {
        // Off the pad and into our corner.
        local.pad = null
        local.homeAt = 0
        teleport(fightSpot(RINGS[message.r], slot))
        const opponent = nameOf(message.f[1 - slot])
        useGame.getState().notify(`${RINGS[message.r].name}: you vs ${opponent}! Get ready...`, 'success')
        playSound('bell')
      } else if (nearRing(message.r)) {
        playSound('bell')
      }
    }

    ringEvents.cancel = (message) => {
      const selfId = useLobby.getState().selfId
      if (message.f.includes(selfId)) {
        useGame.getState().notify('Your opponent left before the bell - fight called off')
        teleport(exitSpot(RINGS[message.r], 0))
      }
    }

    ringEvents.hit = (message) => {
      const selfId = useLobby.getState().selfId
      const now = performance.now() / 1000
      fxFor(message.to, selfId).hurtAt = now
      const mine = message.to === selfId || message.from === selfId
      if (message.to === selfId) playSound('hurt')
      else if (message.from === selfId) playSound('punchHit', { strength: Math.min(1, message.d / 10) })
      if (!positionOf(message.to, _from)) return
      if (!mine && _from.distanceTo(cameraPos.current) > HEAR_DISTANCE) return
      if (!mine) playSound('punchHit', { strength: 0.4 })
      const s = fx.current
      const i = s.next
      s.next = (i + 1) % POOL
      const hit = s.hits[i]
      hit.at = now
      hit.big = message.d >= 9
      hit.pos.set(_from.x, _from.y + CHEST, _from.z)
      // A little towards the puncher, so the burst sits on the front of them.
      if (positionOf(message.from, _from)) {
        const dx = _from.x - hit.pos.x
        const dz = _from.z - hit.pos.z
        const d = Math.hypot(dx, dz) || 1
        hit.pos.x += (dx / d) * 0.4
        hit.pos.z += (dz / d) * 0.4
      }
      labels.current?.[i]?.draw({
        lines: [{ text: `-${formatNumber(Math.max(1, Math.round(message.d)))}`, fill: hit.big ? ['#fff3a0', '#ff5a2a'] : ['#ffffff', '#ffb0a0'] }],
      })
      const number = numbers.current[i]
      if (number && labels.current) {
        number.material.map = labels.current[i].texture
        number.material.needsUpdate = true
      }
    }

    ringEvents.ko = (message) => {
      const selfId = useLobby.getState().selfId
      const now = performance.now() / 1000
      const ring = RINGS[message.r]
      const slot = message.f?.indexOf(selfId) ?? -1
      if (message.draw) {
        if (slot >= 0) {
          useGame.getState().notify("Time's up - it's a draw!")
          local.homeAt = now + KO_S - 0.4
          local.home = exitSpot(ring, slot)
        }
        if (slot >= 0 || nearRing(message.r)) playSound('bell')
        return
      }
      fxFor(message.loser, selfId).koAt = now
      fxFor(message.winner, selfId).cheerAt = now + 0.4
      if (slot >= 0 || nearRing(message.r)) playSound('bell')
      const game = useGame.getState()
      if (message.loser === selfId) {
        const by = nameOf(message.winner)
        game.notify(message.reason === 'decision' ? `Time's up - ${by} wins on points! Back to the lobby` : `Knocked out by ${by}! Back to the lobby`, 'error')
        game.endRingStreak()
        playSound('ko')
        // Down on the canvas first, then home.
        local.homeAt = now + KO_S - 0.3
        local.home = [SPAWN[0] + (Math.random() - 0.5) * 3, SPAWN[1], SPAWN[2] + (Math.random() - 0.5) * 2]
      } else if (message.winner === selfId) {
        game.winRingFight(message.reward, nameOf(message.loser))
        playSound('cheer')
        local.homeAt = now + KO_S - 0.4
        local.home = exitSpot(ring, slot)
      } else if (nearRing(message.r)) {
        playSound('cheer', { gain: 0.5 })
      }
    }

    ringEvents.deny = (message) => {
      if (message.reason === 'taken') useGame.getState().notify('Someone is already on that pad - try the other one!', 'error')
    }

    ringEvents.miss = () => playSound('whoosh')

    return () => {
      ringEvents.start = () => {}
      ringEvents.cancel = () => {}
      ringEvents.hit = () => {}
      ringEvents.ko = () => {}
      ringEvents.deny = () => {}
      ringEvents.miss = () => {}
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Punches thrown while fighting go to the server, with how strong we are now.
  useEffect(
    () =>
      useGame.subscribe((state, prev) => {
        if (state.punchCount <= prev.punchCount) return
        const selfId = useLobby.getState().selfId
        const mine = ringOfPlayer(useRings.getState().rings, selfId)
        if (!mine) return
        if (useRings.getState().rings[mine.index].s !== 'fight') return
        sendRingPunch(mine.index, state.strength)
      }),
    [],
  )

  const opponentAt = useRef([0, 0, 0])

  useFrame(({ camera }) => {
    cameraPos.current.copy(camera.position)
    const now = performance.now() / 1000
    const body = bodyRef.current
    const selfId = useLobby.getState().selfId
    const all = useRings.getState().rings
    const mine = ringOfPlayer(all, selfId)

    // Out of the ring once the fight is over: home for the loser, beside the ring
    // for the winner.
    if (local.homeAt && now >= local.homeAt) {
      local.homeAt = 0
      if (local.home) teleport(local.home)
      local.home = null
      fightFx.koAt = -Infinity
    }

    // Fighting: face the opponent.
    const ring = mine ? all[mine.index] : null
    const opponent = ring ? ring.f[1 - mine.slot] : null
    if (opponent && ring.s !== 'ko' && positionOf(opponent, _from)) {
      opponentAt.current[0] = _from.x
      opponentAt.current[1] = _from.y + CHEST
      opponentAt.current[2] = _from.z
      setAimTarget(opponentAt.current, 0.45, true)
    } else if (aim.ring) {
      setAimTarget(null)
    }

    if (body && selfId) {
      const p = body.translation()
      // On a canvas without being in its fight (a teleport gone astray, a fight that
      // ended without us noticing): back outside.
      for (const r of RINGS) {
        const inRing = Math.abs(p.x - r.x) < RING_HALF + 0.3 && Math.abs(p.z - r.z) < RING_HALF + 0.3 && p.y > RING_FLOOR
        if (inRing && !all[r.id].f.includes(selfId) && !local.homeAt) {
          teleport(ringExit(r))
          useGame.getState().notify('Stand on a pad beside the ring to fight!', 'error')
        }
      }
      // On a pad the server has not given us yet (it may not have had our position):
      // ask again now and then.
      if (local.pad && !mine) {
        const st = all[local.pad.r]
        if (st && st.p[local.pad.slot] !== selfId && now - local.askedAt > RETRY_PAD_S) {
          local.askedAt = now
          sendPadEnter(local.pad.r, local.pad.slot, useGame.getState().strength)
        }
      }
    }

    // A name and health bar over every fighter's head.
    const s = fx.current
    for (let r = 0; r < RINGS.length; r++) {
      const st = all[r]
      const on = st.s !== 'open'
      for (let slot = 0; slot < 2; slot++) {
        const i = r * 2 + slot
        const bar = bars.current[i]
        if (!bar) continue
        const id = on ? st.f[slot] : null
        const placed = id && positionOf(id, _from)
        bar.visible = Boolean(placed)
        if (!placed) continue
        bar.position.set(_from.x, _from.y + BAR_Y, _from.z)
        bar.quaternion.copy(camera.quaternion)
        const key = `${nameOf(id)}|${Math.ceil(st.hp[slot])}`
        if (s.shown[i] !== key && barLabels.current) {
          s.shown[i] = key
          const { ctx, texture } = barLabels.current[i]
          drawBar(ctx, nameOf(id), st.hp[slot], slot)
          texture.needsUpdate = true
          if (bar.material.map !== texture) {
            bar.material.map = texture
            bar.material.needsUpdate = true
          }
        }
      }
    }

    // Bursts and damage numbers over whoever was hit.
    for (let i = 0; i < POOL; i++) {
      const hit = s.hits[i]
      const age = now - hit.at
      const burst = bursts.current[i]
      const ringFx = rings.current[i]
      const number = numbers.current[i]
      if (burst) {
        burst.visible = age >= 0 && age < BURST_S
        if (burst.visible) {
          const k = age / BURST_S
          burst.position.copy(hit.pos)
          burst.scale.setScalar((hit.big ? 1.5 : 1.05) * (0.5 + 0.8 * Math.sqrt(k)))
          burst.material.opacity = 1 - k * k
          burst.material.rotation = i + k
        }
      }
      if (ringFx) {
        ringFx.visible = age >= 0 && age < BURST_S * 1.4
        if (ringFx.visible) {
          const k = age / (BURST_S * 1.4)
          ringFx.position.copy(hit.pos)
          ringFx.scale.setScalar((hit.big ? 1.8 : 1.2) * (0.4 + 1.4 * k))
          ringFx.material.opacity = (1 - k) * 0.85
        }
      }
      if (number) {
        number.visible = age >= 0 && age < NUMBER_S
        if (number.visible) {
          const k = age / NUMBER_S
          number.position.set(hit.pos.x, hit.pos.y + 0.9 + k * 1.2, hit.pos.z)
          number.quaternion.copy(camera.quaternion)
          number.material.opacity = 1 - k * k
        }
      }
    }
  })

  return (
    <>
      {Array.from({ length: RINGS.length * 2 }, (_, i) => (
        <mesh
          key={`bar${i}`}
          ref={(el) => {
            bars.current[i] = el
          }}
          visible={false}
          renderOrder={5}
        >
          <planeGeometry args={[BAR_W, BAR_H]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}
      {Array.from({ length: POOL }, (_, i) => (
        <group key={i}>
          <sprite
            ref={(el) => {
              bursts.current[i] = el
            }}
            visible={false}
            renderOrder={3}
          >
            <spriteMaterial map={impactStarTexture()} color="#fff0d0" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
          <sprite
            ref={(el) => {
              rings.current[i] = el
            }}
            visible={false}
            renderOrder={3}
          >
            <spriteMaterial map={impactRingTexture()} color="#ff7a5a" transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
          <mesh
            ref={(el) => {
              numbers.current[i] = el
            }}
            visible={false}
            renderOrder={4}
          >
            <planeGeometry args={[1.5, 0.62]} />
            <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </>
  )
}

export default RingDirector
