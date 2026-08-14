import {
  COLLISION_RADIUS,
  DASH_COOLDOWN_MS,
  DASH_SPEED,
  DEATH_FREEZE_MS,
  EXORCIST_BASE_SPEED,
  EXORCIST_CAMP_MIN_RADIUS,
  EXORCIST_CAMP_RADIUS,
  EXORCIST_CAMP_SHRINK_PER_SEC,
  EXORCIST_CAMP_SPEED,
  EXORCIST_INTERVAL_MS,
  EXORCIST_MAX,
  EXORCIST_SPEED_STEP,
  EXORCIST_START,
  FIXED_DT_MS,
  HOST_PURIFY_MS,
  MAX_HOSTS,
  RARE_HOST_EVERY,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from './constants.ts'
import { COMBO_WINDOW_MS, possessionScore } from './scoring.ts'
import type { Exorcist, GameEvent, GameState, Host, Vec } from './types.ts'

const WALL_MARGIN = 28

/** Advance the simulation by one fixed timestep, consuming the queued semantic events. */
export function step(state: GameState, events: GameEvent[], dtMs: number = FIXED_DT_MS): void {
  if (state.phase === 'title') {
    if (events.some((e) => e.type === 'start')) state.phase = 'running'
    return
  }
  if (state.phase === 'running') {
    for (const event of events) {
      if (event.type === 'dashToHost') beginDash(state, event.hostId)
    }
    tickDash(state, dtMs)
    tickExorcists(state, dtMs)
    spawnExorcists(state)
    checkDashCollision(state)
    tickPurify(state)
  } else if (state.phase === 'dying') {
    if (state.deathAtMs !== null && state.timeMs - state.deathAtMs >= DEATH_FREEZE_MS) {
      state.phase = 'gameover'
      state.newRecord = state.score > state.highScore
      state.highScore = Math.max(state.highScore, state.score)
    }
  }
  state.timeMs += dtMs
}

function beginDash(state: GameState, hostId: number): void {
  if (state.dash !== null || state.ghostHostId === null) return
  if (state.timeMs - state.lastDashAtMs < DASH_COOLDOWN_MS) return
  const target = state.hosts.find((h) => h.id === hostId && !h.purified)
  if (target === undefined || target.id === state.ghostHostId) return
  const from = state.ghostPos
  const distance = dist(from, target.pos)
  if (distance <= 0) return
  const current = currentHost(state)
  if (current) current.purifyDeadlineMs = Number.POSITIVE_INFINITY
  state.ghostHostId = null
  state.dash = { hostId: target.id, from: { ...from }, to: { ...target.pos }, distance, progress: 0 }
  state.lastDashAtMs = state.timeMs
}

function tickDash(state: GameState, dtMs: number): void {
  const dash = state.dash
  if (dash === null) return
  dash.progress += (DASH_SPEED * dtMs) / 1000 / dash.distance
  if (dash.progress >= 1) {
    state.ghostPos = { ...dash.to }
    state.dash = null
    const host = state.hosts.find((h) => h.id === dash.hostId)
    if (host !== undefined) arrive(state, host)
  } else {
    state.ghostPos = lerp(dash.from, dash.to, dash.progress)
  }
}

function arrive(state: GameState, host: Host): void {
  state.ghostHostId = host.id
  state.ghostPos = { ...host.pos }
  state.combo = state.timeMs - state.lastPossessionAtMs <= COMBO_WINDOW_MS ? state.combo + 1 : 1
  state.lastPossessionAtMs = state.timeMs
  state.score += possessionScore(state.combo, host.rare)
  state.possessions += 1
  host.purifyDeadlineMs = state.timeMs + HOST_PURIFY_MS
  if (state.possessions % RARE_HOST_EVERY === 0) spawnRareHost(state)
}

/** While possessed, the host's timer runs; overstaying purifies it and ends the run. */
function tickPurify(state: GameState): void {
  const host = currentHost(state)
  if (host === null) return
  if (state.timeMs >= host.purifyDeadlineMs) {
    host.purified = true
    state.ghostHostId = null
    die(state)
  }
}

/**
 * Exorcists hunt the ghost: they charge straight at its position, and once
 * inside the camp ring they circle the possessed ghost instead of landing on
 * it. The ring tightens while the ghost overstays, so escape dashes get
 * harder the longer the player greedily waits. Mid-dash they always charge.
 */
function tickExorcists(state: GameState, dtMs: number): void {
  const seekSpeed = exorcistSpeed(desiredExorcistCount(state))
  const ringRadius = campRadius(state)
  for (const e of state.exorcists) {
    const dx = state.ghostPos.x - e.pos.x
    const dy = state.ghostPos.y - e.pos.y
    const distance = Math.hypot(dx, dy)
    if (distance < 1) continue
    const nx = dx / distance
    const ny = dy / distance
    let vx: number
    let vy: number
    if (state.dash === null && distance <= ringRadius) {
      // Camp: circle the ghost, correcting radially toward the shrinking ring.
      const orbit = e.id % 2 === 0 ? 1 : -1
      const radial = (distance - ringRadius) / ringRadius
      vx = (-ny * orbit + nx * radial) * EXORCIST_CAMP_SPEED
      vy = (nx * orbit + ny * radial) * EXORCIST_CAMP_SPEED
    } else {
      vx = nx * seekSpeed
      vy = ny * seekSpeed
    }
    e.dir = { x: nx, y: ny }
    e.pos.x += vx * (dtMs / 1000)
    e.pos.y += vy * (dtMs / 1000)
    clampToWalls(e)
  }
}

/** Distance at which exorcists start circling; shrinks the longer the ghost overstays. */
function campRadius(state: GameState): number {
  // The initial host has no possession timestamp; treat its ring as fresh until
  // the first dash, so the run opens gentle and tightens from the second host on.
  if (state.lastPossessionAtMs < 0) return EXORCIST_CAMP_RADIUS
  const overstayMs = state.timeMs - state.lastPossessionAtMs
  return Math.max(
    EXORCIST_CAMP_MIN_RADIUS,
    EXORCIST_CAMP_RADIUS - overstayMs * (EXORCIST_CAMP_SHRINK_PER_SEC / 1000),
  )
}

/** Safety net: hunters stay inside the room even when a host hugs the wall. */
function clampToWalls(e: Exorcist): void {
  if (e.pos.x < WALL_MARGIN) {
    e.pos.x = WALL_MARGIN
    e.dir.x = Math.abs(e.dir.x)
  } else if (e.pos.x > WORLD_WIDTH - WALL_MARGIN) {
    e.pos.x = WORLD_WIDTH - WALL_MARGIN
    e.dir.x = -Math.abs(e.dir.x)
  }
  if (e.pos.y < WALL_MARGIN) {
    e.pos.y = WALL_MARGIN
    e.dir.y = Math.abs(e.dir.y)
  } else if (e.pos.y > WORLD_HEIGHT - WALL_MARGIN) {
    e.pos.y = WORLD_HEIGHT - WALL_MARGIN
    e.dir.y = -Math.abs(e.dir.y)
  }
}

function desiredExorcistCount(state: GameState): number {
  return Math.min(EXORCIST_START + Math.floor(state.timeMs / EXORCIST_INTERVAL_MS), EXORCIST_MAX)
}

function exorcistSpeed(count: number): number {
  return EXORCIST_BASE_SPEED + EXORCIST_SPEED_STEP * (count - 1)
}

function spawnExorcists(state: GameState): void {
  const desired = desiredExorcistCount(state)
  while (state.exorcists.length < desired) {
    const edge = state.rng.int(4)
    const pos: Vec =
      edge === 0
        ? { x: state.rng.range(60, WORLD_WIDTH - 60), y: WALL_MARGIN + 10 }
        : edge === 1
          ? { x: state.rng.range(60, WORLD_WIDTH - 60), y: WORLD_HEIGHT - WALL_MARGIN - 10 }
          : edge === 2
            ? { x: WALL_MARGIN + 10, y: state.rng.range(60, WORLD_HEIGHT - 60) }
            : { x: WORLD_WIDTH - WALL_MARGIN - 10, y: state.rng.range(60, WORLD_HEIGHT - 60) }
    state.exorcists.push({
      id: state.nextExorcistId++,
      pos,
      dir: normalize({ x: WORLD_WIDTH / 2 - pos.x, y: WORLD_HEIGHT / 2 - pos.y }),
    })
  }
}

/** Exorcists only threaten a ghost in flight; a possessed ghost is safe. */
function checkDashCollision(state: GameState): void {
  if (state.dash === null) return
  for (const e of state.exorcists) {
    if (dist(e.pos, state.ghostPos) < COLLISION_RADIUS) {
      state.dash = null
      die(state)
      return
    }
  }
}

function spawnRareHost(state: GameState): void {
  if (state.hosts.length >= MAX_HOSTS) return
  state.hosts.push({
    id: state.nextHostId++,
    pos: { x: state.rng.range(80, WORLD_WIDTH - 80), y: state.rng.range(80, WORLD_HEIGHT - 80) },
    rare: true,
    purifyDeadlineMs: 0,
    purified: false,
  })
}

function die(state: GameState): void {
  state.phase = 'dying'
  state.dash = null
  state.deathAtMs = state.timeMs
}

function currentHost(state: GameState): Host | null {
  if (state.ghostHostId === null) return null
  return state.hosts.find((h) => h.id === state.ghostHostId) ?? null
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function lerp(a: Vec, b: Vec, t: number): Vec {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

function normalize(v: Vec): Vec {
  const length = Math.hypot(v.x, v.y) || 1
  return { x: v.x / length, y: v.y / length }
}
