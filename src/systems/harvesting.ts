/**
 * Harvesting system: harvester state machine, resource node runtime state, raw delivery.
 * Pure logic, no DOM.
 *
 * PR2 integration: harvesters now use runtime pathfinding instead of straight-line
 * movement. They path to passable tiles adjacent to resource/dropoff footprints,
 * avoiding HQ, buildings, construction sites, obstacles, and resources.
 */

import type { ResourceType, MapData } from '../game/map-types.js';
import { RESOURCE_FOOTPRINTS } from '../game/map-types.js';
import type { GameState } from '../game/game-state.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import { getBuildingFootprint } from '../config/buildings.js';
import { buildPassabilityGrid, type PassabilityGrid } from './passability.js';
import { findPathToAdjacent } from './pathfinding.js';

// ── Constants ────────────────────────────────────────────────────────

/** Control cost per Harvester unit. */
export const HARVESTER_CONTROL_COST = 1;

/** Harvester movement speed in tiles per second. */
export const HARVESTER_SPEED = 2.5;

/** Time in seconds for one gathering cycle. */
export const HARVESTER_GATHER_TIME = 3;

/** Raw amount carried per delivery trip. */
export const HARVESTER_CARRY_AMOUNT = 10;

/** Arrival threshold in tile-space distance. */
const ARRIVAL_THRESHOLD = 0.15;

/** Raw amount stored in each resource type. */
export const RESOURCE_AMOUNTS: Record<ResourceType, number> = {
  small: 50,
  medium: 100,
  large: 200,
  infinite: Infinity,
};

// ── State types ──────────────────────────────────────────────────────

/** Harvester state machine phases. */
export type HarvesterPhase =
  | 'idle'
  | 'moving-to-resource'
  | 'gathering'
  | 'moving-to-dropoff'
  | 'delivering'
  | 'waiting-full-storage';

/** Runtime state for a single Harvester unit. */
export interface HarvesterState {
  /** Floating-point tile position for smooth movement. */
  tx: number;
  ty: number;
  /** Current phase in the harvester state machine. */
  phase: HarvesterPhase;
  /** Index into GameState.resourceNodes for the target node. -1 if no target. */
  targetNodeIndex: number;
  /** Gathering progress 0..1. */
  gatherProgress: number;
  /** Amount of raw currently being carried. */
  carry: number;
  /** Stored dropoff target X (tile-center of adjacent passable tile). */
  targetDropoffTx: number;
  /** Stored dropoff target Y (tile-center of adjacent passable tile). */
  targetDropoffTy: number;
  /** Computed path waypoints (tile-integer positions). Empty when no active path. */
  path: Array<{ tx: number; ty: number }>;
  /** Current waypoint index in path. Points to the next waypoint to move toward. */
  pathIndex: number;
}

/** Runtime state for a resource node on the map. */
export interface ResourceNodeState {
  /** Tile position (matches MapData.resources placement). */
  tx: number;
  ty: number;
  /** Resource type from mapgen. */
  type: ResourceType;
  /** Whether this is an infinite resource. */
  infinite: boolean;
  /** Remaining raw amount. Decrements for finite nodes; stays Infinity for infinite. */
  remaining: number;
}

// ── Factories ────────────────────────────────────────────────────────

/** Create runtime ResourceNodeState[] from static MapData.resources. */
export function createResourceNodeStates(
  mapResources: ReadonlyArray<{ readonly tx: number; readonly ty: number; readonly type: ResourceType }>,
): ResourceNodeState[] {
  return mapResources.map((r) => ({
    tx: r.tx,
    ty: r.ty,
    type: r.type,
    infinite: r.type === 'infinite',
    remaining: RESOURCE_AMOUNTS[r.type],
  }));
}

/** Create initial harvesters near HQ. Places two Harvesters adjacent to HQ. */
export function createInitialHarvesters(
  hq: { readonly tx: number; readonly ty: number },
  occupied: ReadonlySet<string>,
): HarvesterState[] {
  const candidates: Array<{ tx: number; ty: number }> = [];
  for (let ty = hq.ty - 1; ty <= hq.ty + HQ_FOOTPRINT; ty++) {
    for (let tx = hq.tx - 1; tx <= hq.tx + HQ_FOOTPRINT; tx++) {
      const onRing =
        tx === hq.tx - 1
        || tx === hq.tx + HQ_FOOTPRINT
        || ty === hq.ty - 1
        || ty === hq.ty + HQ_FOOTPRINT;
      if (!onRing) continue;
      candidates.push({ tx, ty });
    }
  }

  const harvesters: HarvesterState[] = [];
  for (const candidate of candidates) {
    if (harvesters.length >= 2) break;
    if (candidate.tx < 0 || candidate.ty < 0) continue;
    const key = `${candidate.tx},${candidate.ty}`;
    if (occupied.has(key)) continue;
    // Place harvester at center of tile
    harvesters.push({
      tx: candidate.tx + 0.5,
      ty: candidate.ty + 0.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      targetDropoffTx: 0,
      targetDropoffTy: 0,
      path: [],
      pathIndex: 0,
    });
  }

  // Fallback: if not enough candidates found, place right outside HQ
  while (harvesters.length < 2) {
    harvesters.push({
      tx: hq.tx + HQ_FOOTPRINT + 0.5 + harvesters.length,
      ty: hq.ty + 0.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      targetDropoffTx: 0,
      targetDropoffTy: 0,
      path: [],
      pathIndex: 0,
    });
  }

  return harvesters;
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Advance all harvesters by `dt` seconds.
 *
 * State machine: idle → moving-to-resource → gathering → moving-to-dropoff → delivering → idle
 *   delivering may transition to waiting-full-storage if raw cap is full.
 *   waiting-full-storage transitions back to delivering when cap frees up.
 *
 * - idle: find nearest reachable resource node via pathfinding
 * - moving-to-resource: follow computed path to adjacent tile of resource
 * - gathering: wait for HARVESTER_GATHER_TIME, then extract raw from node
 * - moving-to-dropoff: follow computed path to adjacent tile of dropoff
 * - delivering: deposit carry into economy.resources.raw (no raw loss)
 * - waiting-full-storage: wait at dropoff until raw cap has free space
 */
export function tickHarvesting(state: GameState, dt: number): void {
  // Build passability grid once per tick for all harvesters.
  // This ensures consistent blocking state within a single tick.
  // Pass resourceNodes so depleted finite resources don't block pathfinding.
  const grid = buildPassabilityGrid(state.map, state.resourceNodes);

  for (const harvester of state.harvesters) {
    switch (harvester.phase) {
      case 'idle': {
        const result = findNearestReachableResource(grid, harvester, state.resourceNodes);
        if (result) {
          harvester.targetNodeIndex = result.nodeIndex;
          harvester.path = result.path;
          harvester.pathIndex = 0;
          harvester.phase = 'moving-to-resource';
        }
        break;
      }

      case 'moving-to-resource': {
        const node = state.resourceNodes[harvester.targetNodeIndex];
        if (!node || node.remaining <= 0) {
          // Target depleted or invalid — try another reachable resource
          const result = findNearestReachableResource(grid, harvester, state.resourceNodes);
          if (result) {
            harvester.targetNodeIndex = result.nodeIndex;
            harvester.path = result.path;
            harvester.pathIndex = 0;
            // Stay in moving-to-resource with new target
          } else {
            harvester.phase = 'idle';
            harvester.targetNodeIndex = -1;
            harvester.path = [];
            harvester.pathIndex = 0;
          }
          break;
        }
        if (followPath(harvester, dt)) {
          // Arrived at adjacent tile of resource
          harvester.phase = 'gathering';
          harvester.gatherProgress = 0;
          harvester.path = [];
          harvester.pathIndex = 0;
        }
        break;
      }

      case 'gathering': {
        const node = state.resourceNodes[harvester.targetNodeIndex];
        if (!node || node.remaining <= 0) {
          // Node depleted while gathering — deliver what we have (0) or go idle
          harvester.phase = 'idle';
          harvester.targetNodeIndex = -1;
          harvester.gatherProgress = 0;
          break;
        }
        harvester.gatherProgress += dt / HARVESTER_GATHER_TIME;
        if (harvester.gatherProgress >= 1) {
          // Extract raw from node
          const extract = Math.min(HARVESTER_CARRY_AMOUNT, node.remaining);
          if (!node.infinite) {
            node.remaining -= extract;
          }
          harvester.carry = extract;
          harvester.gatherProgress = 0;
          // Compute dropoff path
          const dropoffResult = findReachableDropoff(grid, harvester, state.map);
          if (dropoffResult) {
            harvester.path = dropoffResult.path;
            harvester.pathIndex = 0;
            harvester.targetDropoffTx = dropoffResult.targetTx + 0.5;
            harvester.targetDropoffTy = dropoffResult.targetTy + 0.5;
            harvester.phase = 'moving-to-dropoff';
          } else {
            // No reachable dropoff — go idle with carry preserved.
            // The harvester will try again on next idle tick.
            harvester.phase = 'idle';
            harvester.targetNodeIndex = -1;
          }
        }
        break;
      }

      case 'moving-to-dropoff': {
        if (followPath(harvester, dt)) {
          harvester.phase = 'delivering';
          harvester.path = [];
          harvester.pathIndex = 0;
        }
        break;
      }

      case 'delivering': {
        if (harvester.carry > 0) {
          const r = state.economy.resources;
          const space = r.rawCap - r.raw;
          const deposit = Math.min(harvester.carry, space);
          r.raw += deposit;
          harvester.carry -= deposit;
          if (harvester.carry > 0) {
            // Storage filled up during partial deposit — wait for space
            harvester.phase = 'waiting-full-storage';
            break;
          }
        }
        harvester.phase = 'idle';
        harvester.targetNodeIndex = -1;
        break;
      }

      case 'waiting-full-storage': {
        const r = state.economy.resources;
        if (r.raw < r.rawCap) {
          // Space freed up — attempt delivery
          harvester.phase = 'delivering';
        }
        break;
      }
    }
  }
}

// ── Path-following ───────────────────────────────────────────────────

/**
 * Follow the current path by moving toward waypoints.
 * Returns true when the path is complete (all waypoints visited).
 * Processes one waypoint per call; the next waypoint starts on the next tick.
 */
function followPath(harvester: HarvesterState, dt: number): boolean {
  if (harvester.pathIndex >= harvester.path.length) {
    return true; // already at destination or empty path
  }

  const waypoint = harvester.path[harvester.pathIndex]!;
  const targetTx = waypoint.tx + 0.5; // tile center
  const targetTy = waypoint.ty + 0.5;

  if (moveToward(harvester, targetTx, targetTy, dt)) {
    // Arrived at this waypoint — advance to next
    harvester.pathIndex++;
    // If no more waypoints, path is complete
    return harvester.pathIndex >= harvester.path.length;
  }

  return false;
}

// ── Reachable target selection ───────────────────────────────────────

/** Result of searching for a reachable resource node. */
interface ReachableResourceResult {
  nodeIndex: number;
  path: Array<{ tx: number; ty: number }>;
}

/**
 * Find the nearest reachable resource node by pathfinding cost.
 * Skips depleted and unreachable nodes.
 * Returns null if no reachable resource exists.
 */
function findNearestReachableResource(
  grid: PassabilityGrid,
  harvester: HarvesterState,
  nodes: ReadonlyArray<ResourceNodeState>,
): ReachableResourceResult | null {
  const fromTx = Math.floor(harvester.tx);
  const fromTy = Math.floor(harvester.ty);

  let bestIndex = -1;
  let bestPath: Array<{ tx: number; ty: number }> = [];
  let bestCost = Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.remaining <= 0) continue;

    const footprint = RESOURCE_FOOTPRINTS[node.type];
    const result = findPathToAdjacent(grid, fromTx, fromTy, node.tx, node.ty, footprint);

    if (result.found && result.cost < bestCost) {
      bestCost = result.cost;
      bestPath = result.path;
      bestIndex = i;
    }
  }

  if (bestIndex < 0) return null;
  return { nodeIndex: bestIndex, path: bestPath };
}

/** Result of searching for a reachable dropoff target. */
interface ReachableDropoffResult {
  path: Array<{ tx: number; ty: number }>;
  targetTx: number;
  targetTy: number;
}

/**
 * Find the nearest reachable dropoff by pathfinding cost.
 * Prefers raw-storage over HQ (tries raw-storages first, then HQ fallback).
 * Returns null if no reachable dropoff exists.
 */
function findReachableDropoff(
  grid: PassabilityGrid,
  harvester: HarvesterState,
  map: MapData,
): ReachableDropoffResult | null {
  const fromTx = Math.floor(harvester.tx);
  const fromTy = Math.floor(harvester.ty);

  let bestPath: Array<{ tx: number; ty: number }> | null = null;
  let bestCost = Infinity;
  let bestTargetTx = 0;
  let bestTargetTy = 0;

  // Try raw-storage buildings first
  for (const building of map.buildings) {
    if (building.type !== 'raw-storage') continue;
    const footprint = getBuildingFootprint(building.type);
    const result = findPathToAdjacent(grid, fromTx, fromTy, building.tx, building.ty, footprint);
    if (result.found && result.cost < bestCost) {
      bestCost = result.cost;
      bestPath = result.path;
      const last = result.path.length > 0 ? result.path[result.path.length - 1]! : { tx: fromTx, ty: fromTy };
      bestTargetTx = last.tx;
      bestTargetTy = last.ty;
    }
  }

  // If a raw-storage was found, use it (preserve raw-storage preference)
  if (bestPath !== null) {
    return { path: bestPath, targetTx: bestTargetTx, targetTy: bestTargetTy };
  }

  // HQ fallback
  const hqResult = findPathToAdjacent(grid, fromTx, fromTy, map.hq.tx, map.hq.ty, HQ_FOOTPRINT);
  if (hqResult.found) {
    const last = hqResult.path.length > 0 ? hqResult.path[hqResult.path.length - 1]! : { tx: fromTx, ty: fromTy };
    return { path: hqResult.path, targetTx: last.tx, targetTy: last.ty };
  }

  return null;
}

// ── Helpers (legacy, kept for backward compatibility) ────────────────

/**
 * Find the nearest valid dropoff target for a harvester carrying Raw.
 * Prefers nearest completed raw-storage center; falls back to HQ center.
 * Offline raw-storage still counts as valid physical storage.
 * Construction sites are not valid dropoff targets.
 *
 * NOTE: This function returns building-center positions (legacy behavior).
 * The actual harvester movement now uses pathfinding to adjacent tiles.
 * Kept for backward compatibility with tests and reference.
 */
export function findNearestDropoff(
  harvester: HarvesterState,
  map: MapData,
): { tx: number; ty: number } {
  let bestDist = Infinity;
  let bestCenter: { tx: number; ty: number } | null = null;

  for (const building of map.buildings) {
    if (building.type !== 'raw-storage') continue;
    const footprint = getBuildingFootprint(building.type);
    const centerTx = building.tx + footprint / 2;
    const centerTy = building.ty + footprint / 2;
    const dist = Math.hypot(centerTx - harvester.tx, centerTy - harvester.ty);
    if (dist < bestDist) {
      bestDist = dist;
      bestCenter = { tx: centerTx, ty: centerTy };
    }
  }

  if (bestCenter) return bestCenter;

  // Fallback: HQ center
  return {
    tx: map.hq.tx + HQ_FOOTPRINT / 2,
    ty: map.hq.ty + HQ_FOOTPRINT / 2,
  };
}

// ── Movement ─────────────────────────────────────────────────────────

/**
 * Move harvester toward target by HARVESTER_SPEED * dt.
 * Returns true if arrived (within ARRIVAL_THRESHOLD).
 */
function moveToward(
  harvester: HarvesterState,
  targetTx: number,
  targetTy: number,
  dt: number,
): boolean {
  const dx = targetTx - harvester.tx;
  const dy = targetTy - harvester.ty;
  const dist = Math.hypot(dx, dy);

  if (dist <= ARRIVAL_THRESHOLD) return true;

  const step = HARVESTER_SPEED * dt;
  if (dist <= step) {
    harvester.tx = targetTx;
    harvester.ty = targetTy;
    return true;
  }

  harvester.tx += (dx / dist) * step;
  harvester.ty += (dy / dist) * step;
  return false;
}
