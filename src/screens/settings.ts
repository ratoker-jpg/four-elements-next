import type { Screen, ScreenTransitionData } from '../types/screens.js';
import type { NavigateFn } from '../core/screen-manager.js';

const UI_SCALES = [100, 125, 150] as const;

export function createSettingsScreen(navigate: NavigateFn): Screen {
  return {
    id: 'settings',

    mount(container: HTMLElement, _data: ScreenTransitionData): void {
      const wrapper = document.createElement('div');
      wrapper.className = 'screen screen--settings';

      const heading = document.createElement('h2');
      heading.className = 'screen__heading';
      heading.textContent = 'Settings';
      wrapper.appendChild(heading);

      const section = document.createElement('div');
      section.className = 'screen__section';

      const label = document.createElement('label');
      label.className = 'screen__label';
      label.textContent = 'UI Scale';
      section.appendChild(label);

      const scaleGroup = document.createElement('div');
      scaleGroup.className = 'screen__scale-group';

      for (const scale of UI_SCALES) {
        const btn = document.createElement('button');
        btn.className = 'btn btn--scale';
        btn.textContent = `${scale}%`;
        btn.dataset.scale = String(scale);
        btn.addEventListener('click', () => {
          document.documentElement.style.setProperty('--ui-scale', String(scale / 100));
          scaleGroup.querySelectorAll('.btn--scale').forEach((b) => b.classList.remove('btn--active'));
          btn.classList.add('btn--active');
        });
        scaleGroup.appendChild(btn);
      }

      section.appendChild(scaleGroup);
      wrapper.appendChild(section);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn--back';
      btnBack.textContent = 'Back';
      btnBack.addEventListener('click', () => navigate('main-menu', null));
      wrapper.appendChild(btnBack);

      container.appendChild(wrapper);
    },

    unmount(): void {
      // DOM is cleared by ScreenManager
    },
  };
}
