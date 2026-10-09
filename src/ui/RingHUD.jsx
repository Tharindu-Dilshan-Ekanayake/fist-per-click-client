import { useEffect, useState } from 'react'

import { useBloxity } from '../bloxity/BloxityContext'
import { useTouchDevice } from '../game/device'
import { fightFx, HURT_S } from '../game/fightFx'
import { ringOfPlayer, ringSecondsLeft, useRings } from '../game/ringState'
import { RING_MAX_HP, RINGS } from '../game/rings'
import { useLobby } from '../net/lobbyClient'
import { OUTLINE } from './textStyle'

const INK = '#1b1b25'
const CORNER = ['#ff4a4a', '#3f8cff']

/** A clock for the panel while it is up: ten ticks a second is plenty for 3-2-1. */
function useTicker(on) {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(id)
  }, [on])
  return now
}

/** One fighter's health bar, in their corner's colour. */
function HealthBar({ name, hp, slot, me, touch, align }) {
  const fraction = Math.max(0, Math.min(1, hp / RING_MAX_HP))
  const fill =
    fraction > 0.5
      ? 'linear-gradient(to bottom, #b4ff6e, #22b81a)'
      : fraction > 0.25
        ? 'linear-gradient(to bottom, #fff07a, #e09400)'
        : 'linear-gradient(to bottom, #ffa08a, #d62a1a)'
  return (
    <div className={`flex min-w-0 flex-1 flex-col ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className={`flex max-w-full items-center gap-1.5 text-white ${touch ? 'text-xs' : 'text-xl'}`} style={OUTLINE}>
        <span className={`inline-block shrink-0 rounded ${touch ? 'h-3 w-1.5' : 'h-5 w-2'}`} style={{ background: CORNER[slot] }} />
        <span className="truncate">{name}</span>
        {me && <span className="shrink-0 text-yellow-300">(YOU)</span>}
      </div>
      <div
        className={`relative mt-1 w-full overflow-hidden rounded-full border-4 ${touch ? 'h-4 border-2' : 'h-7'}`}
        style={{ borderColor: INK, background: '#2a1a24' }}
      >
        <div
          className={`absolute inset-y-0 transition-[width] duration-150 ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ width: `${fraction * 100}%`, background: fill }}
        />
        <span className={`absolute inset-0 flex items-center justify-center text-white ${touch ? 'text-[10px]' : 'text-sm'}`} style={OUTLINE}>
          {Math.ceil(hp)} / {RING_MAX_HP}
        </span>
      </div>
    </div>
  )
}

/**
 * The fight, while you are in one of the boxing rings: both fighters' health across
 * the top, the countdown and "FIGHT!" big in the middle, the knockout, and a red
 * flash round the edge of the screen each time you take a punch.
 */
export function RingHUD() {
  const touch = useTouchDevice()
  const rings = useRings((s) => s.rings)
  const selfId = useLobby((s) => s.selfId)
  const players = useLobby((s) => s.players)
  const { identity } = useBloxity()
  const myName = identity?.displayName || identity?.username || 'You'
  const mine = ringOfPlayer(rings, selfId)
  const ring = mine ? rings[mine.index] : null
  const now = useTicker(Boolean(mine))

  if (!mine || !ring) return null
  // How long the ring has been in its current state: "FIGHT!" stays up a moment.
  const since = now - ring.since
  // The red flash, keyed on the punch that caused it so each one plays afresh.
  const hurt = now / 1000 - fightFx.hurtAt < HURT_S
  const nameOf = (id) => (id === selfId ? myName : players[id]?.name ?? 'Player')
  const [a, b] = ring.f
  const opponent = ring.f[1 - mine.slot]

  let center = null
  if (ring.s === 'countdown') {
    const left = Math.max(1, Math.ceil(ringSecondsLeft(ring, now)))
    center = { text: String(left), color: '#ffd23f', key: `c${left}` }
  } else if (ring.s === 'fight' && since < 900) {
    center = { text: 'FIGHT!', color: '#ff5a4a', key: 'fight' }
  } else if (ring.s === 'ko') {
    const won = ring.hp[mine.slot] > 0
    center = won ? { text: 'YOU WIN!', color: '#7dff6a', key: 'win' } : { text: 'K.O.!', color: '#ff4fd8', key: 'ko' }
  }

  const hint =
    ring.s === 'open'
      ? opponent
        ? ''
        : 'Waiting for a challenger... step out of the ring to leave'
      : ring.s === 'fight'
        ? 'Click fast to punch! The stronger fist wins'
        : ''

  return (
    <>
      <div
        className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${touch ? 'top-12 w-[22rem] max-w-[92vw]' : 'top-16 w-[40rem] max-w-[92vw]'}`}
      >
        <div
          className={`rounded-2xl border-4 px-3 pb-2 pt-1 ${touch ? 'border-2' : ''}`}
          style={{ borderColor: INK, background: 'linear-gradient(to bottom, rgba(42,45,88,0.92), rgba(22,24,47,0.92))' }}
        >
          <div className={`text-center text-white ${touch ? 'text-xs' : 'text-lg'}`} style={OUTLINE}>
            🥊 {RINGS[mine.index].name}
          </div>
          <div className="flex items-center gap-3">
            <HealthBar name={a ? nameOf(a) : '- empty -'} hp={a ? ring.hp[0] : 0} slot={0} me={a === selfId} touch={touch} />
            <span className={`shrink-0 text-yellow-300 ${touch ? 'text-sm' : 'text-3xl'}`} style={OUTLINE}>
              VS
            </span>
            <HealthBar name={b ? nameOf(b) : '- empty -'} hp={b ? ring.hp[1] : 0} slot={1} me={b === selfId} touch={touch} align="right" />
          </div>
        </div>
        {hint && (
          <div className={`mt-1 text-center text-white ${touch ? 'text-[10px]' : 'text-base'}`} style={OUTLINE}>
            {hint}
          </div>
        )}
      </div>

      {center && (
        <div
          key={center.key}
          className={`ring-shout pointer-events-none fixed inset-x-0 top-[34%] z-20 text-center ${touch ? 'text-5xl' : 'text-8xl'}`}
          style={{ ...OUTLINE, color: center.color }}
        >
          {center.text}
        </div>
      )}
      {hurt && <div key={fightFx.hurtAt} className="ring-hurt pointer-events-none fixed inset-0 z-20" />}
    </>
  )
}

export default RingHUD
