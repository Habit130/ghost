import './style.css'
import Phaser from 'phaser'
import { WORLD_HEIGHT, WORLD_WIDTH } from './core/constants.ts'
import { GameScene } from './game/GameScene.ts'

/**
 * Renderer entry point: boots Phaser. All game rules live in src/core (ADR-0001).
 */
new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
  backgroundColor: '#171126',
  scene: [GameScene],
})
