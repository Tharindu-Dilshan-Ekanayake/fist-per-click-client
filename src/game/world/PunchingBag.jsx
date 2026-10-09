import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BoxGeometry, CapsuleGeometry, CylinderGeometry, TorusGeometry, Vector3 } from 'three'

import { setAimTarget } from '../aim'
import { formatBonus, formatNumber } from '../format'
import { useGame } from '../gameStore'
import { BAG_OFFSET_Z, rebirthsShort } from '../trainers'
import { remoteStates, useLobby } from '../../net/lobbyClient'
import { Label, Sparkle } from './Effects'
import { geometry, merge } from './geometry'
import InteractPrompt from './InteractPrompt'
import PadGlow from './PadGlow'
import { labelTexture, radialGlowTexture, shade, studTexture } from './textures'

/** A bag's multiplier as a sign shows it: 1.5 stays 1.5, 6000 becomes 6K. */
const times = (m) => (m < 1000 ? formatBonus(m) : formatNumber(m))

/** Delay from click to impact: the time the glove takes to get there. */
const HIT_DELAY_S = 0.09
const FLASH_S = 0.3
const POPUP_S = 0.9
/** Popups are pooled; this many can be on screen at once. */
const POPUP_COUNT = 6
/** Pad size: a big square tile, the way the reference game lays them out. */
const PAD = 4.6
/** The bag: radius, the length of its straight middle, and how high its centre hangs. */
const BAG_R = 0.55
const BAG_LEN = 1.15
const BAG_Y = 1.6
/** How far in front of the bag's surface the player steps in to punch it. */
const STAND_OFF = 0.62
/** Where it hangs from: the end of the stand's arm. */
const PIVOT_Y = 3.55
/** Pendulum: stiffness (g / length) and damping, and the kick a punch gives it. */
const SWING_K = 14
const SWING_DAMP = 2.6
const KICK = 2.4
/** How brightly the pad's glow shines: dim while locked, brightest while training. */
const STATUS_GLOW = {
  active: 1.2,
  unlocked: 0.85,
  affordable: 0.85,
  locked: 0.45,
  /** Wants rebirths first. Dim like `locked`, because that is what it is. */
  rebirth: 0.45,
}
const GEM = ['#d6f6ff', '#2fa8ff']

const _up = new Vector3(0, 1, 0)

/**
 * The stand the bag hangs from - a base plate, a post behind the bag and an arm
 * reaching over it - as one geometry, shared by every pad. They all take the same
 * steel, so there was never a reason to draw them apart.
 */
const standBody = () =>
  geometry('bag-stand', () => {
    const box = (w, h, d, x, y, z) => {
      const g = new BoxGeometry(w, h, d)
      g.translate(x, y, z)
      return g
    }
    const back = -1.05
    return merge([
      box(1.3, 0.14, 0.9, 0, 0.07, back),
      box(0.22, PIVOT_Y + 0.2, 0.22, 0, (PIVOT_Y + 0.2) / 2, back),
      box(0.18, 0.2, 1.25, 0, PIVOT_Y + 0.1, back / 2 + 0.02),
      // A brace from the post up under the arm.
      (() => {
        const g = new BoxGeometry(0.12, 0.9, 0.12)
        g.rotateX(-0.75)
        g.translate(0, PIVOT_Y - 0.35, back + 0.3)
        return g
      })(),
    ])
  })

/** The chain from the arm down to the bag's cap. */
const chainGeometry = () =>
  geometry('bag-chain', () => {
    const links = []
    const top = 0
    const bottom = -(PIVOT_Y - (BAG_Y + BAG_LEN / 2 + BAG_R) - 0.05)
    const n = 6
    for (let i = 0; i < n; i++) {
      const g = new TorusGeometry(0.06, 0.018, 6, 10)
      if (i % 2) g.rotateY(Math.PI / 2)
      g.translate(0, top + ((bottom - top) * (i + 0.5)) / n, 0)
      links.push(g)
    }
    return merge(links)
  })

const bagGeometry = () => geometry('bag-body', () => new CapsuleGeometry(BAG_R, BAG_LEN, 8, 24))
const capGeometry = () =>
  geometry('bag-cap', () => {
    const g = new CylinderGeometry(BAG_R * 0.72, BAG_R * 0.92, 0.22, 24)
    g.translate(0, BAG_LEN / 2 + BAG_R * 0.62, 0)
    return g
  })
const bandGeometry = () =>
  geometry('bag-bands', () => {
    const band = (y) => {
      const g = new CylinderGeometry(BAG_R + 0.012, BAG_R + 0.012, 0.16, 24, 1, true)
      g.translate(0, y, 0)
      return g
    }
    return merge([band(BAG_LEN / 2 - 0.08), band(-BAG_LEN / 2 + 0.08)])
  })

// Small canvas: a new texture is cached for every distinct gain shown.
const popupTexture = (gain) =>
  labelTexture({ lines: [{ text: `+${formatNumber(gain)}`, icon: 'fist', fill: ['#fff6a8', '#ffc21a'] }], aspect: 2.4, width: 256 })

/**
 * A heavy bag hanging over its training pad. Stepping on an unlocked pad starts
 * training - the gloves go to work on the bag by themselves; on a locked one an E
 * prompt offers to unlock it, and only E spends the Wins. Every punch while training
 * sends the bag swinging, squashes it, flashes it and floats up a "+N" for the
 * Strength gained.
 *
 * @param {{ trainer: object, position: number[], rotationY?: number, labelY?: number }} props
 *   The bag hangs on the pad's local -Z side; `rotationY` turns the whole pad.
 */
export function PunchingBag({ trainer, position, rotationY = 0, labelY = 5.4 }) {
  // 'rebirth' outranks the Wins states on the top three bags: a price you could
  // pay is the wrong thing to show someone who cannot buy it at any price yet.
  const localStatus = useGame((s) =>
    s.activeTrainer === trainer.id
      ? 'active'
      : s.unlockedTrainers.includes(trainer.id)
        ? 'unlocked'
        : rebirthsShort(trainer, s.rebirths) > 0
          ? 'rebirth'
          : s.wins >= trainer.cost
            ? 'affordable'
            : 'locked',
  )
  const rebirthsToGo = useGame((s) => rebirthsShort(trainer, s.rebirths))
  // Someone else training here shows the same glow, even though it's not us -
  // other players' pads should look alive to us too.
  const remoteActive = useLobby((s) => Object.values(s.players).some((p) => p.trainer === trainer.id))
  const status = localStatus === 'active' || remoteActive ? 'active' : localStatus
  const active = status === 'active'
  const offered = useGame((s) => s.interact?.kind === 'trainer' && s.interact.id === trainer.id)

  const swing = useRef(null)
  const bag = useRef(null)
  const flash = useRef(null)
  const padMaterial = useRef(null)
  const popups = useRef([])
  const fx = useRef({ seenPunch: -Infinity, hitAt: -Infinity, pending: [], angle: 0, speed: 0, next: 0, spawned: [], remoteSw: new Map() })
  /** The bag's middle in world space, for turning to face it and the punch bursts. */
  const center = useMemo(() => {
    const p = new Vector3(0, BAG_Y - 0.1, BAG_OFFSET_Z).applyAxisAngle(_up, rotationY)
    return [position[0] + p.x, position[1] + p.y, position[2] + p.z]
  }, [position, rotationY])
  /** Where to stand to hit it: a glove's reach in front of it. */
  const spot = useMemo(() => {
    const p = new Vector3(0, 0, BAG_OFFSET_Z + BAG_R + STAND_OFF).applyAxisAngle(_up, rotationY)
    return [position[0] + p.x, position[2] + p.z]
  }, [position, rotationY])

  /** The bag's own logo: its multiplier, big. */
  const logo = useMemo(
    () =>
      labelTexture({
        lines: [{ text: `x${times(trainer.multiplier)}`, fill: ['#ffffff', shade(trainer.band, 0.2)] }],
        aspect: 1.5,
        width: 256,
      }),
    [trainer],
  )

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()
    if (game.activeTrainer === trainer.id) setAimTarget(center, BAG_R)

    // A fresh punch while training here: queue the impact and a number popup. The
    // freshness check stops a punch thrown before stepping on from counting as a hit.
    if (game.activeTrainer === trainer.id && game.punchAt > s.seenPunch && now - game.punchAt < 0.2) {
      s.seenPunch = game.punchAt
      s.pending.push(game.punchAt + HIT_DELAY_S)
      const i = s.next
      s.next = (i + 1) % POPUP_COUNT
      s.spawned[i] = game.punchAt + HIT_DELAY_S
      const mesh = popups.current[i]
      if (mesh) {
        mesh.material.map = popupTexture(game.lastGain)
        mesh.userData.x = (Math.random() - 0.5) * 1.4
      }
    }

    // Other players' punches while training here: the same swing and flash, just
    // without a number popup - we don't know their exact gain. Detected off their
    // already-networked position track (its punch counter), not a separate message,
    // so no extra traffic.
    for (const [id, p] of Object.entries(useLobby.getState().players)) {
      if (p.trainer !== trainer.id) continue
      const track = remoteStates.get(id)
      if (!track) continue
      const seen = s.remoteSw.get(id) ?? track.sw
      if (track.sw > seen) s.pending.push(now + HIT_DELAY_S)
      s.remoteSw.set(id, track.sw)
    }

    // Punches landing: a kick to the pendulum each.
    while (s.pending.length && s.pending[0] <= now) {
      s.pending.shift()
      s.hitAt = now
      s.speed += KICK * (0.8 + Math.random() * 0.4)
    }

    // Swinging on its chain: a damped pendulum, integrated in small steps.
    const dt = Math.min(delta, 0.05)
    s.speed += (-SWING_K * Math.sin(s.angle) - SWING_DAMP * s.speed) * dt
    s.angle += s.speed * dt
    if (swing.current) {
      swing.current.rotation.x = s.angle
      swing.current.rotation.z = Math.sin(now * 1.3 + position[0]) * 0.015
    }
    // Squashed where the glove went in, bulging round it.
    const t = now - s.hitAt
    if (bag.current) {
      const k = t >= 0 && t < 0.35 ? Math.exp(-t * 14) * Math.cos(t * 40) : 0
      bag.current.scale.set(1 + 0.08 * k, 1 - 0.05 * k, 1 - 0.12 * k)
    }
    if (flash.current) {
      // Not drawn at all between punches: a quad at zero opacity is still a draw.
      const o = t >= 0 && t < FLASH_S ? 0.9 * (1 - t / FLASH_S) : 0
      flash.current.opacity = o
      flash.current.visible = o > 0
    }
    if (padMaterial.current) {
      padMaterial.current.emissiveIntensity = active
        ? 0.6 + 0.25 * Math.sin(clock.elapsedTime * 5)
        : status === 'locked'
          ? 0.08
          : trainer.vip
            ? 0.4 + 0.2 * Math.sin(clock.elapsedTime * 3)
            : 0.3
    }

    popups.current.forEach((mesh, i) => {
      if (!mesh) return
      const age = now - (s.spawned[i] ?? -Infinity)
      mesh.visible = age >= 0 && age < POPUP_S
      if (!mesh.visible) return
      mesh.position.set(mesh.userData.x ?? 0, BAG_Y + 1.1 + age * 1.8, BAG_OFFSET_Z + 0.9)
      mesh.material.opacity = 1 - (age / POPUP_S) ** 2
      // Face the camera: undo the pad's own turn, then apply the camera's rotation.
      mesh.quaternion.setFromAxisAngle(_up, -rotationY).multiply(camera.quaternion)
    })
  })

  const onEnter = ({ other }) => {
    // Local -Z (towards the bag) is world yaw rotationY + π.
    if (other.rigidBodyObject?.name === 'player') useGame.getState().enterTrainer(trainer.id, rotationY + Math.PI, spot)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    if (useGame.getState().activeTrainer === trainer.id) setAimTarget(null)
    useGame.getState().leaveTrainer(trainer.id)
  }

  const statusLine =
    status === 'active'
      ? { text: 'TRAINING!', fill: '#7dff6a' }
      : status === 'unlocked'
        ? { text: trainer.cost === 0 ? 'FREE' : 'UNLOCKED', fill: '#7fd8ff' }
        : status === 'rebirth'
          ? {
              text: `${trainer.rebirths} Rebirth${trainer.rebirths === 1 ? '' : 's'} Needed`,
              icon: 'star',
              fill: ['#ffb0b0', '#ff3b3b'],
            }
          : {
              text: `${formatNumber(trainer.cost)} Wins`,
              icon: 'trophy',
              fill: status === 'affordable' ? ['#fff6a8', '#ffc21a'] : ['#ffd0d0', '#ff7a7a'],
            }

  const band = trainer.band ?? '#ffffff'
  return (
    <group position={position} rotation={[0, rotationY, 0]} name="bag">
      {/* Studded square tile on a darker trim. */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[PAD + 0.5, 0.16, PAD + 0.5]} />
        <meshStandardMaterial color={shade(trainer.color, -0.45)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[PAD, 0.2, PAD]} />
        <meshStandardMaterial
          ref={padMaterial}
          map={studTexture([trainer.color, shade(trainer.color, 0.12)], { cells: 2, studsPerCell: 4 })}
          emissive={trainer.color}
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Neon rim and rings rising off the pad, in its colour. */}
      <PadGlow
        color={trainer.color}
        size={PAD + 0.5}
        y={0.235}
        rise={2.4}
        level={STATUS_GLOW[status]}
        sparkles={active ? 10 : 4}
        phase={position[0]}
      />

      <group position={[0, 0, BAG_OFFSET_Z]}>
        {/* The stand: steel, one shape, one draw. */}
        <mesh geometry={standBody()} castShadow receiveShadow>
          <meshStandardMaterial color="#2c3140" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.16, -1.05]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.32, 20]} />
          <meshStandardMaterial color={trainer.color} emissive={trainer.color} emissiveIntensity={0.4} />
        </mesh>

        {/* The bag, swinging from the end of the arm. */}
        <group ref={swing} position={[0, PIVOT_Y, 0]}>
          <mesh geometry={chainGeometry()}>
            <meshStandardMaterial color="#b9c0cc" metalness={0.9} roughness={0.25} />
          </mesh>
          <group ref={bag} position={[0, BAG_Y - PIVOT_Y, 0]}>
            <mesh geometry={bagGeometry()} castShadow receiveShadow>
              <meshPhysicalMaterial color={trainer.color} roughness={0.38} clearcoat={0.8} clearcoatRoughness={0.3} />
            </mesh>
            <mesh geometry={capGeometry()} castShadow>
              <meshStandardMaterial color="#1e2230" roughness={0.5} metalness={0.3} />
            </mesh>
            <mesh geometry={bandGeometry()}>
              <meshStandardMaterial color={band} roughness={0.5} emissive={band} emissiveIntensity={trainer.vip ? 0.35 : 0.08} />
            </mesh>
            {/* Its logo, front and back. */}
            <>
              {[1, -1].map((face) => (
                <mesh key={face} position={[0, 0.05, face * (BAG_R + 0.02)]} rotation={[0, face > 0 ? 0 : Math.PI, 0]}>
                  <planeGeometry args={[0.78, 0.52]} />
                  <meshBasicMaterial map={logo} transparent depthWrite={false} toneMapped={false} />
                </mesh>
              ))}
            </>
            <mesh position={[0, 0.05, BAG_R + 0.1]}>
              <planeGeometry args={[1.8, 1.8]} />
              <meshBasicMaterial
                ref={flash}
                map={radialGlowTexture()}
                color="#fff3b0"
                transparent
                opacity={0}
                blending={AdditiveBlending}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          </group>
        </group>
      </group>

      {active && (
        <Sparkle
          count={24}
          scale={[2.6, 3.2, 2.6]}
          position={[0, BAG_Y, BAG_OFFSET_Z]}
          size={5}
          speed={0.8}
          color={trainer.color}
        />
      )}

      {Array.from({ length: POPUP_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
        >
          <planeGeometry args={[1.92, 0.8]} />
          <meshBasicMaterial map={popupTexture(1)} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <Billboard position={[0, labelY, BAG_OFFSET_Z]}>
        <Label
          lines={[
            ...(trainer.vip ? [{ text: 'VIP', scale: 0.7, fill: GEM }] : []),
            { text: `x${times(trainer.multiplier)} Strength`, scale: 1.25, fill: ['#ffffff', '#9dff8a'] },
            { text: trainer.name, scale: 0.75, fill: ['#ffffff', '#dfe9ff'] },
            statusLine,
          ]}
          position={[0, 0, 0]}
          size={[3.8, trainer.vip ? 2.3 : 2]}
          style={{ width: 512 }}
        />
      </Billboard>

      {offered && (status === 'affordable' || status === 'locked' || status === 'rebirth') && (
        <InteractPrompt
          position={[0, 2.4, BAG_OFFSET_Z / 2]}
          action="Unlock"
          title={`${trainer.name} · x${trainer.multiplier}`}
          detail={
            status === 'rebirth'
              ? `⭐ ${trainer.rebirths} Rebirths · ${rebirthsToGo} to go`
              : `🏆 ${formatNumber(trainer.cost)} Wins${status === 'locked' ? ' · not enough Wins' : ''}`
          }
          tone={status === 'locked' || status === 'rebirth' ? 'warn' : 'normal'}
        />
      )}

      <RigidBody type="fixed" colliders={false}>
        {/* The bag and its stand are solid, so you can't walk through them. */}
        <CuboidCollider args={[BAG_R, BAG_LEN / 2 + BAG_R, BAG_R]} position={[0, BAG_Y, BAG_OFFSET_Z]} />
        <CuboidCollider args={[0.65, PIVOT_Y / 2, 0.45]} position={[0, PIVOT_Y / 2, BAG_OFFSET_Z - 1.05]} />
        <CuboidCollider
          sensor
          args={[PAD / 2 - 0.2, 1, PAD / 2 - 0.2]}
          position={[0, 1, 0.3]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default PunchingBag
