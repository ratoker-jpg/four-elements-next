import type { Screen, ScreenTransitionData, FactionSelectData, GameScreenData, SeedScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import type { MapgenPresetId } from '../game/mapgen-presets.js';
import { DEFAULT_PRESET_ID } from '../game/mapgen-presets.js';

const FACTIONS = [
  { id: 'cyan', label: 'Голубые' },
  { id: 'green', label: 'Зелёные' },
  { id: 'yellow', label: 'Жёлтые' },
  { id: 'purple', label: 'Фиолетовые' },
  { id: 'random', label: 'Случайная' },
] as const;

export function createFactionSelectScreen(navigate: NavigateFn): Screen {
  return {
    id: 'faction-select',

    mount(container: HTMLElement, data: ScreenTransitionData): void {
      const factionData = data as FactionSelectData | null;
      const mapSize = factionData?.mapSize ?? 'standard';
      const seed = factionData?.seed ?? 42;
      const mapgenPresetId: MapgenPresetId = factionData?.mapgenPresetId ?? DEFAULT_PRESET_ID;

      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--faction-select';

      const card = document.createElement('section');
      card.className = 'menu-card';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Выбор фракции';
      card.appendChild(heading);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      for (const faction of FACTIONS) {
        const btn = document.createElement('button');
        btn.className = `btn btn--faction btn--faction-${faction.id}`;
        btn.textContent = faction.label;
        btn.addEventListener('click', () => {
          const gameData: GameScreenData = { mapSize, faction: faction.id, seed, mapgenPresetId };
          navigate('game-screen', gameData);
        });
        menu.appendChild(btn);
      }

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Назад';
      btnBack.addEventListener('click', () => {
        // Preserve seed and preset on back navigation
        const backData: SeedScreenData = { mapSize, seed, mapgenPresetId };
        navigate('seed-screen', backData);
      });
      menu.appendChild(btnBack);

      card.appendChild(menu);
      wrapper.appendChild(card);
      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}
