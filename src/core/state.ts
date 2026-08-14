import {
  EXORCIST_START,
  HOST_PURIFY_MS,
  INITIAL_HOSTS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.ts'
import { mulberry32 } from './rng.ts'
import type { GameState, Host, Vec } from './types.ts'

const EDGE_DIRECTIONS: Vec[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
]

/** Fresh run: ghost at the first host, one exorcist patrolling, everything else at zero. */
export function createInitialState(seed: number, highScore = 0): GameState {
  const rng = mulberry32(seed)
  const hosts: Host[] = []
  for (let i = 0; i < INITIAL_HOSTS; i++) {
    const col = i % 4
    const row = Math.floor(i / 4)
    hosts.push({
      id: i,
      pos: {
        x: 120 + col * 240 + rng.range(-25, 25),
        y: 135 + row * 270 + rng.range(-25, 25),
      },
      rare: false,
      purifyDeadlineMs: 0,
      purified: false,
    })
  }
  const first = hosts[0]
  first.purifyDeadlineMs = HOST_PURIFY_MS
  const dir = EDGE_DIRECTIONS[rng.int(EDGE_DIRECTIONS.length)]
  return {
    phase: 'title',
    rng,
    timeMs: 0,
    score: 0,
    combo: 0,
    lastPossessionAtMs: -1_000_000,
    highScore,
    newRecord: false,
    ghostHostId: first.id,
    ghostPos: { ...first.pos },
    dash: null,
    lastDashAtMs: -1_000_000,
    hosts,
    exorcists: [{ id: 0, pos: { x: WORLD_WIDTH - 60, y: WORLD_HEIGHT / 2 }, dir }],
    possessions: 0,
    nextHostId: INITIAL_HOSTS,
    nextExorcistId: EXORCIST_START,
    deathAtMs: null,
  }
}
