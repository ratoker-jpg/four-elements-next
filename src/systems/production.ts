/** Production system: factory queue, unit production progress, builder/harvester spawn. Pure logic, no DOM. */

import type { MapData, BuildingPlacement } from '../game/map-types.js';
import type { GameState } from '../game/game-state.js';
import { isBuildingOnline, type ReadonlyPowerState } from './power.js';
import { availableControl, type ReadonlyControlState } from './control.js';
import { getFactionElement, type ReadonlyEconomyState } from './economy.js';
import { BUILDER_CONTROL_COST } from './construction.js';
import { HARVESTER_CONTROL_COST } from './harvesting.js';
import { buildOccupiedTileSet } from './construction.js';
import { getBuildingFootprint } from '../config/buildings.js';

// ── Constants ────────────────────────────────────────────────────────

/** Maximum items in a single factory's production queue. */
export const QUEUE_LIMIT = 2;

/** Unit types that can be produced by a Units Factory. */
export type ProducibleUnitType = 'builder' | 'harvester';

/** Cost and time for each producible unit type.
 *  Element costs are in elementUnits: 10 elementUnits = 1 displayed element. */
export const PRODUCTION_COSTS: Record<ProducibleUnitType, {
  matter: number;
  /** Element cost in elementUnits. 10 elementUnits = 1 displayed element. */
  element: number;
  control: number;
  duration: number;
}> = {
  builder: { matter: 50, element: 10, control: BUILDER_CONTROL_COST, duration: 20 },
  harvester: { matter: 60, element: 10, control: HARVESTER_CONTROL_COST, duration: 25 },
};

// ── State types ──────────────────────────────────────────────────────

/** A single item in a factory's production queue. */
export interface ProductionQueueItem {
  unitType: ProducibleUnitType;
  /** Seconds spent producing so far. */
  elapsed: number;
  /** Total seconds needed to complete. */
  duration: number;
  /** Progress 0..1. */
  progress: number;
  /** Whether production is complete and the unit is awaiting spawn. */
  completed: boolean;
}

/** Production state for a single Units Factory building. */
export interface FactoryProductionState {
  tx: number;
  ty: number;
  queue: ProductionQueueItem[];
}

/** Full production system state. */
export interface ProductionState {
  factories: FactoryProductionState[];
}

/** Read-only view for UI/rendering. */
export type ReadonlyProductionState = Readonly<ProductionState>;

// ── Failure reasons ──────────────────────────────────────────────────

export type ProductionFailureReason =
  | 'factory-not-found'
  | 'factory-offline'
  | 'queue-full'
  | 'insufficient-matter'
  | 'insufficient-element'
  | 'insufficient-control';

export interface ProductionCommandResult {
  ok: boolean;
  reason?: ProductionFailureReason;
  unitType: ProducibleUnitType;
  factoryTx: number;
  factoryTy: number;
}

// ── Factory ──────────────────────────────────────────────────────────

/** Create an empty ProductionState (no factories at game start). */
export function createProductionState(): ProductionState {
  return { factories: [] };
}

/**
 * Called from the completion cascade when a building finishes construction.
 * If the building is a units-factory, adds a new factory entry with an empty queue.
 */
export function applyCompletedBuildingToProduction(
  state: ProductionState,
  building: Pick<BuildingPlacement, 'tx' | 'ty' | 'type'>,
): void {
  if (building.type === 'units-factory') {
    state.factories.push({
      tx: building.tx,
      ty: building.ty,
      queue: [],
    });
  }
}

// ── Start production ─────────────────────────────────────────────────

/**
 * Enqueue a production item at the specified factory.
 *
 * Validates: factory exists, factory online, queue not full,
 * sufficient matter, sufficient active faction element, sufficient control capacity.
 *
 * On success: deducts matter, deducts element, reserves control.used, adds item to queue.
 * On failure: returns reason, no state changes.
 */
export function startProduction(
  state: GameState,
  factoryTx: number,
  factoryTy: number,
  unitType: ProducibleUnitType,
): ProductionCommandResult {
  const factory = state.production.factories.find(
    (f) => f.tx === factoryTx && f.ty === factoryTy,
  );

  if (!factory) {
    return { ok: false, reason: 'factory-not-found', unitType, factoryTx, factoryTy };
  }

  if (!isBuildingOnline(state.power, factoryTx, factoryTy)) {
    return { ok: false, reason: 'factory-offline', unitType, factoryTx, factoryTy };
  }

  if (factory.queue.length >= QUEUE_LIMIT) {
    return { ok: false, reason: 'queue-full', unitType, factoryTx, factoryTy };
  }

  const cost = PRODUCTION_COSTS[unitType];

  if (state.economy.resources.matter < cost.matter) {
    return { ok: false, reason: 'insufficient-matter', unitType, factoryTx, factoryTy };
  }

  const activeElement = getFactionElement(state.economy, state.economy.faction);
  if (activeElement < cost.element) {
    return { ok: false, reason: 'insufficient-element', unitType, factoryTx, factoryTy };
  }

  if (availableControl(state.control) < cost.control) {
    return { ok: false, reason: 'insufficient-control', unitType, factoryTx, factoryTy };
  }

  // Deduct resources
  state.economy.resources.matter -= cost.matter;
  state.economy.resources.elements[state.economy.faction] -= cost.element;

  // Reserve control
  state.control.used += cost.control;

  // Enqueue item
  factory.queue.push({
    unitType,
    elapsed: 0,
    duration: cost.duration,
    progress: 0,
    completed: false,
  });

  return { ok: true, unitType, factoryTx, factoryTy };
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Advance all factory production queues by dt seconds.
 *
 * - Online factories: progress active (first non-completed) queue item.
 * - Offline factories: pause progress (do not reset).
 * - Completed items: attempt spawn. If no free adjacent tile, item stays completed and retries next tick.
 */
export function tickProduction(state: GameState, dt: number): void {
  for (const factory of state.production.factories) {
    const online = isBuildingOnline(state.power, factory.tx, factory.ty);

    if (factory.queue.length === 0) continue;

    const active = factory.queue[0]!;
    if (!active) continue;

    // If active item is not yet completed, advance progress (only if factory online)
    if (!active.completed) {
      if (online) {
        active.elapsed += dt;
        active.progress = Math.min(active.elapsed / active.duration, 1);
        if (active.progress >= 1) {
          active.completed = true;
        }
      }
      // If offline: progress pauses, does not reset
    }

    // If active item is completed, attempt spawn
    if (active.completed) {
      const spawned = trySpawnUnit(state, factory, active);
      if (spawned) {
        // Remove from queue, next item becomes active automatically
        factory.queue.shift();
      }
      // If not spawned: item stays completed at queue[0], retries next tick
    }
  }
}

// ── Spawn ────────────────────────────────────────────────────────────

/**
 * Attempt to spawn a unit near the factory.
 * Returns true if spawned successfully, false if no free tile available.
 */
function trySpawnUnit(
  state: GameState,
  factory: FactoryProductionState,
  item: ProductionQueueItem,
): boolean {
  const tile = findFreeAdjacentTile(state.map, factory.tx, factory.ty);
  if (!tile) return false;

  if (item.unitType === 'builder') {
    state.map.builders.push({ tx: tile.tx, ty: tile.ty, busy: false });
  } else {
    state.harvesters.push({
      tx: tile.tx + 0.5,
      ty: tile.ty + 0.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      targetDropoffTx: 0,
      targetDropoffTy: 0,
    });
  }

  return true;
}

/**
 * Find a free (unoccupied) tile adjacent to the factory's footprint.
 * The factory occupies tiles [tx,tx+1] x [ty,ty+1] (footprint=2).
 * Adjacent ring is all tiles from (tx-1, ty-1) to (tx+2, ty+2) excluding the footprint itself.
 * Returns the first free tile, or null if none available.
 */
export function findFreeAdjacentTile(
  map: MapData,
  factoryTx: number,
  factoryTy: number,
): { tx: number; ty: number } | null {
  const occupied = buildOccupiedTileSet(map);
  const footprint = getBuildingFootprint('units-factory');

  // Iterate the ring of tiles around the factory footprint
  for (let ty = factoryTy - 1; ty <= factoryTy + footprint; ty++) {
    for (let tx = factoryTx - 1; tx <= factoryTx + footprint; tx++) {
      // Skip tiles inside the footprint itself
      if (tx >= factoryTx && tx < factoryTx + footprint && ty >= factoryTy && ty < factoryTy + footprint) {
        continue;
      }

      // Skip out of bounds
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;

      // Check if tile is free
      if (!occupied.has(`${tx},${ty}`)) {
        return { tx, ty };
      }
    }
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Find a factory state by its tile position. Returns undefined if not found. */
export function findFactory(
  state: ReadonlyProductionState,
  tx: number,
  ty: number,
): FactoryProductionState | undefined {
  return state.factories.find((f) => f.tx === tx && f.ty === ty);
}

/** Check if a specific unit type can be produced at the given factory. */
export function canProduce(
  economy: ReadonlyEconomyState,
  control: ReadonlyControlState,
  power: ReadonlyPowerState,
  factoryQueueLength: number,
  factoryTx: number,
  factoryTy: number,
  unitType: ProducibleUnitType,
): boolean {
  if (!isBuildingOnline(power, factoryTx, factoryTy)) return false;
  if (factoryQueueLength >= QUEUE_LIMIT) return false;

  const cost = PRODUCTION_COSTS[unitType];
  if (economy.resources.matter < cost.matter) return false;

  const activeElement = getFactionElement(economy, economy.faction);
  if (activeElement < cost.element) return false;

  if (availableControl(control) < cost.control) return false;

  return true;
}
