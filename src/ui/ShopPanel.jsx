import { useEffect, useMemo, useState } from 'react'

import { useTouchDevice } from '../game/device'
import { footprintCanvas, footprintCost, FOOTPRINT_SETS, footprintRarity, footprintStyle } from '../game/footprintSets'
import { formatNumber } from '../game/format'
import { useGame } from '../game/gameStore'
import { getPass, PASSES } from '../game/passes'
import { CHIP, OUTLINE } from './textStyle'

/**
 * The shop: the passes and every pair of gloves' footprints, all bought with Wins.
 * Gloves, bags and the Exclusive egg are sold where they stand, on their VIP platforms;
 * the shop says so at the bottom rather than duplicating them.
 */

const INK = '#1b1b25'
/** See RebirthPanel: emoji need a shadow to sit with the outlined text. */
const EMOJI = { filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(0,0,0,0.35))' }

/** A trophy and a price in Wins, as every buy button wears it. */
function Price({ item, className = '' }) {
  return (
    <span className={`flex items-center gap-1 ${className}`}>
      <span style={EMOJI} aria-hidden>
        🏆
      </span>
      {formatNumber(item.cost)}
    </span>
  )
}

function ShopButtonFace({ colors, onClick, disabled, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pointer-events-auto relative cursor-pointer rounded-xl border-4 text-white transition duration-100 hover:-translate-y-0.5 hover:scale-[1.02] hover:brightness-110 active:translate-y-0.5 active:scale-[0.98] disabled:cursor-default disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:brightness-100 ${className}`}
      style={{
        ...OUTLINE,
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-white/35" />
      {children}
    </button>
  )
}

/** One pass: what it does, and Buy - or Owned, or (for Auto Wins) a switch. */
function PassRow({ pass, touch }) {
  const owned = useGame((s) => s.ownedPasses.includes(pass.id))
  const autoWins = useGame((s) => s.autoWins)
  const buy = () => useGame.getState().buyPass(pass.id)
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-4 ${touch ? 'p-1.5' : 'p-2.5'}`}
      style={{ borderColor: INK, background: 'linear-gradient(to bottom, #3a3060, #2a2248)' }}
    >
      <span
        className={`flex shrink-0 items-center justify-center rounded-lg border-2 ${touch ? 'h-10 w-10 text-2xl' : 'h-14 w-14 text-4xl'}`}
        style={{ ...EMOJI, borderColor: INK, background: pass.color }}
        aria-hidden
      >
        {pass.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className={`text-white ${touch ? 'text-base' : 'text-2xl'}`} style={OUTLINE}>
          {pass.name}
        </div>
        <div className={`text-white/75 ${touch ? 'text-[10px] leading-tight' : 'text-sm'}`} style={CHIP}>
          {pass.blurb}
        </div>
      </div>
      {owned ? (
        pass.id === 'autoWins' ? (
          <ShopButtonFace
            colors={autoWins ? ['#7ce86a', '#2f9e44'] : ['#ff6a6a', '#d02b2b']}
            onClick={() => useGame.getState().toggleAutoWins()}
            className={touch ? 'px-2 py-1 text-sm' : 'px-4 py-2 text-xl'}
          >
            {autoWins ? 'ON' : 'OFF'}
          </ShopButtonFace>
        ) : (
          <span className={`shrink-0 text-lime-300 ${touch ? 'text-sm' : 'text-xl'}`} style={OUTLINE}>
            OWNED
          </span>
        )
      ) : (
        <ShopButtonFace
          colors={['#3fb6ff', '#0f6fd8']}
          onClick={buy}
          className={touch ? 'px-2 py-1 text-sm' : 'px-4 py-2 text-xl'}
        >
          <Price item={pass} />
        </ShopButtonFace>
      )}
    </div>
  )
}

/**
 * One pair's footprints: the print on a backdrop in its rarity's colours, the gloves it
 * belongs to, and Buy (Wins) - or Wear / On once owned. Locked, saying what it needs,
 * until the gloves themselves are owned.
 */
function FootprintTile({ glove, touch }) {
  const hasGloves = useGame((s) => s.owned.includes(glove.id))
  const owned = useGame((s) => s.ownedFootprints.includes(glove.id))
  const wearing = useGame((s) => s.footprints === glove.id)
  const canAfford = useGame((s) => s.wins >= footprintCost(glove))
  const preview = useMemo(() => footprintCanvas(glove.id).toDataURL(), [glove.id])
  const rarity = footprintRarity(glove)
  const style = footprintStyle(glove)
  const cost = footprintCost(glove)
  const locked = !hasGloves && !owned
  const pick = () => useGame.getState().pickFootprints(glove.id)

  let label
  let colors
  if (wearing) [label, colors] = ['✔ ON', ['#7ce86a', '#2f9e44']]
  else if (owned) [label, colors] = ['WEAR', ['#3fb6ff', '#0f6fd8']]
  else if (locked) [label, colors] = ['LOCKED', ['#6a6a7a', '#44444f']]
  else [label, colors] = [`🏆 ${formatNumber(cost)}`, canAfford ? ['#fff27a', '#f0a000'] : ['#ff8a6a', '#c0392b']]

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border-4 ${touch ? 'p-1' : 'p-1.5'}`}
      style={{
        borderColor: wearing ? '#7ce86a' : INK,
        background: `linear-gradient(to bottom, ${rarity.colors[1]}, #221a40 70%)`,
        boxShadow: wearing ? '0 0 14px rgba(124,232,106,0.7)' : 'inset 0 -4px 0 rgba(0,0,0,0.25)',
      }}
    >
      <div
        className={`relative flex items-center justify-center rounded-lg ${touch ? 'h-14' : 'h-20'}`}
        style={{ background: `radial-gradient(circle, ${rarity.colors[0]}66, transparent 70%)` }}
      >
        <img
          src={preview}
          alt=""
          className={`${touch ? 'h-11' : 'h-16'} ${locked ? 'opacity-40 grayscale' : ''}`}
          style={{ filter: !locked && style.glow ? `drop-shadow(0 0 ${4 + style.tier / 3}px ${glove.trim})` : undefined }}
        />
        {locked && (
          <span className={`absolute ${touch ? 'text-xl' : 'text-3xl'}`} style={EMOJI} aria-hidden>
            🔒
          </span>
        )}
        <span
          className={`absolute left-0 top-0 rounded-md px-1 text-white ${touch ? 'text-[8px]' : 'text-[10px]'}`}
          style={{ ...CHIP, background: `linear-gradient(to bottom, ${rarity.colors[0]}, ${rarity.colors[1]})` }}
        >
          {rarity.name.toUpperCase()}
        </span>
      </div>
      <div className={`truncate text-center text-white ${touch ? 'text-[10px]' : 'text-sm'}`} style={CHIP} title={glove.name}>
        {glove.name}
      </div>
      <div className={`mb-1 truncate text-center text-white/60 ${touch ? 'text-[8px]' : 'text-[10px]'}`} style={CHIP}>
        {locked ? `Needs the ${glove.name}` : `${style.sparkles ? 'Sparkling' : style.glow ? 'Glowing' : 'Classic'} trail`}
      </div>
      <ShopButtonFace
        colors={colors}
        onClick={pick}
        disabled={locked}
        className={`mt-auto w-full ${touch ? 'px-1 py-0.5 text-[10px]' : 'px-1 py-1 text-sm'}`}
      >
        {label}
      </ShopButtonFace>
    </div>
  )
}

const TABS = [
  { id: 'passes', label: 'Passes', emoji: '⭐', colors: ['#ffd84a', '#f08c00'] },
  { id: 'footprints', label: 'Footprints', emoji: '👣', colors: ['#7ce86a', '#2f9e44'] },
]

function ShopDialog() {
  const touch = useTouchDevice()
  const [tab, setTab] = useState('passes')
  const wins = useGame((s) => s.wins)
  const close = () => useGame.getState().toggleShop(false)

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') useGame.getState().toggleShop(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    // The dialog never outgrows the screen: its header and tabs stay put and only the
    // list scrolls, so the close button can never be scrolled out of reach.
    <div
      className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className={`flex max-h-full w-full flex-col rounded-2xl border-4 ${touch ? 'max-w-md p-2' : 'max-w-3xl p-4'}`}
        onClick={(e) => e.stopPropagation()}
        style={{
          borderColor: INK,
          background: 'linear-gradient(to bottom, #4a3a7a, #2e2452)',
          boxShadow: '0 10px 0 rgba(0,0,0,0.45), 0 0 40px rgba(160,100,255,0.35)',
        }}
      >
        <div className={`flex shrink-0 items-center gap-2 ${touch ? 'mb-2' : 'mb-3'}`}>
          <span className={`flex-1 text-white ${touch ? 'text-2xl' : 'text-4xl'}`} style={OUTLINE}>
            🛒 Shop
          </span>
          <span
            className={`flex items-center gap-1 rounded-xl border-2 text-yellow-200 ${touch ? 'px-2 py-0.5 text-sm' : 'px-3 py-1 text-xl'}`}
            style={{ ...OUTLINE, borderColor: INK, background: 'rgba(0,0,0,0.3)' }}
          >
            <span style={EMOJI} aria-hidden>
              🏆
            </span>
            {formatNumber(wins)}
          </span>
          <ShopButtonFace colors={['#ff6a6a', '#d02b2b']} onClick={close} className={touch ? 'px-3 py-1 text-lg' : 'px-4 py-2 text-2xl'}>
            &#10006;
          </ShopButtonFace>
        </div>

        <div className={`flex shrink-0 ${touch ? 'mb-1 gap-1.5' : 'mb-2 gap-2.5'}`}>
          {TABS.map((t) => {
            const on = tab === t.id
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-4 text-white transition duration-100 hover:brightness-110 ${
                  touch ? 'py-1 text-sm' : 'py-2 text-xl'
                } ${on ? '' : 'opacity-60 hover:opacity-90'}`}
                style={{
                  ...OUTLINE,
                  borderColor: INK,
                  background: on ? `linear-gradient(to bottom, ${t.colors[0]}, ${t.colors[1]})` : '#2a2248',
                  boxShadow: on ? 'inset 0 -4px 0 rgba(0,0,0,0.22), 0 3px 0 rgba(0,0,0,0.45)' : 'none',
                }}
              >
                <span style={EMOJI} aria-hidden>
                  {t.emoji}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-1 pt-3">
          {tab === 'passes' && (
            <div className={`flex flex-col ${touch ? 'gap-1.5' : 'gap-2.5'}`}>
              {PASSES.map((pass) => (
                <PassRow key={pass.id} pass={pass} touch={touch} />
              ))}
            </div>
          )}

          {tab === 'footprints' && (
            <>
              <div className={`text-center text-white/80 ${touch ? 'mb-2 text-[10px]' : 'mb-3 text-sm'}`} style={CHIP}>
                Every pair of gloves leaves its own trail - the better the gloves, the fancier the footprints. Own the gloves, then buy their
                footprints with Wins.
              </div>
              <div className={`grid ${touch ? 'grid-cols-3 gap-1.5' : 'grid-cols-5 gap-2.5'}`}>
                {FOOTPRINT_SETS.map((glove) => (
                  <FootprintTile key={glove.id} glove={glove} touch={touch} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className={`shrink-0 text-center text-white/70 ${touch ? 'mt-2 text-[10px]' : 'mt-3 text-sm'}`} style={CHIP}>
          VIP gloves, VIP bags and the Exclusive egg are on their gold platforms in the lobby.
          Passes are yours for good, on every device you log in on.
        </div>
      </div>
    </div>
  )
}

export function ShopPanel() {
  const open = useGame((s) => s.shopOpen)
  return open ? <ShopDialog /> : null
}

/** The left-rail button that opens the shop. */
export function ShopButton() {
  const touch = useTouchDevice()
  return (
    <button
      type="button"
      onClick={() => useGame.getState().toggleShop()}
      className={`pointer-events-auto relative mt-0 flex cursor-pointer flex-col items-center justify-center rounded-xl transition duration-100 hover:-translate-y-0.5 hover:scale-[1.03] hover:brightness-110 active:translate-y-0.5 active:scale-[0.98] ${
        touch ? 'h-12 w-12 border-2' : 'h-[4.5rem] w-[4.5rem] border-4'
      }`}
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #ff7ad8, #e0309a)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35" />
      <span className="pointer-events-none absolute -left-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border-2 px-1 text-[11px] text-white" style={{ ...CHIP, borderColor: INK, background: '#f0a000' }}>B</span>
      <span className={touch ? 'text-2xl' : 'text-4xl'} style={EMOJI} aria-hidden>
        🛒
      </span>
      <span className={`text-white ${touch ? 'text-[11px]' : 'text-sm'}`} style={CHIP}>
        Shop
      </span>
    </button>
  )
}

/**
 * The two big offers down the right edge, the way the reference game shows them:
 * "2x Power" and "2x Wins", each with its price and "Permanent!". Each one goes away
 * once it is owned - an advert for something you have is clutter.
 */
export function PromoStack() {
  const touch = useTouchDevice()
  const owned = useGame((s) => s.ownedPasses)
  const offers = ['power2x', 'wins2x'].filter((id) => !owned.includes(id)).map(getPass)
  if (offers.length === 0) return null
  return (
    <div
      className={`pointer-events-none absolute z-10 flex flex-col items-end ${
        touch ? 'right-2 top-28 gap-2' : 'right-4 top-1/2 -translate-y-1/2 gap-4'
      }`}
    >
      {offers.map((pass) => {
        const powerPass = pass.id === 'power2x'
        const colors = powerPass ? ['#70dcff', '#1374d4'] : ['#fff27a', '#f0a000']
        const accent = powerPass ? '#55c8ff' : '#ffd84a'
        const buy = () => useGame.getState().buyPass(pass.id)

        if (touch) {
          return (
            <div key={pass.id} className="w-32">
              <ShopButtonFace
                colors={colors}
                onClick={buy}
                className="flex h-10 w-full items-center justify-between gap-1 px-1.5 text-[11px]"
              >
                <span className="whitespace-nowrap">{pass.name}</span>
                <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-yellow-100">
                  <Price item={pass} />
                </span>
              </ShopButtonFace>
              <div className="mt-0.5 text-center text-[8px] text-amber-100" style={CHIP}>
                PERMANENT
              </div>
            </div>
          )
        }

        return (
          <div
            key={pass.id}
            className="pointer-events-auto w-56 rounded-2xl border-2 p-1.5 shadow-xl backdrop-blur-sm"
            style={{
              borderColor: accent,
              background: powerPass
                ? 'linear-gradient(145deg, rgba(18, 71, 112, 0.96), rgba(12, 35, 65, 0.96))'
                : 'linear-gradient(145deg, rgba(112, 76, 10, 0.97), rgba(54, 36, 7, 0.97))',
              boxShadow: `0 0 16px ${powerPass ? 'rgba(55, 177, 255, 0.28)' : 'rgba(255, 190, 35, 0.28)'}, 0 6px 0 rgba(0,0,0,0.4)`,
            }}
          >
            <ShopButtonFace
              colors={colors}
              onClick={buy}
              className="w-full px-2 py-2 text-3xl"
            >
              {pass.name}
            </ShopButtonFace>
            <div className="mt-1.5 flex items-center justify-between rounded-lg border border-white/15 bg-black/25 px-2 py-1">
              <span className="text-xs text-white/80" style={CHIP}>
                ONLY
              </span>
              <span className="flex items-center gap-1 text-base text-yellow-200" style={OUTLINE}>
                <Price item={pass} />
              </span>
            </div>
            <div className="mt-1 text-center text-xs text-amber-200" style={CHIP}>
              PERMANENT
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ShopPanel
