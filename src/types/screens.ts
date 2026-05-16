/** All screen identifiers in the application. */
export type ScreenId =
  | 'main-menu'
  | 'map-size'
  | 'faction-select'
  | 'game-screen'
  | 'settings';

/** Data passed when transitioning to a new screen. */
export type ScreenTransitionData = MapSizeData | FactionSelectData | GameScreenData | null;

export interface MapSizeData {
  readonly source: 'main-menu';
}

export interface FactionSelectData {
  readonly mapSize: 'standard' | 'large';
}

export interface GameScreenData {
  readonly mapSize: 'standard' | 'large';
  readonly faction: 'cyan' | 'green' | 'yellow' | 'purple' | 'random';
}

/** A screen module that can be mounted and unmounted by the ScreenManager. */
export interface Screen {
  readonly id: ScreenId;
  mount(container: HTMLElement, data: ScreenTransitionData): void | Promise<void>;
  unmount(): void;
}
