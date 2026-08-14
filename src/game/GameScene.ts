import Phaser from 'phaser'
import {
  DEATH_FREEZE_MS,
  EXORCIST_RADIUS,
  FIXED_DT_MS,
  GHOST_RADIUS,
  HOST_HALF_SIZE,
  HOST_WARN_MS,
  MAX_STEPS_PER_FRAME,
  RESTART_GUARD_MS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../core/constants.ts'
import { step } from '../core/engine.ts'
import { createInitialState } from '../core/state.ts'
import type { GameEvent, GameState, Host, Vec } from '../core/types.ts'
import { blips } from './audio.ts'

const HIGH_SCORE_KEY = 'boo-dash.highScore'

const HOST_COLOR = 0x4c3f78
const HOST_CURRENT_COLOR = 0x7a5fd0
const HOST_RARE_COLOR = 0xffd166
const HOST_PURIFIED_COLOR = 0x2a2438
const HOST_WARN_COLOR = 0xc14b4b
const EXORCIST_COLOR = 0xe5484d
const GHOST_COLOR = 0xf2f2f7
const AIM_COLOR = 0xffd166

const DIR_KEYS: Record<string, Vec> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
}

/**
 * Thin renderer per ADR-0001: reads core state, draws placeholder shapes,
 * translates keyboard/touch into semantic events. No game rules live here.
 */
export class GameScene extends Phaser.Scene {
  private state!: GameState
  private queuedEvents: GameEvent[] = []
  private accumulator = 0
  private paused = false
  private pendingAutoStart = false
  private restartAllowedAt = 0
  private aimedHostId: number | null = null
  private overlayEl: HTMLElement | null = null

  private ghost!: Phaser.GameObjects.Arc
  private aimMark!: Phaser.GameObjects.Arc
  private hostShapes = new Map<number, Phaser.GameObjects.Rectangle>()
  private exorcistShapes = new Map<number, Phaser.GameObjects.Arc>()
  private scoreText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private highText!: Phaser.GameObjects.Text

  private lastPhase = ''
  private lastPaused = false
  private prev = { dashing: false, hostId: -1, phase: 'title' }

  constructor() {
    super('GameScene')
    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('pointerdown', this.onPointerDown)
    this.overlayEl = document.getElementById('overlay')
    this.overlayEl?.addEventListener('click', this.onOverlayClick)
  }

  create(): void {
    this.state = createInitialState(newSeed(), readHighScore())
    this.paused = false
    this.accumulator = 0
    this.aimedHostId = null
    this.hostShapes.clear()
    this.exorcistShapes.clear()
    this.prev = { dashing: false, hostId: this.state.ghostHostId ?? -1, phase: 'title' }

    this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x171126)
    this.add.grid(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 48, 48, 0x241d3d, 0.6)
    this.scoreText = this.add.text(16, 12, '0', {
      fontFamily: 'sans-serif',
      fontSize: '36px',
      color: '#ffffff',
    })
    this.comboText = this.add
      .text(16, 56, '', { fontFamily: 'sans-serif', fontSize: '22px', color: '#ffd166' })
      .setVisible(false)
    this.highText = this.add
      .text(WORLD_WIDTH - 16, 12, '', {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        color: '#9f95c7',
      })
      .setOrigin(1, 0)
    this.ghost = this.add.circle(0, 0, GHOST_RADIUS, GHOST_COLOR)
    this.ghost.setDepth(5)
    this.aimMark = this.add.circle(0, 0, HOST_HALF_SIZE + 14, AIM_COLOR, 0.22)
    this.aimMark.setDepth(4)
    this.aimMark.setVisible(false)

    this.lastPhase = ''
    this.lastPaused = false
    this.syncOverlay()
    if (this.pendingAutoStart) {
      this.pendingAutoStart = false
      this.queuedEvents.push({ type: 'start' })
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.paused) {
      this.accumulator = 0
      return
    }
    if (this.state.phase === 'title' || this.state.phase === 'gameover') {
      this.accumulator = 0
      step(this.state, this.queuedEvents, FIXED_DT_MS)
      this.queuedEvents.length = 0
      this.sync()
      return
    }
    this.accumulator += Math.min(deltaMs, 100)
    let steps = 0
    while (this.accumulator >= FIXED_DT_MS && steps < MAX_STEPS_PER_FRAME) {
      step(this.state, this.queuedEvents, FIXED_DT_MS)
      this.queuedEvents.length = 0
      this.accumulator -= FIXED_DT_MS
      steps++
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0
    this.sync()
  }

  private sync(): void {
    const s = this.state

    this.ghost.setPosition(s.ghostPos.x, s.ghostPos.y)
    if (s.phase === 'dying' && s.deathAtMs !== null) {
      this.ghost.setAlpha(1 - Math.min(1, (s.timeMs - s.deathAtMs) / DEATH_FREEZE_MS))
    } else {
      this.ghost.setAlpha(1)
    }

    for (const host of s.hosts) {
      const shape = this.hostShape(host)
      shape.setPosition(host.pos.x, host.pos.y)
      const remaining =
        host.id === s.ghostHostId ? host.purifyDeadlineMs - s.timeMs : Number.POSITIVE_INFINITY
      if (host.purified) {
        shape.fillColor = HOST_PURIFIED_COLOR
        shape.setAlpha(0.5)
      } else if (host.rare) {
        shape.fillColor = HOST_RARE_COLOR
        shape.setAlpha(1)
      } else if (host.id === s.ghostHostId) {
        shape.fillColor = HOST_CURRENT_COLOR
        shape.setAlpha(1)
      } else {
        shape.fillColor = HOST_COLOR
        shape.setAlpha(1)
      }
      if (!host.purified && remaining < HOST_WARN_MS) {
        shape.fillColor = HOST_WARN_COLOR
        shape.setAlpha(0.5 + 0.5 * Math.abs(Math.sin(s.timeMs / 80)))
      }
    }

    for (const e of s.exorcists) {
      let shape = this.exorcistShapes.get(e.id)
      if (shape === undefined) {
        shape = this.add.circle(e.pos.x, e.pos.y, EXORCIST_RADIUS, EXORCIST_COLOR)
        shape.setDepth(3)
        this.exorcistShapes.set(e.id, shape)
      }
      shape.setPosition(e.pos.x, e.pos.y)
    }

    this.scoreText.setText(String(s.score))
    this.comboText.setVisible(s.combo > 1)
    if (s.combo > 1) this.comboText.setText(`×${s.combo}`)
    this.highText.setText(`最高 ${s.highScore}`)

    if (this.aimedHostId !== null && s.phase === 'running' && s.dash === null) {
      const target = s.hosts.find((h) => h.id === this.aimedHostId && !h.purified)
      if (target !== undefined) {
        this.aimMark.setPosition(target.pos.x, target.pos.y)
        this.aimMark.setVisible(true)
      } else {
        this.aimedHostId = null
        this.aimMark.setVisible(false)
      }
    } else {
      this.aimMark.setVisible(false)
    }

    if (!this.prev.dashing && s.dash !== null) blips.dash()
    if (this.prev.hostId !== s.ghostHostId && s.ghostHostId !== null && s.dash === null) {
      const host = s.hosts.find((h) => h.id === s.ghostHostId)
      if (host !== undefined && host.rare) blips.rare()
      else blips.possess()
    }
    if (this.prev.phase === 'running' && s.phase === 'dying') blips.death()
    this.prev = { dashing: s.dash !== null, hostId: s.ghostHostId ?? -1, phase: s.phase }

    if (this.lastPhase !== s.phase) {
      if (s.phase === 'gameover') {
        this.restartAllowedAt = performance.now() + RESTART_GUARD_MS
        saveHighScore(s.highScore)
      }
      this.lastPhase = s.phase
      this.syncOverlay()
    }
    if (this.lastPaused !== this.paused) {
      this.lastPaused = this.paused
      this.syncOverlay()
    }
  }

  private hostShape(host: Host): Phaser.GameObjects.Rectangle {
    let shape = this.hostShapes.get(host.id)
    if (shape === undefined) {
      shape = this.add.rectangle(
        host.pos.x,
        host.pos.y,
        HOST_HALF_SIZE * 2,
        HOST_HALF_SIZE * 2,
        HOST_COLOR,
      )
      shape.setDepth(1)
      this.hostShapes.set(host.id, shape)
    }
    return shape
  }

  private syncOverlay(): void {
    const el = this.overlayEl
    if (el === null) return
    if (this.paused) {
      el.className = ''
      el.innerHTML =
        '<h1>已暂停</h1><button id="resume-btn">继续(Esc)</button><button id="restart-pause-btn">重开</button>'
      return
    }
    const s = this.state
    if (s.phase === 'title') {
      el.className = ''
      el.innerHTML = `<h1>Boo Dash / 阿飘冲刺</h1>
<div class="sub">方向键 / WASD 瞄准 · Space 冲刺 · 触屏点选宿主</div>
<div class="sub">躲开驱魔人,别在一个宿主里停留超过 5 秒</div>
<div class="score">最高 ${s.highScore}</div>
<div class="sub">按任意键 / 点击开始</div>`
      return
    }
    if (s.phase === 'gameover') {
      el.className = ''
      el.innerHTML = `<div class="score">本局 ${s.score}</div>
${s.newRecord ? '<div class="record">新纪录!</div>' : ''}
<div class="score">最高 ${s.highScore}</div>
<button id="restart-btn">再来一局(R)</button>`
      return
    }
    el.className = 'hidden'
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (!this.state) return
    const s = this.state
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (s.phase === 'running' || s.phase === 'dying') this.togglePause()
      return
    }
    if (s.phase === 'title') {
      this.queuedEvents.push({ type: 'start' })
      return
    }
    if (s.phase === 'gameover') {
      if (e.code === 'KeyR' && performance.now() >= this.restartAllowedAt) this.newRun(true)
      return
    }
    if (s.phase !== 'running' || this.paused) return
    if (e.code === 'Space' || e.code === 'Enter') {
      if (this.aimedHostId !== null) this.dashTo(this.aimedHostId)
      return
    }
    const dir = DIR_KEYS[e.code]
    if (dir !== undefined) this.aimToward(dir)
  }

  private onPointerDown = (e: PointerEvent): void => {
    if (!this.state) return
    if (this.overlayEl !== null && e.target instanceof Node && this.overlayEl.contains(e.target)) {
      return
    }
    const s = this.state
    if (s.phase === 'title') {
      this.queuedEvents.push({ type: 'start' })
      return
    }
    if (s.phase === 'gameover') {
      if (performance.now() >= this.restartAllowedAt) this.newRun(true)
      return
    }
    if (s.phase !== 'running' || this.paused) return
    const w = this.toWorld(e.clientX, e.clientY)
    let best: Host | null = null
    let bestD = 70 * 70
    for (const h of s.hosts) {
      if (h.purified || h.id === s.ghostHostId) continue
      const d = (h.pos.x - w.x) ** 2 + (h.pos.y - w.y) ** 2
      if (d < bestD) {
        bestD = d
        best = h
      }
    }
    if (best !== null) this.dashTo(best.id)
  }

  private onOverlayClick = (e: MouseEvent): void => {
    if (!this.state) return
    const id = (e.target as HTMLElement | null)?.id ?? ''
    if (id === 'resume-btn') {
      this.togglePause()
      return
    }
    if (id === 'restart-pause-btn') {
      this.newRun(true)
      return
    }
    if (id === 'restart-btn') {
      if (this.state.phase === 'gameover' && performance.now() >= this.restartAllowedAt) {
        this.newRun(true)
      }
      return
    }
    if (this.state.phase === 'title') {
      this.queuedEvents.push({ type: 'start' })
      return
    }
    if (this.state.phase === 'gameover' && performance.now() >= this.restartAllowedAt) {
      this.newRun(true)
    }
  }

  private aimToward(dir: Vec): void {
    const s = this.state
    if (s.dash !== null || s.ghostHostId === null) {
      this.aimedHostId = null
      return
    }
    let best: Host | null = null
    let bestAngle = Number.POSITIVE_INFINITY
    for (const h of s.hosts) {
      if (h.purified || h.id === s.ghostHostId) continue
      const dx = h.pos.x - s.ghostPos.x
      const dy = h.pos.y - s.ghostPos.y
      const length = Math.hypot(dx, dy)
      if (length < 1 || length > 600) continue
      const cos = Math.max(-1, Math.min(1, (dx * dir.x + dy * dir.y) / length))
      const angle = Math.acos(cos)
      if (angle < bestAngle) {
        bestAngle = angle
        best = h
      }
    }
    this.aimedHostId = best !== null && bestAngle <= Math.PI / 4 ? best.id : null
  }

  private dashTo(hostId: number): void {
    this.queuedEvents.push({ type: 'dashToHost', hostId })
    this.aimedHostId = null
  }

  private togglePause(): void {
    if (this.state.phase !== 'running' && this.state.phase !== 'dying') return
    this.paused = !this.paused
    if (this.paused) this.accumulator = 0
    this.syncOverlay()
  }

  private newRun(autoStart: boolean): void {
    this.pendingAutoStart = autoStart
    this.paused = false
    this.scene.restart()
  }

  private toWorld(clientX: number, clientY: number): Vec {
    const canvas = document.querySelector('canvas')
    if (canvas === null) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((clientX - rect.left) / rect.width) * WORLD_WIDTH,
      y: ((clientY - rect.top) / rect.height) * WORLD_HEIGHT,
    }
  }
}

function newSeed(): number {
  return (Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0
}

function readHighScore(): number {
  try {
    return Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0
  } catch {
    return 0
  }
}

function saveHighScore(value: number): void {
  try {
    localStorage.setItem(HIGH_SCORE_KEY, String(value))
  } catch {
    // Storage unavailable (private mode etc.) — the prototype keeps working without persistence.
  }
}
