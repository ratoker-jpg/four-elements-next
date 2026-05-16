import type { Screen, ScreenId, ScreenTransitionData } from '../types/screens.js';

export type NavigateFn = (id: ScreenId, data: ScreenTransitionData) => void;

export class ScreenManager {
  private readonly container: HTMLElement;
  private readonly screens: Map<ScreenId, Screen>;
  private current: Screen | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.screens = new Map();
  }

  /** Register a screen. */
  addScreen(screen: Screen): void {
    this.screens.set(screen.id, screen);
  }

  /** Start the application by showing the first screen. */
  start(id: ScreenId, data: ScreenTransitionData = null): void {
    this.show(id, data);
  }

  /** Transition to a different screen. */
  show(id: ScreenId, data: ScreenTransitionData = null): void {
    if (this.current) {
      this.current.unmount();
      this.container.innerHTML = '';
    }
    const next = this.screens.get(id);
    if (!next) {
      throw new Error(`Unknown screen: ${id}`);
    }
    this.current = next;
    next.mount(this.container, data);
  }
}
