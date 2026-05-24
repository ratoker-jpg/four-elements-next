/**
 * Dust particle emitter for moving units in the Phaser production renderer.
 * Uses Phaser 3.90+ particle API with a runtime-generated texture.
 *
 * Ported from spikes/phaser-rts-spike/src/vfx/DustEmitter.ts
 *
 * Design:
 * - Dust only while moving
 * - Start burst is stronger than sustained
 * - Sustained dust is subtle
 * - Particles render behind unit (lower depth)
 * - Generated texture — no external asset needed
 * - Conservative particle cap via frequency/lifespan (~5 particles alive max)
 */

import Phaser from 'phaser';

// ─── Dust constants ───────────────────────────────────────────────
const DUST_SPEED_MIN = 5;
const DUST_SPEED_MAX = 20;
const DUST_LIFESPAN_MIN = 300;
const DUST_LIFESPAN_MAX = 600;
const DUST_SCALE_START = 0.6;
const DUST_SCALE_END = 0.05;
const DUST_ALPHA_START = 0.45;
const DUST_ALPHA_END = 0;
const DUST_FREQUENCY = 100;
const DUST_BURST_COUNT = 5;
const DUST_DEPTH_OFFSET = 0.3;

/** Texture key for the generated dust particle. */
export const DUST_TEXTURE_KEY = '__dust_particle';

/** Generate a small soft-circle dust texture at runtime. Call once during scene create. */
export function generateDustTexture(textures: Phaser.Textures.TextureManager): void {
  if (textures.exists(DUST_TEXTURE_KEY)) return;

  const size = 8;
  const canvas = textures.createCanvas(DUST_TEXTURE_KEY, size, size);
  if (!canvas) return;
  const ctx = canvas.getContext();
  const half = size / 2;

  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  gradient.addColorStop(0, 'rgba(217, 198, 122, 0.9)');
  gradient.addColorStop(1, 'rgba(217, 198, 122, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  canvas.refresh();
}

export class DustEmitter {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private _isEmitting = false;

  constructor(scene: Phaser.Scene) {
    this.emitter = scene.add.particles(0, 0, DUST_TEXTURE_KEY, {
      speed: { min: DUST_SPEED_MIN, max: DUST_SPEED_MAX },
      angle: { min: 0, max: 360 },
      lifespan: { min: DUST_LIFESPAN_MIN, max: DUST_LIFESPAN_MAX },
      scale: { start: DUST_SCALE_START, end: DUST_SCALE_END },
      alpha: { start: DUST_ALPHA_START, end: DUST_ALPHA_END },
      quantity: 1,
      frequency: DUST_FREQUENCY,
      emitting: false,
    });
  }

  /** Whether the emitter is currently emitting. */
  get isEmitting(): boolean {
    return this._isEmitting;
  }

  /** Start dust emission at the given position. Fires a start burst, then continues with sustained emission. */
  start(x: number, y: number, depth: number): void {
    if (this._isEmitting) return;
    this._isEmitting = true;

    this.emitter.setPosition(x, y);
    this.emitter.setDepth(depth - DUST_DEPTH_OFFSET);
    this.emitter.frequency = DUST_FREQUENCY;

    this.emitter.explode(DUST_BURST_COUNT);
    this.emitter.emitting = true;
  }

  /** Stop dust emission. Existing particles fade out naturally by lifespan. */
  stop(): void {
    if (!this._isEmitting) return;
    this._isEmitting = false;
    this.emitter.emitting = false;
  }

  /** Update dust emitter position and depth to follow the unit. */
  updatePosition(x: number, y: number, depth: number): void {
    this.emitter.setPosition(x, y);
    this.emitter.setDepth(depth + 0.5 - DUST_DEPTH_OFFSET);
  }

  /** Destroy the emitter and clean up. */
  destroy(): void {
    this.emitter.destroy();
  }
}
