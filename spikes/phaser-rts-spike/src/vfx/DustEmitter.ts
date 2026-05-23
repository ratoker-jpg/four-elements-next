/**
 * Dust particle emitter for the harvester.
 * Uses Phaser 3.90's particle API (3.60+).
 *
 * Design:
 * - Dust only while moving
 * - Start burst is stronger than sustained
 * - Sustained dust is subtle
 * - Particles render behind harvester (lower depth)
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
const DUST_FREQUENCY = 100;    // ms between particles during sustained movement
const DUST_BURST_COUNT = 5;    // particles on start burst
const DUST_DEPTH_OFFSET = 0.3; // render behind harvester (harvester is depth + 0.5)

export class DustEmitter {
  private emitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private _isEmitting = false;

  constructor(scene: Phaser.Scene) {
    this.emitter = scene.add.particles(0, 0, 'dust_particle', {
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

  /**
   * Start dust emission at the given position.
   * Fires a start burst, then continues with sustained emission.
   */
  start(x: number, y: number, depth: number): void {
    if (this._isEmitting) return;
    this._isEmitting = true;

    this.emitter.setPosition(x, y);
    this.emitter.setDepth(depth - DUST_DEPTH_OFFSET);
    this.emitter.frequency = DUST_FREQUENCY;

    // Start burst — stronger than sustained
    this.emitter.explode(DUST_BURST_COUNT);

    // Begin sustained emission
    this.emitter.emitting = true;
  }

  /** Stop dust emission. Existing particles fade out naturally by lifespan. */
  stop(): void {
    if (!this._isEmitting) return;
    this._isEmitting = false;
    this.emitter.emitting = false;
  }

  /**
   * Update dust emitter position and depth to follow the harvester.
   * @param x      - Harvester base world X (without inertia offset)
   * @param y      - Harvester base world Y (with groundOffset, without inertia)
   * @param depth  - Harvester current depth value (without +0.5 offset)
   */
  updatePosition(x: number, y: number, depth: number): void {
    this.emitter.setPosition(x, y);
    this.emitter.setDepth(depth + 0.5 - DUST_DEPTH_OFFSET);
  }

  /** Destroy the emitter and clean up. */
  destroy(): void {
    this.emitter.destroy();
  }
}
