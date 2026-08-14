import './style.css'
import Phaser from 'phaser'
import { WORLD_HEIGHT, WORLD_WIDTH } from './core/constants.ts'
import { GameScene } from './game/GameScene.ts'

/**
 * Renderer entry point: boots Phaser with FIT scaling so the 960x540 world
 * works on any viewport. All game rules live in src/core (ADR-0001).
 */
function boot(type: number): void {
  new Phaser.Game({
    type,
    parent: 'app',
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    backgroundColor: '#171126',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      // Crisp 16x16 pixel art without smoothing.
      pixelArt: true,
    },
    scene: [GameScene],
  })
}

// Global input listeners are registered before the scene exists, so input
// survives any boot problem and works on the very first title screen.
GameScene.bind()

try {
  boot(Phaser.AUTO)
} catch (error) {
  console.error('WebGL boot failed, falling back to the Canvas renderer', error)
  boot(Phaser.CANVAS)
}
