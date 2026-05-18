import { describe, it, expect } from 'vitest';
import { containFit } from '../../src/render/contain-fit.js';

/**
 * Spritesheet-specific contain-fit tests.
 *
 * drawSpritesheetFrame() passes FRAME_SIZE (256) as both naturalWidth and
 * naturalHeight, representing a square source frame. These tests validate
 * that a square source frame is contained correctly inside various bounding
 * boxes — the exact call pattern used by drawSpritesheetFrame().
 */
describe('spritesheet frame contain-fit (256×256 source)', () => {
  const FRAME_SIZE = 256;

  it('square frame into square box → draws at full box size (no change)', () => {
    // builder_base profile: [76, 76]
    const zoom = 1;
    const result = containFit(FRAME_SIZE, FRAME_SIZE, 76 * zoom, 76 * zoom);
    expect(result.drawWidth).toBe(76);
    expect(result.drawHeight).toBe(76);
  });

  it('square frame into wide box → height constrained, width reduced to match', () => {
    // Hypothetical non-square profile: [140, 100]
    const result = containFit(FRAME_SIZE, FRAME_SIZE, 140, 100);
    // Square source in wide box → height-constrained: drawHeight=100, drawWidth=100
    expect(result.drawHeight).toBe(100);
    expect(result.drawWidth).toBe(100);
  });

  it('square frame into tall box → width constrained, height reduced to match', () => {
    // Hypothetical non-square profile: [80, 120]
    const result = containFit(FRAME_SIZE, FRAME_SIZE, 80, 120);
    // Square source in tall box → width-constrained: drawWidth=80, drawHeight=80
    expect(result.drawWidth).toBe(80);
    expect(result.drawHeight).toBe(80);
  });

  it('harvester_base profile renders unchanged', () => {
    // harvester_base profile: [82, 82]
    const result = containFit(FRAME_SIZE, FRAME_SIZE, 82, 82);
    expect(result.drawWidth).toBe(82);
    expect(result.drawHeight).toBe(82);
  });
});
