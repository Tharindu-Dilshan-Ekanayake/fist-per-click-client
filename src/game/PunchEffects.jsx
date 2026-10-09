import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import { AdditiveBlending, Vector3 } from 'three'

import { aim } from './aim'
import { useGame } from './gameStore'
import { getGlove } from './gloves'
import { playerPosition } from './playerAnchor'
import { impactRingTexture, impactStarTexture, labelTexture } from './world/textures'
import { isSpaceWall } from './walls'
import { OPEN_HALF, SPACE_SPAWN } from './world/themes'

/** Punches that can be landing at once; an OP auto clicker keeps about three going. */
const POOL = 8
/** From the click to the glove arriving: the strike reaches full stretch about here. */
const LAND_S = 0.09
/** How long the starburst and the shock ring last. */
const BURST_S = 0.22
const RING_S = 0.32
/** How long a comic "POW!" hangs about, and how often one turns up. */
const WORD_S = 0.6
const WORD_CHANCE = 0.22
const WORDS = ['POW!', 'BAM!', 'WHAM!', 'SMASH!', 'BOOM!']
const WORD_FILLS = [
  ['#fff6a8', '#ffb31a'],
  ['#ffffff', '#5cd2ff'],
  ['#ffe3f4', '#ff4fb8'],
]
/** How far in front of the player an air punch lands, and at what height. */
const REACH = 1.15
const CHEST = 0.35

const _here = new Vector3()
const _to = new Vector3()
const _away = new Vector3()

const wordTexture = (i) =>
  labelTexture({ lines: [{ text: WORDS[i % WORDS.length], fill: WORD_FILLS[i % WORD_FILLS.length] }], aspect: 2.2, width: 256 })

/**
 * What a punch looks like landing: a starburst where the glove hits - the bag on
 * your pad, the wall in front of you, your opponent in the ring, or just
 * the air - a shock ring spreading off it in the gloves' colour, and now and then a
 * comic "POW!".
 *
 * Local punches only. Other players' are already told by their swing and their
 * sound, and every burst in an eight-player lobby would be a lot of light for very
 * little.
 *
 * @param {{ bodyRef: React.MutableRefObject<any>, anchorRef: React.MutableRefObject<any> }} props
 */
export function PunchEffects({ bodyRef, anchorRef }) {
  const stars = useRef([])
  const rings = useRef([])
  const words = useRef([])
  const state = useRef({
    seen: -Infinity,
    next: 0,
    hits: Array.from({ length: POOL }, () => ({ at: -Infinity, word: -1, spin: 0, size: 1, to: new Vector3() })),
  })

  useFrame(({ camera }) => {
    const now = performance.now() / 1000
    const s = state.current
    const game = useGame.getState()

    if (game.punchAt > s.seen) {
      s.seen = game.punchAt
      if (playerPosition(anchorRef, bodyRef, _here)) {
        const fx = Math.sin(aim.yaw)
        const fz = Math.cos(aim.yaw)
        if (aim.target && (game.activeTrainer || aim.ring)) {
          // On the near face of whatever is being hit, not in its middle.
          _to.set(aim.target[0], aim.target[1], aim.target[2])
          _away.set(_here.x - _to.x, 0, _here.z - _to.z)
          if (_away.lengthSq() > 1e-4) _to.addScaledVector(_away.normalize(), aim.radius ?? 0.5)
        } else if (game.nearWall) {
          // Straight at the wall, at about chest height, wherever along it you stand.
          const cx = isSpaceWall(game.nearWall.number) ? SPACE_SPAWN[0] : 0
          const x = Math.max(cx - OPEN_HALF + 1, Math.min(cx + OPEN_HALF - 1, _here.x))
          const side = _here.z > game.nearWall.z ? 1 : -1
          _to.set(x, _here.y + CHEST, game.nearWall.z + side * 0.45)
        } else {
          _to.set(_here.x + fx * REACH, _here.y + CHEST, _here.z + fz * REACH)
        }
        const glove = getGlove(game.equipped)
        const i = s.next
        s.next = (s.next + 1) % POOL
        const hit = s.hits[i]
        hit.at = game.punchAt + LAND_S
        hit.to.copy(_to)
        hit.spin = Math.random() * Math.PI * 2
        hit.size = 0.9 + Math.min(0.8, glove.size - 1) + Math.random() * 0.2
        hit.word = Math.random() < WORD_CHANCE ? Math.floor(Math.random() * 15) : -1
        stars.current[i]?.material.color.set('#fff3c4')
        rings.current[i]?.material.color.set(glove.trim)
        const word = words.current[i]
        if (word && hit.word >= 0) {
          word.material.map = wordTexture(hit.word)
          word.material.needsUpdate = true
        }
      }
    }

    for (let i = 0; i < POOL; i++) {
      const hit = s.hits[i]
      const star = stars.current[i]
      const ring = rings.current[i]
      const word = words.current[i]
      if (!star || !ring || !word) continue
      const age = now - hit.at

      star.visible = age >= 0 && age < BURST_S
      if (star.visible) {
        const k = age / BURST_S
        star.position.copy(hit.to)
        star.scale.setScalar(hit.size * (0.55 + 0.7 * Math.sqrt(k)))
        star.material.rotation = hit.spin + k * 0.6
        star.material.opacity = 1 - k * k
      }

      ring.visible = age >= 0 && age < RING_S
      if (ring.visible) {
        const k = age / RING_S
        ring.position.copy(hit.to)
        ring.scale.setScalar(hit.size * (0.4 + 1.6 * k))
        ring.material.opacity = (1 - k) * 0.9
      }

      word.visible = hit.word >= 0 && age >= 0 && age < WORD_S
      if (word.visible) {
        const k = age / WORD_S
        word.position.set(hit.to.x, hit.to.y + 0.5 + k * 0.6, hit.to.z)
        // Pops in big, settles, then fades.
        const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.65 : 1.25 - Math.min(0.25, (k - 0.15) * 0.6)
        word.scale.set(1.5 * pop, 0.68 * pop, 1)
        word.quaternion.copy(camera.quaternion)
        word.material.opacity = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3
      }
    }
  })

  return (
    <>
      {Array.from({ length: POOL }, (_, i) => (
        <sprite
          key={`s${i}`}
          ref={(el) => {
            stars.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={impactStarTexture()} transparent blending={AdditiveBlending} depthWrite={false} depthTest={false} toneMapped={false} />
        </sprite>
      ))}
      {Array.from({ length: POOL }, (_, i) => (
        <sprite
          key={`r${i}`}
          ref={(el) => {
            rings.current[i] = el
          }}
          visible={false}
          renderOrder={3}
        >
          <spriteMaterial map={impactRingTexture()} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
        </sprite>
      ))}
      {Array.from({ length: POOL }, (_, i) => (
        <mesh
          key={`w${i}`}
          ref={(el) => {
            words.current[i] = el
          }}
          visible={false}
          renderOrder={4}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={wordTexture(0)} transparent depthWrite={false} depthTest={false} toneMapped={false} />
        </mesh>
      ))}
    </>
  )
}

export default PunchEffects
