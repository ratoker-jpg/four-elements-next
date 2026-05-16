import type { Screen, ScreenTransitionData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

export function createMainMenuScreen(navigate: NavigateFn): Screen {
  return {
    id: 'main-menu',

    mount(container: HTMLElement, _data: ScreenTransitionData): void {
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--main-menu';

      const title = document.createElement('h1');
      title.className = 'screen__title';
      title.textContent = 'Four Elements';
      wrapper.appendChild(title);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      const btnNewGame = createButton('New Game', () => navigate('map-size', { source: 'main-menu' }));
      const btnContinue = createButton('Continue', () => {});
      btnContinue.disabled = true;
      const btnSettings = createButton('Settings', () => navigate('settings', null));

      menu.appendChild(btnNewGame);
      menu.appendChild(btnContinue);
      menu.appendChild(btnSettings);
      wrapper.appendChild(menu);

      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}

function createButton(text: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = 'btn';
  btn.textContent = text;
  btn.addEventListener('click', onClick);
  return btn;
}
