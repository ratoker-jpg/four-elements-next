import type { Screen, ScreenTransitionData, FactionSelectData, GameScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

const FACTIONS = ['cyan', 'green', 'yellow', 'purple', 'random'] as const;

export function createFactionSelectScreen(navigate: NavigateFn): Screen {
  return {
    id: 'faction-select',

    mount(container: HTMLElement, data: ScreenTransitionData): void {
      const factionData = data as FactionSelectData | null;
      const mapSize = factionData?.mapSize ?? 'standard';

      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--faction-select';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Select Faction';
      wrapper.appendChild(heading);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      for (const faction of FACTIONS) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = faction.charAt(0).toUpperCase() + faction.slice(1);
        btn.addEventListener('click', () => {
          const gameData: GameScreenData = { mapSize, faction };
          navigate('game-screen', gameData);
        });
        menu.appendChild(btn);
      }

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Back';
      btnBack.addEventListener('click', () => navigate('map-size', { source: 'main-menu' }));
      menu.appendChild(btnBack);

      wrapper.appendChild(menu);
      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}
