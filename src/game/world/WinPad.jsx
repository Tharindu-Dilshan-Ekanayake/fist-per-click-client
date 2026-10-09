import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import { AdditiveBlending, DoubleSide } from 'three'

import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { getPass } from '../passes'
import { HOLD_S, padStrength, padUnlocked, padWins } from '../walls'
import { Label, Sparkle } from './Effects'
import InteractPrompt, { HOLD_RING } from './InteractPrompt'
import { beamTexture, radialGlowTexture, shade, studTexture } from './textures'
import { SPAWN } from './themes'

const SIZE = 3.2
const BEAM_H = 3.2

/**
 * A glowing Win pad in front of a stage wall. Step on it and hold E: a ring fills
 * around the key, then you're paid the pad's Wins and sent back to the lobby, where
 * every broken wall rebuilds.
 *
 * The left-hand blue pad is pass-gated instead (`pad.pass`, see walls.js). Locked, the
 * same hold on E opens the SDK's purchase modal rather than paying out — holding
 * rather than tapping on purpose, so a stray key press can never start a payment.
 *
 * @param {{ number: number, pad: object, position: number[], home?: number[] }} props
 *   `number` is the wall it stands before; `pad` is an entry of WIN_PADS. `home` is
 *   where it sends you once paid: the lobby's spawn, or Space World's.
 */
export function WinPad({ number, pad, position, home = SPAWN }) {
  const key = `${number}:${pad.id}`
  const needed = padStrength(number, pad)
  const gain = padWins(number, pad)
  const pass = pad.pass ? getPass(pad.pass) : null
  const passPrice = pass ? formatNumber(pass.cost) : ''
  const unlocked = useGame((s) => padUnlocked(number, pad, s))
  const inRange = useGame((s) => s.interact?.kind === 'pad' && s.interact.id === key)

  const top = useRef(null)
  const halo = useRef(null)
  const beam = useRef(null)
  const ring = useRef(null)
  /** The player's rigid body, from the sensor, for the trip home. */
  const playerBody = useRef(null)

  // How brightly a *locked* pad burns. A VIP pad is for sale, not out of reach, so
  // it keeps most of its glow to advertise itself; a pad that just needs more Strength
  // goes all but dark.
  const dim = pass ? 0.55 : 0.2

  useFrame(({ clock }) => {
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 3 + number)
    if (top.current) {
      top.current.emissiveIntensity = unlocked ? (inRange ? 1.1 : 0.75) + 0.15 * pulse : dim * (0.5 + 0.3 * pulse)
    }
    if (halo.current) halo.current.opacity = unlocked ? 0.55 + 0.2 * pulse : dim * 0.4
    if (beam.current) beam.current.opacity = unlocked ? 0.22 + 0.1 * pulse : dim * 0.18

    const game = useGame.getState()
    const held = game.interact?.kind === 'pad' && game.interact.id === key && game.holdingSince !== null
    const progress = held ? (performance.now() / 1000 - game.holdingSince) / HOLD_S : 0
    if (ring.current) ring.current.style.strokeDashoffset = String(HOLD_RING * (1 - Math.min(1, progress)))

    if (progress >= 1) {
      // Held long enough. A locked VIP pad buys its pass; anything else cashes in.
      if (pass && !unlocked) {
        // Drop the hold first: the modal takes over the screen and the keyup that
        // ends it lands on the SDK's overlay, not on us.
        game.interactEnd()
        game.buyPass(pass.id)
        return
      }
      const body = playerBody.current
      if (game.claimPad(number, pad) && body) {
        body.setTranslation({ x: home[0], y: home[1], z: home[2] }, true)
        body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      } else {
        game.interactEnd()
      }
    }
  })

  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    playerBody.current = other.rigidBody
    useGame.getState().setInteract('pad', key)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') useGame.getState().clearInteract('pad', key)
  }

  const map = studTexture([pad.color], { cells: 1, studsPerCell: 6 })

  return (
    <group position={position}>
      {/* Dark trim, then the bright studded tile. */}
      <mesh position={[0, 0.07, 0]} receiveShadow>
        <boxGeometry args={[SIZE + 0.4, 0.14, SIZE + 0.4]} />
        <meshStandardMaterial color={shade(pad.color, -0.55)} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[SIZE, 0.14, SIZE]} />
        <meshStandardMaterial
          ref={top}
          map={map}
          color={unlocked ? '#ffffff' : pass ? '#cfe4ee' : '#8a8a8a'}
          emissive={pad.color}
          emissiveMap={map}
          emissiveIntensity={0.75}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>

      {/* Soft glow on the floor around it and a faint square beam. */}
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[SIZE * 2.4, SIZE * 2.4]} />
        <meshBasicMaterial
          ref={halo}
          map={radialGlowTexture()}
          color={pad.color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.23 + BEAM_H / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[(SIZE / 2) * Math.SQRT2 * 0.95, (SIZE / 2) * Math.SQRT2, BEAM_H, 4, 1, true]} />
        {/* forceSinglePass: see the note in world/Effects.jsx. */}
        <meshBasicMaterial
          ref={beam}
          map={beamTexture()}
          color={pad.color}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          side={DoubleSide}
          forceSinglePass
          toneMapped={false}
        />
      </mesh>
      {(unlocked || pass) && (
        <Sparkle
          count={unlocked ? 18 : 10}
          scale={[SIZE, BEAM_H, SIZE]}
          position={[0, BEAM_H / 2, 0]}
          size={5}
          speed={0.6}
          color={pad.color}
        />
      )}

      <Billboard position={[0, 3.2, 0]}>
        <Label
          lines={[
            ...(pass && !unlocked ? [{ text: 'VIP', scale: 0.7, fill: pad.fill }] : []),
            {
              text: `+${formatNumber(gain)} Wins`,
              icon: 'trophy',
              // A locked VIP pad keeps its colours: the number is the sales pitch.
              fill: unlocked || pass ? pad.fill : ['#e0e0e0', '#9a9a9a'],
            },
            unlocked
              ? { text: 'HOLD E TO CLAIM', scale: 0.55, fill: '#ffffff' }
              : pass
                ? { text: `HOLD E - ${passPrice} WINS`, scale: 0.55, fill: '#bff1ff' }
                : { text: `NEED ${formatNumber(needed)} AMMO`, scale: 0.55, fill: '#ff8a8a' },
          ]}
          position={[0, 0, 0]}
          size={[3.8, pass && !unlocked ? 2 : 1.5]}
          style={{ width: 384 }}
        />
      </Billboard>

      {inRange &&
        (pass && !unlocked ? (
          <InteractPrompt
            position={[0, 1.2, 0]}
            hold
            ringRef={ring}
            action="Hold E"
            title={`Buy ${pass.name}`}
            detail={`🏆 ${passPrice} Wins  -  x${pad.wins} Wins at every stage, forever`}
          />
        ) : (
          <InteractPrompt
            position={[0, 1.2, 0]}
            hold
            ringRef={ring}
            action={unlocked ? 'Hold E' : 'Locked'}
            title={`+${formatNumber(gain)} Wins`}
            detail={unlocked ? 'Cash in and go back to the lobby' : `Need ${formatNumber(needed)} Strength`}
            tone={unlocked ? 'normal' : 'warn'}
          />
        ))}

      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          sensor
          args={[SIZE / 2, 1, SIZE / 2]}
          position={[0, 1, 0]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default WinPad
