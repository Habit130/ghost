/**
 * Deterministic random number generator injected into the game core.
 * Production seeds it from the clock; tests seed it to replay runs exactly.
 */
export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number
  /** Uniform float in [min, max). */
  range(min: number, max: number): number
}

/** Mulberry32 PRNG — small, fast, and good enough for gameplay randomness. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (maxExclusive: number) => Math.floor(next() * maxExclusive),
    range: (min: number, max: number) => min + next() * (max - min),
  }
}
