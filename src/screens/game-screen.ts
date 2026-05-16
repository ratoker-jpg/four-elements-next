import type { Screen, ScreenTransitionData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { GameWorld } from '../game/game-world.js';

export function createGameScreen(navigate: NavigateFn): Screen {
  let gameWorld: GameWorld | null = null;

  return {
    id: 'game-screen',

    async mount(container: HTMLElement, data: ScreenTransitionData): Promise<void> {
      const gameData = data as GameScreenData | null;
      const mapSize = gameData?.mapSize ?? 'standard';
      const faction = gameData?.faction ?? 'cyan';

      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--game';

      const canvas = document.createElement('canvas');
      canvas.className = 'screen__canvas';
      canvas.id = 'game-canvas';
      canvas.style.cursor = 'grab';
      wrapper.appendChild(canvas);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back screen__back-btn';
      btnBack.textContent = 'Back to Menu';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      wrapper.appendChild(btnBack);

      container.appendChild(wrapper);

      const world = new GameWorld(canvas, mapSize, faction);
      gameWorld = world;

      void world.init().then(() => {
        if (gameWorld !== world) return; // unmount already destroyed this world
        world.start();
        wrapper.dataset.ready = 'true';
      });
    },

    unmount(): void {
      if (gameWorld) {
        gameWorld.destroy();
        gameWorld = null;
      }
    },
  };
}
