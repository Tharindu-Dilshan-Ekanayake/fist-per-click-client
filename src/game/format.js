const UNITS = [
  [1e18, 'Qi'],
  [1e15, 'Qa'],
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
]

/** Short number format for the HUD and signs: 950, 1.2K, 3.4M, 5.6B, 7.8T. */
export function formatNumber(n) {
  for (const [size, suffix] of UNITS) {
    if (n >= size) return `${+(n / size).toFixed(1)}${suffix}`
  }
  return String(Math.floor(n))
}

/**
 * A multiplier, without a trailing ".0" on the round ones: 1.25 → "1.25", 8 → "8".
 * Used for the pet Wins bonus on the HUD, egg signs and payout toasts.
 */
export const formatBonus = (n) => String(+n.toFixed(2))

/** Rounds to two significant figures, so balance numbers stay tidy (1234 → 1200). */
export function tidy(n) {
  if (n < 100) return Math.round(n)
  const step = 10 ** (Math.floor(Math.log10(n)) - 1)
  return Math.round(n / step) * step
}
