/** Economy HUD: DOM overlay showing resource counts and caps. */

import type { ReadonlyEconomyState } from '../systems/economy.js';
import { getFactionElement } from '../systems/economy.js';

const FACTION_ELEMENT_LABELS: Record<ReadonlyEconomyState['faction'], string> = {
  cyan: 'Голубой элемент',
  green: 'Зелёный элемент',
  yellow: 'Жёлтый элемент',
  purple: 'Фиолетовый элемент',
};

const FACTION_ELEMENT_COLORS: Record<ReadonlyEconomyState['faction'], string> = {
  cyan: '#7de1ff',
  green: '#5ee89a',
  yellow: '#f2d75c',
  purple: '#d4a5ff',
};

/** Create the economy HUD DOM element. Returns the container and an update function. */
export function createEconomyHud(): {
  element: HTMLElement;
  update: (state: ReadonlyEconomyState) => void;
} {
  const hud = document.createElement('div');
  hud.className = 'economy-hud';

  const rawItem = createResourceItem('raw', 'Сырьё', '#7de1ff');
  const matterItem = createResourceItem('matter', 'Материя', '#5ee89a');
  const elementItem = createResourceItem('element', 'Элемент', '#d4a5ff');

  hud.appendChild(rawItem.element);
  hud.appendChild(matterItem.element);
  hud.appendChild(elementItem.element);

  const update = (state: ReadonlyEconomyState) => {
    const r = state.resources;
    rawItem.update(r.raw, r.rawCap);
    matterItem.update(r.matter, r.matterCap);
    elementItem.setLabel(FACTION_ELEMENT_LABELS[state.faction]);
    elementItem.setColor(FACTION_ELEMENT_COLORS[state.faction]);
    elementItem.update(getFactionElement(state, state.faction), r.elementCap);
  };

  return { element: hud, update };
}

function createResourceItem(
  key: string,
  label: string,
  color: string,
): {
  element: HTMLElement;
  update: (current: number, cap: number) => void;
  setLabel: (nextLabel: string) => void;
  setColor: (nextColor: string) => void;
} {
  const item = document.createElement('div');
  item.className = `economy-hud__item economy-hud__item--${key}`;

  const icon = document.createElement('span');
  icon.className = 'economy-hud__icon';
  icon.style.backgroundColor = color;
  item.appendChild(icon);

  const labelEl = document.createElement('span');
  labelEl.className = 'economy-hud__label';
  labelEl.textContent = label;
  item.appendChild(labelEl);

  const value = document.createElement('span');
  value.className = 'economy-hud__value';
  value.textContent = '0/0';
  item.appendChild(value);

  const update = (current: number, cap: number) => {
    value.textContent = `${current}/${cap}`;
  };

  const setLabel = (nextLabel: string) => {
    labelEl.textContent = nextLabel;
  };

  const setColor = (nextColor: string) => {
    icon.style.backgroundColor = nextColor;
  };

  return { element: item, update, setLabel, setColor };
}
