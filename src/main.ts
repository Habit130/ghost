import Phaser from 'phaser'
import { GameScene } from './game/GameScene.ts'

/**
 * Game entry point: boots Phaser with the placeholder scene.
 */
new Phaser.Game({
  type: Phaser.AUTO,
  width: 960,
  height: 540,
  backgroundColor: '#1a1a2e',
  scene: [GameScene],
})
