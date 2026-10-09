import { PerspectiveCamera, View } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'

import { useTouchDevice } from '../game/device'
import { getEgg } from '../game/eggs'
import { formatBonus, formatNumber } from '../game/format'
import { useGame } from '../game/gameStore'
import { MAX_EQUIPPED, PETS, petWinsMultiplier } from '../game/pets'
import { PetModel } from '../game/world/PetModel'
import { shade } from '../game/world/textures'
import { CHIP, OUTLINE } from './textStyle'

const INK = '#1b1b25'
const GREEN = '#5fe64c'

/**
 * How rare a pet reads as, from its Wins bonus: the word on its card and the
 * colour its multiplier badge is painted in. The bonus is the game's only
 * ladder, so the tiers hang off it rather than off a second list to keep in step.
 */
const TIERS = [
  { upto: 1.4, name: 'Common', colors: ['#e8eef7', '#9fb0c6'], text: '#1b1b25' },
  { upto: 2, name: 'Uncommon', colors: ['#7de08a', '#2f9e44'], text: '#06240d' },
  { upto: 3, name: 'Rare', colors: ['#6fc8ff', '#1f7ac8'], text: '#04203a' },
  { upto: 6, name: 'Epic', colors: ['#c99bff', '#7a42c8'], text: '#20073f' },
  { upto: 10, name: 'Legendary', colors: ['#ffd76a', '#f0a000'], text: '#3a2300' },
  { upto: Infinity, name: 'Mythic', colors: ['#ff8ae8', '#8a4dff'], text: '#2a0640' },
]
const tierOf = (bonus) => TIERS.find((t) => bonus <= t.upto)

/**
 * Emoji are drawn by the system font and carry none of the weight the outlined text
 * beside them has. A drop shadow puts them on the same footing, so they read as part
 * of the artwork rather than as characters that wandered in.
 */
const EMOJI = { filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.55)) drop-shadow(0 0 6px rgba(0,0,0,0.35))' }

/** Chunky outlined button: dark border, gradient face and a darker bottom lip. */
function PanelButton({ colors, onClick, disabled, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`pointer-events-auto relative cursor-pointer rounded-xl border-4 px-4 py-2 text-2xl text-white transition duration-100 hover:brightness-110 active:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:brightness-100 ${className}`}
      style={{
        ...OUTLINE,
        borderColor: INK,
        background: `linear-gradient(to bottom, ${colors[0]}, ${colors[1]})`,
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      {/* The glossy strip every button in this game wears. */}
      <span className="pointer-events-none absolute inset-x-3 top-1 h-1.5 rounded-full bg-white/35" />
      {children}
    </button>
  )
}

function PawIcon({ className = 'h-8 w-8' }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g fill="#ffd24a" stroke={INK} strokeWidth="7" strokeLinejoin="round">
        <path d="M50 46 Q74 46 78 68 Q80 88 50 88 Q20 88 22 68 Q26 46 50 46 Z" />
        <ellipse cx="28" cy="34" rx="11" ry="14" />
        <ellipse cx="72" cy="34" rx="11" ry="14" />
        <ellipse cx="46" cy="20" rx="10" ry="13" />
        <ellipse cx="68" cy="14" rx="9" ry="12" />
      </g>
    </svg>
  )
}

function LockIcon({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`shrink-0 ${className}`}>
      <g stroke={INK} strokeWidth="8" strokeLinejoin="round">
        <path d="M32 46 V30 a18 18 0 0 1 36 0 V46" fill="none" />
        <rect x="20" y="46" width="60" height="44" rx="8" fill="#cbd5e1" />
      </g>
    </svg>
  )
}

function TrophyIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className={`inline-block shrink-0 align-[-0.15em] ${className}`}>
      <g stroke="#2a1a00" strokeWidth="8" strokeLinejoin="round">
        <path d="M24 16 Q6 18 12 34 Q18 46 32 44 M76 16 Q94 18 88 34 Q82 46 68 44" fill="none" />
        <path d="M22 10 H78 L74 44 Q50 68 26 44 Z" fill="#ffc21a" />
        <rect x="42" y="58" width="16" height="16" fill="#ffc21a" />
        <rect x="26" y="74" width="48" height="16" rx="3" fill="#ffc21a" />
      </g>
    </svg>
  )
}

/** The tick on a pet that's out following you. */
function CheckBadge() {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2"
      style={{ borderColor: INK, background: GREEN }}
      title="Following you"
    >
      <svg viewBox="0 0 100 100" aria-hidden="true" className="h-3 w-3">
        <path d="M22 52 L42 72 L80 28" fill="none" stroke={INK} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/**
 * One pet turning slowly on the spot, drawn into whichever card is tracking it.
 * Every portrait shares the panel's single WebGL canvas (see View.Port below),
 * so a full grid costs one context, not one per tile.
 */
function Portrait({ pet, spin = 0.6 }) {
  const ref = useRef(null)
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * spin
  })
  return (
    <>
      {/* Framed so the tallest pet (the unicorn, about 1.7 high) fits with its
          feet still in shot. */}
      <PerspectiveCamera makeDefault position={[0, 0.82, 2.6]} fov={36} />
      <ambientLight intensity={1} />
      <directionalLight position={[3, 6, 4]} intensity={1.7} />
      <directionalLight position={[-3, 2, -2]} intensity={0.5} />
      <group ref={ref} scale={1.1}>
        <PetModel pet={pet} />
      </group>
    </>
  )
}

/**
 * A pet's card in the grid, painted in its own coat colours so the roster reads
 * as a collection rather than ten identical tiles. A green frame and a tick mean
 * it's out following you. Pets that haven't been hatched yet keep their slot as
 * a locked card showing what their egg costs, so there's always something to
 * work towards.
 */
function PetCard({ pet, owned, equipped, selected, onSelect }) {
  const egg = getEgg(pet.id)
  const tier = tierOf(pet.winsBonus)
  const lip = 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)'
  return (
    <button
      type="button"
      onClick={() => onSelect(pet.id)}
      className="pointer-events-auto relative flex w-full cursor-pointer flex-col items-center overflow-hidden rounded-xl border-4 transition duration-100 hover:brightness-110 active:translate-y-0.5"
      style={{
        borderColor: equipped ? GREEN : INK,
        background: owned
          ? `linear-gradient(to bottom, ${shade(pet.colors.belly, 0.5)}, ${shade(pet.colors.body, 0.25)})`
          : 'linear-gradient(to bottom, #59616f, #333a46)',
        boxShadow: selected
          ? `${lip}, 0 0 0 4px #7fd8ff`
          : equipped
            ? `${lip}, 0 0 12px ${GREEN}88`
            : lip,
      }}
    >
      {/* Top row: what it multiplies Wins by, and whether it's out. Both stay
          inside the card - it clips, so anything hung off the edge would vanish. */}
      <span className="flex w-full items-start justify-between gap-1 px-1 pt-1">
        <span
          className="shrink-0 rounded border-2 px-1 text-xs"
          style={{
            ...CHIP,
            borderColor: INK,
            color: owned ? tier.text : '#e2e8f0',
            background: owned ? `linear-gradient(to bottom, ${tier.colors[0]}, ${tier.colors[1]})` : '#4a515e',
          }}
        >
          x{formatBonus(pet.winsBonus)}
        </span>
        {equipped && <CheckBadge />}
      </span>

      {owned ? (
        <View className="h-14 w-full sm:h-20">
          <Portrait pet={pet} />
        </View>
      ) : (
        <div className="flex h-14 w-full items-center justify-center sm:h-20">
          <LockIcon />
        </div>
      )}

      <span
        className={`w-full truncate px-1 pb-1 text-center ${owned ? 'text-base' : 'text-sm'}`}
        style={{ ...CHIP, color: owned ? '#12202e' : '#ffd76a' }}
      >
        {owned ? pet.name : formatNumber(egg?.cost ?? 0)}
      </span>
    </button>
  )
}

/** The big card beside the grid: the selected pet, what it gives, and its switch. */
function PetDetail({ pet, owned, equipped, onClose }) {
  const egg = getEgg(pet.id)
  const tier = tierOf(pet.winsBonus)
  return (
    <div
      className="prompt-pop pointer-events-auto relative flex w-full shrink-0 flex-col items-center gap-1.5 rounded-2xl border-4 p-3 md:w-60"
      style={{ borderColor: INK, background: 'linear-gradient(to bottom, #2b3446, #161b26)' }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-1 top-1 z-10 h-7 w-7 cursor-pointer rounded-lg border-2 bg-red-500 text-lg leading-none text-white transition duration-100 hover:brightness-110 active:translate-y-0.5"
        style={{ ...CHIP, borderColor: INK }}
        aria-label="Close"
      >
        ✕
      </button>

      {/* Portrait, lit from behind by the pet's own accent colour. */}
      <div
        className="h-24 w-full overflow-hidden rounded-xl border-2 md:h-36"
        style={{
          borderColor: '#00000055',
          background: `radial-gradient(circle at 50% 64%, ${shade(pet.colors.accent, -0.3)}, #0d1118 68%)`,
        }}
      >
        {owned ? (
          <View className="h-full w-full">
            <Portrait pet={pet} spin={0.9} />
          </View>
        ) : (
          <div className="flex h-full items-center justify-center">
            <LockIcon className="h-14 w-14" />
          </div>
        )}
      </div>

      <span className="text-2xl text-white" style={OUTLINE}>
        {pet.name}
      </span>
      <span
        className="rounded-md border-2 px-2 text-sm"
        style={{
          ...CHIP,
          borderColor: INK,
          color: tier.text,
          background: `linear-gradient(to bottom, ${tier.colors[0]}, ${tier.colors[1]})`,
        }}
      >
        {tier.name} · {pet.species}
      </span>

      <span className="mt-1 text-xl text-yellow-300" style={OUTLINE}>
        x{formatBonus(pet.winsBonus)} Wins
      </span>

      {owned ? (
        <PanelButton
          colors={equipped ? ['#c9d2e0', '#7f8a9c'] : ['#7dff6a', '#2fae1f']}
          onClick={() => useGame.getState().togglePet(pet.id)}
          className="mt-1 w-full"
        >
          {equipped ? 'Unequip' : 'Equip'}
        </PanelButton>
      ) : (
        <span className="mt-1 text-center text-sm text-slate-300" style={CHIP}>
          Hatch the {egg?.name} for <TrophyIcon className="h-4 w-4" /> {formatNumber(egg?.cost ?? 0)}
        </span>
      )}
    </div>
  )
}

/** One of the two counters under the header. */
function Counter({ value, of, label }) {
  return (
    <span
      className="rounded-lg border-2 px-3 py-0.5 text-xl text-white"
      style={{ ...OUTLINE, borderColor: INK, background: '#00000044' }}
    >
      <span className="text-yellow-300">{value}</span> / {of} {label}
    </span>
  )
}

/**
 * The Pets panel: every pet in the game as a card, the ones you've hatched in
 * their own colours and the rest locked behind their egg's price. Tapping a card
 * selects it; the card beside the grid equips or unequips it. Any number of your
 * pets can be out at once (up to MAX_EQUIPPED) and their Wins bonuses add up, so
 * the total in the header is what every payout is multiplied by.
 */
export function PetsPanel() {
  const open = useGame((s) => s.petsOpen)
  const ownedPets = useGame((s) => s.ownedPets)
  const equippedPets = useGame((s) => s.equippedPets)
  const selected = useGame((s) => s.petsSelected)
  const canvasRef = useRef(null)

  // Escape closes it, like every other overlay.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.code === 'Escape') useGame.getState().togglePetsPanel(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (!open) return null

  const total = petWinsMultiplier(equippedPets)
  const shown = PETS.find((p) => p.id === selected) ?? null
  const allOut = ownedPets.length > 0 && equippedPets.length === ownedPets.length

  return (
    <div className="pointer-events-auto absolute inset-0 z-30 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      {/* One canvas for every portrait in the panel; each card's View scissors
          its own slice out of it. It sits above the panel - otherwise the card
          backgrounds paint straight over the portraits - and passes every click
          through to the cards underneath. */}
      <Canvas
        ref={canvasRef}
        // pointerEvents has to be set here, not through a class: Canvas writes
        // `pointer-events: auto` inline on its wrapper, and an inline style beats
        // any class. Without this the full-screen canvas swallows every click on
        // the panel underneath it.
        style={{ position: 'fixed', inset: 0, zIndex: 60, pointerEvents: 'none' }}
        gl={{ antialias: true }}
      >
        <View.Port />
      </Canvas>

      <div
        className="prompt-pop relative z-50 my-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border-4 shadow-2xl"
        style={{ borderColor: INK, background: 'linear-gradient(to bottom, #3a4455, #1e2532)' }}
      >
        {/* Header */}
        <div
          className="relative flex items-center gap-3 border-b-4 px-4 py-2"
          style={{ borderColor: INK, background: 'linear-gradient(to bottom, #ffc153, #ef7d00)' }}
        >
          <span className="pointer-events-none absolute inset-x-4 top-1.5 h-2 rounded-full bg-white/30" />
          <PawIcon />
          <span className="text-3xl text-white" style={OUTLINE}>
            Pets
          </span>
          <span
            className="ml-auto rounded-lg border-2 px-3 py-0.5 text-2xl"
            style={{ ...OUTLINE, borderColor: INK, background: '#00000055', color: total > 1 ? '#ffe066' : '#ffffff' }}
          >
            x{formatBonus(total)} Wins
          </span>
          <button
            type="button"
            onClick={() => useGame.getState().togglePetsPanel(false)}
            className="cursor-pointer rounded-lg border-4 bg-red-500 px-3 text-2xl text-white transition duration-100 hover:brightness-110 active:translate-y-0.5"
            style={{ ...OUTLINE, borderColor: INK }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Counters */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3">
          <Counter value={equippedPets.length} of={MAX_EQUIPPED} label="Equipped" />
          <Counter value={ownedPets.length} of={PETS.length} label="Pets" />
        </div>

        <div className="flex flex-col gap-3 p-4 md:flex-row">
          {/* Actions */}
          <div className="flex shrink-0 gap-3 md:w-40 md:flex-col">
            <PanelButton
              colors={['#7dff6a', '#2fae1f']}
              onClick={() => useGame.getState().equipAllPets()}
              disabled={allOut}
              className="flex-1 md:flex-none"
            >
              Equip All
            </PanelButton>
            <PanelButton
              colors={['#c9d2e0', '#7f8a9c']}
              onClick={() => useGame.getState().unequipAllPets()}
              disabled={equippedPets.length === 0}
              className="flex-1 md:flex-none"
            >
              Unequip All
            </PanelButton>
            <span className="hidden text-center text-sm text-slate-300 md:block" style={CHIP}>
              Every pet you send out adds its bonus on top.
            </span>
          </div>

          {/* Grid. Never scrolls: a View draws into the canvas by screen rect, so
              a card scrolled out of a clipped box would still paint over the
              panel. The roster is a fixed ten, so it's sized to always fit. */}
          <div className="grid flex-1 auto-rows-min content-start grid-cols-4 gap-2 sm:gap-3 md:grid-cols-5">
            {PETS.map((pet) => (
              <PetCard
                key={pet.id}
                pet={pet}
                owned={ownedPets.includes(pet.id)}
                equipped={equippedPets.includes(pet.id)}
                selected={selected === pet.id}
                onSelect={(id) => useGame.getState().selectPet(id)}
              />
            ))}
          </div>

          {shown && (
            <PetDetail
              pet={shown}
              owned={ownedPets.includes(shown.id)}
              equipped={equippedPets.includes(shown.id)}
              onClose={() => useGame.getState().selectPet(null)}
            />
          )}
        </div>

        {ownedPets.length === 0 && (
          <div className="px-4 pb-4 text-center text-lg text-slate-200" style={CHIP}>
            No pets yet — walk up to an egg in the Eggs zone and press <span className="text-yellow-300">E</span> to hatch one.
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The Pets button on the HUD's left rail, with how many are out on its corner.
 *
 * Laid out in the flow of the counter column rather than pinned to a `top-`, so it
 * slides down of its own accord when the pet-bonus line above it appears. It used
 * to be absolute, and the line landed on top of it.
 */
export function PetsButton() {
  // Half size on a phone, so the left rail stops before the thumbstick starts.
  const touch = useTouchDevice()
  const equipped = useGame((s) => s.equippedPets.length)
  return (
    <button
      type="button"
      onClick={() => useGame.getState().togglePetsPanel()}
      className={`pointer-events-auto relative mt-0 flex cursor-pointer flex-col items-center justify-center rounded-xl transition duration-100 hover:-translate-y-0.5 hover:scale-[1.03] hover:brightness-110 active:translate-y-0.5 active:scale-[0.98] ${
        touch ? 'h-12 w-12 border-2' : 'h-[4.5rem] w-[4.5rem] border-4'
      }`}
      style={{
        borderColor: INK,
        background: 'linear-gradient(to bottom, #ffd24a, #f0a000)',
        boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.22), 0 4px 0 rgba(0,0,0,0.45)',
      }}
    >
      <span className="pointer-events-none absolute inset-x-2 top-1 h-1.5 rounded-full bg-white/35" />
      <span className="pointer-events-none absolute -left-2 -top-2 z-20 flex h-5 min-w-5 items-center justify-center rounded-md border-2 px-1 text-[11px] text-white" style={{ ...CHIP, borderColor: INK, background: '#2879f0' }}>P</span>
      {/* The dog, matching the reference art. The drawn paw it replaced is still
          used inside the panel, where it is small and wants a flat silhouette. */}
      <span className={touch ? 'text-2xl' : 'text-4xl'} style={EMOJI} aria-hidden>
        🐶
      </span>
      <span className={`text-white ${touch ? 'text-[11px]' : 'text-sm'}`} style={CHIP}>
        Pets
      </span>
      {equipped > 0 && (
        <span
          className="absolute -right-2 -top-2 flex h-6 min-w-6 items-center justify-center rounded-full border-2 px-1 text-sm text-white"
          style={{ ...CHIP, borderColor: INK, background: GREEN }}
        >
          {equipped}
        </span>
      )}
    </button>
  )
}

export default PetsPanel
