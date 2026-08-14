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
  private static instance: GameScene | null = null

  /** Register global input listeners once, independent of the scene lifecycle. */
  static bind(): void {
    window.addEventListener('keydown', GameScene.onGlobalKeyDown)
    window.addEventListener('pointerdown', GameScene.onGlobalPointerDown)
    document.getElementById('overlay')?.addEventListener('click', GameScene.onGlobalOverlayClick)
    document.addEventListener('visibilitychange', GameScene.onVisibilityChange)
  }

  private static onGlobalKeyDown = (e: KeyboardEvent): void => {
    GameScene.instance?.handleKeyDown(e)
  }

  private static onGlobalPointerDown = (e: PointerEvent): void => {
    GameScene.instance?.handlePointerDown(e)
  }

  private static onGlobalOverlayClick = (e: MouseEvent): void => {
    GameScene.instance?.handleOverlayClick(e)
  }

  private static onVisibilityChange = (): void => {
    if (document.hidden) GameScene.instance?.handleAutoPause()
  }

  private static attach(scene: GameScene): void {
    GameScene.instance = scene
  }

  private static detach(): void {
    GameScene.instance = null
  }

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
  private aimGfx!: Phaser.GameObjects.Graphics
  private trailGfx!: Phaser.GameObjects.Graphics
  private trail: Vec[] = []
  private hostShapes = new Map<number, Phaser.GameObjects.Rectangle>()
  private exorcistShapes = new Map<number, Phaser.GameObjects.Arc>()
  private scoreText!: Phaser.GameObjects.Text
  private comboText!: Phaser.GameObjects.Text
  private highText!: Phaser.GameObjects.Text

  private lastPhase = ''
  private lastPaused = false
  private prev = { dashing: false, hostId: -1, phase: 'title', score: 0, combo: 0, nearMiss: false }

  constructor() {
    super('GameScene')
  }

  create(): void {
    this.state = createInitialState(newSeed(), readHighScore())
    this.overlayEl = document.getElementById('overlay')
    GameScene.attach(this)
    this.events.once('shutdown', () => GameScene.detach())
    this.paused = false
    this.accumulator = 0
    this.aimedHostId = null
    this.hostShapes.clear()
    this.exorcistShapes.clear()
    this.prev = {
      dashing: false,
      hostId: this.state.ghostHostId ?? -1,
      phase: 'title',
      score: 0,
      combo: 0,
      nearMiss: false,
    }

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
    this.aimGfx = this.add.graphics()
    this.aimGfx.setDepth(4)
    this.trailGfx = this.add.graphics()
    this.trailGfx.setDepth(2)
    this.trail = []

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
    this.drawTrail(s)
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
        this.aimGfx.clear()
        this.aimGfx.lineStyle(2, AIM_COLOR, 0.4)
        this.aimGfx.lineBetween(s.ghostPos.x, s.ghostPos.y, target.pos.x, target.pos.y)
      } else {
        this.aimedHostId = null
        this.aimMark.setVisible(false)
        this.aimGfx.clear()
      }
    } else {
      this.aimMark.setVisible(false)
      this.aimGfx.clear()
    }

    if (!this.prev.dashing && s.dash !== null) blips.dash()
    if (this.prev.hostId !== s.ghostHostId && s.ghostHostId !== null && s.dash === null) {
      const host = s.hosts.find((h) => h.id === s.ghostHostId)
      if (host !== undefined) {
        this.floatScore(host.pos.x, host.pos.y, s.score - this.prev.score, s.nearMiss)
        if (host.rare) blips.rare()
        else blips.possess()
        if (s.nearMiss) {
          blips.nearMiss()
          this.cameras.main.shake(70, 0.0035)
        }
      }
    }
    if (s.combo > 1 && s.combo !== this.prev.combo) {
      this.comboText.setScale(1.5)
      this.tweens.add({ targets: this.comboText, scale: 1, duration: 180, ease: 'Back.Out' })
    }
    if (this.prev.phase === 'running' && s.phase === 'dying') {
      blips.death()
      this.cameras.main.shake(140, 0.006)
    }
    this.prev = {
      dashing: s.dash !== null,
      hostId: s.ghostHostId ?? -1,
      phase: s.phase,
      score: s.score,
      combo: s.combo,
      nearMiss: s.nearMiss,
    }

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

  /** Fading afterimages behind the ghost while it dashes, so flight is readable. */
  private drawTrail(s: GameState): void {
    if (s.dash !== null) {
      const last = this.trail[this.trail.length - 1]
      if (last === undefined || Math.hypot(s.ghostPos.x - last.x, s.ghostPos.y - last.y) >= 10) {
        this.trail.push({ x: s.ghostPos.x, y: s.ghostPos.y })
      }
      if (this.trail.length > 10) this.trail.shift()
      const g = this.trailGfx
      g.clear()
      for (let i = 0; i < this.trail.length; i++) {
        const t = (i + 1) / this.trail.length
        g.fillStyle(GHOST_COLOR, 0.25 * t)
        g.fillCircle(this.trail[i].x, this.trail[i].y, GHOST_RADIUS * (0.4 + 0.5 * t))
      }
    } else if (this.trail.length > 0) {
      this.trail.length = 0
      this.trailGfx.clear()
    }
  }

  /** Floating score popup at the possessed host; highlighted on a near miss. */
  private floatScore(x: number, y: number, gained: number, nearMiss: boolean): void {
    const label = this.add.text(x, y - 26, nearMiss ? `贴脸! +${gained}` : `+${gained}`, {
      fontFamily: 'sans-serif',
      fontSize: nearMiss ? '24px' : '18px',
      fontStyle: 'bold',
      color: nearMiss ? '#ffd166' : '#ffffff',
    })
    label.setOrigin(0.5).setDepth(10)
    this.tweens.add({
      targets: label,
      y: y - 70,
      alpha: 0,
      duration: 800,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy(),
    })
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
<div class="sub">躲开驱魔人,别在一个宿主里停留超过 3.5 秒</div>
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

  handleKeyDown = (e: KeyboardEvent): void => {
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

  handlePointerDown = (e: PointerEvent): void => {
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

  handleOverlayClick = (e: MouseEvent): void => {
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

  /** Pause when the tab loses visibility (UI decision #9). */
  handleAutoPause(): void {
    if (this.paused) return
    if (this.state.phase !== 'running' && this.state.phase !== 'dying') return
    this.paused = true
    this.accumulator = 0
    this.syncOverlay()
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
