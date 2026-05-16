/** Production panel: DOM overlay showing factory production queues and controls. Minimal UI. */

import type { ProducibleUnitType, ReadonlyProductionState } from '../systems/production.js';
import { canProduce, QUEUE_LIMIT, PRODUCTION_COSTS as COSTS } from '../systems/production.js';
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

export function createProductionPanel(
  onProduce: (factoryTx: number, factoryTy: number, unitType: ProducibleUnitType) => void,
): {
  element: HTMLElement;
  update: (state: ProductionPanelState) => void;
} {
  const root = document.createElement('div');
  root.className = 'production-panel';
  root.dataset.visible = 'false';

  const title = document.createElement('div');
  title.className = 'production-panel__title';
  title.textContent = 'Производство';
  root.appendChild(title);

  const factoryList = document.createElement('div');
  factoryList.className = 'production-panel__list';
  root.appendChild(factoryList);

  const update = (state: ProductionPanelState): void => {
    const hasFactories = state.factories.length > 0;
    root.dataset.visible = hasFactories ? 'true' : 'false';

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

      for (const unitType of ['builder', 'harvester'] as ProducibleUnitType[]) {
        const cost = COSTS[unitType];
        const canAfford = canProduce(
          state.economy,
          state.control,
          state.power,
          factory.queue.length,
          factory.tx,
          factory.ty,
          unitType,
        );

        const btn = document.createElement('button');
        btn.className = 'btn production-panel__produce-btn';
        btn.type = 'button';
        btn.textContent = `${UNIT_LABELS[unitType]} • ${cost.matter}M/${cost.element}E • ${cost.duration}с`;
        btn.disabled = !canAfford;
        btn.title = !canAfford ? 'Недостаточно ресурсов или контроля' : '';
        btn.addEventListener('click', () => onProduce(factory.tx, factory.ty, unitType));
        buttonsRow.appendChild(btn);
      }

      card.appendChild(buttonsRow);

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

  return { element: root, update };
}
