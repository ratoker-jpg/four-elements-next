import type { Screen, ScreenTransitionData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';
import { isDevPanelAllowed } from '../dev/dev-panel.js';

export function createMainMenuScreen(navigate: NavigateFn): Screen {
  return {
    id: 'main-menu',

    mount(container: HTMLElement, _data: ScreenTransitionData): void {
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--main-menu';

      const card = document.createElement('section');
      card.className = 'menu-card';

      const title = document.createElement('h1');
      title.className = 'screen__title';
      title.textContent = 'Четыре элемента';
      card.appendChild(title);

      const subtitle = document.createElement('p');
      subtitle.className = 'screen__subtitle';
      subtitle.textContent = 'Новая чистая версия изометрической RTS';
      card.appendChild(subtitle);

      const menu = document.createElement('div');
      menu.className = 'screen__menu';

      const btnNewGame = createButton('Новая игра', () => navigate('map-size', { source: 'main-menu' }));
      const btnContinue = createButton('Продолжить', () => {});
      btnContinue.disabled = true;
      const btnSettings = createButton('Настройки', () => navigate('settings', null));

      menu.appendChild(btnNewGame);
      menu.appendChild(btnContinue);
      menu.appendChild(btnSettings);

      // Dev-only: Map Editor button
      if (isDevPanelAllowed()) {
        const btnEditor = createButton('Редактор карты', () => navigate('editor-screen', { mapSize: 'standard' }));
        btnEditor.id = 'editor-menu-btn';
        menu.appendChild(btnEditor);
      }

      card.appendChild(menu);
      wrapper.appendChild(card);

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
