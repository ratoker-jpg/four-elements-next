/** Production panel: DOM overlay showing factory production queues and controls. Minimal UI. */

import type { ProducibleUnitType, ReadonlyProductionState } from '../systems/production.js';
import { QUEUE_LIMIT, PRODUCTION_COSTS as COSTS } from '../systems/production.js';
import { isBuildingOnline } from '../systems/power.js';
import type { ReadonlyEconomyState } from '../systems/economy.js';
import type { ReadonlyPowerState } from '../systems/power.js';
import type { ReadonlyControlState } from '../systems/control.js';

export interface ProductionPanelState {
  factories: ReadonlyProductionState['factories'];
  economy: ReadonlyEconomyState;
  control: ReadonlyControlState;
  power: ReadonlyPowerState;
}

const UNIT_LABELS: Record<ProducibleUnitType, string> = {
  builder: 'Строитель',
  harvester: 'Сборщик',
};

const UNIT_SHORT: Record<ProducibleUnitType, string> = {
  builder: 'BLD',
  harvester: 'HRV',
};

function getDisabledReason(
  state: ProductionPanelState,
  factoryTx: number,
  factoryTy: number,
  queueLength: number,
  unitType: ProducibleUnitType,
): string | null {
  if (!isBuildingOnline(state.power, factoryTx, factoryTy)) return 'Фабрика без питания';
  if (queueLength >= QUEUE_LIMIT) return 'Очередь заполнена';

  const cost = COSTS[unitType];
  if (state.economy.resources.matter < cost.matter) return 'Недостаточно материи';

  const activeElement = state.economy.resources.elements[state.economy.faction];
  if (activeElement < cost.element) return 'Недостаточно элемента фракции';

  if (state.control.current - state.control.used < cost.control) return 'Недостаточно контроля';

  return null;
}

export function createProductionPanel(
  onProduce: (factoryTx: number, factoryTy: number, unitType: ProducibleUnitType) => void,
): {
  element: HTMLElement;
  update: (state: ProductionPanelState) => void;
  toggle: () => void;
} {
  const root = document.createElement('div');
  root.className = 'production-panel';
  root.dataset.visible = 'false';
  root.dataset.open = 'false';

  const panel = document.createElement('div');
  panel.className = 'production-panel__panel';
  panel.style.display = 'none';

  const applyOpenState = (): void => {
    panel.style.display = root.dataset.open === 'true' ? 'block' : 'none';
  };

  const toggleButton = document.createElement('button');
  toggleButton.className = 'btn production-panel__toggle';
  toggleButton.type = 'button';
  toggleButton.textContent = 'Производство';
  toggleButton.addEventListener('click', () => {
    root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
    applyOpenState();
  });
  root.appendChild(toggleButton);

  root.appendChild(panel);

  const title = document.createElement('div');
  title.className = 'production-panel__title';
  title.textContent = 'Производство';
  panel.appendChild(title);

  const factoryList = document.createElement('div');
  factoryList.className = 'production-panel__list';
  panel.appendChild(factoryList);

  const update = (state: ProductionPanelState): void => {
    const hasFactories = state.factories.length > 0;
    root.dataset.visible = hasFactories ? 'true' : 'false';
    toggleButton.textContent = `Производство${hasFactories ? ` (${state.factories.length})` : ''}`;

    if (!hasFactories) {
      root.dataset.open = 'false';
    }
    applyOpenState();

    // Rebuild factory list
    factoryList.innerHTML = '';

    for (const factory of state.factories) {
      const online = isBuildingOnline(state.power, factory.tx, factory.ty);
      const card = document.createElement('div');
      card.className = 'production-panel__factory';
      card.dataset.online = online ? 'true' : 'false';

      const header = document.createElement('div');
      header.className = 'production-panel__factory-header';
      header.textContent = `Фабрика (${factory.tx}, ${factory.ty})`;
      card.appendChild(header);

      const status = document.createElement('span');
      status.className = 'production-panel__factory-status';
      status.textContent = online ? 'Онлайн' : 'Оффлайн';
      card.appendChild(status);

      // Buttons row
      const buttonsRow = document.createElement('div');
      buttonsRow.className = 'production-panel__buttons';
      const disabledReasons: string[] = [];

      for (const unitType of ['builder', 'harvester'] as ProducibleUnitType[]) {
        const cost = COSTS[unitType];
        const disabledReason = getDisabledReason(
          state,
          factory.tx,
          factory.ty,
          factory.queue.length,
          unitType,
        );
        if (disabledReason && !disabledReasons.includes(disabledReason)) disabledReasons.push(disabledReason);

        const btn = document.createElement('button');
        btn.className = 'btn production-panel__produce-btn';
        btn.type = 'button';
        btn.textContent = `${UNIT_LABELS[unitType]} • ${cost.matter}M/${cost.element}E • ${cost.duration}с`;
        btn.disabled = disabledReason !== null;
        btn.title = disabledReason ?? '';
        btn.addEventListener('pointerdown', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (btn.disabled) return;
          onProduce(factory.tx, factory.ty, unitType);
        });
        btn.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
        });
        buttonsRow.appendChild(btn);
      }

      card.appendChild(buttonsRow);

      if (disabledReasons.length > 0) {
        const reason = document.createElement('div');
        reason.className = 'production-panel__reason';
        reason.textContent = disabledReasons[0]!;
        card.appendChild(reason);
      }

      // Queue display
      const queueInfo = document.createElement('div');
      queueInfo.className = 'production-panel__queue';
      queueInfo.textContent = `Очередь: ${factory.queue.length}/${QUEUE_LIMIT}`;
      card.appendChild(queueInfo);

      // Progress of active item
      if (factory.queue.length > 0) {
        const active = factory.queue[0]!;
        const progressRow = document.createElement('div');
        progressRow.className = 'production-panel__progress-row';

        const label = document.createElement('span');
        label.className = 'production-panel__progress-label';
        label.textContent = active.completed
          ? `${UNIT_SHORT[active.unitType]} — ожидает`
          : `${UNIT_SHORT[active.unitType]} ${Math.floor(active.progress * 100)}%`;
        progressRow.appendChild(label);

        const barBg = document.createElement('div');
        barBg.className = 'production-panel__progress-bar';
        const barFill = document.createElement('div');
        barFill.className = 'production-panel__progress-fill';
        barFill.style.width = `${Math.min(active.progress * 100, 100)}%`;
        if (active.completed) barFill.style.width = '100%';
        barBg.appendChild(barFill);
        progressRow.appendChild(barBg);

        card.appendChild(progressRow);
      }

      // Second queue item
      if (factory.queue.length > 1) {
        const queued = factory.queue[1]!;
        const queuedInfo = document.createElement('div');
        queuedInfo.className = 'production-panel__queued-item';
        queuedInfo.textContent = `В очереди: ${UNIT_SHORT[queued.unitType]}`;
        card.appendChild(queuedInfo);
      }

      factoryList.appendChild(card);
    }
  };

  const toggle = () => {
    root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
    applyOpenState();
  };

  return { element: root, update, toggle };
}
