/** Economy + Power + Control HUD: DOM overlay showing resource counts, power balance, and control usage. */

import type { ReadonlyEconomyState } from '../systems/economy.js';
import { getFactionElement } from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { ReadonlyControlState } from '../systems/control.js';

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

/** Create the game HUD. Returns the container and update functions. */
export function createEconomyHud(): {
  element: HTMLElement;
  updateEconomy: (state: ReadonlyEconomyState) => void;
  updatePower: (state: ReadonlyPowerState) => void;
  updateControl: (state: ReadonlyControlState) => void;
} {
  const hud = document.createElement('div');
  hud.className = 'economy-hud';

  // Resource items
  const rawItem = createResourceItem('raw', 'Сырьё', '#7de1ff');
  const matterItem = createResourceItem('matter', 'Материя', '#5ee89a');
  const elementItem = createResourceItem('element', 'Элемент', '#d4a5ff');

  // Separator for resource group
  const sep1 = document.createElement('div');
  sep1.className = 'economy-hud__separator';

  // Power + Control items
  const powerItem = createResourceItem('power', 'Энергия', '#f0c96a');
  const controlItem = createResourceItem('control', 'Контроль', '#c898f0');

  hud.appendChild(rawItem.element);
  hud.appendChild(matterItem.element);
  hud.appendChild(elementItem.element);
  hud.appendChild(sep1);
  hud.appendChild(powerItem.element);
  hud.appendChild(controlItem.element);

  const updateEconomy = (state: ReadonlyEconomyState) => {
    const r = state.resources;
    rawItem.update(r.raw, r.rawCap);
    matterItem.update(r.matter, r.matterCap);
    elementItem.setLabel(FACTION_ELEMENT_LABELS[state.faction]);
    elementItem.setColor(FACTION_ELEMENT_COLORS[state.faction]);
    elementItem.update(getFactionElement(state, state.faction), r.elementCap);
  };

  const updatePower = (state: ReadonlyPowerState) => {
    powerItem.updateValue(`${state.netPower >= 0 ? '+' : ''}${state.netPower}`);
    // Color red when in deficit
    const valueEl = powerItem.element.querySelector('.economy-hud__value') as HTMLElement;
    if (valueEl) {
      valueEl.style.color = state.netPower < 0 ? '#ff6666' : '';
    }
  };

  const updateControl = (state: ReadonlyControlState) => {
    // Show actual occupied control slots instead of current capacity / hard cap.
    // Example: 2/15 at start, then 3/15 after producing one unit.
    controlItem.updateValue(`${state.used}/${state.current}`);
    controlItem.element.title = `Использовано контроля: ${state.used}/${state.current}. Максимум: ${state.cap}`;

    const valueEl = controlItem.element.querySelector('.economy-hud__value') as HTMLElement;
    if (valueEl) {
      valueEl.style.color = state.used > state.current ? '#ff6666' : '';
    }
  };

  return { element: hud, updateEconomy, updatePower, updateControl };
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
  updateValue: (text: string) => void;
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

  const updateValue = (text: string) => {
    value.textContent = text;
  };

  return { element: item, update, setLabel, setColor, updateValue };
}
