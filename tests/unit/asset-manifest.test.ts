import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ASSET_MANIFEST } from '../../src/core/constants.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('ASSET_MANIFEST', () => {
  it('maps mineral_infinite to the approved _01 asset and keeps legacy fallback', () => {
    expect(ASSET_MANIFEST.mineral_infinite).toBe('assets/environment/mineral_infinite_01.png');
    expect(ASSET_MANIFEST.mineral_infinite_legacy).toBe('assets/environment/mineral_infinite.png');
  });

  it('contains the new sand tile variant entries', () => {
    for (let index = 1; index <= 12; index++) {
      const suffix = String(index).padStart(2, '0');
      expect(ASSET_MANIFEST[`sand_tile_${suffix}`]).toBe(`assets/tiles/sand_tile/sand_tile_${suffix}.png`);
    }
  });

  it('resolves every manifest path to a real file under public/', () => {
    for (const [key, relativePath] of Object.entries(ASSET_MANIFEST)) {
      const absolutePath = resolve(repoRoot, 'public', relativePath);
      expect(existsSync(absolutePath), `${key} -> ${relativePath}`).toBe(true);
    }
  });
});
