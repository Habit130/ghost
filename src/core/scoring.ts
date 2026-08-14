/**
 * Scoring rules locked by the concept decision (issue #2).
 * Pure and Phaser-free — the seed of the deterministic game core (issue #7).
 */

/** Points for a normal possession. */
export const BASE_SCORE = 10

/** Combo multiplier equals the combo count, capped here. */
export const MAX_MULTIPLIER = 10

/** A rare host is worth this many times the base score. */
export const RARE_HOST_MULTIPLIER = 20

/** Milliseconds after a possession within which the next one continues the combo. */
export const COMBO_WINDOW_MS = 1500

/**
 * Score awarded for one possession.
 * @param combo The combo count including this possession (>= 1).
 * @param rare Whether the possessed host is a rare host.
 */
export function possessionScore(combo: number, rare = false): number {
  const multiplier = Math.min(Math.max(Math.floor(combo), 1), MAX_MULTIPLIER)
  const base = rare ? BASE_SCORE * RARE_HOST_MULTIPLIER : BASE_SCORE
  return base * multiplier
}

/**
 * Whether a possession at nowMs continues the combo that last landed at previousAtMs.
 */
export function comboContinued(previousAtMs: number, nowMs: number): boolean {
  return nowMs - previousAtMs <= COMBO_WINDOW_MS
}
