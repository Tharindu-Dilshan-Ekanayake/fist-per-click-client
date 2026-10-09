import { useEffect, useRef, useState } from 'react'

import { useTouchDevice } from '../game/device'
import { formatBonus, formatNumber } from '../game/format'
import { AUTO_WINS_S, powerMultiplier, useGame, winsMultiplier } from '../game/gameStore'
import {
  activeBoost,
  BOOSTS,
  levelFor,
  levelStrength,
  MAX_LEVEL,
  rebirthMultiplier,
  WALK_SPEED,
} from '../game/progression'
import { playSound } from '../game/sound'
import { getTrainer } from '../game/trainers'
import { ControlsButton, ControlsPanel } from './Controls'
import { GuideButton } from './HowToPlay'
import { RingHUD } from './RingHUD'
import { PetsButton, PetsPanel } from './PetsPanel'
import { RebirthButton, RebirthIcon, RebirthPanel } from './RebirthPanel'
import { PromoStack, ShopButton, ShopPanel } from './ShopPanel'
import { OUTLINE, outlined, SOFT } from './textStyle'
import { HUD_STRIP_H, reportStripHeight, useTouchScale } from './touchLayout'

const ICON_SHADOW = { filter: 'drop-shadow(0 3px 0 rgba(0,0,0,0.85))' }
const INK = '#1b1b25'

/**
 * Toast notice styling per tone: the stripe and timer bar colour, the icon's
 * gradient, and the card's own background.
 */
const NOTICE = {
  success: { accent: '#5fe64c', icon: ['#eaffd8', '#5fe64c'], bg: ['#1d3a26', '#101f17'] },
  error: { accent: '#ff6b6b', icon: ['#ffdede', '#ff5a5a'], bg: ['#3d1c20', '#231216'] },
  info: { accent: '#5cc4ff', icon: ['#eaf9ff', '#5cc4ff'], bg: ['#17304a', '#111b28'] },
}


/** Button faces for the x2 / x4 / x8 boosts: gold, orange, red. */
const BOOST_COLORS = {
  2: ['#ffd84a', '#f0a000'],
  4: ['#ff9448', '#e2521c'],
  8: ['#ff5a5a', '#c81e1e'],
}

// --- Icons: drawn in the same outlined style as the signs, not emoji -----------------

/**
 * A red boxing glove on a white cuff - the game's Strength, drawn the way the signs
 * in the world draw it. Same chunky outline as every other icon here.
 */
export function FistIcon({ className = 'h-[1.3em] w-[1.3em]', style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ ...ICON_SHADOW, ...style }}
    >
      <defs>
        <linearGradient id="hud-glove" x1="0.1" y1="0" x2="0.9" y2="0.9">
          <stop offset="0" stopColor="#ff9a88" />
          <stop offset="0.5" stopColor="#f0302a" />
          <stop offset="1" stopColor="#b0140f" />
        </linearGradient>
      </defs>
      <g stroke={INK} strokeWidth="7" strokeLinejoin="round">
        <rect x="28" y="66" width="46" height="28" rx="6" fill="#f4f4f4" />
        <path d="M30 70 C16 58 14 26 34 12 C50 2 78 4 86 22 C95 40 90 62 74 70 Z" fill="url(#hud-glove)" />
        <ellipse cx="31" cy="47" rx="12" ry="17" transform="rotate(-14 31 47)" fill="url(#hud-glove)" />
      </g>
      <rect x="31.5" y="74" width="39" height="8" fill="#ffd23f" />
      <ellipse cx="62" cy="22" rx="14" ry="6" transform="rotate(-20 62 22)" fill="rgba(255,255,255,0.5)" />
    </svg>
  )
}

function TrophyIcon({ className, style }) {
  return (
    <svg
      viewBox="0 0 100 100"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
      style={{ ...ICON_SHADOW, ...style }}
    >
      <defs>
        <linearGradient id="hud-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3a0" />
          <stop offset="1" stopColor="#f0a800" />
        </linearGradient>
      </defs>
      <g stroke="#2a1a00" strokeWidth="7" strokeLinejoin="round">
        <path d="M24 16 Q6 18 12 34 Q18 46 32 44 M76 16 Q94 18 88 34 Q82 46 68 44" fill="none" />
        <path d="M22 10 H78 L74 44 Q50 68 26 44 Z" fill="url(#hud-gold)" />
        <rect x="42" y="58" width="16" height="16" fill="url(#hud-gold)" />
        <rect x="26" y="74" width="48" height="16" rx="3" fill="url(#hud-gold)" />
      </g>
    </svg>
  )
}

function ShoeIcon({ className }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <g stroke={INK} strokeWidth="6" strokeLinejoin="round">
        <path d="M10 66 L14 32 Q30 38 40 28 L54 44 Q72 50 88 56 Q95 61 92 70 L12 70 Z" fill="#ff3b4a" />
        <path d="M10 70 H92 V80 H10 Z" fill="#ffffff" />
      </g>
    </svg>
  )
}

/** Check / warning-triangle / info-circle, in the notice's own gradient. */
function NoticeIcon({ tone, className = 'h-7 w-7' }) {
  const [from, to] = NOTICE[tone].icon
  const gradId = `notice-grad-${tone}`
  const gradient = (
    <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={from} />
      <stop offset="1" stopColor={to} />
    </linearGradient>
  )
  if (tone === 'error') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
        <defs>{gradient}</defs>
        <path d="M50 6 L94 88 H6 Z" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" strokeLinejoin="round" />
        <rect x="44" y="34" width="12" height="30" rx="5" fill={INK} />
        <circle cx="50" cy="76" r="7" fill={INK} />
      </svg>
    )
  }
  if (tone === 'success') {
    return (
      <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
        <defs>{gradient}</defs>
        <circle cx="50" cy="50" r="44" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" />
        <path
          d="M30 52 L44 66 L72 34"
          fill="none"
          stroke={INK}
          strokeWidth="10"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`} style={ICON_SHADOW}>
      <defs>{gradient}</defs>
      <circle cx="50" cy="50" r="44" fill={`url(#${gradId})`} stroke={INK} strokeWidth="7" />
      <circle cx="50" cy="30" r="7" fill={INK} />
      <rect x="42" y="44" width="16" height="34" rx="6" fill={INK} />
    </svg>
  )
}

// --- Pieces --------------------------------------------------------------------------

/** A clock that ticks every second, for boost countdowns. */
function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** Chunky outlined button: dark border, gradient face and a darker bottom lip. */
function GameButton({ colors, onClick, className = '', style, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pointer-events-auto relative rounded-xl border-4 transition hover:brightness-110 active:translate-y-0.5 ${className}`}
      style={{
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
        ...style,
      }}
    >
      {children}
    </button>
  )
}

/**
 * Wins price in the top-right corner of a button.
 *
 * Shrinks on a phone along with the button it hangs off. At the desktop size it is
 * a 24px trophy sitting 16px above a button that is only 38px tall down there, which
 * is most of a second button's worth of furniture on top of the first.
 */
function PriceTag({ cost }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  if (!touch) {
    return (
      <span className="absolute -right-2 -top-4 flex items-center gap-0.5 text-lg text-white" style={OUTLINE}>
        <TrophyIcon className="h-6 w-6" />
        {formatNumber(cost)}
      </span>
    )
  }
  const px = Math.max(13, Math.round(15 * scale))
  return (
    <span
      className="absolute flex items-center gap-0.5 text-white"
      style={{ ...outlined(1, 2), right: -2, top: -px, fontSize: px }}
    >
      <TrophyIcon className="" style={{ width: px, height: px }} />
      {formatNumber(cost)}
    </span>
  )
}

/**
 * The toast that says what just happened. One card, the tone carried by a stripe
 * down its left edge, the icon in its own well, and a bar along the bottom that
 * drains so you can see it's about to go. Keyed on the message id by the caller,
 * so a new message replays the pop from the start.
 *
 * @param {{ message: { text: string, tone: 'success' | 'error' | 'info' } }} props
 */
function Notice({ message }) {
  const tone = NOTICE[message.tone]
  return (
    <div key={message.id} className="pointer-events-none absolute inset-x-0 top-20 z-10 flex justify-center px-4">
      <div
        className="notice-pop relative flex max-w-2xl items-center gap-3 overflow-hidden rounded-2xl border-4 py-3 pl-4 pr-5 shadow-2xl"
        style={{ borderColor: INK, background: `linear-gradient(to bottom, ${tone.bg[0]}, ${tone.bg[1]})` }}
      >
        {/* The tone, read at a glance before a word of it is. */}
        <span className="absolute inset-y-0 left-0 w-2" style={{ background: tone.accent }} />
        <span
          className="ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2"
          style={{ borderColor: '#00000066', background: '#00000055' }}
        >
          <NoticeIcon tone={message.tone} className="h-8 w-8" />
        </span>
        <span className="min-w-0 text-pretty text-lg leading-snug text-white sm:text-xl" style={SOFT}>
          {message.text}
        </span>
        {/* Drains over the toast's life, so its leaving is never a surprise. */}
        <span className="notice-timer absolute inset-x-0 bottom-0 h-1.5" style={{ background: tone.accent }} />
      </div>
    </div>
  )
}

/**
 * "+N" popups with the fist icon: each pops up where the punch was thrown with a
 * little twist, then flies into the Strength counter. Half size on a phone, where
 * forty of them a second would otherwise cover the player.
 */
function ClickPopups() {
  const popups = useGame((s) => s.popups)
  const touch = useTouchDevice()
  return popups.map((p) => (
    <div
      key={p.id}
      className={`click-popup pointer-events-none z-20 flex items-center gap-1 whitespace-nowrap text-yellow-300 ${
        touch ? 'text-xl' : 'text-4xl'
      }`}
      style={{
        ...OUTLINE,
        left: p.x,
        top: p.y,
        '--dx': `${p.dx}px`,
        '--dy': `${p.dy}px`,
        '--rot': `${((p.id % 5) - 2) * 9}deg`,
      }}
    >
      <FistIcon className={touch ? 'h-6 w-6' : 'h-11 w-11'} />
      <span>+{formatNumber(p.gain)}</span>
    </div>
  ))
}

/**
 * Auto Wins, while it is on: pays out every AUTO_WINS_S seconds with a coin, and
 * the Wins counter bumps. No toast - one every ten seconds would bury the real ones.
 */
function AutoWinsTicker() {
  const on = useGame((s) => s.autoWins && s.ownedPasses.includes('autoWins'))
  useEffect(() => {
    if (!on) return undefined
    const id = setInterval(() => {
      if (useGame.getState().collectAutoWins() > 0) playSound('coin')
    }, AUTO_WINS_S * 1000)
    return () => clearInterval(id)
  }, [on])
  return null
}

/**
 * "LEVEL UP!" across the middle of the screen for a moment each time a new level is
 * reached, with the level under it. Keyed on the moment, so each one plays afresh.
 */
function LevelUpBanner() {
  const at = useGame((s) => s.levelUpAt)
  const level = useGame((s) => levelFor(s.strength))
  const touch = useTouchDevice()
  // Which level-up has finished playing; the banner shows until the latest one has.
  const [done, setDone] = useState(null)
  useEffect(() => {
    if (!Number.isFinite(at)) return undefined
    const id = setTimeout(() => setDone(at), 1500)
    return () => clearTimeout(id)
  }, [at])
  if (!Number.isFinite(at) || done === at) return null
  return (
    <div key={at} className="ring-shout pointer-events-none fixed inset-x-0 top-[24%] z-20 text-center" style={OUTLINE}>
      <div className={touch ? 'text-4xl text-yellow-300' : 'text-7xl text-yellow-300'}>LEVEL UP!</div>
      <div className={touch ? 'text-xl text-white' : 'text-3xl text-white'}>Level {level}</div>
    </div>
  )
}

/**
 * Big trophy and Wins total, top left under the player card, with the pet's Wins
 * multiplier under it whenever one is out (see petWinsMultiplier).
 */
function WinsCounter() {
  const touch = useTouchDevice()
  const wins = useGame((s) => s.wins)
  const rebirths = useGame((s) => s.rebirths)
  const pets = useGame((s) => s.equippedPets)
  const passes = useGame((s) => s.ownedPasses)
  const bonus = winsMultiplier({ equippedPets: pets, ownedPasses: passes })
  return (
    <div
      className={`pointer-events-none absolute z-10 flex flex-col items-start ${
        touch ? 'left-2 top-14' : 'left-4 top-20'
      }`}
      style={OUTLINE}
    >
      <div className={`flex items-center ${touch ? 'gap-1' : 'gap-2'}`}>
        <TrophyIcon className={touch ? 'h-7 w-7' : 'h-12 w-12'} />
        <span key={wins} className={`power-bump text-white ${touch ? 'text-2xl' : 'text-5xl'}`}>
          {formatNumber(wins)}
        </span>
      </div>
      <div className={`ml-1 flex items-center gap-1 text-white ${touch ? 'text-sm' : 'text-lg'}`}>
        <RebirthIcon className={`flex-none ${touch ? 'h-7 w-7' : 'h-8 w-8'}`} />
        <span key={rebirths} className="power-bump">
          {formatNumber(rebirths)} Rebirths
        </span>
      </div>
      {bonus > 1 && (
        <span className={`ml-1 text-lime-300 ${touch ? 'text-sm' : 'text-2xl'}`}>
          {pets.length > 0 ? `${pets.length} pets · ` : ''}x{formatBonus(bonus)} Wins
        </span>
      )}
    </div>
  )
}

/** Vertically stacked action buttons centred along the left edge. */
function LeftActionRail() {
  const touch = useTouchDevice()
  return (
    <div
      className={`pointer-events-none absolute z-10 flex -translate-y-1/2 flex-col items-center ${
        touch ? 'left-2 top-1/2 gap-1' : 'left-4 top-1/2 gap-2'
      }`}
    >
      <PetsButton />
      <RebirthButton />
      <ShopButton />
      <ControlsButton />
      <GuideButton />
    </div>
  )
}

/** Level bar that fills with Strength; "MAX" once there's nothing left to reach. */
/**
 * Everything in the bottom panel comes in two sizes.
 *
 * The desktop sizes are what the game was drawn at - big, chunky, readable across a
 * room. On a phone held sideways the same panel is taller than the space left over
 * once the on-screen controls have theirs, so each piece here has a compact form:
 * about half the height, and the same information.
 */
/**
 * Sizes for the boost and auto-clicker buttons on a phone.
 *
 * They scale with the screen like everything else down here, but only so far: a
 * button below about forty pixels is one you miss, and five of them will not fit
 * across a narrow phone at any size worth tapping. So they stop shrinking and the
 * row scrolls sideways instead - which is the honest answer, and the one where every
 * boost is still reachable.
 */
const BUTTON_H = (scale) => Math.max(34, Math.round(36 * scale))
const BOOST_W = (scale) => Math.max(64, Math.round(70 * scale))
const ICON_PX = (scale) => Math.max(16, Math.round(18 * scale))

function LevelBar({ strength }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const level = levelFor(strength)
  const max = level >= MAX_LEVEL
  const from = levelStrength(level)
  const to = levelStrength(level + 1)
  const fraction = max ? 1 : Math.min(1, (strength - from) / (to - from))
  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl ${touch ? 'border-2' : 'h-16 border-4'}`}
      style={{
        borderColor: INK,
        background: '#5a3208',
        boxShadow: '0 4px 0 rgba(0,0,0,0.45)',
        // Floored: below about thirty pixels the text inside stops fitting.
      ...(touch ? { height: Math.max(28, Math.round(30 * scale)) } : null),
      }}
    >
      <div
        className="absolute inset-y-0 left-0 transition-[width] duration-300"
        style={{ width: `${fraction * 100}%`, background: 'linear-gradient(to bottom, #6fe8ff, #2fb6ff 60%, #1a8fe0)' }}
      />
      <div className="absolute inset-x-3 top-1.5 h-2 rounded-full bg-white/30" />
      <div
        className={`relative flex h-full items-center justify-between text-white ${
          touch ? 'gap-2 px-2 text-xs' : 'gap-3 px-5 text-3xl'
        }`}
        style={OUTLINE}
      >
        <span>Level {level}</span>
        {max ? (
          <span>MAX</span>
        ) : (
          <span className={touch ? 'text-xs' : 'text-2xl'}>{`${formatNumber(strength)} / ${formatNumber(to)}`}</span>
        )}
      </div>
    </div>
  )
}

function BoostButton({ def, now }) {
  const touch = useTouchDevice()
  const scale = useTouchScale()
  const boost = useGame((s) => s.boost)
  const running = activeBoost(boost, now)?.multiplier === def.multiplier
  const left = running ? Math.max(0, Math.ceil((boost.until - now) / 1000)) : 0
  return (
    <GameButton
      colors={BOOST_COLORS[def.multiplier]}
      onClick={() => useGame.getState().buyBoost(def.multiplier)}
      className={`${touch ? 'shrink-0' : 'h-16 flex-1'} ${running ? 'ring-4 ring-lime-300' : ''}`}
      style={touch ? { width: BOOST_W(scale), height: BUTTON_H(scale), borderWidth: 2 } : undefined}
    >
      <span
        className={`flex items-center justify-center text-white ${touch ? 'gap-0.5' : 'gap-2 text-3xl'}`}
        style={touch ? { ...OUTLINE, fontSize: Math.max(13, Math.round(16 * scale)) } : OUTLINE}
      >
        <FistIcon
          className={touch ? '' : 'h-10 w-10'}
          style={touch ? { width: ICON_PX(scale), height: ICON_PX(scale) } : undefined}
        />
        x{def.multiplier}
      </span>
      {running ? (
        <span
          className="absolute -right-2 -top-4 rounded-md border-2 bg-lime-500 px-1.5 text-base text-white"
          style={{ ...OUTLINE, borderColor: INK }}
        >
          {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
        </span>
      ) : (
        <PriceTag cost={def.cost} />
      )}
    </GameButton>
  )
}

/**
 * The HUD: toasts, click popups, the Wins counter, the shop and its offers, the ring
 * fight panel, and the bottom panel with Strength, the level bar and
 * boosts. Also handles E.
 */
export function GameHUD() {
  const touch = useTouchDevice()
  // The panel shrinks with the controls, so the two keep their proportions and the
  // game keeps the middle of the screen (see ui/touchLayout.js).
  const scale = useTouchScale()
  // The controls sit above this panel, so they need to know how tall it came out.
  const strip = useRef(null)
  useEffect(() => {
    const el = strip.current
    if (!touch || !el) return
    const observer = new ResizeObserver(([entry]) => reportStripHeight(entry.contentRect.height))
    observer.observe(el)
    reportStripHeight(el.getBoundingClientRect().height)
    return () => observer.disconnect()
  }, [touch])
  const strength = useGame((s) => s.strength)
  const rebirths = useGame((s) => s.rebirths)
  const boost = useGame((s) => s.boost)
  const ownedPasses = useGame((s) => s.ownedPasses)
  const message = useGame((s) => s.message)
  const activeTrainer = useGame((s) => s.activeTrainer)
  const now = useNow()

  useEffect(() => {
    const shortcuts = {
      KeyP: () => useGame.getState().togglePetsPanel(),
      KeyR: () => useGame.getState().toggleRebirthPanel(),
      KeyB: () => useGame.getState().toggleShop(),
      KeyC: () => useGame.getState().toggleControlsPanel(),
      KeyG: () => useGame.getState().toggleGuide(),
    }
    const onKeyDown = (e) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return
      if (e.target instanceof HTMLElement && e.target.isContentEditable) return
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return
      const action = shortcuts[e.code]
      if (!action) return
      e.preventDefault()
      action()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const level = levelFor(strength)
  const multiplier =
    powerMultiplier({ strength, boost, rebirths, ownedPasses }, now) * (getTrainer(activeTrainer)?.multiplier ?? 1)

  // E acts on whatever is in range (see the prompts in the world); Win pads need it held.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.code === 'KeyE' && !e.repeat) useGame.getState().interactStart()
    }
    const onKeyUp = (e) => {
      if (e.code === 'KeyE') useGame.getState().interactEnd()
    }
    const onBlur = () => useGame.getState().interactEnd()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return (
    <>
      <ClickPopups />
      <AutoWinsTicker />
      {/* Wins stay at the top; action buttons form their own centred left rail. */}
      <WinsCounter />
      <LeftActionRail />
      <RingHUD />
      <LevelUpBanner />
      <PromoStack />
      <PetsPanel />
      <RebirthPanel />
      <ShopPanel />
      <ControlsPanel />
      {message && <Notice message={message} />}

      {/*
        On a phone this is a strip along the very bottom of the screen, under the
        on-screen controls rather than above them (see touchLayout.js), and its three
        columns collapse into one: side by side they want about 900px and a phone held
        sideways has 700 at best.

        Under, because the camera holds the player in the middle of the screen and
        anything parked there hides them. The one thing a player has to be able to see
        in a game about hitting things is the thing doing the hitting.

        Strength, speed and the multiplier share one line. The level bar stays
        centred, with the boost row below it.
      */}
      <div
        ref={strip}
        className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col px-2 ${
          touch ? 'bottom-0 items-stretch gap-1 pb-1' : 'bottom-4 items-center gap-1 px-4'
        }`}
        style={
          touch
            ? {
                paddingBottom: 'var(--safe-bottom)',
                // The controls are positioned on the promise that this is how tall
                // the strip gets; holding it here is what keeps that true.
                minHeight: Math.round(HUD_STRIP_H * scale),
                justifyContent: 'flex-end',
              }
            : undefined
        }
      >
        {level >= MAX_LEVEL ? (
          /*
            The reference game's own words, and this time they point at something:
            clicking it opens the Rebirth panel, which says what the trade is worth.
          */
          <button
            type="button"
            onClick={() => useGame.getState().toggleRebirthPanel(true)}
            className={`pointer-events-auto cursor-pointer text-red-500 transition hover:brightness-125 active:translate-y-0.5 ${
              touch ? 'text-center text-sm' : 'text-4xl'
            }`}
            style={OUTLINE}
          >
            Rebirth needed to level up!{' '}
            <span className={`text-yellow-300 ${touch ? 'text-xs' : 'text-2xl'}`}>
              (x{rebirthMultiplier(rebirths + 1)} Power)
            </span>
          </button>
        ) : (
          strength === 0 && (
            <div
              className={`animate-pulse text-white ${touch ? 'text-center text-xs' : 'text-2xl'}`}
              style={OUTLINE}
            >
              {touch ? 'Tap 👊 to punch!' : 'Click to punch!'}
            </div>
          )
        )}

        {touch ? (
          <>
            <div className="flex w-full items-center justify-between gap-2 text-white" style={OUTLINE}>
              {/* Click popups fly to this element; the value bounces as it changes. */}
              <span data-strength-counter className="flex items-center gap-1 whitespace-nowrap text-sm">
                <FistIcon className="h-4 w-4" />
                <span key={strength} className="power-bump">
                  {formatNumber(strength)}
                </span>{' '}
                Strength
              </span>
              <span className="flex flex-col items-end text-[9px] leading-tight text-sky-300">
                <span className="flex items-center gap-0.5">
                  <ShoeIcon className="h-2.5 w-2.5" />
                  Speed: {WALK_SPEED}
                </span>
                <span className="text-lime-300">Punch x{multiplier.toFixed(2)}</span>
              </span>
            </div>
            <LevelBar strength={strength} />
            {/* Leave room for the price tags above the compact boost buttons. */}
            <div className="pointer-events-auto flex justify-center gap-1 overflow-x-auto pt-3">
              {BOOSTS.map((def) => (
                <BoostButton key={def.multiplier} def={def} now={now} />
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-1 flex w-full max-w-4xl flex-col items-center gap-2">
              <div className="flex w-full items-center justify-between gap-3 text-white" style={OUTLINE}>
                {/* Strength stays left; speed and punch power sit together on the right. */}
                <span data-strength-counter className="flex items-center gap-1.5 whitespace-nowrap text-4xl">
                  <FistIcon className="h-10 w-10" />
                  <span key={strength} className="power-bump">
                    {formatNumber(strength)}
                  </span>
                  Strength
                </span>
                <span className="flex flex-col items-end text-lg leading-tight text-sky-300">
                  <span className="flex items-center gap-1 whitespace-nowrap">
                    <ShoeIcon className="h-5 w-5" />
                    Speed: {WALK_SPEED}
                  </span>
                  <span className="whitespace-nowrap text-lime-300">Punch Damage x{multiplier.toFixed(2)}</span>
                </span>
              </div>
              <LevelBar strength={strength} />
              <div className="flex w-full gap-3">
                {BOOSTS.map((def) => (
                  <BoostButton key={def.multiplier} def={def} now={now} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}

export default GameHUD
