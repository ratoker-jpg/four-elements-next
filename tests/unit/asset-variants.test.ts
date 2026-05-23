import { describe, expect, it } from 'vitest';
import {
  TERRAIN_VARIANT_GROUPS,
  computeMapVisualSeed,
  resolveDecorAsset,
  resolveObstacleAsset,
  resolveResourceAsset,
  resolveTerrainAsset,
} from '../../src/core/asset-variants.js';

describe('asset variant resolvers', () => {
  it('keeps infinite mineral on the logical key with a legacy fallback', () => {
    const resolution = resolveResourceAsset('infinite', 24, 24, 42);
    expect(resolution.preferredKey).toBe('mineral_infinite');
    expect(resolution.fallbackKey).toBe('mineral_infinite_legacy');
    expect(resolution.profileKey).toBe('mineral_infinite');
  });

  it('selects approved small mineral variants without changing gameplay types', () => {
    const resolution = resolveResourceAsset('small', 10, 15, 42);
    expect(/^mineral_small_0[2-9]$/.test(resolution.preferredKey)).toBe(true);
    expect(resolution.fallbackKey).toBe('mineral_small');
    expect(resolution.profileKey).toBe('mineral_small');
  });

  it('selects approved obstacle and decor variants with legacy fallbacks', () => {
    const rock = resolveObstacleAsset('rock-cluster', 8, 9, 7);
    const bush = resolveDecorAsset('bush', 4, 5, 7);
    expect(/^rock_cluster_0[2-9]$/.test(rock.preferredKey)).toBe(true);
    expect(rock.fallbackKey).toBe('rock_cluster_small_01');
    expect(/^dry_bush_0[2-9]$/.test(bush.preferredKey)).toBe(true);
    expect(bush.fallbackKey).toBe('dry_bush_01');
  });

  it('selects terrain variants deterministically per chunk and semantic terrain type', () => {
    const first = resolveTerrainAsset('sand', 1, 1, 99);
    const second = resolveTerrainAsset('sand', 2, 2, 99);
    const dark = resolveTerrainAsset('sand-dark', 1, 1, 99);

    expect(first).toEqual(second);
    expect(TERRAIN_VARIANT_GROUPS.sand).toContain(first.preferredKey);
    expect(TERRAIN_VARIANT_GROUPS['sand-dark']).toContain(dark.preferredKey);
    expect(first.fallbackKey).toBe('terrain_sand');
    expect(dark.fallbackKey).toBe('terrain_sand_dark');
  });

  it('computes a stable visual seed from map metadata', () => {
    const map = { width: 48, height: 48, hq: { tx: 6, ty: 7, faction: 'cyan' as const } };
    expect(computeMapVisualSeed(map)).toBe(computeMapVisualSeed(map));
    expect(computeMapVisualSeed(map)).not.toBe(
      computeMapVisualSeed({ width: 48, height: 48, hq: { tx: 6, ty: 7, faction: 'green' as const } }),
    );
  });
});
