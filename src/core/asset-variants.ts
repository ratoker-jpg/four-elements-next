import type {
  DecorType,
  MapData,
  ObstacleType,
  ResourceType,
  TerrainType,
} from '../game/map-types.js';

export type EnvironmentProfileKey =
  | 'mineral_small'
  | 'mineral_medium'
  | 'mineral_large'
  | 'mineral_infinite'
  | 'mountain_small_01'
  | 'mountain_medium_01'
  | 'mountain_large_01'
  | 'volcano_small_01'
  | 'volcano_medium_01'
  | 'rock_cluster_small_01'
  | 'dry_bush_01'
  | 'sand_bump_01';

export interface EnvironmentAssetResolution {
  readonly preferredKey: string;
  readonly fallbackKey: string;
  readonly profileKey: EnvironmentProfileKey;
}

export interface TerrainAssetResolution {
  readonly preferredKey: string;
  readonly fallbackKey: string;
}

const TERRAIN_CHUNK_SIZE = 3;

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function hashParts(...parts: Array<string | number>): number {
  return hashString(parts.join('|'));
}

function chooseVariant(keys: readonly string[], hash: number): string {
  return keys[hash % keys.length]!;
}

interface VariantSpec {
  readonly preferredKeys: readonly string[];
  readonly fallbackKey: string;
  readonly profileKey: EnvironmentProfileKey;
}

const RESOURCE_VARIANTS: Record<ResourceType, VariantSpec> = {
  small: {
    preferredKeys: [
      'mineral_small_02',
      'mineral_small_03',
      'mineral_small_04',
      'mineral_small_05',
      'mineral_small_06',
      'mineral_small_07',
      'mineral_small_08',
      'mineral_small_09',
    ],
    fallbackKey: 'mineral_small',
    profileKey: 'mineral_small',
  },
  medium: {
    preferredKeys: [
      'mineral_medium_02',
      'mineral_medium_03',
      'mineral_medium_04',
      'mineral_medium_05',
      'mineral_medium_06',
      'mineral_medium_07',
      'mineral_medium_08',
      'mineral_medium_09',
    ],
    fallbackKey: 'mineral_medium',
    profileKey: 'mineral_medium',
  },
  large: {
    preferredKeys: [
      'mineral_large_02',
      'mineral_large_03',
      'mineral_large_04',
      'mineral_large_05',
      'mineral_large_06',
      'mineral_large_07',
      'mineral_large_08',
      'mineral_large_09',
    ],
    fallbackKey: 'mineral_large',
    profileKey: 'mineral_large',
  },
  infinite: {
    preferredKeys: ['mineral_infinite'],
    fallbackKey: 'mineral_infinite_legacy',
    profileKey: 'mineral_infinite',
  },
};

const OBSTACLE_VARIANTS: Record<ObstacleType, VariantSpec> = {
  'mountain-small': {
    preferredKeys: [
      'mountain_small_02',
      'mountain_small_03',
      'mountain_small_04',
      'mountain_small_05',
      'mountain_small_06',
      'mountain_small_07',
      'mountain_small_08',
      'mountain_small_09',
    ],
    fallbackKey: 'mountain_small_01',
    profileKey: 'mountain_small_01',
  },
  'mountain-medium': {
    preferredKeys: [
      'mountain_medium_02',
      'mountain_medium_03',
      'mountain_medium_04',
      'mountain_medium_05',
      'mountain_medium_06',
      'mountain_medium_07',
      'mountain_medium_08',
      'mountain_medium_09',
    ],
    fallbackKey: 'mountain_medium_01',
    profileKey: 'mountain_medium_01',
  },
  'mountain-large': {
    preferredKeys: [
      'mountain_large_02',
      'mountain_large_03',
      'mountain_large_04',
      'mountain_large_05',
      'mountain_large_06',
      'mountain_large_07',
      'mountain_large_08',
      'mountain_large_09',
    ],
    fallbackKey: 'mountain_large_01',
    profileKey: 'mountain_large_01',
  },
  'volcano-small': {
    preferredKeys: ['volcano_small_01'],
    fallbackKey: 'volcano_small_01',
    profileKey: 'volcano_small_01',
  },
  'volcano-medium': {
    preferredKeys: ['volcano_medium_01'],
    fallbackKey: 'volcano_medium_01',
    profileKey: 'volcano_medium_01',
  },
  'rock-cluster': {
    preferredKeys: [
      'rock_cluster_02',
      'rock_cluster_03',
      'rock_cluster_04',
      'rock_cluster_05',
      'rock_cluster_06',
      'rock_cluster_07',
      'rock_cluster_08',
      'rock_cluster_09',
    ],
    fallbackKey: 'rock_cluster_small_01',
    profileKey: 'rock_cluster_small_01',
  },
};

const DECOR_VARIANTS: Record<DecorType, VariantSpec> = {
  bush: {
    preferredKeys: [
      'dry_bush_02',
      'dry_bush_03',
      'dry_bush_04',
      'dry_bush_05',
      'dry_bush_06',
      'dry_bush_07',
      'dry_bush_08',
      'dry_bush_09',
    ],
    fallbackKey: 'dry_bush_01',
    profileKey: 'dry_bush_01',
  },
  'sand-bump': {
    preferredKeys: [
      'sand_bump_02',
      'sand_bump_03',
      'sand_bump_04',
      'sand_bump_05',
      'sand_bump_06',
      'sand_bump_07',
      'sand_bump_08',
      'sand_bump_09',
    ],
    fallbackKey: 'sand_bump_01',
    profileKey: 'sand_bump_01',
  },
};

export const TERRAIN_VARIANT_GROUPS: Record<TerrainType, readonly string[]> = {
  'sand-light': ['sand_tile_01', 'sand_tile_02', 'sand_tile_03', 'sand_tile_04'],
  // Keep the default terrain on cleaner base tiles because mapgen produces
  // mostly plain sand and accent-heavy tiles would dominate the whole map.
  sand: [
    'sand_tile_01',
    'sand_tile_02',
    'sand_tile_03',
    'sand_tile_04',
    'sand_tile_05',
    'sand_tile_06',
    'sand_tile_07',
    'sand_tile_08',
  ],
  // Make the cracked accent tile available but rarer than the other rough
  // dark-sand options.
  'sand-dark': ['sand_tile_09', 'sand_tile_10', 'sand_tile_12', 'sand_tile_09', 'sand_tile_10', 'sand_tile_12', 'sand_tile_11'],
};

const TERRAIN_FALLBACK_KEYS: Record<TerrainType, string> = {
  sand: 'terrain_sand',
  'sand-dark': 'terrain_sand_dark',
  'sand-light': 'terrain_sand_light',
};

function resolveEnvironmentVariant(
  label: string,
  spec: VariantSpec,
  visualSeed: number,
  tx: number,
  ty: number,
): EnvironmentAssetResolution {
  return {
    preferredKey: chooseVariant(spec.preferredKeys, hashParts(label, visualSeed, tx, ty)),
    fallbackKey: spec.fallbackKey,
    profileKey: spec.profileKey,
  };
}

export function resolveResourceAsset(
  type: ResourceType,
  tx: number,
  ty: number,
  visualSeed: number,
): EnvironmentAssetResolution {
  return resolveEnvironmentVariant(`resource:${type}`, RESOURCE_VARIANTS[type], visualSeed, tx, ty);
}

export function resolveObstacleAsset(
  type: ObstacleType,
  tx: number,
  ty: number,
  visualSeed: number,
): EnvironmentAssetResolution {
  return resolveEnvironmentVariant(`obstacle:${type}`, OBSTACLE_VARIANTS[type], visualSeed, tx, ty);
}

export function resolveDecorAsset(
  type: DecorType,
  tx: number,
  ty: number,
  visualSeed: number,
): EnvironmentAssetResolution {
  return resolveEnvironmentVariant(`decor:${type}`, DECOR_VARIANTS[type], visualSeed, tx, ty);
}

export function resolveTerrainAsset(
  type: TerrainType,
  tx: number,
  ty: number,
  visualSeed: number,
): TerrainAssetResolution {
  const chunkX = Math.floor(tx / TERRAIN_CHUNK_SIZE);
  const chunkY = Math.floor(ty / TERRAIN_CHUNK_SIZE);
  return {
    preferredKey: chooseVariant(
      TERRAIN_VARIANT_GROUPS[type],
      hashParts('terrain', type, visualSeed, chunkX, chunkY),
    ),
    fallbackKey: TERRAIN_FALLBACK_KEYS[type],
  };
}

export function computeMapVisualSeed(map: Pick<MapData, 'width' | 'height' | 'hq'>): number {
  return hashParts('map-visual-seed', map.width, map.height, map.hq.tx, map.hq.ty, map.hq.faction);
}
