import { create } from 'zustand'

/**
 * Sound effects, synthesised with the Web Audio API from oscillators and filtered
 * noise: nothing to download (so nothing to wait for on a slow connection), next
 * to no CPU, and each sound is a few lines to tune. Call `playSound(name, options)`
 * from anywhere; it does nothing until the browser allows audio (after the first
 * click or key press), while muted, or while the tab is hidden.
 */

const MUTE_KEY = 'fpc-muted'
/** Where the master gain sits at 100% volume; the portal's slider scales this. */
const FULL_VOLUME = 0.6
/** 0-1, from the portal's master_volume setting (see game/settings.js). */
let volumeScale = 1

/** The gain the master node should be at right now. */
const targetGain = () => (useSound.getState().muted ? 0 : FULL_VOLUME * volumeScale)

const readMuted = () => {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

/** `muted` for the speaker button; remembered between visits. */
export const useSound = create(() => ({ muted: readMuted() }))

let ctx = null
let out = null
let noise = null

function start() {
  if (ctx) return ctx
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  ctx = new AudioCtx()
  // Squashes the peaks when several sounds stack (a wall shattering mid-burst)
  // instead of letting them clip.
  const limiter = ctx.createDynamicsCompressor()
  limiter.threshold.value = -12
  limiter.knee.value = 8
  limiter.ratio.value = 6
  limiter.attack.value = 0.003
  limiter.release.value = 0.2
  limiter.connect(ctx.destination)
  out = ctx.createGain()
  out.gain.value = targetGain()
  out.connect(limiter)
  // Two seconds of white noise, shared by every hiss, whoosh and crunch.
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = noise.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return ctx
}

// Browsers keep audio off until the page is clicked or a key is pressed.
if (typeof window !== 'undefined') {
  const unlock = () => {
    const c = start()
    if (!c) return
    c.resume()
      .then(() => {
        if (c.state !== 'running') return
        window.removeEventListener('pointerdown', unlock, true)
        window.removeEventListener('keydown', unlock, true)
      })
      .catch(() => {})
  }
  window.addEventListener('pointerdown', unlock, true)
  window.addEventListener('keydown', unlock, true)
}

export function setMuted(muted) {
  useSound.setState({ muted })
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // Private browsing: it just won't be remembered.
  }
  if (out) out.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.03)
}

export const toggleMuted = () => setMuted(!useSound.getState().muted)

/**
 * Master volume as a 0-1 fraction, from the portal's slider. Muting still wins:
 * the speaker button and the slider are independent, and either one at zero means
 * silence.
 */
export function setMasterVolume(fraction) {
  const next = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 1
  if (next === volumeScale) return
  volumeScale = next
  if (out && ctx) out.gain.setTargetAtTime(targetGain(), ctx.currentTime, 0.03)
}

// --- Building blocks ----------------------------------------------------------------

/** `value`, randomly up to `amount` (a fraction) higher or lower, so repeats differ. */
const vary = (value, amount) => value * (1 + (Math.random() * 2 - 1) * amount)

/** A gain node that rises to `peak` over `attack` s, then fades out over `decay` s. */
function envelope(t, attack, peak, decay) {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.linearRampToValueAtTime(peak, t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
  gain.connect(out)
  return gain
}

/** One oscillator note, `at` s from now, optionally gliding from `freq` to `to`. */
function tone({ at = 0, type = 'sine', freq, to, attack = 0.004, decay = 0.2, gain = 0.2 }) {
  const t = ctx.currentTime + at
  const osc = ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
  osc.connect(envelope(t, attack, gain, decay))
  osc.start(t)
  osc.stop(t + attack + decay + 0.02)
}

/** Filtered noise: a hiss, whoosh, scuff or crunch, depending on the filter. */
function hiss({ at = 0, filter = 'bandpass', freq = 1000, to, q = 1, attack = 0.004, decay = 0.2, gain = 0.2 }) {
  const t = ctx.currentTime + at
  const src = ctx.createBufferSource()
  src.buffer = noise
  src.loop = true
  const f = ctx.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay)
  src.connect(f).connect(envelope(t, attack, gain, decay))
  // Start from a random spot in the noise, so no two hits sound exactly alike.
  src.start(t, Math.random() * 1.5)
  src.stop(t + attack + decay + 0.02)
}

const NOTE = {
  C5: 523.25,
  E5: 659.25,
  G5: 783.99,
  B5: 987.77,
  C6: 1046.5,
  E6: 1318.5,
  G6: 1568,
  C7: 2093,
}

// --- The sounds -----------------------------------------------------------------------

const SOUNDS = {
  /**
   * One footfall: a light tap as the foot lands, then a soft gritty scuff as the
   * sole rolls on. Filtered noise only, like a real step: a pitched tone sounded
   * like a drum, and a deep low thud made the player sound heavy. A sprint is a
   * little crisper.
   */
  step({ sprint = false } = {}) {
    const k = sprint ? 1.15 : 1
    hiss({ filter: 'lowpass', freq: vary(sprint ? 1100 : 950, 0.2), to: 450, q: 0.7, attack: 0.002, decay: 0.045, gain: 0.12 * k })
    hiss({ at: 0.015, freq: vary(3000, 0.25), q: 1.2, attack: 0.003, decay: 0.04, gain: 0.07 * k })
  },

  jump() {
    hiss({ freq: 700, to: 2200, q: 0.8, attack: 0.01, decay: 0.12, gain: 0.08 })
    tone({ type: 'triangle', freq: 260, to: 520, decay: 0.1, gain: 0.05 })
  },

  /** Landing from a jump or fall; `strength` 0-1 from how fast they came down. */
  land({ strength = 1 } = {}) {
    tone({ freq: 95, to: 40, attack: 0.002, decay: 0.16, gain: 0.3 * strength })
    hiss({ filter: 'lowpass', freq: 900, attack: 0.002, decay: 0.12, gain: 0.16 * strength })
  },

  /**
   * A punch. `kind` is the gloves' voice (see punchKind); `gain` turns it down for
   * automatic and distant punches.
   *
   * Every punch is a whoosh of air as the arm goes out and a thud as it lands - a
   * low sine dropping away under a burst of muffled noise - and the fancier gloves
   * add their own flourish on top: a crackle of fire, an electric zap, a crystal
   * ping, a cosmic shimmer.
   */
  punch({ kind = 'thud', gain = 1 } = {}) {
    hiss({ freq: vary(700, 0.15), to: 2600, q: 1.1, attack: 0.012, decay: 0.07, gain: 0.12 * gain })
    const heavy = kind === 'heavy' ? 1.3 : 1
    tone({ at: 0.06, freq: vary(150 / heavy, 0.08), to: 48, attack: 0.002, decay: 0.12 * heavy, gain: 0.42 * gain })
    hiss({ at: 0.06, filter: 'lowpass', freq: 1300, to: 240, attack: 0.002, decay: 0.09 * heavy, gain: 0.3 * gain })
    hiss({ at: 0.06, filter: 'highpass', freq: 3500, attack: 0.001, decay: 0.02, gain: 0.08 * gain })
    if (kind === 'fire') {
      hiss({ at: 0.06, freq: 500, to: 2000, q: 0.7, attack: 0.02, decay: 0.22, gain: 0.12 * gain })
    } else if (kind === 'zap') {
      tone({ at: 0.06, type: 'square', freq: vary(1400, 0.1), to: 300, attack: 0.002, decay: 0.12, gain: 0.05 * gain })
    } else if (kind === 'crystal') {
      tone({ at: 0.07, type: 'triangle', freq: vary(NOTE.E6, 0.04), attack: 0.002, decay: 0.3, gain: 0.06 * gain })
    } else if (kind === 'cosmic') {
      tone({ at: 0.07, type: 'triangle', freq: NOTE.G6, attack: 0.01, decay: 0.35, gain: 0.04 * gain })
      tone({ at: 0.1, type: 'triangle', freq: NOTE.C7, attack: 0.01, decay: 0.3, gain: 0.03 * gain })
    }
  },

  /** A quick swish of air: a punch that hit nothing. */
  whoosh() {
    hiss({ freq: 500, to: 2200, q: 1.2, attack: 0.02, decay: 0.12, gain: 0.12 })
  },

  /** A glove landing on another fighter: a meaty smack. `strength` 0-1. */
  punchHit({ strength = 0.6 } = {}) {
    const k = 0.6 + 0.4 * strength
    hiss({ filter: 'highpass', freq: 2800, attack: 0.001, decay: 0.03, gain: 0.2 * k })
    tone({ freq: vary(190, 0.1), to: 60, attack: 0.002, decay: 0.16, gain: 0.5 * k })
    hiss({ filter: 'lowpass', freq: 2200, to: 300, attack: 0.002, decay: 0.12, gain: 0.35 * k })
  },

  /** Taking a punch in the ring. */
  hurt() {
    tone({ freq: 230, to: 70, attack: 0.002, decay: 0.2, gain: 0.35 })
    hiss({ filter: 'bandpass', freq: 1700, q: 2, attack: 0.001, decay: 0.12, gain: 0.22 })
  },

  /** The ring bell: three bright dings. */
  bell() {
    for (let i = 0; i < 3; i++) {
      const at = i * 0.22
      tone({ at, type: 'triangle', freq: 1320, attack: 0.002, decay: 0.7, gain: 0.12 })
      tone({ at, freq: 2640, attack: 0.002, decay: 0.4, gain: 0.05 })
      tone({ at, freq: 3960, attack: 0.002, decay: 0.25, gain: 0.025 })
    }
  },

  /** Going down: a falling groan and a thump on the canvas. */
  ko() {
    tone({ type: 'sawtooth', freq: 320, to: 70, attack: 0.02, decay: 0.9, gain: 0.05 })
    tone({ at: 0.7, freq: 100, to: 35, attack: 0.003, decay: 0.4, gain: 0.5 })
    hiss({ at: 0.7, filter: 'lowpass', freq: 900, attack: 0.003, decay: 0.3, gain: 0.3 })
  },

  /** A crowd roaring and clapping. `gain` turns it down from further away. */
  cheer({ gain = 1 } = {}) {
    hiss({ freq: 1100, q: 0.6, attack: 0.25, decay: 1.6, gain: 0.16 * gain })
    hiss({ freq: 2300, q: 0.8, attack: 0.3, decay: 1.3, gain: 0.08 * gain })
    for (let i = 0; i < 14; i++) {
      hiss({ at: 0.1 + Math.random() * 1.2, filter: 'highpass', freq: vary(1800, 0.3), attack: 0.001, decay: 0.03, gain: 0.05 * gain })
    }
  },

  /** A punch striking a stage wall; `strength` 0-1 (how big a bite of its health). */
  wallHit({ strength = 0.5 } = {}) {
    const k = 0.6 + 0.4 * strength
    hiss({ filter: 'highpass', freq: 4000, attack: 0.001, decay: 0.03, gain: 0.12 })
    tone({ freq: vary(150, 0.1), to: 50, attack: 0.002, decay: 0.2, gain: 0.45 * k })
    hiss({ filter: 'lowpass', freq: 3200, to: 500, attack: 0.002, decay: 0.16, gain: 0.32 * k })
    tone({ type: 'triangle', freq: vary(1900, 0.1), to: 1300, attack: 0.001, decay: 0.05, gain: 0.07 })
  },

  /** A stage wall shattering: a crack and a boom, rumble, chunks clattering down, a sparkle. */
  wallBreak() {
    hiss({ filter: 'highpass', freq: 2500, attack: 0.001, decay: 0.09, gain: 0.3 })
    tone({ freq: 130, to: 32, attack: 0.004, decay: 0.8, gain: 0.6 })
    hiss({ filter: 'lowpass', freq: 1600, to: 120, attack: 0.01, decay: 1.1, gain: 0.5 })
    for (let i = 0; i < 12; i++) {
      const at = 0.08 + Math.random() * 0.8
      const gain = 0.04 + Math.random() * 0.06
      tone({ at, type: 'triangle', freq: vary(1100, 0.4), to: 500, attack: 0.001, decay: 0.05, gain })
      hiss({ at, freq: vary(2400, 0.3), q: 2, attack: 0.001, decay: 0.04, gain: gain * 1.4 })
    }
    for (const [i, freq] of [NOTE.E5, NOTE.G5, NOTE.B5, NOTE.E6].entries()) {
      tone({ at: 0.18 + i * 0.06, type: 'triangle', freq, attack: 0.005, decay: 0.3, gain: 0.09 })
      tone({ at: 0.18 + i * 0.06, freq: freq * 2, attack: 0.005, decay: 0.2, gain: 0.03 })
    }
  },

  /** Auto Wins paying out: one soft coin. */
  coin() {
    tone({ type: 'square', freq: NOTE.B5, decay: 0.06, gain: 0.03 })
    tone({ at: 0.06, type: 'square', freq: NOTE.E6, decay: 0.22, gain: 0.03 })
  },

  /** New gloves or anything unlocked: a bright rising arpeggio into a shimmering chord. */
  unlock() {
    for (const [i, freq] of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].entries()) {
      tone({ at: i * 0.07, type: 'triangle', freq, decay: 0.3, gain: 0.16 })
      tone({ at: i * 0.07, freq: freq * 2, decay: 0.18, gain: 0.05 })
    }
    for (const freq of [NOTE.C6, NOTE.E6, NOTE.G6]) {
      tone({ at: 0.3, type: 'triangle', freq, attack: 0.01, decay: 1.1, gain: 0.07 })
    }
    tone({ at: 0.3, freq: NOTE.C7, attack: 0.01, decay: 0.9, gain: 0.03 })
    for (let i = 0; i < 8; i++) tone({ at: 0.32 + Math.random() * 0.6, freq: vary(3200, 0.3), decay: 0.12, gain: 0.025 })
    hiss({ at: 0.28, filter: 'highpass', freq: 6000, attack: 0.15, decay: 0.6, gain: 0.04 })
  },

  /** Putting on gloves you already own: a quick two-note chime. */
  equip() {
    hiss({ filter: 'highpass', freq: 5000, attack: 0.001, decay: 0.02, gain: 0.05 })
    tone({ type: 'triangle', freq: NOTE.G5, decay: 0.1, gain: 0.12 })
    tone({ at: 0.06, type: 'triangle', freq: NOTE.C6, decay: 0.18, gain: 0.12 })
  },

  /** A switch flipped (auto clicker on or off). */
  click() {
    tone({ type: 'triangle', freq: 900, to: 700, attack: 0.001, decay: 0.05, gain: 0.08 })
  },

  /** Cashing in at a Win pad: a cascade of coin chimes, then a teleport whoosh. */
  win() {
    for (let i = 0; i < 7; i++) {
      const k = vary(1, 0.03)
      tone({ at: i * 0.07, type: 'square', freq: NOTE.B5 * k, decay: 0.06, gain: 0.035 })
      tone({ at: i * 0.07 + 0.05, type: 'square', freq: NOTE.E6 * k, decay: 0.25, gain: 0.035 })
    }
    hiss({ at: 0.35, freq: 300, to: 5000, q: 1.2, attack: 0.25, decay: 0.3, gain: 0.14 })
    tone({ at: 0.35, freq: 220, to: 1400, attack: 0.25, decay: 0.3, gain: 0.05 })
  },

  /** A new level: a quick climbing sparkle and a bright chord. */
  levelUp() {
    for (const [i, freq] of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6].entries()) {
      tone({ at: i * 0.05, type: 'triangle', freq, decay: 0.18, gain: 0.11 })
    }
    for (const freq of [NOTE.C6, NOTE.E6, NOTE.G6]) {
      tone({ at: 0.26, type: 'triangle', freq, attack: 0.01, decay: 0.7, gain: 0.06 })
    }
    hiss({ at: 0.05, freq: 900, to: 6000, q: 1, attack: 0.2, decay: 0.25, gain: 0.07 })
  },

  /** A flying punch hitting the ground: a deep thump and a shower of grit. */
  shockwave() {
    tone({ freq: 110, to: 30, attack: 0.003, decay: 0.5, gain: 0.5 })
    hiss({ filter: 'lowpass', freq: 1600, to: 120, attack: 0.004, decay: 0.45, gain: 0.35 })
    hiss({ at: 0.04, filter: 'highpass', freq: 3000, attack: 0.001, decay: 0.08, gain: 0.08 })
  },

  /** A new stage reached: a short fanfare, after the wall's crash. */
  stage() {
    const at = 0.45
    for (const [i, freq] of [NOTE.C5, NOTE.E5, NOTE.G5].entries()) {
      tone({ at: at + i * 0.1, type: 'triangle', freq, decay: 0.12, gain: 0.14 })
    }
    for (const freq of [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6]) {
      tone({ at: at + 0.32, type: 'triangle', freq, attack: 0.01, decay: 1.2, gain: 0.08 })
      tone({ at: at + 0.32, type: 'sawtooth', freq, attack: 0.02, decay: 0.6, gain: 0.012 })
    }
  },

  /** Not enough Wins or Power, a wall too strong: a soft low "bonk-bonk". */
  error() {
    tone({ type: 'triangle', freq: 330, to: 300, decay: 0.09, gain: 0.14 })
    tone({ at: 0.1, type: 'triangle', freq: 247, to: 220, decay: 0.16, gain: 0.14 })
  },
}

/** Shortest gap between two plays of the same sound, so rapid repeats don't pile up. */
const MIN_GAP_S = { step: 0.08, punch: 0.03, punchHit: 0.04, hurt: 0.06, whoosh: 0.05, bell: 1, cheer: 1, levelUp: 0.3, shockwave: 0.2, wallHit: 0.04, error: 0.25 }
const lastPlayed = {}

/** Plays one of SOUNDS by name. */
export function playSound(name, options) {
  if (!ctx || ctx.state !== 'running' || useSound.getState().muted || document.hidden) return
  const now = ctx.currentTime
  if (now - (lastPlayed[name] ?? -Infinity) < (MIN_GAP_S[name] ?? 0)) return
  lastPlayed[name] = now
  try {
    SOUNDS[name]?.(options)
  } catch {
    // A sound must never break the game.
  }
}
