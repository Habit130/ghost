import type { Rng } from './rng.ts'

export type Vec = { x: number; y: number }

export type Phase = 'title' | 'running' | 'dying' | 'gameover'

export interface Host {
  id: number
  pos: Vec
  rare: boolean
  /** Game-time at which this host purifies while possessed; Infinity once vacated in time. */
  purifyDeadlineMs: number
  purified: boolean
}

export interface Exorcist {
  id: number
  pos: Vec
  dir: Vec
}

export interface Dash {
  hostId: number
  from: Vec
  to: Vec
  distance: number
  progress: number
  /** Smallest gap to any exorcist so far mid-dash; feeds the near-miss bonus. */
  minExorcistGap: number
}

export interface GameState {
  phase: Phase
  rng: Rng
  timeMs: number
  score: number
  combo: number
  lastPossessionAtMs: number
  highScore: number
  newRecord: boolean
  ghostHostId: number | null
  ghostPos: Vec
  dash: Dash | null
  lastDashAtMs: number
  /** Latched true when the last possession shaved past an exorcist (UI feedback). */
  nearMiss: boolean
  hosts: Host[]
  exorcists: Exorcist[]
  possessions: number
  nextHostId: number
  nextExorcistId: number
  deathAtMs: number | null
}

/** Semantic input events; the renderer translates keyboard/touch into these. */
export type GameEvent = { type: 'start' } | { type: 'dashToHost'; hostId: number }
