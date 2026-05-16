import type { Screen, ScreenTransitionData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { GameWorld } from '../game/game-world.js';
import { createEconomyHud } from '../render/economy-hud.js';

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

      // Economy HUD overlay
      const hud = createEconomyHud();
      hud.element.id = 'economy-hud';
      wrapper.appendChild(hud.element);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back screen__back-btn';
      btnBack.textContent = 'В главное меню';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      wrapper.appendChild(btnBack);

      container.appendChild(wrapper);

      const world = new GameWorld(canvas, mapSize, faction);
      gameWorld = world;

      // Wire economy HUD updates
      world.onEconomyUpdate = (state) => hud.update(state);

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
