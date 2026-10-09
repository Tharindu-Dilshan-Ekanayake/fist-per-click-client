import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import { AdditiveBlending, BoxGeometry, Vector3 } from 'three'

import { setAimTarget } from '../aim'
import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { DUMMY_OFFSET_Z, rebirthsShort } from '../trainers'
import { remoteStates, useLobby } from '../../net/lobbyClient'
import { Label, Sparkle } from './Effects'
import { geometry, merge } from './geometry'
import InteractPrompt from './InteractPrompt'
import PadGlow from './PadGlow'
import { labelTexture, radialGlowTexture, shade, studTexture, targetTexture } from './textures'

/** Delay from click to impact: the time the bullet takes to get there. */
const HIT_DELAY_S = 0.06
const WOBBLE_S = 0.6
const FLASH_S = 0.3
const POPUP_S = 0.9
/** Popups are pooled; this many can be on screen at once. */
const POPUP_COUNT = 6
/** Height of the bullseye's centre, and its radius. */
const HEAD_Y = 2.2
const FACE_R = 1.05
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
 * The stand a target hangs on - a post, two splayed legs behind it and a backing
 * board - as one geometry, shared by every pad. They all take the same wood, so
 * there was never a reason to draw them apart.
 */
const standBody = () =>
  geometry('target-stand', () => {
    const box = (w, h, d, x, y, z, rx = 0) => {
      const g = new BoxGeometry(w, h, d)
      if (rx) g.rotateX(rx)
      g.translate(x, y, z)
      return g
    }
    return merge([
      box(0.22, HEAD_Y, 0.22, 0, HEAD_Y / 2, -0.25),
      box(0.18, 2.1, 0.18, -0.55, 1, -0.55, -0.35),
      box(0.18, 2.1, 0.18, 0.55, 1, -0.55, -0.35),
      box(FACE_R * 2.05, FACE_R * 2.05, 0.16, 0, HEAD_Y, -0.12),
    ])
  })

// Small canvas: a new texture is cached for every distinct gain shown.
const popupTexture = (gain) =>
  labelTexture({ lines: [{ text: `+${formatNumber(gain)}`, icon: 'ammo', fill: ['#fff6a8', '#ffc21a'] }], aspect: 2.4, width: 256 })

/**
 * A shooting target on its pad. Stepping on an unlocked pad starts training; on a
 * locked one an E prompt offers to unlock it, and only E spends the Wins. Every
 * shot while training rocks the target, flashes the bullseye and floats up a "+N"
 * for the Ammo gained.
 *
 * @param {{ trainer: object, position: number[], rotationY?: number, labelY?: number }} props
 *   The target stands on the pad's local -Z side; `rotationY` turns the whole pad.
 */
export function TrainingDummy({ trainer, position, rotationY = 0, labelY = 4.9 }) {
  // 'rebirth' outranks the Wins states on the top three targets: a price you could
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
  // Someone else training here shows the same "TRAINING!" glow, even though it's
  // not us - other players' training pads should look alive to us too.
  const remoteActive = useLobby((s) => Object.values(s.players).some((p) => p.trainer === trainer.id))
  const status = localStatus === 'active' || remoteActive ? 'active' : localStatus
  const active = status === 'active'
  const offered = useGame((s) => s.interact?.kind === 'trainer' && s.interact.id === trainer.id)

  const dummy = useRef(null)
  const flash = useRef(null)
  const padMaterial = useRef(null)
  const popups = useRef([])
  const fx = useRef({ seenSwing: -Infinity, hitAt: -Infinity, next: 0, spawned: [], remoteSw: new Map() })
  /** The bullseye's centre in world space, for the tracers to fly at. */
  const bullseye = useMemo(() => {
    const p = new Vector3(0, HEAD_Y, DUMMY_OFFSET_Z).applyAxisAngle(_up, rotationY)
    return [position[0] + p.x, position[1] + p.y, position[2] + p.z]
  }, [position, rotationY])

  useFrame(({ camera, clock }) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()
    if (game.activeTrainer === trainer.id) setAimTarget(bullseye)

    // A fresh shot while training here: queue the impact and a number popup. The
    // freshness check stops a shot fired before stepping on from counting as a hit.
    if (game.activeTrainer === trainer.id && game.shotAt > s.seenSwing && now - game.shotAt < 0.2) {
      s.seenSwing = game.shotAt
      s.hitAt = game.shotAt + HIT_DELAY_S
      const i = s.next
      s.next = (i + 1) % POPUP_COUNT
      s.spawned[i] = s.hitAt
      const mesh = popups.current[i]
      if (mesh) {
        mesh.material.map = popupTexture(game.lastGain)
        mesh.userData.x = (Math.random() - 0.5) * 1.4
      }
    }

    // Other players' shots while training here: the same wobble and flash, just
    // without a number popup - we don't know their exact Ammo gain. Detected off
    // their already-networked position track (its shot counter), not a separate
    // message, so no extra traffic.
    for (const [id, p] of Object.entries(useLobby.getState().players)) {
      if (p.trainer !== trainer.id) continue
      const track = remoteStates.get(id)
      if (!track) continue
      const seen = s.remoteSw.get(id) ?? track.sw
      if (track.sw > seen) s.hitAt = now
      s.remoteSw.set(id, track.sw)
    }

    // Knocked back, then a damped rock about the base.
    const t = now - s.hitAt
    if (dummy.current) {
      dummy.current.rotation.x = t >= 0 && t < WOBBLE_S ? -0.3 * Math.exp(-t * 6) * Math.cos(t * 22) : 0
    }
    if (flash.current) flash.current.opacity = t >= 0 && t < FLASH_S ? 1 - t / FLASH_S : 0
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
      mesh.position.set(mesh.userData.x ?? 0, HEAD_Y + 0.8 + age * 1.8, DUMMY_OFFSET_Z + 0.6)
      mesh.material.opacity = 1 - (age / POPUP_S) ** 2
      // Face the camera: undo the pad's own turn, then apply the camera's rotation.
      mesh.quaternion.setFromAxisAngle(_up, -rotationY).multiply(camera.quaternion)
    })
  })

  const onEnter = ({ other }) => {
    // Local -Z (towards the target) is world yaw rotationY + π.
    if (other.rigidBodyObject?.name === 'player') useGame.getState().enterTrainer(trainer.id, rotationY + Math.PI)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    if (useGame.getState().activeTrainer === trainer.id) setAimTarget(null)
    useGame.getState().leaveTrainer(trainer.id)
  }

  const statusLine =
    status === 'active'
      ? { text: 'SHOOTING!', fill: '#7dff6a' }
      : status === 'unlocked'
        ? { text: trainer.cost === 0 ? 'FREE' : 'UNLOCKED', fill: '#7fd8ff' }
        : status === 'rebirth'
            ? {
                text: `${trainer.rebirths} Rebirth${trainer.rebirths === 1 ? '' : 's'}`,
                icon: 'star',
                fill: ['#e6c9ff', '#a45cff'],
              }
            : {
              text: `${formatNumber(trainer.cost)} Wins`,
              icon: 'trophy',
                fill: status === 'affordable' ? ['#fff6a8', '#ffc21a'] : ['#ffd0d0', '#ff7a7a'],
              }


  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Studded square tile on a darker trim. */}
      <mesh position={[0, 0.08, 0]} receiveShadow>
        <boxGeometry args={[3.6, 0.16, 3.6]} />
        <meshStandardMaterial color={shade(trainer.color, -0.45)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <boxGeometry args={[3.1, 0.2, 3.1]} />
        <meshStandardMaterial
          ref={padMaterial}
          map={studTexture([trainer.color], { cells: 1, studsPerCell: 6 })}
          emissive={trainer.color}
          emissiveIntensity={0.3}
          roughness={0.6}
        />
      </mesh>

      {/* Neon rim and rings rising off the pad, in its colour. */}
      <PadGlow
        color={trainer.color}
        size={3.6}
        y={0.235}
        rise={2.6}
        level={STATUS_GLOW[status]}
        sparkles={active ? 10 : 5}
        phase={position[2]}
      />

      {/* The target pivots at its base, so the wobble rocks it back on its stand. */}
      <group ref={dummy} position={[0, 0, DUMMY_OFFSET_Z]}>
        <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.4, 0.2, 1.4]} />
          <meshStandardMaterial color="#3a3a44" roughness={0.8} />
        </mesh>
        {/* Post, legs and backing board: one shape, one material, one draw. */}
        <mesh geometry={standBody()} castShadow>
          <meshStandardMaterial map={studTexture(['#8a5a2b'], { cells: 1, studsPerCell: 2 })} roughness={0.8} />
        </mesh>
        {/* A rim in the target's own colour, then the bullseye on its face. */}
        <mesh position={[0, HEAD_Y, -0.01]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[FACE_R + 0.12, FACE_R + 0.12, 0.14, 32]} />
          <meshStandardMaterial color={trainer.color} emissive={trainer.color} emissiveIntensity={0.25} roughness={0.5} />
        </mesh>
        <mesh position={[0, HEAD_Y, 0.065]}>
          <circleGeometry args={[FACE_R, 40]} />
          <meshStandardMaterial map={targetTexture(trainer.color)} transparent roughness={0.6} />
        </mesh>
        <mesh position={[0, HEAD_Y, 0.3]}>
          <planeGeometry args={[2.6, 2.6]} />
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

      {active && (
        <Sparkle
          count={24}
          scale={[2.6, 3.2, 2.6]}
          position={[0, HEAD_Y, DUMMY_OFFSET_Z]}
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

      <Billboard position={[0, labelY, DUMMY_OFFSET_Z]}>
        <Label
          lines={[
            ...(trainer.vip ? [{ text: 'VIP', scale: 0.7, fill: GEM }] : []),
            { text: trainer.name, scale: 0.8, fill: ['#ffffff', '#dfe9ff'] },
            { text: `${trainer.multiplier}x Power`, icon: 'ammo', scale: 1.1, fill: ['#ffffff', '#ffe9a8'] },
            statusLine,
          ]}
          position={[0, 0, 0]}
          size={[3.6, 2]}
          style={{ width: 512 }}
        />
      </Billboard>

      {offered &&
        (status === 'affordable' ||
          status === 'locked' ||
          status === 'rebirth') && (
          <InteractPrompt
            position={[0, 2.4, DUMMY_OFFSET_Z / 2]}
            action="Unlock"
            title={`${trainer.name} · ${trainer.multiplier}x`}
            detail={
              status === 'rebirth'
                ? `⭐ ${trainer.rebirths} Rebirths · ${rebirthsToGo} to go`
                : `🏆 ${formatNumber(trainer.cost)} Wins${status === 'locked' ? ' · not enough Wins' : ''}`
            }
            tone={status === 'locked' || status === 'rebirth' ? 'warn' : 'normal'}
          />
        )}

      <RigidBody type="fixed" colliders={false}>
        {/* Solid target, so you can't walk through it. */}
        <CuboidCollider args={[FACE_R, HEAD_Y / 2 + 0.5, 0.5]} position={[0, HEAD_Y / 2 + 0.5, DUMMY_OFFSET_Z - 0.2]} />
        <CuboidCollider
          sensor
          args={[1.6, 1, 1.6]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default TrainingDummy
