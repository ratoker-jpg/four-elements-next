/** Map data types for the Four Elements game. */

export type FactionId = 'cyan' | 'green' | 'yellow' | 'purple';

export type TerrainType = 'sand' | 'sand-dark' | 'sand-light';

export type ResourceType = 'small' | 'medium' | 'large' | 'infinite';

/** Blocking obstacle types that impede movement and construction. */
export type ObstacleType =
  | 'mountain-small'
  | 'mountain-medium'
  | 'mountain-large'
  | 'volcano-small'
  | 'volcano-medium'
  | 'rock-cluster';

/** Non-blocking decor types — visual life, no gameplay blocking. */
export type DecorType =
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
  /** Footprint size (footprint x footprint tiles occupied). Default 1; infinite = 3. */
  footprint: number;
}

export interface ObstaclePlacement {
  tx: number;
  ty: number;
  type: ObstacleType;
  /** Footprint size (footprint x footprint tiles occupied). */
  footprint: number;
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
  /** Index into MapData.builders for the builder assigned to this site. */
  builderIndex: number;
}

export interface MapData {
  width: number;
  height: number;
  terrain: TerrainType[][];
  hq: HqPlacement;
  resources: ResourcePlacement[];
  obstacles: ObstaclePlacement[];
  decor: DecorPlacement[];
  buildings: BuildingPlacement[];
  builders: BuilderPlacement[];
  constructionSites: ConstructionSitePlacement[];
}

/** Footprint sizes for resource types. */
export const RESOURCE_FOOTPRINTS: Record<ResourceType, number> = {
  small: 1,
  medium: 1,
  large: 1,
  infinite: 3,
};

/** Asset key mapping for resource types. */
export const RESOURCE_ASSET_KEYS: Record<ResourceType, string> = {
  small: 'mineral_small',
  medium: 'mineral_medium',
  large: 'mineral_large',
  infinite: 'mineral_infinite',
};

/** Asset key mapping for obstacle types. */
export const OBSTACLE_ASSET_KEYS: Record<ObstacleType, string> = {
  'mountain-small': 'mountain_small_01',
  'mountain-medium': 'mountain_medium_01',
  'mountain-large': 'mountain_large_01',
  'volcano-small': 'volcano_small_01',
  'volcano-medium': 'volcano_medium_01',
  'rock-cluster': 'rock_cluster_small_01',
};

/** Asset key mapping for decor types. */
export const DECOR_ASSET_KEYS: Record<DecorType, string> = {
  'bush': 'dry_bush_01',
  'sand-bump': 'sand_bump_01',
};

/** Footprint sizes for obstacle types. */
export const OBSTACLE_FOOTPRINTS: Record<ObstacleType, number> = {
  'mountain-small': 1,
  'mountain-medium': 2,
  'mountain-large': 3,
  'volcano-small': 1,
  'volcano-medium': 2,
  'rock-cluster': 1,
};

/** Asset key for terrain types. */
export const TERRAIN_ASSET_KEYS: Record<TerrainType, string> = {
  sand: 'terrain_sand',
  'sand-dark': 'terrain_sand_dark',
  'sand-light': 'terrain_sand_light',
};
