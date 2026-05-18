import { describe, it, expect } from 'vitest';
import { containFit } from '../../src/render/contain-fit.js';

describe('containFit', () => {
  it('square image in square box → unchanged dimensions', () => {
    const result = containFit(100, 100, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('tall image in wide box → height constrained, width reduced to preserve aspect ratio', () => {
    // 80×160 natural aspect = 0.5, box 140×140
    const result = containFit(80, 160, 140, 140);
    // Height constrained: drawHeight = 140, drawWidth = 140 * (80/160) = 70
    expect(result.drawHeight).toBe(140);
    expect(result.drawWidth).toBe(70);
  });

  it('wide image in tall box → width constrained, height reduced to preserve aspect ratio', () => {
    // 160×80 natural aspect = 2, box 140×140
    const result = containFit(160, 80, 140, 140);
    // Width constrained: drawWidth = 140, drawHeight = 140 / 2 = 70
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(70);
  });

  it('invalid natural size (zero) → fallback to max box', () => {
    const result = containFit(0, 100, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('invalid natural size (negative) → fallback to max box', () => {
    const result = containFit(-10, 100, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('invalid natural size (NaN) → fallback to max box', () => {
    const result = containFit(NaN, 100, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('invalid natural size (Infinity) → fallback to max box', () => {
    const result = containFit(Infinity, 100, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('zero naturalWidth and naturalHeight → fallback to max box', () => {
    const result = containFit(0, 0, 140, 140);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(140);
  });

  it('non-square box with square image → fits inside without exceeding either dimension', () => {
    // 100×100 natural, 200×100 box (wide)
    const result = containFit(100, 100, 200, 100);
    // Image is taller relative to box → height constrained
    expect(result.drawHeight).toBe(100);
    expect(result.drawWidth).toBe(100);
  });

  it('non-square box with matching aspect ratio → fills box exactly', () => {
    // 200×100 natural (2:1), 140×70 box (2:1)
    const result = containFit(200, 100, 140, 70);
    expect(result.drawWidth).toBe(140);
    expect(result.drawHeight).toBe(70);
  });
});
