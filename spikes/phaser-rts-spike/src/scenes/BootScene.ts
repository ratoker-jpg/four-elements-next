/**
 * Boot scene — loads spike assets, shows progress, then starts GameScene.
 */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale.game.config;

    // Progress bar
    const barW = 300;
    const barH = 20;
    const barX = (width as number) / 2 - barW / 2;
    const barY = (height as number) / 2 - barH / 2;

    const bg = this.add.graphics();
    const bar = this.add.graphics();
    this.add.text((width as number) / 2, barY - 20, 'Loading spike assets...', {
      fontSize: '14px',
      color: '#c0b890',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      bar.clear();
      bar.fillStyle(0xc0a040, 1);
      bar.fillRect(barX, barY, barW * value, barH);
    });

    this.load.on('complete', () => {
      bg.destroy();
      bar.destroy();
    });

    // --- Load spike assets ---
    // All paths relative to Vite dev server root or public/ dir.
    // In dev, Vite serves ../../public/ (root repo assets) via server.fs.allow.

    // Terrain
    this.load.image('sand_tile', this.assetUrl('assets/tiles/sand_tile.png'));

    // Faction buildings (cyan only)
    this.load.image('hq', this.assetUrl('assets/factions/cyan/buildings/hq_t1.png'));

    // Environment
    this.load.image('mineral_small', this.assetUrl('assets/environment/mineral_small.png'));
    this.load.image('mineral_infinite', this.assetUrl('assets/environment/mineral_infinite_01.png'));
    this.load.image('mountain_small', this.assetUrl('assets/environment/mountain_small_01.png'));
    this.load.image('rock_cluster', this.assetUrl('assets/environment/rock_cluster_small_01.png'));

    // Unit sprite sheets — 8 rows × 8 cols, 256px per frame
    this.load.spritesheet('harvester', this.assetUrl('assets/factions/cyan/units/harvester_8x8_256.png'), {
      frameWidth: 256,
      frameHeight: 256,
    });
    this.load.spritesheet('builder', this.assetUrl('assets/factions/cyan/units/builder_8x8_256.png'), {
      frameWidth: 256,
      frameHeight: 256,
    });
  }

  create(): void {
    this.scene.start('GameScene');
  }

  /**
   * Resolve asset URL — uses import.meta.env.BASE_URL for GitHub Pages compat.
   */
  private assetUrl(path: string): string {
    const base = import.meta.env.BASE_URL ?? '/';
    return `${base}${path}`;
  }
}
