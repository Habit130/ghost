/**
 * Tiny WebAudio blips for prototype feedback — placeholder audio per the asset
 * strategy (#6), to be replaced by real Kenney CC0 sounds later.
 */

let ctx: AudioContext | null = null

function tone(freqA: number, freqB: number, durationMs: number, type: OscillatorType, volume: number): void {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freqA, ctx.currentTime)
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqB), ctx.currentTime + durationMs / 1000)
    gain.gain.setValueAtTime(volume, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + durationMs / 1000)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + durationMs / 1000 + 0.02)
  } catch {
    ctx = null
  }
}

export const blips = {
  dash: (): void => tone(420, 160, 90, 'square', 0.04),
  possess: (): void => tone(660, 990, 70, 'sine', 0.06),
  rare: (): void => {
    tone(880, 1320, 60, 'sine', 0.07)
    setTimeout(() => tone(1320, 1760, 80, 'sine', 0.07), 70)
  },
  nearMiss: (): void => {
    tone(900, 1500, 55, 'sine', 0.05)
    setTimeout(() => tone(600, 420, 60, 'square', 0.04), 50)
  },
  death: (): void => tone(220, 55, 260, 'sawtooth', 0.08),
}
