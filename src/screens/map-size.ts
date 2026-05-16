import type { Screen, ScreenTransitionData, FactionSelectData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

const MAP_SIZES = ['standard', 'large'] as const;

export function createMapSizeScreen(navigate: NavigateFn): Screen {
  return {
    id: 'map-size',

    mount(container: HTMLElement, _data: ScreenTransitionData): void {
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--map-size';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Select Map Size';
      wrapper.appendChild(heading);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      for (const size of MAP_SIZES) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.textContent = size.charAt(0).toUpperCase() + size.slice(1);
        btn.addEventListener('click', () => {
          const data: FactionSelectData = { mapSize: size };
          navigate('faction-select', data);
        });
        menu.appendChild(btn);
      }

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Back';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      menu.appendChild(btnBack);

      wrapper.appendChild(menu);
      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}
