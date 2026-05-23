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
  TERRAIN_COLORS,
} from '../../src/core/constants.js';
import { shouldComputeAlphaMeta } from '../../src/core/assets.js';
import type { TerrainType } from '../../src/game/map-types.js';

describe('PROC-SAND-01: procedural sand terrain', () => {
  beforeEach(() => {
    clearProceduralSandCache();
  });

  // ── Feature flag ────────────────────────────────────────────────────

  it('FE_PROCEDURAL_SAND_ENABLED is true by default', () => {
    expect(FE_PROCEDURAL_SAND_ENABLED).toBe(true);
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
    const color1 = proceduralSandColor('sand', 42, 10, 20);
    const color2 = proceduralSandColor('sand', 999, 10, 20);
    // Not guaranteed to be different for any specific tile, but likely different
    // for at least one tile in a sample
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
      const lightColor = proceduralSandColor('sand-light', 42, tx, ty);
      const sandColor = proceduralSandColor('sand', 42, tx, ty);

      // Parse rgb(r,g,b) and compute perceived brightness
      sandLightSum += parseRgbBrightness(lightColor);
      sandSum += parseRgbBrightness(sandColor);
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
      const sandColor = proceduralSandColor('sand', 42, tx, ty);
      const darkColor = proceduralSandColor('sand-dark', 42, tx, ty);

      sandSum += parseRgbBrightness(sandColor);
      sandDarkSum += parseRgbBrightness(darkColor);
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
    // Two tiles in the same chunk should differ only by micro-variation
    const chunkSize = PROCEDURAL_SAND_CHUNK_SIZE;
    const tx1 = 0;
    const ty1 = 0;
    const tx2 = 1;
    const ty2 = 1;
    // Both should be in chunk (0,0)
    expect(Math.floor(tx1 / chunkSize)).toBe(Math.floor(tx2 / chunkSize));
    expect(Math.floor(ty1 / chunkSize)).toBe(Math.floor(ty2 / chunkSize));

    const color1 = proceduralSandColor('sand', 42, tx1, ty1);
    const color2 = proceduralSandColor('sand', 42, tx2, ty2);

    // They should be close but not necessarily identical (micro-variation)
    const b1 = parseRgbBrightness(color1);
    const b2 = parseRgbBrightness(color2);
    const diff = Math.abs(b1 - b2);
    // Micro-variation is ±2%, so max difference should be small
    expect(diff).toBeLessThan(0.06);
  });

  it('tiles in different chunks can have more variation', () => {
    const chunkSize = PROCEDURAL_SAND_CHUNK_SIZE;
    const tx1 = 0;
    const ty1 = 0;
    const tx2 = chunkSize; // Next chunk over
    const ty2 = 0;

    // Sample multiple visualSeeds to find at least one case with notable difference
    let foundVariation = false;
    for (let seed = 0; seed < 20; seed++) {
      const color1 = proceduralSandColor('sand', seed, tx1, ty1);
      const color2 = proceduralSandColor('sand', seed, tx2, ty2);
      const b1 = parseRgbBrightness(color1);
      const b2 = parseRgbBrightness(color2);
      if (Math.abs(b1 - b2) > 0.01) {
        foundVariation = true;
        break;
      }
    }
    // Different chunks CAN have different tints (not guaranteed for every seed)
    expect(foundVariation).toBe(true);
  });

  // ── Cache behavior ──────────────────────────────────────────────────

  it('clearProceduralSandCache resets internal state', () => {
    const color1 = proceduralSandColor('sand', 42, 10, 20);
    clearProceduralSandCache();
    const color2 = proceduralSandColor('sand', 42, 10, 20);
    // After clear, recomputation should produce the same result (deterministic)
    expect(color1).toBe(color2);
  });

  // ── shouldComputeAlphaMeta respects procedural flag ──────────────────

  it('shouldComputeAlphaMeta returns false for terrain keys when procedural is ON', () => {
    // This test documents the current behavior; if FE_PROCEDURAL_SAND_ENABLED changes,
    // the test should be updated accordingly
    if (FE_PROCEDURAL_SAND_ENABLED) {
      expect(shouldComputeAlphaMeta('terrain_sand')).toBe(false);
      expect(shouldComputeAlphaMeta('terrain_sand_dark')).toBe(false);
      expect(shouldComputeAlphaMeta('terrain_sand_light')).toBe(false);
      expect(shouldComputeAlphaMeta('sand_tile_01')).toBe(false);
      expect(shouldComputeAlphaMeta('sand_tile_12')).toBe(false);
    }
  });

  it('shouldComputeAlphaMeta still returns true for building/HQ keys', () => {
    expect(shouldComputeAlphaMeta('building_cyan_power_plant')).toBe(true);
    expect(shouldComputeAlphaMeta('hq_cyan')).toBe(true);
  });

  // ── No chessboard/noisy look ────────────────────────────────────────

  it('adjacent tiles do not produce a chessboard pattern', () => {
    // Check that horizontally adjacent tiles have similar brightness
    const colors: number[] = [];
    for (let tx = 0; tx < 10; tx++) {
      colors.push(parseRgbBrightness(proceduralSandColor('sand', 42, tx, 5)));
    }

    // Count sign changes in brightness differences
    let signChanges = 0;
    for (let i = 1; i < colors.length - 1; i++) {
      const diff1 = colors[i]! - colors[i - 1]!;
      const diff2 = colors[i + 1]! - colors[i]!;
      if (diff1 * diff2 < 0) signChanges++;
    }

    // A chessboard pattern would cause ~9 sign changes in 10 tiles
    // Normal variation should cause far fewer
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
  // Perceived brightness (ITU-R BT.601)
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
