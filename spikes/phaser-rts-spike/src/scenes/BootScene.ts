/**
 * Boot scene — loads spike assets, creates Phaser animations, then starts GameScene.
 */
import Phaser from 'phaser';
import { DIRECTION_NAMES } from '../iso/DirectionUtils.js';

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
    this.createHarvesterAnimations();
    this.scene.start('GameScene');
  }

  /**
   * Create Phaser animations for the harvester spritesheet.
   *
   * Spritesheet layout: 8 rows (directions) × 8 columns (animation frames).
   * Direction row order: 0=east, 1=SE, 2=south, 3=SW, 4=west, 5=NW, 6=north, 7=NE.
   * Harvester column layout:
   *   0=idle, 1-4=move, 5-7=unload
   *
   * Frame index = row * 8 + col.
   * Animation key format: `harvester_{direction}_{phase}`
   *   e.g. `harvester_south_move`, `harvester_se_idle`, `harvester_nw_unload`
   */
  private createHarvesterAnimations(): void {
    for (let row = 0; row < DIRECTION_NAMES.length; row++) {
      const dir = DIRECTION_NAMES[row]!;
      const baseFrame = row * 8;

      // Idle: single frame at col 0
      this.anims.create({
        key: `harvester_${dir}_idle`,
        frames: [{ key: 'harvester', frame: baseFrame }],
        frameRate: 1,
        repeat: -1,
      });

      // Move: cols 1–4 cycling
      this.anims.create({
        key: `harvester_${dir}_move`,
        frames: this.anims.generateFrameNumbers('harvester', {
          start: baseFrame + 1,
          end: baseFrame + 4,
        }),
        frameRate: 8,
        repeat: -1,
      });

      // Unload: cols 5–7 cycling
      this.anims.create({
        key: `harvester_${dir}_unload`,
        frames: this.anims.generateFrameNumbers('harvester', {
          start: baseFrame + 5,
          end: baseFrame + 7,
        }),
        frameRate: 6,
        repeat: -1,
      });
    }
  }

  /**
   * Resolve asset URL — uses import.meta.env.BASE_URL for GitHub Pages compat.
   */
  private assetUrl(path: string): string {
    const base = import.meta.env.BASE_URL ?? '/';
    return `${base}${path}`;
  }
}
