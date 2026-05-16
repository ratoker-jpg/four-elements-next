/** Aggregated game simulation state. Extracted from GameWorld for system-runner consumption. */

import { MAP_SIZE_STANDARD, MAP_SIZE_LARGE, HQ_FOOTPRINT } from '../core/constants.js';
import { generateMap } from './mapgen.js';
import type { MapData, FactionId } from './map-types.js';
import {
  createEconomyState,
  getSeparatorPositions,
  getStorageCount,
  type EconomyState,
} from '../systems/economy.js';
import {
  createPowerState,
  type PowerState,
} from '../systems/power.js';
import {
  createControlState,
  type ControlState,
} from '../systems/control.js';
import { BUILDER_CONTROL_COST } from '../systems/construction.js';
import {
  createInitialHarvesters,
  createResourceNodeStates,
  HARVESTER_CONTROL_COST,
  type HarvesterState,
  type ResourceNodeState,
} from '../systems/harvesting.js';

/** Map the UI map-size string to a grid dimension. */
function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

/** All mutable game simulation state in one object. Systems read/write this. */
export interface GameState {
  readonly map: MapData;
  economy: EconomyState;
  power: PowerState;
  control: ControlState;
  constructionStatusMessage: string;
  /** Runtime harvester units. Managed by tickHarvesting. */
  harvesters: HarvesterState[];
  /** Runtime resource node states (depletion tracking). Managed by tickHarvesting. */
  resourceNodes: ResourceNodeState[];
}

/** Resolve "random" faction to a concrete FactionId. */
function resolveFaction(faction: FactionId | 'random'): FactionId {
  if (faction !== 'random') return faction;
  const factions: FactionId[] = ['cyan', 'green', 'yellow', 'purple'];
  return factions[Math.floor(Math.random() * factions.length)]!;
}

/** Create a set of occupied tiles from map data (for placement checks). */
function buildOccupiedSet(map: MapData): Set<string> {
  const occupied = new Set<string>();
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      occupied.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }
  for (const building of map.buildings) {
    occupied.add(`${building.tx},${building.ty}`);
  }
  for (const builder of map.builders) {
    occupied.add(`${builder.tx},${builder.ty}`);
  }
  for (const resource of map.resources) {
    occupied.add(`${resource.tx},${resource.ty}`);
  }
  for (const site of map.constructionSites) {
    occupied.add(`${site.tx},${site.ty}`);
  }
  return occupied;
}

/** Create the full initial GameState from UI parameters. */
export function createGameState(mapSize: string, faction: FactionId | 'random'): GameState {
  const resolvedFaction = resolveFaction(faction);
  const size = resolveMapSize(mapSize);
  const map = generateMap(size, size, resolvedFaction);

  const separatorPositions = getSeparatorPositions(map.buildings);
  const storageCount = getStorageCount(map.buildings);
  const economy = createEconomyState(separatorPositions, storageCount, resolvedFaction);

  const power = createPowerState(map.hq, map.buildings);

  const relayOnlineCount = power.buildings.filter(
    (b) => b.type === 'command-relay' && b.online,
  ).length;

  // Create harvesters and resource node runtime state
  const occupied = buildOccupiedSet(map);
  const harvesters = createInitialHarvesters(map.hq, occupied);
  const resourceNodes = createResourceNodeStates(map.resources);

  const control = createControlState(
    map.buildings.filter((b) => b.type === 'command-relay').length,
    relayOnlineCount,
    map.builders.length * BUILDER_CONTROL_COST + harvesters.length * HARVESTER_CONTROL_COST,
  );

  return {
    map,
    economy,
    power,
    control,
    constructionStatusMessage: 'Строитель готов к строительству.',
    harvesters,
    resourceNodes,
  };
}
