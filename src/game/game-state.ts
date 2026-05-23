/** Aggregated game simulation state. Extracted from GameWorld for system-runner consumption. */

import { MAP_SIZE_STANDARD, MAP_SIZE_LARGE, HQ_FOOTPRINT } from '../core/constants.js';
import { computeMapVisualSeed } from '../core/asset-variants.js';
import { generateMap } from './mapgen.js';
import type { MapgenPresetId } from './mapgen-presets.js';
import { DEFAULT_PRESET_ID, resolveMapgenPresetConfig } from './mapgen-presets.js';
import type { MapData, FactionId } from './map-types.js';
import {
  createEconomyState,
  getSeparatorPositions,
  getRawStorageCount,
  getMatterStorageCount,
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
import {
  createProductionState,
  type ProductionState,
} from '../systems/production.js';
import {
  createTerritoryState,
  initTerritoryFromHq,
  type TerritoryState,
} from '../systems/territory.js';
import { getBuildingFootprint } from '../config/buildings.js';

/** Map the UI map-size string to a grid dimension. */
function resolveMapSize(mapSize: string): number {
  return mapSize === 'large' ? MAP_SIZE_LARGE : MAP_SIZE_STANDARD;
}

/** All mutable game simulation state in one object. Systems read/write this. */
export interface GameState {
  readonly map: MapData;
  readonly visualSeed: number;
  economy: EconomyState;
  power: PowerState;
  control: ControlState;
  constructionStatusMessage: string;
  /** Cumulative count of construction sites cancelled during gameplay. */
  constructionCancelledCount: number;
  /** Runtime harvester units. Managed by tickHarvesting. */
  harvesters: HarvesterState[];
  /** Runtime resource node states (depletion tracking). Managed by tickHarvesting. */
  resourceNodes: ResourceNodeState[];
  /** Production system state: factory queues and progress. Managed by tickProduction. */
  production: ProductionState;
  /** Territory spread state: per-tile ownership and frontier. Managed by tickTerritory. */
  territory: TerritoryState;
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
    const footprint = getBuildingFootprint(building.type);
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        occupied.add(`${building.tx + dx},${building.ty + dy}`);
      }
    }
  }
  for (const builder of map.builders) {
    occupied.add(`${builder.tx},${builder.ty}`);
  }
  for (const resource of map.resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        occupied.add(`${resource.tx + dx},${resource.ty + dy}`);
      }
    }
  }
  for (const obstacle of map.obstacles) {
    for (let dy = 0; dy < obstacle.footprint; dy++) {
      for (let dx = 0; dx < obstacle.footprint; dx++) {
        occupied.add(`${obstacle.tx + dx},${obstacle.ty + dy}`);
      }
    }
  }
  for (const site of map.constructionSites) {
    const footprint = getBuildingFootprint(site.type);
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        occupied.add(`${site.tx + dx},${site.ty + dy}`);
      }
    }
  }
  return occupied;
}

/** Create the full initial GameState from UI parameters. */
export function createGameState(
  mapSize: string,
  faction: FactionId | 'random',
  seed: number = 42,
  mapgenPresetId: MapgenPresetId = DEFAULT_PRESET_ID,
): GameState {
  const resolvedFaction = resolveFaction(faction);
  const size = resolveMapSize(mapSize);
  const mapgenConfig = resolveMapgenPresetConfig(mapgenPresetId);
  const map = generateMap(size, size, resolvedFaction, seed, mapgenConfig);

  const separatorPositions = getSeparatorPositions(map.buildings);
  const rawStorageCount = getRawStorageCount(map.buildings);
  const matterStorageCount = getMatterStorageCount(map.buildings);
  const economy = createEconomyState(separatorPositions, rawStorageCount, matterStorageCount, resolvedFaction);

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

  const production = createProductionState();

  // Territory: initialize with HQ footprint as fully owned
  const territory = createTerritoryState(size, size);
  initTerritoryFromHq(territory, map.hq.tx, map.hq.ty, resolvedFaction);

  return {
    map,
    visualSeed: seed,
    economy,
    power,
    control,
    constructionStatusMessage: 'Строитель готов к строительству.',
    constructionCancelledCount: 0,
    harvesters,
    resourceNodes,
    production,
    territory,
  };
}

/**
 * Deep-clone a MapData object through JSON round-trip.
 * This ensures runtime mutations never reach the original editor MapData
 * or saved localStorage maps.
 * Returns null if the value cannot be serialized/parsed.
 */
export function deepCloneMapData(map: MapData): MapData | null {
  try {
    return JSON.parse(JSON.stringify(map)) as MapData;
  } catch {
    return null;
  }
}

/**
 * Create a full initial GameState from a custom MapData (editor-launched game).
 *
 * The input MapData is deep-cloned before use so that runtime mutations
 * never affect the editor's MapData or saved localStorage maps.
 *
 * If map.builders exists and contains valid builder data, those builders
 * are preserved. If map.builders is missing or empty, one starting builder
 * is created near HQ.
 *
 * The faction is taken from mapData.hq.faction (not hardcoded).
 */
export function createGameStateFromMap(mapData: MapData, faction: FactionId): GameState {
  // Deep-clone to prevent runtime mutations from reaching editor/saved map
  const cloned = deepCloneMapData(mapData);
  if (cloned === null) {
    throw new Error('Failed to deep-clone custom MapData');
  }
  const map = cloned;

  // Ensure gameplay arrays exist (defensive — normalize like custom-map-storage does)
  map.buildings = Array.isArray(map.buildings) ? map.buildings : [];
  map.constructionSites = Array.isArray(map.constructionSites) ? map.constructionSites : [];

  // Builder handling: preserve if valid, otherwise create one near HQ
  if (!Array.isArray(map.builders) || map.builders.length === 0) {
    // Create one starting builder near HQ
    const occupied = buildOccupiedSet(map);
    const tile = findFreeTileNearHq(map, occupied);
    if (tile) {
      map.builders = [{
        tx: tile.tx,
        ty: tile.ty,
        busy: false,
        phase: 'idle',
        path: [],
        pathIndex: 0,
        ftx: tile.tx + 0.5,
        fty: tile.ty + 0.5,
        targetTx: tile.tx,
        targetTy: tile.ty,
        assignedSiteId: -1,
      }];
    } else {
      // Fallback: place builder at HQ center (should not happen on valid maps)
      map.builders = [{
        tx: map.hq.tx,
        ty: map.hq.ty,
        busy: false,
        phase: 'idle',
        path: [],
        pathIndex: 0,
        ftx: map.hq.tx + 0.5,
        fty: map.hq.ty + 0.5,
        targetTx: map.hq.tx,
        targetTy: map.hq.ty,
        assignedSiteId: -1,
      }];
    }
  }

  // Initialize subsystems using the same logic as createGameState
  const separatorPositions = getSeparatorPositions(map.buildings);
  const rawStorageCount = getRawStorageCount(map.buildings);
  const matterStorageCount = getMatterStorageCount(map.buildings);
  const economy = createEconomyState(separatorPositions, rawStorageCount, matterStorageCount, faction);

  const power = createPowerState(map.hq, map.buildings);

  const relayOnlineCount = power.buildings.filter(
    (b) => b.type === 'command-relay' && b.online,
  ).length;

  const occupied = buildOccupiedSet(map);
  const harvesters = createInitialHarvesters(map.hq, occupied);
  const resourceNodes = createResourceNodeStates(map.resources);

  const control = createControlState(
    map.buildings.filter((b) => b.type === 'command-relay').length,
    relayOnlineCount,
    map.builders.length * BUILDER_CONTROL_COST + harvesters.length * HARVESTER_CONTROL_COST,
  );

  const production = createProductionState();

  const territory = createTerritoryState(map.width, map.height);
  initTerritoryFromHq(territory, map.hq.tx, map.hq.ty, faction);

  return {
    map,
    visualSeed: computeMapVisualSeed(map),
    economy,
    power,
    control,
    constructionStatusMessage: 'Строитель готов к строительству.',
    constructionCancelledCount: 0,
    harvesters,
    resourceNodes,
    production,
    territory,
  };
}

/**
 * Find a free tile in the ring around HQ using the occupied-tile set.
 * Used by createGameStateFromMap when builders are missing.
 */
function findFreeTileNearHq(
  map: MapData,
  occupied: Set<string>,
): { tx: number; ty: number } | null {
  const hq = map.hq;
  for (let ty = hq.ty - 1; ty <= hq.ty + HQ_FOOTPRINT; ty++) {
    for (let tx = hq.tx - 1; tx <= hq.tx + HQ_FOOTPRINT; tx++) {
      // Skip tiles inside HQ footprint
      if (tx >= hq.tx && tx < hq.tx + HQ_FOOTPRINT && ty >= hq.ty && ty < hq.ty + HQ_FOOTPRINT) continue;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      if (!occupied.has(`${tx},${ty}`)) return { tx, ty };
    }
  }
  return null;
}
