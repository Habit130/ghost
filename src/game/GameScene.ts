import Phaser from 'phaser'

/**
 * Placeholder scene proving the Phaser wiring end to end.
 * The real possession-dash loop replaces this once the architecture is decided (issue #7).
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene')
  }

  create(): void {
    this.add
      .text(480, 260, 'Boo Dash / 阿飘冲刺 — scaffold', {
        fontFamily: 'sans-serif',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5)
  }
}
