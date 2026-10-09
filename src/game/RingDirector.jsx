import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { AdditiveBlending, Vector3 } from 'three'

import { useBloxity } from '../bloxity/BloxityContext'
import { remotePositions, sendRingEnter, sendRingLeave, sendRingPunch, useLobby } from '../net/lobbyClient'
import { aim, setAimTarget } from './aim'
import { fightFx, fxFor, KO_S } from './fightFx'
import { formatNumber } from './format'
import { useGame } from './gameStore'
import { ringLocal as local } from './ringLocal'
import { ringEvents, ringLocked, ringOfPlayer, useRings } from './ringState'
import { RING_FLOOR, RING_HALF, ringExit, RINGS } from './rings'
import { playSound } from './sound'
import { SPAWN } from './world/themes'
import { createDynamicLabel, impactRingTexture, impactStarTexture } from './world/textures'

/** How long to wait before asking again to step into a ring the server said no to. */
const RETRY_ENTER_S = 1.2
/** How far from the camera a fight's knockout bell and crowd can be heard. */
const HEAR_DISTANCE = 45
/** A punch burst on whoever was hit, and the damage number over them. */
const POOL = 6
const BURST_S = 0.25
const NUMBER_S = 0.9
/** Chest height above a player's body centre. */
const CHEST = 0.35

const _from = new Vector3()

/**
 * Runs the local half of the boxing rings, every frame and on every message:
 *
 *   - punches thrown while fighting go to the server, which says what they did
 *   - while fighting, the player turns to face the opponent
 *   - a hit flinches whoever took it, with a burst and a damage number over them;
 *     a knockout drops the loser, the winner cheers, and the loser is sent back to
 *     the lobby once they have hit the canvas
 *   - anyone standing in a ring that fills up without them is put back outside
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
  const fx = useRef({
    next: 0,
    hits: Array.from({ length: POOL }, () => ({ at: -Infinity, pos: new Vector3(), big: false })),
  })
  useEffect(() => {
    labels.current = Array.from({ length: POOL }, () => createDynamicLabel({ aspect: 2.4, width: 256 }))
    return () => labels.current?.forEach((label) => label.texture.dispose())
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

  const teleport = (x, y, z) => {
    const body = bodyRef.current
    if (!body) return
    body.setTranslation({ x, y, z }, true)
    body.setLinvel({ x: 0, y: 0, z: 0 }, true)
  }

  // The server's news, wired into ringEvents for lobbyClient to call.
  useEffect(() => {
    ringEvents.hit = (message) => {
      const selfId = useLobby.getState().selfId
      const now = performance.now() / 1000
      fxFor(message.to, selfId).hurtAt = now
      if (message.to === selfId) playSound('hurt')
      else if (message.from === selfId) playSound('punchHit', { strength: Math.min(1, message.d / 10) })
      else if (!positionOf(message.to, _from) || _from.distanceTo(cameraPos.current) > HEAR_DISTANCE) return
      else playSound('punchHit', { strength: 0.4 })
      if (!positionOf(message.to, _from)) return
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
      fxFor(message.loser, selfId).koAt = now
      fxFor(message.winner, selfId).cheerAt = now + 0.4
      const ring = RINGS[message.r]
      const near = ring && Math.hypot(cameraPos.current.x - ring.x, cameraPos.current.z - ring.z) < HEAR_DISTANCE
      if (near || message.winner === selfId || message.loser === selfId) playSound('bell')
      const game = useGame.getState()
      if (message.loser === selfId) {
        game.notify(
          message.forfeit ? `You left the ring - ${nameOf(message.winner)} wins` : `Knocked out by ${nameOf(message.winner)}! Back to the lobby`,
          'error',
        )
        game.endRingStreak()
        playSound('ko')
        // Down on the canvas first, then home - unless they walked out, in which
        // case they are already on their way.
        local.koHome = message.forfeit ? 0 : now + KO_S - 0.3
        if (message.forfeit) fightFx.koAt = -Infinity
      } else if (message.winner === selfId) {
        game.winRingFight(message.reward, nameOf(message.loser))
        playSound('cheer')
      } else if (near) {
        playSound('cheer', { gain: 0.5 })
      }
    }

    ringEvents.deny = (message) => {
      if (message.reason !== 'full') return
      const ring = RINGS[message.r]
      if (!ring) return
      useGame.getState().notify(`${ring.name} is full - wait for this fight to finish!`, 'error')
      const [x, y, z] = ringExit(ring)
      teleport(x, y, z)
    }

    ringEvents.miss = () => playSound('whoosh')

    return () => {
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

  const cameraPos = useRef(new Vector3())
  const opponentAt = useRef([0, 0, 0])

  useFrame(({ camera }) => {
    cameraPos.current.copy(camera.position)
    const now = performance.now() / 1000
    const body = bodyRef.current
    const selfId = useLobby.getState().selfId
    const all = useRings.getState().rings
    const mine = ringOfPlayer(all, selfId)

    // Home after a knockout, once we have hit the canvas.
    if (local.koHome && now >= local.koHome) {
      local.koHome = 0
      teleport(SPAWN[0] + (Math.random() - 0.5) * 3, SPAWN[1], SPAWN[2] + (Math.random() - 0.5) * 2)
      if (local.inside >= 0) {
        sendRingLeave(local.inside)
        local.inside = -1
      }
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

    if (body) {
      const p = body.translation()
      // Standing in a ring that has filled up without us: out you go.
      for (const r of RINGS) {
        const inRing = Math.abs(p.x - r.x) < RING_HALF + 0.3 && Math.abs(p.z - r.z) < RING_HALF + 0.3 && p.y > RING_FLOOR
        if (!inRing) continue
        const st = all[r.id]
        if (ringLocked(st) && !st.f.includes(selfId) && selfId) {
          const [x, y, z] = ringExit(r)
          teleport(x, y, z)
          useGame.getState().notify(`${r.name} is taken - watch the fight from outside!`, 'error')
        }
      }
      // On a canvas the server has not let us onto yet (it may not have had our
      // position): ask again now and then while the ring is open.
      if (local.inside >= 0 && !mine && all[local.inside]?.s === 'open' && now - local.askedAt > RETRY_ENTER_S) {
        local.askedAt = now
        sendRingEnter(local.inside, useGame.getState().strength)
      }
    }

    // Bursts and damage numbers over whoever was hit.
    const s = fx.current
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
