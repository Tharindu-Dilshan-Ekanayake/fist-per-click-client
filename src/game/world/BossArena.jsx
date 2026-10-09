import { Billboard } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { AdditiveBlending, BoxGeometry, ConeGeometry, DoubleSide, Matrix4, Object3D, SphereGeometry, TorusGeometry, Vector3 } from 'three'

import { setAimTarget } from '../aim'
import { BOSS_RESPAWN_S, BOSS_TIME_S, bossHp, bossSkin, bossStats } from '../boss'
import { BOSS_PLAYER_MAX_HP, useBossFight } from '../bossFight'
import { formatNumber } from '../format'
import { useGame } from '../gameStore'
import { playSound } from '../sound'
import { Sparkle } from './Effects'
import { geometry, merge } from './geometry'
import { createDynamicLabel, createHpBar, HP_BAR_ASPECT, radialGlowTexture } from './textures'
import { SPAWN } from './themes'

/** The boss is modelled about five and a half units tall, then scaled up by this. */
const SCALE = 2.5
/** Where it stands relative to the arena's centre: on its plinth, at the south end. */
const BOSS_OFFSET = [0, 0.75, -12]
/** Its chest, in its own units: where the shots land and the tracers fly to. */
const CHEST_Y = 2.5
/** Delay from click to impact: the time the bullet takes to get there. */
const HIT_DELAY_S = 0.08
const FLASH_S = 0.15
const POPUP_COUNT = 8
const POPUP_S = 1
/** How often the HUD's copy of the fight (useBossFight) is refreshed. */
const PUBLISH_S = 0.1
const DEATH_S = 0.9
const RISE_S = 0.9

/** Fire rings in the air at once, and how close one has to pass to hit. */
const RING_POOL = 24
const RING_HIT_RADIUS = 1.5
/** The slam's ground wave: how many flames make up its circle, and how fast it spreads. */
const WAVE_POOL = 2
const WAVE_FLAMES = 56
const WAVE_SPEED = 11
/** A wave hits anyone standing within this of its edge - jumping clears it. */
const WAVE_HIT_BAND = 1
const WAVE_CLEAR_Y = 1.6
const METEOR_POOL = 9
const METEOR_FALL_S = 0.7
const METEOR_RADIUS = 2.3
/** After a hit, this long before the next one can land. */
const HIT_GRACE_S = 0.6
/** The arena floor's height, which the waves run along. */
const FLOOR_Y = 0

const ATTACK_TEXT = {
  throw: '🔥 FIRE RINGS - DODGE!',
  slam: '💥 GROUND SLAM - JUMP!',
  barrage: '🔥 BARRAGE - KEEP MOVING!',
  meteor: '☄️ METEORS - GET OUT OF THE RED!',
}

const _v = new Vector3()
const _w = new Vector3()
const _hand = new Vector3()
const _m = new Matrix4()
const _o = new Object3D()

/**
 * The boss's body, split by material and merged: its skin, its armour, its horns
 * and claws, and everything that glows. Built once; every level is the same shape
 * recoloured. Arms are separate - they swing and throw - and so are their claws.
 */
const bossParts = () =>
  geometry('boss-demon', () => {
    const box = (w, h, d, x, y, z, rx = 0, rz = 0) => {
      const g = new BoxGeometry(w, h, d)
      if (rx) g.rotateX(rx)
      if (rz) g.rotateZ(rz)
      g.translate(x, y, z)
      return g
    }
    /** A four-sided spike `h` long, its base at (x, y, z), tilted by rx / rz. */
    const spike = (r, h, x, y, z, rx = 0, rz = 0) => {
      const g = new ConeGeometry(r, h, 4)
      g.translate(0, h / 2, 0)
      if (rx) g.rotateX(rx)
      if (rz) g.rotateZ(rz)
      g.translate(x, y, z)
      return g
    }
    return {
      body: merge([box(2.2, 2, 1.3, 0, 2.5, 0), box(1.4, 1.25, 1.25, 0, 4.15, 0)]),
      armor: merge([
        box(0.75, 1.5, 0.75, -0.55, 0.75, 0),
        box(0.75, 1.5, 0.75, 0.55, 0.75, 0),
        box(2.35, 0.4, 1.45, 0, 1.55, 0),
        box(1.1, 0.55, 1.2, -1.4, 3.45, 0, 0, 0.2),
        box(1.1, 0.55, 1.2, 1.4, 3.45, 0, 0, -0.2),
        box(1.3, 0.9, 0.12, 0, 2.3, 0.68),
        box(1.2, 0.38, 0.35, 0, 3.6, 0.55),
        box(1.5, 0.3, 1.35, 0, 4.75, 0),
      ]),
      horns: merge([
        spike(0.24, 1.2, -0.6, 4.8, 0, 0, 0.55),
        spike(0.24, 1.2, 0.6, 4.8, 0, 0, -0.55),
        spike(0.14, 0.7, -1.18, 5.72, 0, 0, -0.2),
        spike(0.14, 0.7, 1.18, 5.72, 0, 0, 0.2),
        spike(0.2, 0.9, -1.55, 3.7, 0, 0, 0.9),
        spike(0.2, 0.9, 1.55, 3.7, 0, 0, -0.9),
        spike(0.18, 0.8, 0, 3.2, -0.65, -1.9),
        spike(0.18, 0.8, 0, 2.5, -0.65, -1.9),
        spike(0.18, 0.8, 0, 1.8, -0.65, -1.9),
        // Teeth, pointing down out of the jaw.
        spike(0.07, 0.22, -0.35, 3.62, 0.72, Math.PI),
        spike(0.07, 0.22, -0.12, 3.62, 0.72, Math.PI),
        spike(0.07, 0.22, 0.12, 3.62, 0.72, Math.PI),
        spike(0.07, 0.22, 0.35, 3.62, 0.72, Math.PI),
      ]),
      // Angry slanted eyes, a burning mouth and a core in the chest.
      glow: merge([
        box(0.4, 0.16, 0.06, -0.33, 4.3, 0.63, 0, -0.3),
        box(0.4, 0.16, 0.06, 0.33, 4.3, 0.63, 0, 0.3),
        box(0.8, 0.14, 0.04, 0, 3.78, 0.73),
        box(0.5, 0.5, 0.08, 0, 2.6, 0.75, 0, Math.PI / 4),
      ]),
      arm: merge([box(0.7, 1.6, 0.7, 0, -0.8, 0), box(1, 0.9, 1, 0, -1.95, 0)]),
      claws: merge([
        spike(0.1, 0.5, -0.3, -2.35, 0.3, Math.PI),
        spike(0.1, 0.5, 0, -2.35, 0.35, Math.PI),
        spike(0.1, 0.5, 0.3, -2.35, 0.3, Math.PI),
      ]),
    }
  })

/** Seconds left on the clock as "0:42". */
const clockText = (s) => `${Math.floor(s / 60)}:${String(Math.max(0, Math.floor(s % 60))).padStart(2, '0')}`

/** The arms' pose for an attack at `t` seconds in, with `windup` before it lands. */
function attackPose(kind, t, windup, hand) {
  const k = Math.min(1, t / windup)
  const after = Math.max(0, t - windup)
  const ease = 1 - (1 - k) ** 2
  if (kind === 'throw') {
    // The throwing arm goes up and back, charging; then whips forward.
    const arm = after > 0 ? -2.8 + Math.min(1, after / 0.15) * 1.6 : -2.8 * ease
    return hand === 0 ? [arm, -0.3] : [-0.3, arm]
  }
  if (kind === 'slam') {
    // Both fists high overhead, then down into the floor.
    const a = after > 0 ? -3 + Math.min(1, after / 0.12) * 3.2 : -3 * ease
    return [a, a]
  }
  if (kind === 'barrage') {
    // Fists forward, punching out in turn.
    const beat = Math.sin(after * 22)
    return [-1.5 * ease - (after > 0 ? Math.max(0, beat) * 0.6 : 0), -1.5 * ease - (after > 0 ? Math.max(0, -beat) * 0.6 : 0)]
  }
  // Meteor: both arms flung up to the sky.
  return [-3.1 * ease, -3.1 * ease]
}

/**
 * The boss arena's fight: the boss itself, its health bar and clock, its attacks,
 * and the sensor that knows when the player is inside.
 *
 * One boss at a time, local to each player like the stage walls. It waits until the
 * first shot, then the clock runs; every shot after that lands as damage equal to the
 * Ammo it earned (see game/boss.js). Beat it in time and it falls, pays out, and the
 * next level steps in a few seconds later. Run out of time and it heals in full.
 *
 * It fights back from the moment you step into the arena, shot or no shot. Every attack is telegraphed - the HUD names it, the boss winds up,
 * its hands catch fire - and every one can be dodged:
 *
 *   throw    fire rings hurled from its hand, aimed where you are going   - move
 *   slam     a ring of fire racing out along the floor                     - jump
 *   barrage  a rapid stream of rings from both hands                       - keep moving
 *   meteor   fire from the sky on red circles round you                    - leave the red
 *
 * What it knows and how hard it hits come from bossStats(level). Run out of health
 * and you wake up in the lobby; the boss heals.
 *
 * @param {{ position: number[], arenaHalf: number, bodyRef: React.MutableRefObject<any> }} props
 *   the arena's centre and half-size, and the player's rigid body
 */
export function BossArena({ position, arenaHalf, bodyRef }) {
  const level = useGame((s) => s.bossLevel)
  const skin = bossSkin(level)
  const parts = bossParts()
  const at = useMemo(
    () => [position[0] + BOSS_OFFSET[0], position[1] + BOSS_OFFSET[1], position[2] + BOSS_OFFSET[2]],
    [position],
  )
  const chest = useMemo(() => [at[0], at[1] + CHEST_Y * SCALE, at[2]], [at])

  const bar = useMemo(() => createHpBar(), [])
  const header = useMemo(() => createDynamicLabel({ aspect: 4, width: 512 }), [])
  const popupLabels = useMemo(
    () => Array.from({ length: POPUP_COUNT }, () => createDynamicLabel({ aspect: 2.6, width: 256 })),
    [],
  )
  useEffect(
    () => () => {
      bar.texture.dispose()
      header.texture.dispose()
      popupLabels.forEach((label) => label.texture.dispose())
    },
    [bar, header, popupLabels],
  )

  const ringGeometry = geometry('boss-ring', () => new TorusGeometry(0.75, 0.2, 8, 22))
  const flameGeometry = geometry('boss-flame', () => new BoxGeometry(0.9, 1.3, 0.5))
  const meteorGeometry = geometry('boss-meteor', () => new SphereGeometry(1, 14, 12))
  const glowMap = radialGlowTexture()

  const rig = useRef(null)
  const armL = useRef(null)
  const armR = useRef(null)
  const hands = useRef([])
  const handFire = useRef([])
  const bodyMat = useRef(null)
  const glow = useRef(null)
  const popups = useRef([])
  const ringMeshes = useRef([])
  const waveMesh = useRef(null)
  const meteorMeshes = useRef([])
  const warnMeshes = useRef([])

  const fx = useRef({
    level: 0,
    hp: 0,
    phase: 'waiting',
    startedAt: 0,
    downAt: 0,
    risenAt: -Infinity,
    seenShot: -Infinity,
    pending: [],
    hitAt: -Infinity,
    shownHp: -1,
    shownClock: '',
    shownLevel: 0,
    publishedAt: -Infinity,
    nextPopup: 0,
    popupAt: [],
    popupX: [],
    facing: 0,
    nextAttackAt: Infinity,
    /** The attack under way: { kind, start, windup, hand, fired, done } or null. */
    attack: null,
    lastKind: null,
    nextHand: 0,
    playerSafeUntil: 0,
    rings: Array.from({ length: RING_POOL }, () => ({
      active: false,
      position: new Vector3(),
      velocity: new Vector3(),
      spin: 0,
      expiresAt: 0,
    })),
    waves: Array.from({ length: WAVE_POOL }, () => ({ active: false, start: 0, hit: false })),
    meteors: Array.from({ length: METEOR_POOL }, () => ({ active: false, x: 0, z: 0, landAt: 0, landed: false })),
  })

  // The wave's flames all start hidden.
  useLayoutEffect(() => {
    const mesh = waveMesh.current
    if (!mesh) return
    _m.makeScale(0, 0, 0)
    for (let i = 0; i < WAVE_POOL * WAVE_FLAMES; i++) mesh.setMatrixAt(i, _m)
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  useFrame(({ camera, clock }, delta) => {
    const now = performance.now() / 1000
    const s = fx.current
    const game = useGame.getState()
    const maxHp = bossHp(game.bossLevel)
    const stats = bossStats(s.level || game.bossLevel)
    const body = bodyRef?.current
    const player = body?.translation()

    /** Calls the whole fight off: no attacks in flight, nothing pending. */
    const calmDown = () => {
      s.attack = null
      s.nextAttackAt = Infinity
      for (const ring of s.rings) ring.active = false
      for (const wave of s.waves) wave.active = false
      for (const meteor of s.meteors) meteor.active = false
    }

    /** The player takes `damage`, knocked away along (dx, dz). At zero, back to the lobby. */
    const hurt = (damage, dx, dz) => {
      if (!body || now < s.playerSafeUntil) return
      s.playerSafeUntil = now + HIT_GRACE_S
      const hp = Math.max(0, useBossFight.getState().playerHp - damage)
      useBossFight.setState({ playerHp: hp, playerHitAt: now * 1000, staggerUntil: now * 1000 + 360 })
      const len = Math.hypot(dx, dz) || 1
      body.setLinvel({ x: (dx / len) * 8, y: 6, z: (dz / len) * 8 }, true)
      playSound('playerHurt')
      if (hp > 0) return
      // Knocked out: wake up in the lobby, and the boss heals for the next try.
      body.setTranslation({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }, true)
      body.setLinvel({ x: 0, y: 0, z: 0 }, true)
      useBossFight.setState({ playerHp: BOSS_PLAYER_MAX_HP, staggerUntil: 0 })
      game.setInBossArena(false)
      setAimTarget(null)
      s.phase = 'waiting'
      s.hp = bossHp(s.level)
      s.pending.length = 0
      calmDown()
      playSound('bossRoar')
      game.notify(`${bossSkin(s.level).name} knocked you out! Back to the lobby - power up and try again`, 'error')
    }

    // A new level (first mount, or the last one fell): full health, waiting.
    if (s.level !== game.bossLevel && s.phase !== 'down') {
      s.level = game.bossLevel
      s.hp = maxHp
      s.phase = 'waiting'
    }

    if (game.inBossArena && s.phase !== 'down') setAimTarget(chest)

    // Shots fired while in the arena, each landing a moment later.
    if (game.inBossArena && game.shotAt > s.seenShot && now - game.shotAt < 0.2 && s.phase !== 'down') {
      s.seenShot = game.shotAt
      s.pending.push([game.shotAt + HIT_DELAY_S, game.lastGain])
    }
    while (s.pending.length && now >= s.pending[0][0]) {
      const [, damage] = s.pending.shift()
      if (s.phase === 'down') continue
      if (s.phase === 'waiting') {
        s.phase = 'fighting'
        s.startedAt = now
        if (!s.attack) s.nextAttackAt = Math.min(s.nextAttackAt, now + 1.2)
        playSound('bossRoar')
      }
      s.hp -= damage
      s.hitAt = now
      playSound('bossHit')
      const i = s.nextPopup
      s.nextPopup = (i + 1) % POPUP_COUNT
      s.popupAt[i] = now
      s.popupX[i] = (Math.random() - 0.5) * 3
      popupLabels[i].draw({ lines: [{ text: `-${formatNumber(damage)}`, icon: 'ammo', fill: ['#ffffff', '#ffb347'] }] })
      const mesh = popups.current[i]
      if (mesh && mesh.material.map !== popupLabels[i].texture) {
        mesh.material.map = popupLabels[i].texture
        mesh.material.needsUpdate = true
      }
      if (s.hp <= 0) {
        s.hp = 0
        s.phase = 'down'
        s.downAt = now
        s.pending.length = 0
        calmDown()
        playSound('wallBreak')
        playSound('stage')
        game.defeatBoss(s.level)
      }
    }

    // Out of time: it shrugs it off and heals.
    if (s.phase === 'fighting' && now - s.startedAt >= BOSS_TIME_S) {
      s.phase = 'waiting'
      s.hp = maxHp
      calmDown()
      playSound('bossRoar')
      game.notify('Out of time - the boss healed! Get more Ammo per click and try again', 'error')
    }
    // Nobody left to fight: it waits, healed, for the next challenger.
    if (s.phase === 'fighting' && !game.inBossArena) {
      s.phase = 'waiting'
      s.hp = maxHp
      calmDown()
    }
    // Back up again after a breather, one level higher.
    if (s.phase === 'down' && now - s.downAt >= BOSS_RESPAWN_S) {
      s.level = game.bossLevel
      s.hp = bossHp(s.level)
      s.phase = 'waiting'
      s.risenAt = now
      calmDown()
      if (game.inBossArena) playSound('bossRoar')
    }

    // --- Attacks ------------------------------------------------------------------
    // It goes for you as soon as you are in the arena: the clock waits for your first
    // shot, the boss does not. Leave, and it calls everything off.
    const aggro = game.inBossArena && s.phase !== 'down'
    if (!aggro && s.phase !== 'down' && (s.attack || s.nextAttackAt !== Infinity)) calmDown()
    if (aggro && !s.attack && s.nextAttackAt === Infinity) s.nextAttackAt = now + Math.max(2, s.risenAt + RISE_S + 1 - now)

    // Pick one - never the same twice running when there is a choice - and wind up.
    if (aggro && player && !s.attack && now >= s.nextAttackAt) {
      const choices = stats.attacks.filter((kind) => kind !== s.lastKind || stats.attacks.length === 1)
      const kind = choices[Math.floor(Math.random() * choices.length)]
      const windup = kind === 'slam' || kind === 'meteor' ? stats.windup + 0.3 : stats.windup
      s.attack = { kind, start: now, windup, hand: s.nextHand, fired: 0, done: false }
      s.nextHand = 1 - s.nextHand
      s.lastKind = kind
      playSound('bossRoar')
      if (kind === 'meteor') {
        // The circles show at once, so there is the whole wind-up to get clear.
        for (let n = 0; n < stats.meteors; n++) {
          const meteor = s.meteors.find((m) => !m.active)
          if (!meteor) break
          const spread = n === 0 ? 0 : 3 + Math.random() * 6
          const angle = Math.random() * Math.PI * 2
          meteor.active = true
          meteor.landed = false
          meteor.x = Math.max(position[0] - arenaHalf + 2, Math.min(position[0] + arenaHalf - 2, player.x + Math.cos(angle) * spread))
          meteor.z = Math.max(position[2] - arenaHalf + 2, Math.min(position[2] + arenaHalf - 2, player.z + Math.sin(angle) * spread))
          meteor.landAt = now + windup + METEOR_FALL_S + n * 0.12
        }
      }
    }

    /** One fire ring out of hand `hand`, aimed at the player, `angle` off the line. */
    const throwRing = (hand, angle) => {
      const ring = s.rings.find((r) => !r.active)
      if (!ring || !player) return
      hands.current[hand]?.getWorldPosition(_hand)
      // Aim where the player will be, not where they are - more so at higher levels.
      const v = body.linvel()
      const flight = _hand.distanceTo(_w.set(player.x, player.y, player.z)) / stats.speed
      _v.set(
        player.x + v.x * flight * stats.lead - _hand.x,
        player.y + 0.3 - _hand.y,
        player.z + v.z * flight * stats.lead - _hand.z,
      ).normalize()
      ring.active = true
      ring.position.copy(_hand)
      ring.velocity.copy(_v).applyAxisAngle(_w.set(0, 1, 0), angle).multiplyScalar(stats.speed)
      ring.spin = Math.random() * Math.PI
      ring.expiresAt = now + 4
    }

    const a = s.attack
    if (a && aggro) {
      const t = now - a.start
      if (a.kind === 'throw' && !a.fired && t >= a.windup) {
        a.fired = 1
        for (let n = 0; n < stats.volley; n++) throwRing(a.hand, (n - (stats.volley - 1) / 2) * 0.22)
        playSound('fireThrow')
        a.doneAt = now + 0.4
      } else if (a.kind === 'slam' && t >= a.windup) {
        // One wave on impact; from level 5 a second chases the first.
        const due = 1 + (stats.waves > 1 && t >= a.windup + 0.65 ? 1 : 0)
        while (a.fired < due) {
          const wave = s.waves.find((w) => !w.active)
          if (wave) {
            wave.active = true
            wave.start = now
            wave.hit = false
          }
          a.fired++
          playSound('slam')
        }
        if (a.fired >= stats.waves) a.doneAt ??= now + 0.5
      } else if (a.kind === 'barrage' && t >= a.windup) {
        const due = Math.min(stats.barrage, 1 + Math.floor((t - a.windup) / 0.16))
        while (a.fired < due) {
          throwRing(a.fired % 2, (Math.random() - 0.5) * 0.12)
          a.fired++
          playSound('fireThrow')
        }
        if (a.fired >= stats.barrage) a.doneAt ??= now + 0.3
      } else if (a.kind === 'meteor' && t >= a.windup) {
        a.doneAt ??= now + METEOR_FALL_S + stats.meteors * 0.12
      }
      if (a.doneAt && now >= a.doneAt) {
        s.attack = null
        s.nextAttackAt = now + stats.cooldown
      }
    }

    // Fire rings in flight.
    for (const ring of s.rings) {
      if (!ring.active) continue
      ring.position.addScaledVector(ring.velocity, delta)
      ring.spin += delta * 9
      if (now >= ring.expiresAt || ring.position.y < FLOOR_Y - 1) {
        ring.active = false
        continue
      }
      if (game.inBossArena && player) {
        _w.set(player.x, player.y + 0.3, player.z)
        if (ring.position.distanceToSquared(_w) < RING_HIT_RADIUS ** 2) {
          ring.active = false
          hurt(stats.damage, ring.velocity.x, ring.velocity.z)
        }
      }
    }

    // Slam waves spreading along the floor. Only someone off the ground clears one.
    for (const wave of s.waves) {
      if (!wave.active) continue
      const r = (now - wave.start) * WAVE_SPEED
      if (r > arenaHalf * 1.6) {
        wave.active = false
        continue
      }
      if (!wave.hit && game.inBossArena && player) {
        const dx = player.x - at[0]
        const dz = player.z - at[2]
        if (Math.abs(Math.hypot(dx, dz) - r) < WAVE_HIT_BAND && player.y < FLOOR_Y + WAVE_CLEAR_Y) {
          wave.hit = true
          hurt(stats.damage, dx, dz)
        }
      }
    }

    // Meteors falling onto their circles.
    for (const meteor of s.meteors) {
      if (!meteor.active) continue
      if (!meteor.landed && now >= meteor.landAt) {
        meteor.landed = true
        playSound('slam')
        if (game.inBossArena && player && Math.hypot(player.x - meteor.x, player.z - meteor.z) < METEOR_RADIUS) {
          hurt(stats.damage, player.x - meteor.x, player.z - meteor.z)
        }
      }
      if (meteor.landed && now >= meteor.landAt + 0.35) meteor.active = false
    }

    // --- Looks ------------------------------------------------------------------
    const t = clock.elapsedTime
    const g = rig.current
    if (g) {
      const downFor = now - s.downAt
      const risenFor = now - s.risenAt
      let scale = SCALE
      if (s.phase === 'down') scale = SCALE * Math.max(0, 1 - downFor / DEATH_S)
      else if (risenFor < RISE_S) scale = SCALE * (risenFor / RISE_S)
      g.scale.setScalar(Math.max(0.0001, scale))
      g.visible = scale > 0.001
      // It turns to face you while it fights.
      const want = aggro && player ? Math.atan2(player.x - at[0], player.z - at[2]) : 0
      s.facing += (want - s.facing) * Math.min(1, delta * 4)
      g.rotation.y = s.phase === 'down' ? downFor * 8 : s.facing
      const slamDip = a?.kind === 'slam' && now - a.start > a.windup ? Math.max(0, 0.6 - (now - a.start - a.windup) * 2) : 0
      g.position.y = at[1] - slamDip + (aggro ? Math.abs(Math.sin(t * 3)) * 0.35 : Math.sin(t * 1.4) * 0.15)
    }
    let [poseL, poseR] = [Math.sin(t * 1.3) * 0.35, -Math.sin(t * 1.3) * 0.35]
    if (a && aggro) [poseL, poseR] = attackPose(a.kind, now - a.start, a.windup, a.hand)
    else if (aggro) [poseL, poseR] = [Math.sin(t * 4) * 0.5 - 0.3, -Math.sin(t * 4) * 0.5 - 0.3]
    if (armL.current) armL.current.rotation.x += (poseL - armL.current.rotation.x) * Math.min(1, delta * 18)
    if (armR.current) armR.current.rotation.x += (poseR - armR.current.rotation.x) * Math.min(1, delta * 18)
    // Hands burn brighter as an attack charges.
    const charging = a && aggro ? Math.min(1, (now - a.start) / a.windup) : 0
    handFire.current.forEach((sprite, i) => {
      if (!sprite) return
      const lit = !a || a.kind !== 'throw' || a.hand === i ? charging : 0
      const size = 0.9 + Math.sin(t * 17 + i) * 0.12 + lit * 2.2
      sprite.scale.setScalar(aggro ? size : 0.7)
    })
    const flash = Math.max(0, 1 - (now - s.hitAt) / FLASH_S)
    if (bodyMat.current) bodyMat.current.emissiveIntensity = 0.12 + flash * 0.9
    if (glow.current) glow.current.opacity = charging > 0 ? 0.6 + charging * 0.4 : aggro ? 0.45 + 0.15 * Math.sin(t * 6) : 0.3

    ringMeshes.current.forEach((mesh, i) => {
      const ring = s.rings[i]
      if (!mesh || !ring) return
      mesh.visible = ring.active
      if (!ring.active) return
      mesh.position.copy(ring.position)
      mesh.lookAt(_v.copy(ring.position).add(ring.velocity))
      mesh.rotateZ(ring.spin)
    })
    const flames = waveMesh.current
    if (flames) {
      let n = 0
      for (const wave of s.waves) {
        const r = (now - wave.start) * WAVE_SPEED
        for (let i = 0; i < WAVE_FLAMES; i++, n++) {
          if (!wave.active) {
            flames.setMatrixAt(n, _m.makeScale(0, 0, 0))
            continue
          }
          const angle = (i / WAVE_FLAMES) * Math.PI * 2
          _o.position.set(at[0] + Math.sin(angle) * r, FLOOR_Y + 0.6, at[2] + Math.cos(angle) * r)
          _o.rotation.set(0, angle, 0)
          const h = 0.8 + 0.4 * Math.sin(t * 20 + i)
          _o.scale.set(1 + r * 0.03, h, 1)
          _o.updateMatrix()
          flames.setMatrixAt(n, _o.matrix)
        }
      }
      flames.instanceMatrix.needsUpdate = true
      flames.visible = s.waves.some((w) => w.active)
    }
    meteorMeshes.current.forEach((mesh, i) => {
      const meteor = s.meteors[i]
      const warn = warnMeshes.current[i]
      if (!mesh || !warn || !meteor) return
      const left = meteor.landAt - now
      mesh.visible = meteor.active && !meteor.landed && left < METEOR_FALL_S
      if (mesh.visible) mesh.position.set(meteor.x, FLOOR_Y + (left / METEOR_FALL_S) * 26, meteor.z)
      warn.visible = meteor.active
      if (warn.visible) {
        warn.position.set(meteor.x, FLOOR_Y + 0.06, meteor.z)
        warn.material.opacity = meteor.landed ? 0.9 : 0.35 + 0.35 * Math.abs(Math.sin(t * 10))
        warn.scale.setScalar(meteor.landed ? 1.4 : 1)
      }
    })

    // The board over its head: name and level, health, and the clock.
    const left = s.phase === 'fighting' ? BOSS_TIME_S - (now - s.startedAt) : BOSS_TIME_S
    const clockLine = s.phase === 'down' ? 'DEFEATED!' : s.phase === 'waiting' ? 'Shoot to start!' : `⏱ ${clockText(left)}`
    const shownHp = Math.ceil(s.hp)
    if (shownHp !== s.shownHp) {
      s.shownHp = shownHp
      bar.draw(shownHp, bossHp(s.level || game.bossLevel))
    }
    if (clockLine !== s.shownClock || s.shownLevel !== s.level) {
      s.shownClock = clockLine
      s.shownLevel = s.level
      header.draw({
        lines: [
          { text: `${bossSkin(s.level || 1).name} · Lv ${s.level || 1}`, fill: ['#ffffff', '#ffb0b0'] },
          { text: clockLine, scale: 0.8, fill: s.phase === 'fighting' && left < 10 ? '#ff6a6a' : '#fff3a0' },
        ],
      })
    }

    if (now - s.publishedAt >= PUBLISH_S) {
      s.publishedAt = now
      const warning = a && aggro && now - a.start < a.windup + 0.2
      useBossFight.setState({
        phase: s.phase,
        level: s.level || game.bossLevel,
        hp: shownHp,
        maxHp: bossHp(s.level || game.bossLevel),
        endsAt: (s.startedAt + BOSS_TIME_S) * 1000,
        nextAt: (s.downAt + BOSS_RESPAWN_S) * 1000,
        attackAt: s.nextAttackAt * 1000,
        warningUntil: warning ? (a.start + a.windup + 0.2) * 1000 : 0,
        warningText: warning ? ATTACK_TEXT[a.kind] : '',
        maxPlayerHp: BOSS_PLAYER_MAX_HP,
      })
    }

    popups.current.forEach((popup, i) => {
      if (!popup) return
      const age = now - (s.popupAt[i] ?? -Infinity)
      popup.visible = age >= 0 && age < POPUP_S
      if (!popup.visible) return
      popup.position.set(at[0] + s.popupX[i], chest[1] + 2 + age * 3, at[2] + 3)
      popup.material.opacity = 1 - (age / POPUP_S) ** 2
      popup.quaternion.copy(camera.quaternion)
    })
  })

  const half = arenaHalf - 1
  const onEnter = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    useBossFight.setState({ playerHp: BOSS_PLAYER_MAX_HP, staggerUntil: 0 })
    useGame.getState().setInBossArena(true)
  }
  const onExit = ({ other }) => {
    if (other.rigidBodyObject?.name !== 'player') return
    useGame.getState().setInBossArena(false)
    setAimTarget(null)
  }

  /** One arm, pivoting at the shoulder, with claws and a hand that catches fire. */
  const arm = (side, ref, i) => (
    <group ref={ref} position={[side * 1.45, 3.25, 0]}>
      <mesh geometry={parts.arm} castShadow>
        <meshStandardMaterial color={skin.armor} metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh geometry={parts.claws}>
        <meshStandardMaterial color={skin.horn} roughness={0.5} />
      </mesh>
      <object3D
        position={[0, -2.1, 0.2]}
        ref={(el) => {
          hands.current[i] = el
        }}
      />
      <sprite
        position={[0, -2.1, 0.2]}
        ref={(el) => {
          handFire.current[i] = el
        }}
      >
        <spriteMaterial map={glowMap} color={skin.fire} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </sprite>
    </group>
  )

  return (
    <group>
      <group ref={rig} position={at} scale={SCALE}>
        <mesh geometry={parts.body} castShadow>
          <meshStandardMaterial ref={bodyMat} color={skin.body} emissive="#ffffff" emissiveIntensity={0.12} roughness={0.6} />
        </mesh>
        <mesh geometry={parts.armor} castShadow>
          <meshStandardMaterial color={skin.armor} metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh geometry={parts.horns} castShadow>
          <meshStandardMaterial color={skin.horn} roughness={0.5} />
        </mesh>
        <mesh geometry={parts.glow}>
          <meshBasicMaterial color={skin.eye} toneMapped={false} />
        </mesh>
        {arm(-1, armL, 0)}
        {arm(1, armR, 1)}
      </group>

      {/* A glow behind it in its fire's colour, flaring as it winds up. */}
      <Billboard position={chest}>
        <mesh>
          <planeGeometry args={[16, 16]} />
          <meshBasicMaterial
            ref={glow}
            map={glowMap}
            color={skin.fire}
            transparent
            opacity={0.3}
            blending={AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </Billboard>
      <Sparkle count={50} scale={[9, 12, 7]} position={chest} size={9} speed={0.9} color={skin.fire} />

      {Array.from({ length: RING_POOL }, (_, i) => (
        <group
          key={`ring-${i}`}
          visible={false}
          ref={(el) => {
            ringMeshes.current[i] = el
          }}
        >
          <mesh geometry={ringGeometry}>
            <meshBasicMaterial color={skin.fire} toneMapped={false} />
          </mesh>
          <mesh geometry={ringGeometry} scale={[0.9, 0.9, 1.6]}>
            <meshBasicMaterial color="#fff2a1" transparent opacity={0.7} toneMapped={false} />
          </mesh>
          <sprite scale={2.8}>
            <spriteMaterial map={glowMap} color={skin.fire} transparent opacity={0.8} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
          </sprite>
        </group>
      ))}

      <instancedMesh
        ref={waveMesh}
        args={[flameGeometry, undefined, WAVE_POOL * WAVE_FLAMES]}
        frustumCulled={false}
        visible={false}
      >
        <meshBasicMaterial color={skin.fire} transparent opacity={0.85} blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>

      {Array.from({ length: METEOR_POOL }, (_, i) => (
        <group key={`meteor-${i}`}>
          <group
            visible={false}
            ref={(el) => {
              meteorMeshes.current[i] = el
            }}
          >
            <mesh geometry={meteorGeometry} scale={1.1}>
              <meshBasicMaterial color={skin.fire} toneMapped={false} />
            </mesh>
            <sprite scale={4.5}>
              <spriteMaterial map={glowMap} color={skin.fire} transparent blending={AdditiveBlending} depthWrite={false} toneMapped={false} />
            </sprite>
          </group>
          <mesh
            visible={false}
            rotation={[-Math.PI / 2, 0, 0]}
            ref={(el) => {
              warnMeshes.current[i] = el
            }}
          >
            <ringGeometry args={[METEOR_RADIUS - 0.35, METEOR_RADIUS, 36]} />
            <meshBasicMaterial color="#ff2a1a" transparent opacity={0.6} side={DoubleSide} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      ))}

      <Billboard position={[at[0], at[1] + 6.4 * SCALE, at[2]]}>
        <mesh position={[0, 1.1, 0]}>
          <planeGeometry args={[7, 1.75]} />
          <meshBasicMaterial map={header.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
        <mesh>
          <planeGeometry args={[6, 6 / HP_BAR_ASPECT]} />
          <meshBasicMaterial map={bar.texture} transparent depthWrite={false} toneMapped={false} />
        </mesh>
      </Billboard>

      {Array.from({ length: POPUP_COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            popups.current[i] = el
          }}
          visible={false}
          renderOrder={2}
        >
          <planeGeometry args={[3.4, 1.3]} />
          <meshBasicMaterial transparent depthWrite={false} toneMapped={false} />
        </mesh>
      ))}

      <RigidBody type="fixed" colliders={false}>
        {/* Solid, so nobody walks through it. */}
        <CuboidCollider args={[1.3 * SCALE, 2.5 * SCALE, 0.8 * SCALE]} position={[at[0], at[1] + 2.5 * SCALE, at[2]]} />
        <CuboidCollider
          sensor
          args={[half, 6, half]}
          position={[position[0], 6, position[2]]}
          onIntersectionEnter={onEnter}
          onIntersectionExit={onExit}
        />
      </RigidBody>
    </group>
  )
}

export default BossArena
