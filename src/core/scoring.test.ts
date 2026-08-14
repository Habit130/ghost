import { describe, expect, it } from 'vitest'
import {
  BASE_SCORE,
  COMBO_WINDOW_MS,
  MAX_MULTIPLIER,
  comboContinued,
  possessionScore,
} from './scoring.ts'

describe('possessionScore', () => {
  it('awards the base score at combo 1', () => {
    expect(possessionScore(1)).toBe(BASE_SCORE)
  })

  it('multiplies by the combo count', () => {
    expect(possessionScore(4)).toBe(BASE_SCORE * 4)
  })

  it('caps the multiplier at MAX_MULTIPLIER', () => {
    expect(possessionScore(42)).toBe(BASE_SCORE * MAX_MULTIPLIER)
  })

  it('treats a combo below 1 as 1', () => {
    expect(possessionScore(0)).toBe(BASE_SCORE)
  })

  it('awards 20x base on a rare host', () => {
    expect(possessionScore(3, true)).toBe(BASE_SCORE * 20 * 3)
  })
})

describe('comboContinued', () => {
  it('continues the combo within the window', () => {
    expect(comboContinued(1000, 1000 + COMBO_WINDOW_MS)).toBe(true)
  })

  it('breaks the combo after the window', () => {
    expect(comboContinued(1000, 1000 + COMBO_WINDOW_MS + 1)).toBe(false)
  })
})
