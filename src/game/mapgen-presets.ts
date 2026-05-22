/**
 * MAP-EDITOR-ARCH-01 PR6 — Mapgen preset selector on Seed Screen.
 *
 * Named presets that map to Partial<MapgenConfig> overrides.
 * Screens pass MapgenPresetId; resolution happens only in createGameState.
 *
 * Design decisions:
 * - Presets are identified by string ID — lightweight to thread through screens.
 * - Each preset stores a Partial<MapgenConfig> merged with defaults via resolveMapgenConfig.
 * - No volcano presets.  No custom editing.  No localStorage.
 */

import type { MapgenConfig } from './mapgen-config.js';
import { resolveMapgenConfig } from './mapgen-config.js';

/** Identifiers for the four map generation presets. */
export type MapgenPresetId = 'balanced' | 'more-resources' | 'more-mountains' | 'open-map';

/** Default preset — identical to DEFAULT_MAPGEN_CONFIG. */
export const DEFAULT_PRESET_ID: MapgenPresetId = 'balanced';

/** Preset definition: a UI label + partial config override. */
export interface MapgenPreset {
  readonly label: string;
  readonly config: Partial<MapgenConfig>;
}

/** All available presets.  Keys are MapgenPresetId values. */
export const MAPGEN_PRESETS: Readonly<Record<MapgenPresetId, MapgenPreset>> = {
  balanced: {
    label: 'Сбалансированная',
    config: {},
  },
  'more-resources': {
    label: 'Больше ресурсов',
    config: {
      starterSmallCount: 15,
      starterMediumCount: 8,
      transitionMediumCount: 5,
      transitionLargeCount: 4,
      farLargeCount: 4,
      centerLargeCount: 6,
      centerMediumCount: 8,
    },
  },
  'more-mountains': {
    label: 'Больше скал и гор',
    config: {
      edgeClusterCountStandard: 14,
      edgeClusterCountLarge: 22,
      interiorClusterDensityDivisor: 250,
    },
  },
  'open-map': {
    label: 'Открытая карта',
    config: {
      edgeClusterCountStandard: 4,
      edgeClusterCountLarge: 8,
      interiorClusterDensityDivisor: 700,
      decorBushCount: 10,
      decorSandBumpCount: 12,
      edgeDecorBushCount: 3,
      edgeDecorSandBumpCount: 4,
    },
  },
};

/** All valid preset IDs in display order. */
export const PRESET_IDS: readonly MapgenPresetId[] = ['balanced', 'more-resources', 'more-mountains', 'open-map'];

/**
 * Resolve a preset ID to a full MapgenConfig by merging the preset's
 * partial overrides with DEFAULT_MAPGEN_CONFIG.
 *
 * @param id - Preset identifier.  Must be a valid MapgenPresetId.
 * @returns A complete MapgenConfig with all fields filled.
 */
export function resolveMapgenPresetConfig(id: MapgenPresetId): MapgenConfig {
  const preset = MAPGEN_PRESETS[id];
  return resolveMapgenConfig(preset.config);
}
