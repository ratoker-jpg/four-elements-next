/** Map data types for the Four Elements game. */

export type FactionId = 'cyan' | 'green' | 'yellow' | 'purple';

export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';

export type ResourceType = 'small' | 'medium' | 'large' | 'infinite';

export type DecorType =
  | 'mountain-small'
  | 'mountain-medium'
  | 'mountain-large'
  | 'volcano-small'
  | 'volcano-medium'
  | 'rock-cluster'
  | 'bush'
  | 'sand-bump';

export interface HqPlacement {
  tx: number;
  ty: number;
  faction: FactionId;
}

export interface ResourcePlacement {
  tx: number;
  ty: number;
  type: ResourceType;
}

export interface DecorPlacement {
  tx: number;
  ty: number;
  type: DecorType;
}

/** Building types that have game logic (economy, production, etc.). */
export type BuildingType = 'separator' | 'raw-storage' | 'matter-storage' | 'power-plant' | 'command-relay' | 'units-factory';

export interface BuildingPlacement {
  tx: number;
  ty: number;
  type: BuildingType;
}

export interface BuilderPlacement {
  tx: number;
  ty: number;
  busy: boolean;
}

export interface ConstructionSitePlacement {
  tx: number;
  ty: number;
  type: BuildingType;
  elapsed: number;
  duration: number;
  progress: number;
}

export interface MapData {
  width: number;
  height: number;
  terrain: TerrainType[][];
  hq: HqPlacement;
  resources: ResourcePlacement[];
  decor: DecorPlacement[];
  buildings: BuildingPlacement[];
  builders: BuilderPlacement[];
  constructionSites: ConstructionSitePlacement[];
}

/** Asset key mapping for resource types. */
export const RESOURCE_ASSET_KEYS: Record<ResourceType, string> = {
  small: 'mineral_small',
  medium: 'mineral_medium',
  large: 'mineral_large',
  infinite: 'mineral_infinite',
};

/** Asset key mapping for decor types. */
export const DECOR_ASSET_KEYS: Record<DecorType, string> = {
  'mountain-small': 'mountain_small_01',
  'mountain-medium': 'mountain_medium_01',
  'mountain-large': 'mountain_large_01',
  'volcano-small': 'volcano_small_01',
  'volcano-medium': 'volcano_medium_01',
  'rock-cluster': 'rock_cluster_small_01',
  'bush': 'dry_bush_01',
  'sand-bump': 'sand_bump_01',
};

/** Asset key for terrain types. */
export const TERRAIN_ASSET_KEYS: Record<TerrainType, string> = {
  sand: 'terrain_sand',
  'sand-dark': 'terrain_sand_dark',
  'sand-light': 'terrain_sand_light',
};
