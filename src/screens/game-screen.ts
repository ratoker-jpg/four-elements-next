import type { Screen, ScreenTransitionData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { GameWorld } from '../game/game-world.js';
import { createEconomyHud } from '../render/economy-hud.js';
import { createBuildMenu } from '../render/build-menu.js';

export function createGameScreen(navigate: NavigateFn): Screen {
  let gameWorld: GameWorld | null = null;
  let buildMenuHotkey: ((event: KeyboardEvent) => void) | null = null;

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

      const hud = createEconomyHud();
      hud.element.id = 'economy-hud';
      wrapper.appendChild(hud.element);

      const buildMenu = createBuildMenu((buildingType) => {
        gameWorld?.startConstruction(buildingType);
      });
      buildMenu.element.id = 'build-menu';
      wrapper.appendChild(buildMenu.element);

      buildMenuHotkey = (event: KeyboardEvent) => {
        if (event.repeat || event.code !== 'KeyB') return;
        buildMenu.toggle();
      };
      window.addEventListener('keydown', buildMenuHotkey);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back screen__back-btn';
      btnBack.textContent = 'В главное меню';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      wrapper.appendChild(btnBack);

      container.appendChild(wrapper);

      const world = new GameWorld(canvas, mapSize, faction);
      gameWorld = world;

      world.onEconomyUpdate = (state) => hud.updateEconomy(state);
      world.onPowerUpdate = (state) => hud.updatePower(state);
      world.onControlUpdate = (state) => hud.updateControl(state);
      world.onConstructionUpdate = (state) => {
        buildMenu.update({
          matter: state.matter,
          builderBusy: state.builderBusy,
          statusMessage: state.statusMessage,
        });
      };

      void world.init().then(() => {
        if (gameWorld !== world) return;
        world.start();
        wrapper.dataset.ready = 'true';
      });
    },

    unmount(): void {
      if (buildMenuHotkey) {
        window.removeEventListener('keydown', buildMenuHotkey);
        buildMenuHotkey = null;
      }

      if (gameWorld) {
        gameWorld.destroy();
        gameWorld = null;
      }
    },
  };
}
