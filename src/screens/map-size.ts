import type { Screen, ScreenTransitionData, SeedScreenData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

const MAP_SIZES = [
  { id: 'standard', label: 'Стандартная', note: '48×48 — основной размер для MVP' },
  { id: 'large', label: 'Большая', note: 'Пока тоже 48×48, расширим позже' },
] as const;

export function createMapSizeScreen(navigate: NavigateFn): Screen {
  return {
    id: 'map-size',

    mount(container: HTMLElement, _data: ScreenTransitionData): void {
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--map-size';

      const card = document.createElement('section');
      card.className = 'menu-card';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Размер карты';
      card.appendChild(heading);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      for (const size of MAP_SIZES) {
        const btn = document.createElement('button');
        btn.className = 'btn';
        btn.innerHTML = `<span>${size.label}</span><small>${size.note}</small>`;
        btn.addEventListener('click', () => {
          const data: SeedScreenData = { mapSize: size.id };
          navigate('seed-screen', data);
        });
        menu.appendChild(btn);
      }

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Назад';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
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
