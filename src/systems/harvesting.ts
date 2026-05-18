/** Harvesting system: harvester state machine, resource node runtime state, raw delivery. Pure logic, no DOM. */

import type { ResourceType, MapData } from '../game/map-types.js';
import type { GameState } from '../game/game-state.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import { getBuildingFootprint } from '../config/buildings.js';

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
const RESOURCE_AMOUNTS: Record<ResourceType, number> = {
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
  /** Stored dropoff target X (tile-center). Computed once at gathering→moving-to-dropoff transition. */
  targetDropoffTx: number;
  /** Stored dropoff target Y (tile-center). Computed once at gathering→moving-to-dropoff transition. */
  targetDropoffTy: number;
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

/** Create initial harvesters near HQ. Places one Harvester adjacent to HQ. */
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

  for (const candidate of candidates) {
    if (candidate.tx < 0 || candidate.ty < 0) continue;
    const key = `${candidate.tx},${candidate.ty}`;
    if (occupied.has(key)) continue;
    // Place harvester at center of tile
    return [{
      tx: candidate.tx + 0.5,
      ty: candidate.ty + 0.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      targetDropoffTx: 0,
      targetDropoffTy: 0,
    }];
  }

  // Fallback: place right outside HQ even if overlapping
  return [{
    tx: hq.tx + HQ_FOOTPRINT + 0.5,
    ty: hq.ty + 0.5,
    phase: 'idle',
    targetNodeIndex: -1,
    gatherProgress: 0,
    carry: 0,
    targetDropoffTx: 0,
    targetDropoffTy: 0,
  }];
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Advance all harvesters by `dt` seconds.
 *
 * State machine: idle → moving-to-resource → gathering → moving-to-dropoff → delivering → idle
 *   delivering may transition to waiting-full-storage if raw cap is full.
 *   waiting-full-storage transitions back to delivering when cap frees up.
 *
 * - idle: find nearest non-depleted resource node
 * - moving-to-resource: move toward target node center
 * - gathering: wait for HARVESTER_GATHER_TIME, then extract raw from node
 * - moving-to-dropoff: move toward nearest raw-storage center (fallback HQ)
 * - delivering: deposit carry into economy.resources.raw (no raw loss)
 * - waiting-full-storage: wait at dropoff until raw cap has free space
 */
export function tickHarvesting(state: GameState, dt: number): void {

  for (const harvester of state.harvesters) {
    switch (harvester.phase) {
      case 'idle': {
        const nodeIndex = findNearestNode(harvester, state.resourceNodes);
        if (nodeIndex >= 0) {
          harvester.targetNodeIndex = nodeIndex;
          harvester.phase = 'moving-to-resource';
        }
        break;
      }

      case 'moving-to-resource': {
        const node = state.resourceNodes[harvester.targetNodeIndex];
        if (!node || node.remaining <= 0) {
          // Target depleted or invalid — go idle to re-select
          harvester.phase = 'idle';
          harvester.targetNodeIndex = -1;
          break;
        }
        const targetTx = node.tx + 0.5;
        const targetTy = node.ty + 0.5;
        if (moveToward(harvester, targetTx, targetTy, dt)) {
          harvester.phase = 'gathering';
          harvester.gatherProgress = 0;
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
          // Compute and store dropoff target (nearest raw-storage, fallback HQ)
          const dropoff = findNearestDropoff(harvester, state.map);
          harvester.targetDropoffTx = dropoff.tx;
          harvester.targetDropoffTy = dropoff.ty;
          harvester.phase = 'moving-to-dropoff';
        }
        break;
      }

      case 'moving-to-dropoff': {
        if (moveToward(harvester, harvester.targetDropoffTx, harvester.targetDropoffTy, dt)) {
          harvester.phase = 'delivering';
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

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Find the nearest valid dropoff target for a harvester carrying Raw.
 * Prefers nearest completed raw-storage center; falls back to HQ center.
 * Offline raw-storage still counts as valid physical storage.
 * Construction sites are not valid dropoff targets.
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

/** Find the nearest non-depleted resource node. Returns -1 if none available. */
function findNearestNode(
  harvester: HarvesterState,
  nodes: ReadonlyArray<ResourceNodeState>,
): number {
  let bestIndex = -1;
  let bestDist = Infinity;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node.remaining <= 0) continue;
    const dist = Math.hypot(node.tx + 0.5 - harvester.tx, node.ty + 0.5 - harvester.ty);
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }

  return bestIndex;
}

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
