import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import { aurasForLevel, getAura } from './auras'
import { getEgg } from './eggs'
import { formatBonus, formatNumber } from './format'
import { footprintCost } from './footprintSets'
import { DEFAULT_GLOVE, getGlove } from './gloves'
import { getPass, passMultiplier } from './passes'
import { getPet, MAX_EQUIPPED, PETS, petWinsMultiplier } from './pets'
import {
  activeBoost,
  AUTO_CLICKERS,
  BOOSTS,
  BOOST_S,
  canRebirth,
  levelFor,
  levelMultiplier,
  rebirthMultiplier,
} from './progression'
import { playSound } from './sound'
import { getTrainer, rebirthsShort, TRAINERS } from './trainers'
import {
  isSpaceWall,
  padStrength,
  padUnlocked,
  padWins,
  stageWins,
  WALL_RESET_DELAY_S,
  WALLS_PER_STAGE,
  wallStage,
} from './walls'

/** Strength for one punch. Kept a whole number so the totals stay tidy. */
export const clickGain = (glove, trainer, multiplier = 1) =>
  Math.max(1, Math.round(glove.power * (trainer?.multiplier ?? 1) * multiplier))

/**
 * Level times any running boost times every rebirth earned times the 2x Power pass:
 * everything that multiplies a punch, bar the bag you are standing at.
 *
 * Every field is read with a default so that a caller passing a partial slice - the
 * HUD passes only what it subscribes to - multiplies by one rather than by undefined.
 */
export const powerMultiplier = ({ strength = 0, boost = null, rebirths = 0, ownedPasses = [] }, now = Date.now()) =>
  levelMultiplier(levelFor(strength)) *
  (activeBoost(boost, now)?.multiplier ?? 1) *
  rebirthMultiplier(rebirths) *
  passMultiplier(ownedPasses, 'power2x')

/** Everything that multiplies a Wins payout: the pets following you and the 2x Wins pass. */
export const winsMultiplier = ({ equippedPets = [], ownedPasses = [] }) =>
  petWinsMultiplier(equippedPets) * passMultiplier(ownedPasses, 'wins2x')

/**
 * The stage whose Win pad Auto Wins pays out: the last one whose ten walls have all
 * been broken at some point. 0 before stage 1 is cleared.
 */
export const clearedStage = (bestWall) => Math.floor(bestWall / WALLS_PER_STAGE)

/** Seconds between Auto Wins payouts. */
export const AUTO_WINS_S = 10

/**
 * Everything that is the player's progress, and nothing that is just this session.
 * This is exactly what is saved - to localStorage, and to the game server when
 * signed in (see game/cloudSave.js) - and the defaults are a brand new player.
 */
export const DEFAULT_PROGRESS = Object.freeze({
  /** Strength: what every punch adds to, and what a wall takes as damage. */
  strength: 0,
  /** Rebirths completed. Every one is a permanent multiplier on every punch. */
  rebirths: 0,
  wins: 0,
  /** Ids of the gloves bought (see gloves.js); the rookies are free. */
  owned: [DEFAULT_GLOVE],
  /** The pair being worn. */
  equipped: DEFAULT_GLOVE,
  /** Ids of hatched eggs (one pet each — see pets.js). */
  ownedPets: [],
  /**
   * Ids of the pets currently following the player, in the order they walk
   * (first one leads). Their Wins bonuses add up — see petWinsMultiplier.
   */
  equippedPets: [],
  unlockedTrainers: [TRAINERS[0].id],
  /** Highest lobby stage wall ever broken (0 = none). */
  bestWall: 0,
  /** Highest Space World wall ever broken, counted from 1 (0 = none). */
  spaceBest: 0,
  /** Running power boost: `{ multiplier, until }` (until in ms), or null. */
  boost: null,
  /** Whether the OP Auto Clicker has been bought. */
  opAutoOwned: false,
  /**
   * Ids of the passes the player owns (see game/passes.js), bought with Wins.
   */
  ownedPasses: [],
  /** Whether Auto Wins is switched on (it only runs once the pass is owned). */
  autoWins: false,
  /** Ids of the gloves whose footprints have been bought in the shop (see footprintSets.js). */
  ownedFootprints: [],
  /** The footprints being left, by glove id, or null for none. */
  footprints: null,
  /** Ids of the auras earned (by level) or bought (in the shop); see auras.js. */
  ownedAuras: [],
  /** The aura being worn, or null for none. */
  aura: null,
  /** The highest level ever reached, on any run: the level auras go by this. */
  bestLevel: 1,
  /** Fights won in the boxing rings (see world/BoxingRing.jsx). */
  ringWins: 0,
  /** Most fights won in a row without leaving the ring. */
  ringStreak: 0,
})

/** The keys of DEFAULT_PROGRESS, which is the list of what gets saved. */
export const PROGRESS_KEYS = Object.keys(DEFAULT_PROGRESS)

/** Just the progress out of a full store snapshot. */
export const pickProgress = (state) => Object.fromEntries(PROGRESS_KEYS.map((key) => [key, state[key]]))

const MESSAGE_MS = 2600
/** Matches the `click-popup` animation in index.css. */
const POPUP_MS = 1100
let messageId = 0
let popupId = 0

/**
 * Player progress, plus the session state around it.
 *
 * Saved to localStorage on every change, and - while signed in - to the game server
 * as well, which is what brings it back on another device or after the browser's
 * storage is cleared. See game/cloudSave.js for when each one wins.
 *
 * Readable outside React (e.g. in useFrame) via `useGame.getState()`.
 */
export const useGame = create(
  persist(
    (set, get) => ({
      ...DEFAULT_PROGRESS,
      /**
       * Whose progress this is: the Bloxity user id it was loaded for or saved as,
       * or null for a guest's. Lets cloudSave tell a guest's run (which a first
       * sign-in adopts) from someone else's (which it never does).
       */
      ownerId: null,
      /** The server's revision of the save this state was last synced with. */
      syncedRev: 0,

      /** Whether the Rebirth panel is open. Not saved: it starts closed every session. */
      rebirthOpen: false,
      /** Whether the Pets panel is open. */
      petsOpen: false,
      /** Whether the shop is open. */
      shopOpen: false,
      /** Whether the Controls panel is open. */
      controlsOpen: false,
      /** Whether the Guide is open. It is, every time the game starts. */
      guideOpen: true,
      /** Which pet's card the Pets panel is showing on the right, or null. */
      petsSelected: null,

      /** Id of the bag whose pad the player is standing on, or null. */
      activeTrainer: null,
      /** Yaw the player turns to while training, so they face the bag. */
      trainYaw: Math.PI,
      /** `[x, z]` the player steps to while training, in reach of the bag; or null. */
      trainSpot: null,
      /** What the E key acts on: `{ kind: 'glove' | 'egg' | 'pad' | 'trainer', id }`, or null. */
      interact: null,
      /** `performance.now()` seconds when E started being held, or null. */
      holdingSince: null,
      /** The stage wall within range: `{ number, z }` (z of its centre), or null. */
      nearWall: null,
      /** Walls broken this run, `{ [number]: true }`; cleared back in the lobby. */
      brokenWalls: {},
      /** When the broken walls rebuild (performance.now()/1000), once that's due; else null. */
      wallsResetAt: null,
      /** Which auto clicker is running: 'off' | 'normal' | 'op'. */
      autoClick: 'off',
      /** Player position `[x, y, z]` at the last punch, so a wall knows which side was hit. */
      punchPos: null,
      /** "+N Strength" popups flying to the Strength counter: `{ id, gain, x, y, dx, dy }`. */
      popups: [],
      /** `performance.now()` seconds of the last level-up, for the burst (see PlayerFx). */
      levelUpAt: -Infinity,
      /** `performance.now()` seconds of the last punch; drives the swing and the hits. */
      punchAt: -Infinity,
      /** Punches thrown this session: which hand throws, and which punch it is (see avatarRig). */
      punchCount: 0,
      /** Strength gained by the last punch, for the bag's "+N" popup. */
      lastGain: 0,
      /** Latest toast: `{ text, tone: 'info'|'success'|'error', id }`. */
      message: null,

      notify: (text, tone = 'info') => {
        const id = ++messageId
        set({ message: { text, tone, id } })
        // Every "can't do that" goes through here, so they all get the same bonk.
        if (tone === 'error') playSound('error')
        setTimeout(() => {
          if (get().message?.id === id) set({ message: null })
        }, MESSAGE_MS)
      },

      /**
       * One punch with the gloves on: gain their Strength, times the bag, level, boost,
       * rebirths and passes. `popup` (`{ x, y, dx, dy }` in screen pixels) sends a
       * "+N" flying from (x, y) by (dx, dy), to the Strength counter. `at` is the
       * player's position, if known.
       */
      punch: (popup, at) => {
        const state = get()
        const gain = clickGain(getGlove(state.equipped), getTrainer(state.activeTrainer), powerMultiplier(state))
        const next = {
          strength: state.strength + gain,
          lastGain: gain,
          punchAt: performance.now() / 1000,
          punchCount: state.punchCount + 1,
          punchPos: at ?? null,
        }
        // A new level: celebrate it, and hand over any aura it earns.
        const before = levelFor(state.strength)
        const after = levelFor(next.strength)
        if (after > before) {
          next.levelUpAt = next.punchAt
          if (after > state.bestLevel) {
            next.bestLevel = after
            const earned = aurasForLevel(after).filter((id) => !state.ownedAuras.includes(id))
            if (earned.length) {
              next.ownedAuras = [...state.ownedAuras, ...earned]
              // The first one is put straight on; after that they wait in the shop.
              if (!state.aura) next.aura = earned[earned.length - 1]
              setTimeout(() => {
                const names = earned.map((id) => getAura(id).name).join(', ')
                get().notify(`Level ${after}! New aura unlocked: ${names}`, 'success')
              }, 0)
            }
          }
          playSound('levelUp')
        }
        if (popup) {
          const id = ++popupId
          // Capped, so frantic clicking can't pile up hundreds of elements.
          next.popups = [...state.popups.slice(-24), { ...popup, gain, id }]
          setTimeout(() => set({ popups: get().popups.filter((p) => p.id !== id) }), POPUP_MS)
        }
        set(next)
      },

      /**
       * Stepping onto a bag's pad: train if it's unlocked. A locked one only offers
       * itself with an E prompt (see unlockTrainer); nothing is spent just by
       * walking over it. `faceYaw` is the yaw that points the player at the bag.
       */
      enterTrainer: (id, faceYaw = Math.PI, spot = null) => {
        if (!getTrainer(id)) return
        if (!get().unlockedTrainers.includes(id)) {
          set({ interact: { kind: 'trainer', id }, holdingSince: null, trainYaw: faceYaw, trainSpot: spot })
          return
        }
        set({ activeTrainer: id, trainYaw: faceYaw, trainSpot: spot })
      },

      /** E on a locked bag's pad: buy it if affordable, then start training on it. */
      unlockTrainer: (id) => {
        const { unlockedTrainers, wins, rebirths, interact, notify } = get()
        const trainer = getTrainer(id)
        if (!trainer || unlockedTrainers.includes(id)) return
        // The top three want rebirths as well as Wins, and the rebirths are checked
        // first: being told to go and rebirth is more use than being told a price
        // that would not have been enough anyway.
        const short = rebirthsShort(trainer, rebirths)
        if (short > 0) {
          notify(`${trainer.name} needs ${trainer.rebirths} Rebirths - ${short} to go`, 'error')
          return
        }
        if (wins < trainer.cost) {
          notify(`Need ${formatNumber(trainer.cost - wins)} more Wins to unlock the ${trainer.name}`, 'error')
          return
        }
        set({
          wins: wins - trainer.cost,
          unlockedTrainers: [...unlockedTrainers, id],
          activeTrainer: id,
          interact: interact?.kind === 'trainer' && interact.id === id ? null : interact,
        })
        notify(`Unlocked the ${trainer.name} - x${trainer.multiplier} Strength!`, 'success')
        playSound('unlock')
      },

      leaveTrainer: (id) => {
        if (get().activeTrainer === id) set({ activeTrainer: null })
        get().clearInteract('trainer', id)
      },

      /** A glove pad, egg, Win pad or locked bag came into E range. */
      setInteract: (kind, id) => set({ interact: { kind, id }, holdingSince: null }),
      /** It went out of range; ignored if something else has taken over since. */
      clearInteract: (kind, id) => {
        const current = get().interact
        if (current?.kind === kind && current.id === id) set({ interact: null, holdingSince: null })
      },
      /** E pressed (or the prompt clicked): act on whatever is in range. */
      interactNow: () => {
        const target = get().interact
        if (target?.kind === 'glove') get().pickGlove(target.id)
        else if (target?.kind === 'egg') get().hatchEgg(target.id)
        else if (target?.kind === 'trainer') get().unlockTrainer(target.id)
      },
      /** E went down. Win pads need it held (see WinPad); everything else acts at once. */
      interactStart: () => {
        const { interact, holdingSince } = get()
        if (interact?.kind !== 'pad') get().interactNow()
        else if (holdingSince === null) set({ holdingSince: performance.now() / 1000 })
      },
      /** E came up. */
      interactEnd: () => {
        if (get().holdingSince !== null) set({ holdingSince: null })
      },
      /**
       * E at an egg stand: hatch it (spends Wins) if it isn't owned yet, otherwise
       * summon its pet to follow the player - or, if it's already following, just
       * says so.
       */
      hatchEgg: (id) => {
        const { ownedPets, wins, notify } = get()
        const egg = getEgg(id)
        const pet = getPet(id)
        if (!egg || !pet) return

        // Already hatched: the stand doubles as a summon/dismiss switch for it.
        if (ownedPets.includes(id)) {
          get().togglePet(id)
          return
        }

        if (wins < egg.cost) {
          notify(`Need ${formatNumber(egg.cost - wins)} more Wins to hatch ${egg.name}`, 'error')
          return
        }
        set({
          wins: wins - egg.cost,
          ownedPets: [...ownedPets, id],
          equippedPets: [...get().equippedPets, id].slice(0, MAX_EQUIPPED),
        })
        notify(`${egg.name} hatched into ${pet.name}! x${formatBonus(pet.winsBonus)} Wins`, 'success')
        playSound('unlock')
      },

      /**
       * Send a hatched pet out to follow, or call it back in if it already is.
       * Unknown or unhatched ids are ignored, so the Pets panel can call this
       * for any tile without checking first.
       */
      togglePet: (id) => {
        const { ownedPets, equippedPets, notify } = get()
        const pet = getPet(id)
        if (!pet || !ownedPets.includes(id)) return

        if (equippedPets.includes(id)) {
          set({ equippedPets: equippedPets.filter((p) => p !== id) })
          notify(`${pet.name} is waiting back at its egg`)
          playSound('click')
          return
        }
        if (equippedPets.length >= MAX_EQUIPPED) {
          notify(`Only ${MAX_EQUIPPED} pets can follow you at once`, 'error')
          return
        }
        set({ equippedPets: [...equippedPets, id] })
        notify(`${pet.name} is now following you! x${formatBonus(pet.winsBonus)} Wins`)
        playSound('equip')
      },

      /** Every hatched pet at once, best bonus leading the pack. */
      equipAllPets: () => {
        const { ownedPets, equippedPets, notify } = get()
        if (ownedPets.length === 0) {
          notify('Hatch an egg first — no pets yet', 'error')
          return
        }
        const all = PETS.filter((p) => ownedPets.includes(p.id))
          .sort((a, b) => b.winsBonus - a.winsBonus)
          .slice(0, MAX_EQUIPPED)
          .map((p) => p.id)
        if (all.length === equippedPets.length && all.every((id) => equippedPets.includes(id))) {
          notify('Every pet you own is already out')
          return
        }
        set({ equippedPets: all })
        notify(`${all.length} pets following you! x${formatBonus(petWinsMultiplier(all))} Wins`, 'success')
        playSound('equip')
      },

      /** Send them all home, back to 1x Wins. */
      unequipAllPets: () => {
        if (get().equippedPets.length === 0) return
        set({ equippedPets: [] })
        playSound('click')
      },

      /**
       * Open or close the Pets panel (the HUD's Pets button, and Escape).
       * Opening it lands on the pet leading the squad, so the detail card has
       * something in it rather than a gap until the first tap.
       */
      togglePetsPanel: (open) =>
        set((s) => {
          const next = open ?? !s.petsOpen
          if (!next) return { petsOpen: false }
          return { petsOpen: true, petsSelected: s.equippedPets[0] ?? s.ownedPets[0] ?? PETS[0].id }
        }),

      /** Show this pet on the Pets panel's detail card; null closes it. */
      selectPet: (id) => set({ petsSelected: id }),

      toggleRebirthPanel: (open) => set((s) => ({ rebirthOpen: open ?? !s.rebirthOpen })),

      toggleShop: (open) => set((s) => ({ shopOpen: open ?? !s.shopOpen })),

      /** Open or close the Guide (its button in the left rail, G, and Escape). */
      toggleGuide: (open) => set((s) => ({ guideOpen: open ?? !s.guideOpen })),

      /** Open or close the Controls panel (the HUD's Controls button, and Escape). */
      toggleControlsPanel: (open) => set((s) => ({ controlsOpen: open ?? !s.controlsOpen })),

      /**
       * Spend all your Strength for a permanent multiplier on every future punch.
       *
       * Only `strength` is given up. Wins, gloves, pets, bags, boosts and passes are
       * all left exactly as they were - a button that took back
       * something the player had paid for would be a trap, and this one is meant to
       * be pressed.
       *
       * Guarded rather than trusted: the panel disables the button when it cannot be
       * afforded, but the check lives here too, so no path into this - a stale panel,
       * a double click, a future auto-rebirth - can zero someone's Strength for nothing.
       */
      rebirth: () => {
        const { strength, rebirths, notify } = get()
        if (!canRebirth(strength, rebirths)) return
        const next = rebirths + 1
        set({ strength: 0, rebirths: next, rebirthOpen: false })
        playSound('unlock')
        notify(`Rebirth ${next}! Every punch is now x${rebirthMultiplier(next)} Power`, 'success')
      },

      /**
       * E at a glove pad: put them on if owned, otherwise try to buy them with Wins.
       */
      pickGlove: (id) => {
        const { owned, equipped, wins, notify } = get()
        const glove = getGlove(id)
        if (equipped === id) {
          notify(`${glove.name} are already on`)
          return
        }
        if (owned.includes(id)) {
          set({ equipped: id })
          notify(`Put on the ${glove.name}`)
          playSound('equip')
          return
        }
        if (wins < glove.cost) {
          notify(`Need ${formatNumber(glove.cost - wins)} more Wins for the ${glove.name}`, 'error')
          return
        }
        set({ wins: wins - glove.cost, owned: [...owned, id], equipped: id })
        notify(`Bought the ${glove.name}! +${formatNumber(glove.power)} Strength per punch`, 'success')
        playSound('unlock')
      },

      /**
       * An aura's button in the shop: buy it if it is for sale and not owned, wear it
       * if it is owned, take it off if it is already on. A level aura not yet earned
       * just says how far there is to go.
       */
      pickAura: (id) => {
        const { ownedAuras, aura, wins, bestLevel, notify } = get()
        const def = getAura(id)
        if (!def) return
        if (ownedAuras.includes(id)) {
          const on = aura !== id
          set({ aura: on ? id : null })
          notify(on ? `Now wearing the ${def.name}` : 'Aura off')
          playSound(on ? 'equip' : 'click')
          return
        }
        if (def.level) {
          notify(`Reach Level ${def.level} to unlock the ${def.name} (best so far: ${bestLevel})`, 'error')
          return
        }
        if (wins < def.cost) {
          notify(`Need ${formatNumber(def.cost - wins)} more Wins for the ${def.name}`, 'error')
          return
        }
        set({ wins: wins - def.cost, ownedAuras: [...ownedAuras, id], aura: id })
        notify(`Bought the ${def.name}!`, 'success')
        playSound('unlock')
      },

      /**
       * A footprint set's button in the shop: buy it if it isn't owned (you need the
       * gloves first), wear it if it is, take it off if it's already on.
       */
      pickFootprints: (id) => {
        const { owned, ownedFootprints, footprints, wins, notify } = get()
        const glove = getGlove(id)
        if (glove.id !== id) return
        if (ownedFootprints.includes(id)) {
          const on = footprints !== id
          set({ footprints: on ? id : null })
          notify(on ? `Now leaving ${glove.name} footprints` : 'Footprints off')
          playSound(on ? 'equip' : 'click')
          return
        }
        if (!owned.includes(id)) {
          notify(`Get the ${glove.name} first to unlock their footprints`, 'error')
          return
        }
        const cost = footprintCost(glove)
        if (wins < cost) {
          notify(`Need ${formatNumber(cost - wins)} more Wins for the ${glove.name} footprints`, 'error')
          return
        }
        set({ wins: wins - cost, ownedFootprints: [...ownedFootprints, id], footprints: id })
        notify(`Bought the ${glove.name} footprints!`, 'success')
        playSound('unlock')
      },

      /** Came within range of a stage wall (`z`: the z of its centre). */
      setNearWall: (number, z) => set({ nearWall: { number, z } }),
      /** Left its range; ignored if another wall has taken over since. */
      clearNearWall: (number) => {
        if (get().nearWall?.number === number) set({ nearWall: null })
      },

      /** A stage wall's health hit zero (see StageWall, which tracks the damage). */
      breakWall: (number) => {
        const { brokenWalls, bestWall, spaceBest, notify } = get()
        if (isSpaceWall(number)) {
          set({ brokenWalls: { ...brokenWalls, [number]: true }, spaceBest: Math.max(spaceBest, number - 1000) })
          return
        }
        set({ brokenWalls: { ...brokenWalls, [number]: true }, bestWall: Math.max(bestWall, number) })
        if (number > 1 && (number - 1) % WALLS_PER_STAGE === 0) {
          notify(`Stage ${wallStage(number)} reached!`, 'success')
          playSound('stage')
        }
      },
      /**
       * Back in a lobby with walls still broken: starts the rebuild countdown
       * (a no-op if one's already running, or nothing is broken). See WallReset.
       */
      scheduleWallReset: () => {
        const { brokenWalls, wallsResetAt } = get()
        if (wallsResetAt !== null || Object.keys(brokenWalls).length === 0) return
        set({ wallsResetAt: performance.now() / 1000 + WALL_RESET_DELAY_S })
      },

      /**
       * Stepped back out of the lobby (through the still-broken walls) before the
       * countdown ran out: it only rebuilds after a full, uninterrupted stay in the
       * lobby, so cancel it. Walking back in later starts a fresh one.
       */
      cancelWallReset: () => {
        if (get().wallsResetAt !== null) set({ wallsResetAt: null })
      },

      /** The countdown ran out (or a Win pad sent us straight back): rebuild every wall. */
      resetWalls: () => set({ brokenWalls: {}, wallsResetAt: null }),

      /**
       * Held E long enough on a Win pad: pay out. Returns the Wins gained, or 0 if
       * the pad is shut; the pad then sends the player home.
       */
      claimPad: (number, pad) => {
        const state = get()
        const { wins, notify } = state
        if (!padUnlocked(number, pad, state)) {
          if (pad.pass) notify(`${getPass(pad.pass).name} needed for this pad`, 'error')
          else notify(`Need ${formatNumber(padStrength(number, pad))} Strength for this Win pad`, 'error')
          return 0
        }
        const bonus = winsMultiplier(state)
        const gain = Math.round(padWins(number, pad) * bonus)
        // Walls stay broken a little longer; WallReset starts their rebuild countdown
        // once we've actually arrived back in the lobby (see scheduleWallReset).
        set({ wins: wins + gain, nearWall: null, interact: null, holdingSince: null })
        const note = bonus > 1 ? ` (x${formatBonus(bonus)})` : ''
        notify(`+${formatNumber(gain)} Wins${note}! Back to the lobby`, 'success')
        playSound('win')
        return gain
      },

      /**
       * Won a fight in one of the boxing rings: the Wins the server worked out from
       * the loser's Strength (see the server's rings.js), with every Wins multiplier
       * on top, and one more on the streak.
       */
      winRingFight: (base, opponent) => {
        const state = get()
        const bonus = winsMultiplier(state)
        const gain = Math.max(1, Math.round(base * bonus))
        const streak = state.ringStreak + 1
        set({ wins: state.wins + gain, ringWins: state.ringWins + 1, ringStreak: streak })
        const note = streak > 1 ? ` - ${streak} in a row!` : ''
        state.notify(`K.O.! You beat ${opponent}! +${formatNumber(gain)} Wins${note}`, 'success')
        playSound('win')
        return gain
      },

      /** Knocked out, or walked out of the ring: the streak is over. */
      endRingStreak: () => {
        if (get().ringStreak !== 0) set({ ringStreak: 0 })
      },

      /** A power boost button: buy it, or add time if the same one is running. */
      buyBoost: (multiplier) => {
        const { wins, boost, notify } = get()
        const def = BOOSTS.find((b) => b.multiplier === multiplier)
        if (!def) return
        const now = Date.now()
        const current = activeBoost(boost, now)
        if (current && current.multiplier > multiplier) {
          notify(`Your x${current.multiplier} boost is still running`, 'error')
          return
        }
        if (wins < def.cost) {
          notify(`Need ${formatNumber(def.cost - wins)} more Wins for x${multiplier} Power`, 'error')
          return
        }
        const start = current?.multiplier === multiplier ? current.until : now
        set({ wins: wins - def.cost, boost: { multiplier, until: start + BOOST_S * 1000 } })
        notify(`x${multiplier} Power for ${BOOST_S / 60} minutes!`, 'success')
        playSound('unlock')
      },

      /**
       * Buys a pass with Wins (see game/passes.js).
       *
       * @returns {boolean} whether the pass is now owned
       */
      buyPass: (id) => {
        const { ownedPasses, wins, notify } = get()
        const pass = getPass(id)
        if (!pass) return false
        if (ownedPasses.includes(id)) return true
        if (wins < pass.cost) {
          notify(`Need ${formatNumber(pass.cost - wins)} more Wins for ${pass.name}`, 'error')
          return false
        }
        set({
          wins: wins - pass.cost,
          ownedPasses: [...ownedPasses, id],
          // Auto Wins is no use bought and switched off.
          ...(id === 'autoWins' ? { autoWins: true } : null),
        })
        notify(`${pass.name} unlocked - yours for good!`, 'success')
        playSound('unlock')
        return true
      },

      /** Switches Auto Wins on or off; offers the pass if it isn't owned yet. */
      toggleAutoWins: () => {
        const { ownedPasses, autoWins } = get()
        if (!ownedPasses.includes('autoWins')) return get().buyPass('autoWins')
        set({ autoWins: !autoWins })
        playSound('click')
      },

      /**
       * One Auto Wins payout: the gold pad of the deepest stage ever cleared, with
       * every Wins multiplier on it. Called on a timer by the HUD while it is on.
       */
      collectAutoWins: () => {
        const state = get()
        if (!state.autoWins || !state.ownedPasses.includes('autoWins')) return 0
        const stage = clearedStage(state.bestWall)
        if (stage === 0) return 0
        const gain = Math.round(stageWins(stage) * winsMultiplier(state))
        set({ wins: state.wins + gain })
        return gain
      },

      /** An auto clicker button: start or stop it, buying the OP one the first time. */
      toggleAutoClick: (kind) => {
        const { autoClick, opAutoOwned, wins, notify } = get()
        if (autoClick === kind) {
          set({ autoClick: 'off' })
          playSound('click')
          return
        }
        if (kind === 'op' && !opAutoOwned) {
          const { cost } = AUTO_CLICKERS.op
          if (wins < cost) {
            notify(`Need ${formatNumber(cost - wins)} more Wins for the OP Auto Clicker`, 'error')
            return
          }
          set({ wins: wins - cost, opAutoOwned: true })
          notify('OP Auto Clicker unlocked!', 'success')
          playSound('unlock')
        } else {
          playSound('click')
        }
        set({ autoClick: kind })
      },

      /**
       * Replaces the whole of the player's progress - a save loaded from the server,
       * or a fresh start on signing out. Session state (where you stand, what is
       * open) is left alone, apart from anything that pointed at what just changed.
       */
      loadProgress: (progress, { ownerId = null, syncedRev = 0 } = {}) =>
        set({
          ...DEFAULT_PROGRESS,
          ...progress,
          ownerId,
          syncedRev,
          activeTrainer: null,
          interact: null,
          holdingSince: null,
          popups: [],
        }),
    }),
    {
      name: 'fpc-progress',
      version: 1,
      partialize: (state) => ({ ...pickProgress(state), ownerId: state.ownerId, syncedRev: state.syncedRev }),
    },
  ),
)
