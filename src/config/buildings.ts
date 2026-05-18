import type { BuildingType } from '../game/map-types.js';

export interface BuildingDefinition {
  type: BuildingType;
  label: string;
  costMatter: number;
  buildTimeSeconds: number;
  shortCode: string;
  footprint: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  separator: {
    type: 'separator',
    label: 'Сепаратор',
    costMatter: 80,
    buildTimeSeconds: 25,
    shortCode: 'SEP',
    footprint: 2,
  },
  'raw-storage': {
    type: 'raw-storage',
    label: 'Сырьевой склад',
    costMatter: 100,
    buildTimeSeconds: 20,
    shortCode: 'RSR',
    footprint: 2,
  },
  'matter-storage': {
    type: 'matter-storage',
    label: 'Склад материи',
    costMatter: 100,
    buildTimeSeconds: 20,
    shortCode: 'MST',
    footprint: 2,
  },
  'power-plant': {
    type: 'power-plant',
    label: 'Электростанция',
    costMatter: 120,
    buildTimeSeconds: 25,
    shortCode: 'PWR',
    footprint: 2,
  },
  'command-relay': {
    type: 'command-relay',
    label: 'Командный ретранслятор',
    costMatter: 90,
    buildTimeSeconds: 18,
    shortCode: 'CMD',
    footprint: 2,
  },
  'units-factory': {
    type: 'units-factory',
    label: 'Фабрика юнитов',
    costMatter: 150,
    buildTimeSeconds: 30,
    shortCode: 'FAC',
    footprint: 2,
  },
};

export const BUILD_MENU_ORDER: BuildingType[] = [
  'separator',
  'raw-storage',
  'matter-storage',
  'power-plant',
  'command-relay',
  'units-factory',
];

export function getBuildingFootprint(type: BuildingType): number {
  return BUILDING_DEFINITIONS[type].footprint;
}
