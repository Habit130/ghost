import { describe, expect, it } from 'vitest'
import {
  EXORCIST_INTERVAL_MS,
  EXORCIST_MAX,
  FIXED_DT_MS,
  HOST_PURIFY_MS,
} from './constants.ts'
import { step } from './engine.ts'
import { createInitialState } from './state.ts'
import type { GameEvent, GameState } from './types.ts'

function run(state: GameState, events: GameEvent[] = [], steps = 1): void {
  for (let i = 0; i < steps; i++) step(state, i === 0 ? events : [], FIXED_DT_MS)
}

function stepsFor(ms: number): number {
  return Math.round(ms / FIXED_DT_MS)
}

function start(s: GameState): void {
  run(s, [{ type: 'start' }], 1)
}

function dashUntilArrived(s: GameState, hostId: number): void {
  run(s, [{ type: 'dashToHost', hostId }], 1)
  let guard = 0
  while (s.dash !== null && guard++ < 1000) run(s, [], 1)
  expect(s.dash).toBeNull()
}

describe('game state', () => {
  it('is deterministic for a given seed', () => {
    const a = createInitialState(42)
    const b = createInitialState(42)
    expect(a.hosts.map((h) => h.pos)).toEqual(b.hosts.map((h) => h.pos))
    expect(a.exorcists[0].pos).toEqual(b.exorcists[0].pos)
  })

  it('waits in title until a start event, with time frozen', () => {
    const s = createInitialState(1)
    run(s, [], stepsFor(500))
    expect(s.phase).toBe('title')
    expect(s.timeMs).toBe(0)
    start(s)
    expect(s.phase).toBe('running')
  })
})

describe('dashing and scoring', () => {
  it('arrives at the target host and scores the base amount', () => {
    const s = createInitialState(7)
    start(s)
    const target = s.hosts[1]
    dashUntilArrived(s, target.id)
    expect(s.ghostHostId).toBe(target.id)
    expect(s.score).toBe(10)
    expect(s.combo).toBe(1)
  })

  it('chains the combo within the window and resets after a gap', () => {
    const s = createInitialState(7)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    const c = s.hosts[2]
    dashUntilArrived(s, b.id)
    run(s, [], stepsFor(300))
    dashUntilArrived(s, a.id)
    expect(s.combo).toBe(2)
    run(s, [], stepsFor(1600))
    dashUntilArrived(s, c.id)
    expect(s.combo).toBe(1)
  })

  it('caps the score multiplier at 10 while the combo keeps counting', () => {
    const s = createInitialState(7)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    let gained = 0
    for (let i = 0; i < 11; i++) {
      const before = s.score
      dashUntilArrived(s, s.ghostHostId === a.id ? b.id : a.id)
      gained = s.score - before
      run(s, [], stepsFor(300))
    }
    expect(s.combo).toBe(11)
    // The 11th possession scored with the capped 10x multiplier.
    expect(gained).toBe(100)
  })

  it('blocks a re-dash within the cooldown after arrival', () => {
    const s = createInitialState(7)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    const c = s.hosts[2]
    b.pos = { x: a.pos.x + 120, y: a.pos.y }
    c.pos = { x: a.pos.x + 240, y: a.pos.y }
    dashUntilArrived(s, b.id)
    run(s, [{ type: 'dashToHost', hostId: c.id }], 1)
    expect(s.dash).toBeNull()
    run(s, [], stepsFor(200))
    run(s, [{ type: 'dashToHost', hostId: c.id }], 1)
    expect(s.dash).not.toBeNull()
  })
})

describe('purify pressure', () => {
  it('dies when overstaying a host, and the host becomes unusable', () => {
    const s = createInitialState(3)
    start(s)
    const first = s.hosts[0]
    run(s, [], stepsFor(HOST_PURIFY_MS + FIXED_DT_MS))
    expect(s.phase).toBe('dying')
    expect(first.purified).toBe(true)
    expect(s.ghostHostId).toBeNull()
    run(s, [], stepsFor(600))
    expect(s.phase).toBe('gameover')
  })

  it('keeps a host usable when left before expiry', () => {
    const s = createInitialState(3)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    run(s, [], stepsFor(3000))
    dashUntilArrived(s, b.id)
    expect(a.purified).toBe(false)
    run(s, [], stepsFor(300))
    dashUntilArrived(s, a.id)
    expect(s.ghostHostId).toBe(a.id)
  })

  it('ends the run with zero score when the player never dashes', () => {
    const s = createInitialState(11)
    start(s)
    run(s, [], stepsFor(6000))
    expect(s.phase).toBe('gameover')
    expect(s.score).toBe(0)
  })
})

describe('exorcists', () => {
  it('dies when an exorcist touches the ghost mid-dash', () => {
    const s = createInitialState(5)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    b.pos = { x: a.pos.x + 300, y: a.pos.y }
    s.exorcists[0].pos = { x: a.pos.x + 150, y: a.pos.y }
    s.exorcists[0].dir = { x: 0, y: 0 }
    run(s, [{ type: 'dashToHost', hostId: b.id }], 1)
    run(s, [], stepsFor(600))
    expect(s.phase).toBe('gameover')
  })

  it('ignores exorcists while the ghost is possessed', () => {
    const s = createInitialState(5)
    start(s)
    s.exorcists[0].pos = { ...s.ghostPos }
    s.exorcists[0].dir = { x: 0, y: 0 }
    run(s, [], stepsFor(200))
    expect(s.phase).toBe('running')
  })

  it('adds an exorcist every 20s up to the cap', () => {
    const s = createInitialState(5)
    start(s)
    // Vacate the ghost so the purified-away death cannot mask the spawn logic.
    s.ghostHostId = null
    s.hosts[0].purifyDeadlineMs = Number.POSITIVE_INFINITY
    s.timeMs = EXORCIST_INTERVAL_MS - FIXED_DT_MS
    run(s, [], 2)
    expect(s.exorcists.length).toBe(2)
    s.timeMs = EXORCIST_INTERVAL_MS * 10
    run(s, [], 2)
    expect(s.exorcists.length).toBe(EXORCIST_MAX)
  })
})

describe('rare hosts', () => {
  it('spawns a rare host on the 10th possession', () => {
    const s = createInitialState(9)
    start(s)
    const a = s.hosts[0]
    const b = s.hosts[1]
    for (let i = 0; i < 10; i++) {
      dashUntilArrived(s, s.ghostHostId === a.id ? b.id : a.id)
      run(s, [], stepsFor(300))
    }
    expect(s.hosts.some((h) => h.rare)).toBe(true)
  })
})
