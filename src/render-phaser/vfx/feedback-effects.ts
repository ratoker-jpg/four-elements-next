/**
 * Active feedback effects for the Phaser production renderer.
 * Simple pulse rings and scale effects for gathering/unloading/construction.
 *
 * Ported from spikes/phaser-rts-spike/src/vfx/FeedbackEffects.ts
 *
 * Design principles:
 * - Subtle, not combat-like
 * - Small expanding ring for action confirmation
 * - No heavy VFX, projectiles, or explosions
 * - Rings auto-destroy after tween completes
 */

import Phaser from 'phaser';

/**
 * Spawn a small expanding ring at the resource position (gathering feedback).
 * Green-tinted pulse to indicate resource extraction.
 */
export function spawnGatherPulse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
): void {
  spawnPulseRing(scene, x, y, 0x44cc88, depth, 6, 2.2, 500);
}

/**
 * Spawn a small expanding ring at the HQ position (unloading feedback).
 * Amber-tinted pulse to indicate resource delivery.
 */
export function spawnUnloadPulse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
): void {
  spawnPulseRing(scene, x, y, 0xccaa44, depth, 6, 2.0, 400);
}

/**
 * Subtle scale pulse on the HQ sprite when unloading completes.
 */
export function spawnHqPulse(
  scene: Phaser.Scene,
  hqSprite: Phaser.GameObjects.Image,
): void {
  scene.tweens.add({
    targets: hqSprite,
    scaleX: { from: hqSprite.scaleX, to: hqSprite.scaleX * 1.04 },
    scaleY: { from: hqSprite.scaleY, to: hqSprite.scaleY * 1.04 },
    duration: 200,
    yoyo: true,
    ease: 'Quad.easeInOut',
  });
}

/**
 * Spawn a subtle expanding ring at the construction site (construction progress feedback).
 * Gold-tinted pulse to indicate construction activity.
 */
export function spawnConstructionPulse(
  scene: Phaser.Scene,
  x: number,
  y: number,
  depth: number,
): void {
  spawnPulseRing(scene, x, y, 0xf0c96a, depth, 4, 1.8, 350);
}

// ─── Internal ─────────────────────────────────────────────────────

function spawnPulseRing(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  depth: number,
  initialRadius: number,
  endScale: number,
  duration: number,
): void {
  const ring = scene.add.graphics();
  ring.setDepth(depth + 0.6);
  ring.lineStyle(1.5, color, 0.7);
  ring.strokeCircle(0, 0, initialRadius);
  ring.setPosition(x, y);

  scene.tweens.add({
    targets: ring,
    scaleX: endScale,
    scaleY: endScale,
    alpha: 0,
    duration: duration,
    ease: 'Quad.easeOut',
    onComplete: () => {
      ring.destroy();
    },
  });
}
