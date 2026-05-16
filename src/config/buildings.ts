import type { BuildingType } from '../game/map-types.js';

export interface BuildingDefinition {
  type: BuildingType;
  label: string;
  costMatter: number;
  buildTimeSeconds: number;
  shortCode: string;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  separator: {
    type: 'separator',
    label: 'Сепаратор',
    costMatter: 80,
    buildTimeSeconds: 25,
    shortCode: 'SEP',
  },
  storage: {
    type: 'storage',
    label: 'Склад',
    costMatter: 100,
    buildTimeSeconds: 20,
    shortCode: 'STO',
  },
  'power-plant': {
    type: 'power-plant',
    label: 'Электростанция',
    costMatter: 120,
    buildTimeSeconds: 25,
    shortCode: 'PWR',
  },
  'command-relay': {
    type: 'command-relay',
    label: 'Командный ретранслятор',
    costMatter: 90,
    buildTimeSeconds: 18,
    shortCode: 'CMD',
  },
};

export const BUILD_MENU_ORDER: BuildingType[] = [
  'separator',
  'storage',
  'power-plant',
  'command-relay',
];
