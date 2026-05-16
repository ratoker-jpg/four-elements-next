import { BUILDING_DEFINITIONS, BUILD_MENU_ORDER } from '../config/buildings.js';
import type { BuildingType } from '../game/map-types.js';

export interface BuildMenuState {
  matter: number;
  builderBusy: boolean;
  statusMessage: string;
}

export function createBuildMenu(onBuild: (buildingType: BuildingType) => void): {
  element: HTMLElement;
  update: (state: BuildMenuState) => void;
  toggle: () => void;
} {
  const root = document.createElement('div');
  root.className = 'build-menu';
  root.dataset.open = 'false';

  const toggleButton = document.createElement('button');
  toggleButton.className = 'btn build-menu__toggle';
  toggleButton.type = 'button';
  toggleButton.textContent = 'Строительство (B)';
  toggleButton.addEventListener('click', () => {
    root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
  });
  root.appendChild(toggleButton);

  const panel = document.createElement('div');
  panel.className = 'build-menu__panel';

  const title = document.createElement('div');
  title.className = 'build-menu__title';
  title.textContent = 'Строительство';
  panel.appendChild(title);

  const description = document.createElement('div');
  description.className = 'build-menu__hint';
  description.textContent = 'Статичный Builder ставит здания автоматически рядом с собой.';
  panel.appendChild(description);

  const buttons = new Map<BuildingType, HTMLButtonElement>();
  for (const buildingType of BUILD_MENU_ORDER) {
    const definition = BUILDING_DEFINITIONS[buildingType];
    const button = document.createElement('button');
    button.className = 'btn build-menu__option';
    button.type = 'button';
    button.textContent = `${definition.label} • ${definition.costMatter} Matter • ${definition.buildTimeSeconds}с`;
    button.addEventListener('click', () => onBuild(buildingType));
    buttons.set(buildingType, button);
    panel.appendChild(button);
  }

  const status = document.createElement('div');
  status.className = 'build-menu__status';
  panel.appendChild(status);

  root.appendChild(panel);

  const update = (state: BuildMenuState) => {
    for (const [buildingType, button] of buttons) {
      const definition = BUILDING_DEFINITIONS[buildingType];
      const canAfford = state.matter >= definition.costMatter;
      button.disabled = state.builderBusy || !canAfford;
      button.title = state.builderBusy
        ? 'Builder занят'
        : canAfford
          ? ''
          : 'Недостаточно Matter';
    }
    status.textContent = state.statusMessage;
    status.dataset.tone = state.statusMessage.startsWith('Не') ? 'error' : 'neutral';
  };

  const toggle = () => {
    root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
  };

  return { element: root, update, toggle };
}
