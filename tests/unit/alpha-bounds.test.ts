import { describe, it, expect } from 'vitest';
import { computeAlphaBounds, shouldComputeAlphaMeta } from '../../src/core/assets.js';

/** Create a Uint8ClampedArray representing an RGBA image with the given dimensions. */
function makePixelData(
  width: number,
  height: number,
  painter: (x: number, y: number) => [number, number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = painter(x, y);
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = a;
    }
  }
  return data;
}

describe('computeAlphaBounds', () => {
  it('fully opaque image returns full bounds', () => {
    const w = 4;
    const h = 4;
    const data = makePixelData(w, h, () => [255, 0, 0, 255]);
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });

  it('transparent padding around visible content returns visible bounds', () => {
    const w = 8;
    const h = 8;
    // Fully transparent by default, opaque 3×3 block at (2,3)→(4,5)
    const data = makePixelData(w, h, (x, y) => {
      if (x >= 2 && x <= 4 && y >= 3 && y <= 5) return [255, 0, 0, 255];
      return [0, 0, 0, 0];
    });
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 2, y: 3, w: 3, h: 3 });
  });

  it('fully transparent image falls back to full dimensions', () => {
    const w = 5;
    const h = 5;
    const data = makePixelData(w, h, () => [0, 0, 0, 0]);
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 0, y: 0, w: 5, h: 5 });
  });

  it('semi-transparent pixels (alpha > 0) are included in bounds', () => {
    const w = 6;
    const h = 6;
    const data = makePixelData(w, h, (x, y) => {
      if (x === 1 && y === 1) return [100, 100, 100, 1]; // barely visible
      if (x === 4 && y === 4) return [200, 200, 200, 128]; // semi-transparent
      return [0, 0, 0, 0];
    });
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 1, y: 1, w: 4, h: 4 });
  });

  it('single visible pixel returns 1×1 bounds', () => {
    const w = 10;
    const h = 10;
    const data = makePixelData(w, h, (x, y) => {
      if (x === 7 && y === 3) return [255, 0, 0, 255];
      return [0, 0, 0, 0];
    });
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 7, y: 3, w: 1, h: 1 });
  });

  it('visible content touching canvas edges returns correct bounds', () => {
    const w = 4;
    const h = 4;
    // Opaque at edges only: row 0 and row 3, all columns
    const data = makePixelData(w, h, (x, y) => {
      if (y === 0 || y === 3) return [255, 0, 0, 255];
      return [0, 0, 0, 0];
    });
    const result = computeAlphaBounds(data, w, h);
    expect(result).toEqual({ x: 0, y: 0, w: 4, h: 4 });
  });

  it('simulates 512×512 building with transparent padding', () => {
    // Simulate a 512×512 canvas with 21px left/right padding, 73px top padding, 17px bottom padding
    // Visible content: 470×422 at (21, 73)
    const canvasW = 512;
    const canvasH = 512;
    const padL = 21;
    const padT = 73;
    const padR = 21;
    const padB = 17;
    const visW = canvasW - padL - padR; // 470
    const visH = canvasH - padT - padB; // 422

    const data = makePixelData(canvasW, canvasH, (x, y) => {
      if (x >= padL && x < canvasW - padR && y >= padT && y < canvasH - padB) {
        return [128, 128, 128, 255];
      }
      return [0, 0, 0, 0];
    });

    const result = computeAlphaBounds(data, canvasW, canvasH);
    expect(result.x).toBe(padL);
    expect(result.y).toBe(padT);
    expect(result.w).toBe(visW);
    expect(result.h).toBe(visH);
  });
});

describe('shouldComputeAlphaMeta', () => {
  it('returns true for building_cyan_power_plant', () => {
    expect(shouldComputeAlphaMeta('building_cyan_power_plant')).toBe(true);
  });

  it('returns true for building_green_separator', () => {
    expect(shouldComputeAlphaMeta('building_green_separator')).toBe(true);
  });

  it('returns true for HQ keys (hq_cyan)', () => {
    expect(shouldComputeAlphaMeta('hq_cyan')).toBe(true);
  });

  it('returns true for HQ keys (hq_purple)', () => {
    expect(shouldComputeAlphaMeta('hq_purple')).toBe(true);
  });

  it('returns true for all 6 building types across factions', () => {
    const types = ['separator', 'raw_storage', 'matter_storage', 'power_plant', 'command_relay', 'units_factory'];
    const factions = ['cyan', 'green', 'yellow', 'purple'];
    for (const type of types) {
      for (const faction of factions) {
        expect(shouldComputeAlphaMeta(`building_${faction}_${type}`)).toBe(true);
      }
    }
  });

  it('returns false for terrain manifest keys when procedural sand is enabled', () => {
    // PROC-SAND-01: When FE_PROCEDURAL_SAND_ENABLED is true, terrain alpha
    // metadata is not needed for the active render path. Assets still load.
    expect(shouldComputeAlphaMeta('terrain_sand')).toBe(false);
    expect(shouldComputeAlphaMeta('sand_tile_09')).toBe(false);
  });

  it('returns false for mineral_small', () => {
    expect(shouldComputeAlphaMeta('mineral_small')).toBe(false);
  });

  it('returns false for builder spritesheet keys', () => {
    expect(shouldComputeAlphaMeta('builder_cyan')).toBe(false);
  });

  it('returns false for harvester spritesheet keys', () => {
    expect(shouldComputeAlphaMeta('harvester_green')).toBe(false);
  });

  it('returns false for environment/decor keys', () => {
    expect(shouldComputeAlphaMeta('mountain_large_01')).toBe(false);
    expect(shouldComputeAlphaMeta('dry_bush_01')).toBe(false);
    expect(shouldComputeAlphaMeta('sand_bump_01')).toBe(false);
    expect(shouldComputeAlphaMeta('rock_cluster_small_01')).toBe(false);
  });
});

describe('AssetStore.getMeta fallback behavior', () => {
  it('returns null for unknown keys without errors', async () => {
    // Dynamic import to get the class; it won't load any real assets here
    const { AssetStore } = await import('../../src/core/assets.js');
    const store = new AssetStore();
    expect(store.getMeta('nonexistent_key')).toBeNull();
  });

  it('returns null for keys not yet loaded', async () => {
    const { AssetStore } = await import('../../src/core/assets.js');
    const store = new AssetStore();
    expect(store.getMeta('building_cyan_power_plant')).toBeNull();
  });
});
