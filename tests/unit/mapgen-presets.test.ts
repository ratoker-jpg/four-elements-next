import { describe, it, expect } from 'vitest';
import {
  MAPGEN_PRESETS,
  DEFAULT_PRESET_ID,
  PRESET_IDS,
  resolveMapgenPresetConfig,
  type MapgenPresetId,
} from '../../src/game/mapgen-presets.js';
import { DEFAULT_MAPGEN_CONFIG } from '../../src/game/mapgen-config.js';
import { generateMap } from '../../src/game/mapgen.js';

describe('mapgen-presets', () => {
  // ── Preset definitions ───────────────────────────────────────────

  it('MAPGEN_PRESETS has exactly 4 entries with correct IDs', () => {
    const keys = Object.keys(MAPGEN_PRESETS) as MapgenPresetId[];
    expect(keys).toEqual(['balanced', 'more-resources', 'more-mountains', 'open-map']);
  });

  it('PRESET_IDS matches MAPGEN_PRESETS keys in display order', () => {
    const keys = Object.keys(MAPGEN_PRESETS) as MapgenPresetId[];
    expect(PRESET_IDS).toEqual(keys);
  });

  it('each preset has a non-empty Russian label', () => {
    for (const preset of Object.values(MAPGEN_PRESETS)) {
      expect(preset.label.length).toBeGreaterThan(0);
      // Cyrillic character check — at least one Cyrillic letter
      expect(/[\u0400-\u04FF]/.test(preset.label)).toBe(true);
    }
  });

  it('DEFAULT_PRESET_ID is balanced', () => {
    expect(DEFAULT_PRESET_ID).toBe('balanced');
  });

  it('no preset ID contains "volcano"', () => {
    const ids = Object.keys(MAPGEN_PRESETS);
    const volcanoIds = ids.filter((k) => /volcano/i.test(k));
    expect(volcanoIds).toEqual([]);
  });

  // ── Preset config resolution ────────────────────────────────────

  it('resolveMapgenPresetConfig("balanced") returns config equal to DEFAULT_MAPGEN_CONFIG', () => {
    const cfg = resolveMapgenPresetConfig('balanced');
    expect(cfg).toEqual(DEFAULT_MAPGEN_CONFIG);
  });

  it('resolveMapgenPresetConfig("more-resources") has higher resource counts than balanced', () => {
    const cfg = resolveMapgenPresetConfig('more-resources');
    expect(cfg.starterSmallCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.starterSmallCount);
    expect(cfg.starterMediumCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.starterMediumCount);
    expect(cfg.transitionMediumCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.transitionMediumCount);
    expect(cfg.transitionLargeCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.transitionLargeCount);
    expect(cfg.farLargeCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.farLargeCount);
    expect(cfg.centerLargeCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.centerLargeCount);
    expect(cfg.centerMediumCount).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.centerMediumCount);
  });

  it('resolveMapgenPresetConfig("more-mountains") has higher obstacle density than balanced', () => {
    const cfg = resolveMapgenPresetConfig('more-mountains');
    expect(cfg.edgeClusterCountStandard).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.edgeClusterCountStandard);
    expect(cfg.edgeClusterCountLarge).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.edgeClusterCountLarge);
    expect(cfg.interiorClusterDensityDivisor).toBeLessThan(DEFAULT_MAPGEN_CONFIG.interiorClusterDensityDivisor);
  });

  it('resolveMapgenPresetConfig("open-map") has lower obstacle density and decor than balanced', () => {
    const cfg = resolveMapgenPresetConfig('open-map');
    expect(cfg.edgeClusterCountStandard).toBeLessThan(DEFAULT_MAPGEN_CONFIG.edgeClusterCountStandard);
    expect(cfg.edgeClusterCountLarge).toBeLessThan(DEFAULT_MAPGEN_CONFIG.edgeClusterCountLarge);
    expect(cfg.interiorClusterDensityDivisor).toBeGreaterThan(DEFAULT_MAPGEN_CONFIG.interiorClusterDensityDivisor);
    expect(cfg.decorBushCount).toBeLessThan(DEFAULT_MAPGEN_CONFIG.decorBushCount);
    expect(cfg.decorSandBumpCount).toBeLessThan(DEFAULT_MAPGEN_CONFIG.decorSandBumpCount);
    expect(cfg.edgeDecorBushCount).toBeLessThan(DEFAULT_MAPGEN_CONFIG.edgeDecorBushCount);
    expect(cfg.edgeDecorSandBumpCount).toBeLessThan(DEFAULT_MAPGEN_CONFIG.edgeDecorSandBumpCount);
  });

  // ── Determinism with presets ────────────────────────────────────

  it('same seed + same preset is deterministic', () => {
    for (const presetId of PRESET_IDS) {
      const cfg = resolveMapgenPresetConfig(presetId);
      const a = generateMap(48, 48, 'cyan', 42, cfg);
      const b = generateMap(48, 48, 'cyan', 42, cfg);
      expect(a.resources.length).toBe(b.resources.length);
      expect(a.obstacles.length).toBe(b.obstacles.length);
      expect(a.decor.length).toBe(b.decor.length);
    }
  });

  it('different presets with same seed produce different map shapes', () => {
    const balancedMap = generateMap(48, 48, 'cyan', 42, resolveMapgenPresetConfig('balanced'));
    const moreResourcesMap = generateMap(48, 48, 'cyan', 42, resolveMapgenPresetConfig('more-resources'));
    const moreMountainsMap = generateMap(48, 48, 'cyan', 42, resolveMapgenPresetConfig('more-mountains'));
    const openMapMap = generateMap(48, 48, 'cyan', 42, resolveMapgenPresetConfig('open-map'));

    // more-resources should have more resources than balanced
    expect(moreResourcesMap.resources.length).toBeGreaterThanOrEqual(balancedMap.resources.length);

    // more-mountains should have more obstacles than balanced
    expect(moreMountainsMap.obstacles.length).toBeGreaterThanOrEqual(balancedMap.obstacles.length);

    // open-map should have fewer obstacles than balanced
    expect(openMapMap.obstacles.length).toBeLessThanOrEqual(balancedMap.obstacles.length);

    // open-map should have less decor than balanced
    expect(openMapMap.decor.length).toBeLessThanOrEqual(balancedMap.decor.length);
  });

  it('balanced preset without config matches generateMap with resolved balanced config', () => {
    const a = generateMap(48, 48, 'cyan', 42);
    const b = generateMap(48, 48, 'cyan', 42, resolveMapgenPresetConfig('balanced'));
    expect(a.resources.length).toBe(b.resources.length);
    expect(a.obstacles.length).toBe(b.obstacles.length);
    expect(a.decor.length).toBe(b.decor.length);
  });
});
