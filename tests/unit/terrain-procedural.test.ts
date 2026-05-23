import { describe, it, expect, beforeEach } from 'vitest';
import {
  proceduralSandColor,
  clearProceduralSandCache,
} from '../../src/render/terrain-procedural.js';
import {
  FE_PROCEDURAL_SAND_ENABLED,
  PROCEDURAL_SAND_CHUNK_SIZE,
  PROC_SAND_HUE_RANGE,
  PROC_SAND_SAT_RANGE,
  PROC_SAND_LIGHT_RANGE,
  PROC_SAND_MICRO_RANGE,
} from '../../src/core/constants.js';
import type { TerrainType } from '../../src/game/map-types.js';

/**
 * Tests for the procedural sand terrain module.
 *
 * NOTE: FE_PROCEDURAL_SAND_ENABLED is currently false (legacy terrain is active).
 * These tests verify the procedural terrain logic itself remains correct
 * for when the flag is re-enabled.
 */
describe('PROC-SAND-01: procedural sand terrain (module logic)', () => {
  beforeEach(() => {
    clearProceduralSandCache();
  });

  // ── Feature flag state ──────────────────────────────────────────────

  it('FE_PROCEDURAL_SAND_ENABLED is currently false (legacy terrain active)', () => {
    expect(FE_PROCEDURAL_SAND_ENABLED).toBe(false);
  });

  it('PROCEDURAL_SAND_CHUNK_SIZE is 4', () => {
    expect(PROCEDURAL_SAND_CHUNK_SIZE).toBe(4);
  });

  // ── Tuning constants are within safe ranges ─────────────────────────

  it('tuning constants are conservative (small ranges)', () => {
    expect(PROC_SAND_HUE_RANGE).toBeLessThanOrEqual(10);
    expect(PROC_SAND_SAT_RANGE).toBeLessThanOrEqual(0.15);
    expect(PROC_SAND_LIGHT_RANGE).toBeLessThanOrEqual(0.12);
    expect(PROC_SAND_MICRO_RANGE).toBeLessThanOrEqual(0.05);
  });

  // ── Determinism: same inputs → same output ──────────────────────────

  it('same inputs always produce the same color', () => {
    const color1 = proceduralSandColor('sand', 42, 10, 20);
    const color2 = proceduralSandColor('sand', 42, 10, 20);
    expect(color1).toBe(color2);
  });

  it('determinism holds across all terrain types', () => {
    const types: TerrainType[] = ['sand', 'sand-dark', 'sand-light'];
    for (const t of types) {
      const a = proceduralSandColor(t, 99, 5, 5);
      const b = proceduralSandColor(t, 99, 5, 5);
      expect(a).toBe(b);
    }
  });

  it('determinism holds with visualSeed = 0', () => {
    const a = proceduralSandColor('sand', 0, 0, 0);
    const b = proceduralSandColor('sand', 0, 0, 0);
    expect(a).toBe(b);
  });

  // ── Different visualSeed can produce different output ────────────────

  it('different visualSeed can produce different colors', () => {
    let foundDifferent = false;
    for (let tx = 0; tx < 20 && !foundDifferent; tx++) {
      for (let ty = 0; ty < 20 && !foundDifferent; ty++) {
        if (proceduralSandColor('sand', 42, tx, ty) !== proceduralSandColor('sand', 999, tx, ty)) {
          foundDifferent = true;
        }
      }
    }
    expect(foundDifferent).toBe(true);
  });

  // ── Terrain types produce distinguishable base tones ─────────────────

  it('sand-light is lighter than sand on average', () => {
    const sampleSize = 100;
    let sandLightSum = 0;
    let sandSum = 0;

    for (let i = 0; i < sampleSize; i++) {
      const tx = i * 3;
      const ty = i * 7;
      sandLightSum += parseRgbBrightness(proceduralSandColor('sand-light', 42, tx, ty));
      sandSum += parseRgbBrightness(proceduralSandColor('sand', 42, tx, ty));
    }

    expect(sandLightSum / sampleSize).toBeGreaterThan(sandSum / sampleSize);
  });

  it('sand is lighter than sand-dark on average', () => {
    const sampleSize = 100;
    let sandSum = 0;
    let sandDarkSum = 0;

    for (let i = 0; i < sampleSize; i++) {
      const tx = i * 3;
      const ty = i * 7;
      sandSum += parseRgbBrightness(proceduralSandColor('sand', 42, tx, ty));
      sandDarkSum += parseRgbBrightness(proceduralSandColor('sand-dark', 42, tx, ty));
    }

    expect(sandSum / sampleSize).toBeGreaterThan(sandDarkSum / sampleSize);
  });

  it('procedural colors stay in valid rgb() range', () => {
    const types: TerrainType[] = ['sand', 'sand-dark', 'sand-light'];
    for (const t of types) {
      for (let tx = 0; tx < 48; tx++) {
        for (let ty = 0; ty < 48; ty++) {
          const color = proceduralSandColor(t, 42, tx, ty);
          const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
          expect(match).not.toBeNull();
          const r = parseInt(match![1]!, 10);
          const g = parseInt(match![2]!, 10);
          const b = parseInt(match![3]!, 10);
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(255);
          expect(g).toBeGreaterThanOrEqual(0);
          expect(g).toBeLessThanOrEqual(255);
          expect(b).toBeGreaterThanOrEqual(0);
          expect(b).toBeLessThanOrEqual(255);
        }
      }
    }
  });

  // ── Chunk coherence: tiles in same chunk have similar tint ───────────

  it('tiles in same chunk share chunk-level base tint', () => {
    const chunkSize = PROCEDURAL_SAND_CHUNK_SIZE;
    const tx1 = 0;
    const ty1 = 0;
    const tx2 = 1;
    const ty2 = 1;
    expect(Math.floor(tx1 / chunkSize)).toBe(Math.floor(tx2 / chunkSize));
    expect(Math.floor(ty1 / chunkSize)).toBe(Math.floor(ty2 / chunkSize));

    const color1 = proceduralSandColor('sand', 42, tx1, ty1);
    const color2 = proceduralSandColor('sand', 42, tx2, ty2);

    const b1 = parseRgbBrightness(color1);
    const b2 = parseRgbBrightness(color2);
    expect(Math.abs(b1 - b2)).toBeLessThan(0.06);
  });

  it('tiles in different chunks can have more variation', () => {
    const chunkSize = PROCEDURAL_SAND_CHUNK_SIZE;
    const tx2 = chunkSize;

    let foundVariation = false;
    for (let seed = 0; seed < 20; seed++) {
      const color1 = proceduralSandColor('sand', seed, 0, 0);
      const color2 = proceduralSandColor('sand', seed, tx2, 0);
      const b1 = parseRgbBrightness(color1);
      const b2 = parseRgbBrightness(color2);
      if (Math.abs(b1 - b2) > 0.01) {
        foundVariation = true;
        break;
      }
    }
    expect(foundVariation).toBe(true);
  });

  // ── Cache behavior ──────────────────────────────────────────────────

  it('clearProceduralSandCache resets internal state', () => {
    const color1 = proceduralSandColor('sand', 42, 10, 20);
    clearProceduralSandCache();
    const color2 = proceduralSandColor('sand', 42, 10, 20);
    expect(color1).toBe(color2);
  });

  // ── No chessboard/noisy look ────────────────────────────────────────

  it('adjacent tiles do not produce a chessboard pattern', () => {
    const colors: number[] = [];
    for (let tx = 0; tx < 10; tx++) {
      colors.push(parseRgbBrightness(proceduralSandColor('sand', 42, tx, 5)));
    }

    let signChanges = 0;
    for (let i = 1; i < colors.length - 1; i++) {
      const diff1 = colors[i]! - colors[i - 1]!;
      const diff2 = colors[i + 1]! - colors[i]!;
      if (diff1 * diff2 < 0) signChanges++;
    }

    expect(signChanges).toBeLessThan(7);
  });
});

/** Parse an rgb(r,g,b) string and compute perceived brightness (0–1). */
function parseRgbBrightness(color: string): number {
  const match = color.match(/^rgb\((\d+),(\d+),(\d+)\)$/);
  if (!match) return 0;
  const r = parseInt(match[1]!, 10) / 255;
  const g = parseInt(match[2]!, 10) / 255;
  const b = parseInt(match[3]!, 10) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
