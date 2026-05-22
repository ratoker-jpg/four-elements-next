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
}

export interface FactionSelectData {
  readonly mapSize: 'standard' | 'large';
  readonly seed: number;
}

export interface GameScreenData {
  readonly mapSize: 'standard' | 'large';
  readonly faction: 'cyan' | 'green' | 'yellow' | 'purple' | 'random';
  readonly seed: number;
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
