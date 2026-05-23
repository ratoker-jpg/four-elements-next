/** All screen identifiers in the application. */
export type ScreenId =
  | 'main-menu'
  | 'map-size'
  | 'seed-screen'
  | 'faction-select'
  | 'game-screen'
  | 'settings'
  | 'editor-screen';

/** Data passed when transitioning to a new screen. */
export type ScreenTransitionData = MapSizeData | SeedScreenData | FactionSelectData | GameScreenData | EditorScreenData | null;

export interface MapSizeData {
  readonly source: 'main-menu';
}

export interface SeedScreenData {
  readonly mapSize: 'standard' | 'large';
  /** Preserved seed when returning from Faction Select. Undefined on first visit. */
  readonly seed?: number;
  /** Preserved preset when returning from Faction Select. Undefined on first visit. */
  readonly mapgenPresetId?: import('../game/mapgen-presets.js').MapgenPresetId;
}

export interface FactionSelectData {
  readonly mapSize: 'standard' | 'large';
  readonly seed: number;
  readonly mapgenPresetId: import('../game/mapgen-presets.js').MapgenPresetId;
}

export interface GameScreenData {
  readonly mapSize: 'standard' | 'large';
  readonly faction: 'cyan' | 'green' | 'yellow' | 'purple' | 'random';
  readonly seed: number;
  readonly mapgenPresetId: import('../game/mapgen-presets.js').MapgenPresetId;
  /** PR10: Custom map data for launching from editor. When present, the game
   *  uses this MapData instead of generating one from seed/preset. */
  readonly customMapData?: import('../game/map-types.js').MapData;
}

export interface EditorScreenData {
  readonly mapSize: 'standard' | 'large';
}

/** A screen module that can be mounted and unmounted by the ScreenManager. */
export interface Screen {
  readonly id: ScreenId;
  mount(container: HTMLElement, data: ScreenTransitionData): void | Promise<void>;
  unmount(): void;
}
