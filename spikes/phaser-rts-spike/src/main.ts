/**
 * Phaser RTS Spike — Stage 1 entry point.
 * Isolated spike: does NOT touch production game code.
 */
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#2a2418',
  scene: [BootScene, GameScene],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
  input: {
    keyboard: true,
    mouse: true,
  },
});

// Expose for dev console inspection
(window as unknown as Record<string, unknown>).__phaserSpike = game;
