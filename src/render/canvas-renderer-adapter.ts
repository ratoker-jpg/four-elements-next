import {
  ASSET_MANIFEST,
  BUILDING_ASSET_MANIFEST,
  CIVIL_8X8_256_MANIFEST,
  FE_BUILDING_SPRITES_ENABLED,
  FE_CIVIL_8X8_256_SHEETS_ENABLED,
} from '../core/constants.js';
import { AssetStore } from '../core/assets.js';
import { render } from './renderer.js';
import type { WorldRenderer, WorldRenderSnapshot } from '../render-phaser/types.js';

export class CanvasWorldRenderer implements WorldRenderer {
  readonly kind = 'canvas';

  private readonly ctx: CanvasRenderingContext2D;
  private readonly assets: AssetStore;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Cannot get 2D context');
    this.ctx = ctx;
    this.assets = new AssetStore();
  }

  async init(): Promise<void> {
    await this.assets.loadManifest(ASSET_MANIFEST);
    if (FE_CIVIL_8X8_256_SHEETS_ENABLED) {
      await this.assets.loadManifest(CIVIL_8X8_256_MANIFEST);
    }
    if (FE_BUILDING_SPRITES_ENABLED) {
      await this.assets.loadManifest(BUILDING_ASSET_MANIFEST);
    }
  }

  render(snapshot: WorldRenderSnapshot): void {
    render(
      this.ctx,
      snapshot.map,
      snapshot.visualSeed,
      snapshot.camera,
      this.assets,
      snapshot.economy,
      snapshot.power,
      snapshot.harvesters,
      snapshot.ticks,
      snapshot.prevHarvesterPositions,
      snapshot.territory,
      snapshot.resourceNodes,
    );
  }

  resize(width: number, height: number): void {
    this.ctx.canvas.width = width;
    this.ctx.canvas.height = height;
  }

  destroy(): void {
    // Canvas renderer owns no external runtime.
  }
}
