/**
 * Territory spread system.
 *
 * Manages slow faction territory expansion as a colored overlay layer.
 * Territory is purely visual + gameplay identity — it does NOT block
 * construction, movement, or pathfinding.
 *
 * Lifecycle:
 * 1. HQ footprint starts as fully owned territory (progress = 1).
 * 2. When a building is completed, its footprint tiles begin filling sequentially.
 * 3. After a tile reaches progress 1, it can spread to unclaimed neighbors.
 * 4. Spread is wave-like, one tile per step, with a max radius of 10 from
 *    the source building center.
 * 5. Territory does not affect construction, movement, or pathfinding.
 */

import type { FactionId, MapData, BuildingPlacement } from '../game/map-types.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import {
  TERRITORY_TILE_FILL_SECONDS,
  TERRITORY_SPREAD_STEP_SECONDS,
  TERRITORY_MAX_RADIUS,
} from '../core/constants.js';
import { getBuildingFootprint } from '../config/buildings.js';

// ── Data structures ──────────────────────────────────────────────────

/** Per-tile territory data. Stored in a flat array indexed by ty * width + tx. */
export interface TerritoryTile {
  /** 0 = unclaimed, (0,1] = filling/claimed. 1 = fully claimed. */
  progress: number;
  /** Faction that owns this tile. null if unclaimed. */
  owner: FactionId | null;
  /** Distance (in tiles) from the nearest source center. Used to enforce max radius. */
  distFromSource: number;
}

/** A building that acts as a territory source. */
interface TerritorySource {
  /** Center tile X of the building. */
  cx: number;
  /** Center tile Y of the building. */
  cy: number;
  /** Building footprint size. */
  footprint: number;
  /** Tiles on the building's footprint, in sequential fill order. */
  tiles: Array<{ tx: number; ty: number }>;
  /** Index of the next tile to start filling in the sequential footprint fill. */
  nextFillIndex: number;
  /** Whether the footprint is fully claimed. */
  footprintClaimed: boolean;
}

export interface TerritoryState {
  readonly width: number;
  readonly height: number;
  /** Flat array of per-tile territory data. Index = ty * width + tx. */
  tiles: TerritoryTile[];
  /** Active territory sources (HQ + completed buildings). */
  sources: TerritorySource[];
  /** Timer accumulator for spread steps. */
  spreadAccumulator: number;
  /** Queue of tiles to spread into on the next step. Each entry has position + distance from source. */
  frontier: Array<{ tx: number; ty: number; dist: number; owner: FactionId }>;
}

// ── Factory ──────────────────────────────────────────────────────────

/** Create an empty territory state with no sources. */
export function createTerritoryState(width: number, height: number): TerritoryState {
  const tiles: TerritoryTile[] = [];
  for (let i = 0; i < width * height; i++) {
    tiles.push({ progress: 0, owner: null, distFromSource: Infinity });
  }
  return {
    width,
    height,
    tiles,
    sources: [],
    spreadAccumulator: 0,
    frontier: [],
  };
}

/** Initialize territory for a new game — mark HQ footprint as fully owned. */
export function initTerritoryFromHq(
  state: TerritoryState,
  hqTx: number,
  hqTy: number,
  faction: FactionId,
): void {
  // Mark HQ tiles as fully owned
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      const tx = hqTx + dx;
      const ty = hqTy + dy;
      const idx = ty * state.width + tx;
      if (idx >= 0 && idx < state.tiles.length) {
        state.tiles[idx] = { progress: 1, owner: faction, distFromSource: 0 };
      }
    }
  }

  // Add HQ as a territory source (footprint already claimed)
  const hqFootprintTiles: Array<{ tx: number; ty: number }> = [];
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      hqFootprintTiles.push({ tx: hqTx + dx, ty: hqTy + dy });
    }
  }

  const hqSource: TerritorySource = {
    cx: hqTx + Math.floor(HQ_FOOTPRINT / 2),
    cy: hqTy + Math.floor(HQ_FOOTPRINT / 2),
    footprint: HQ_FOOTPRINT,
    tiles: hqFootprintTiles,
    nextFillIndex: HQ_FOOTPRINT * HQ_FOOTPRINT, // all already filled
    footprintClaimed: true,
  };
  state.sources.push(hqSource);

  // Seed the frontier with neighbors of the HQ footprint
  seedFrontierFromSource(state, hqSource, faction);
}

/** Seed the frontier queue with unclaimed neighbors of a fully-claimed source. */
function seedFrontierFromSource(
  state: TerritoryState,
  source: TerritorySource,
  faction: FactionId,
): void {
  const visited = new Set<string>();
  // Start from the edge tiles of the footprint
  for (const tile of source.tiles) {
    for (const [nx, ny] of getNeighbors(tile.tx, tile.ty, state.width, state.height)) {
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      visited.add(key);

      const idx = ny * state.width + nx;
      const t = state.tiles[idx]!;
      if (t.progress > 0) continue; // already claimed or filling

      const dist = Math.max(Math.abs(nx - source.cx), Math.abs(ny - source.cy));
      if (dist > TERRITORY_MAX_RADIUS) continue;

      state.frontier.push({ tx: nx, ty: ny, dist, owner: faction });
    }
  }
}

// ── Building completion ──────────────────────────────────────────────

/**
 * Register a completed building as a territory source.
 * Its footprint tiles will begin filling sequentially.
 */
export function addBuildingSource(
  state: TerritoryState,
  building: BuildingPlacement,
  _faction: FactionId,
): void {
  const footprint = getBuildingFootprint(building.type);
  const tiles: Array<{ tx: number; ty: number }> = [];
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      tiles.push({ tx: building.tx + dx, ty: building.ty + dy });
    }
  }

  const source: TerritorySource = {
    cx: building.tx + Math.floor(footprint / 2),
    cy: building.ty + Math.floor(footprint / 2),
    footprint,
    tiles,
    nextFillIndex: 0, // start filling from first tile
    footprintClaimed: false,
  };
  state.sources.push(source);
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Advance territory state by dt seconds.
 *
 * Two phases each tick:
 * 1. Footprint fill: sequentially fill tiles on building footprints.
 * 2. Frontier spread: expand territory outward from claimed tiles.
 */
export function tickTerritory(
  state: TerritoryState,
  map: MapData,
  dt: number,
): void {
  if (dt <= 0) return;

  const faction = map.hq.faction;

  // Phase 1: Sequential footprint fill
  for (const source of state.sources) {
    if (source.footprintClaimed) continue;

    // Fill the current tile gradually
    while (!source.footprintClaimed && dt > 0) {
      if (source.nextFillIndex >= source.tiles.length) {
        source.footprintClaimed = true;
        // Seed frontier from this newly claimed source
        seedFrontierFromSource(state, source, faction);
        break;
      }

      const tilePos = source.tiles[source.nextFillIndex]!;
      const idx = tilePos.ty * state.width + tilePos.tx;
      const tile = state.tiles[idx]!;

      // Skip tiles already fully claimed (e.g. by spread from another source)
      if (tile.progress >= 1) {
        source.nextFillIndex++;
        continue;
      }

      const remaining = 1 - tile.progress;
      const fillRate = 1 / TERRITORY_TILE_FILL_SECONDS; // progress per second
      const progress = fillRate * dt;

      if (progress >= remaining) {
        // This tile is fully claimed
        const dtUsed = remaining / fillRate;
        dt -= dtUsed;
        state.tiles[idx] = { progress: 1, owner: faction, distFromSource: 0 };
        source.nextFillIndex++;
      } else {
        // Partial fill
        state.tiles[idx] = {
          progress: tile.progress + progress,
          owner: faction,
          distFromSource: 0,
        };
        dt = 0; // used all time on this tile
      }
    }
  }

  // Phase 2: Frontier spread (wave-like outward expansion)
  state.spreadAccumulator += dt;

  while (state.spreadAccumulator >= TERRITORY_SPREAD_STEP_SECONDS) {
    state.spreadAccumulator -= TERRITORY_SPREAD_STEP_SECONDS;
    processSpreadStep(state, faction);
  }
}

/**
 * Process one spread step: claim the next frontier wave.
 * Each step claims all tiles at the current frontier distance,
 * then expands the frontier to their unclaimed neighbors.
 */
function processSpreadStep(state: TerritoryState, faction: FactionId): void {
  if (state.frontier.length === 0) return;

  // Sort frontier for deterministic order: by distance, then by ty, then by tx
  state.frontier.sort((a, b) => a.dist - b.dist || a.ty - b.ty || a.tx - b.tx);

  // Claim all frontier tiles at the minimum distance
  const nextFrontier: Array<{ tx: number; ty: number; dist: number; owner: FactionId }> = [];

  // Process tiles in order — claim them and expand
  let i = 0;
  while (i < state.frontier.length) {
    const entry = state.frontier[i]!;
    const idx = entry.ty * state.width + entry.tx;
    const tile = state.tiles[idx]!;

    // Only claim if still unclaimed
    if (tile.progress === 0) {
      state.tiles[idx] = { progress: 1, owner: faction, distFromSource: entry.dist };

      // Expand to unclaimed neighbors
      for (const [nx, ny] of getNeighbors(entry.tx, entry.ty, state.width, state.height)) {
        const nIdx = ny * state.width + nx;
        const nTile = state.tiles[nIdx]!;
        if (nTile.progress > 0) continue; // already claimed or filling

        // Check distance from nearest source
        const minDist = getMinDistFromSources(state, nx, ny);
        if (minDist > TERRITORY_MAX_RADIUS) continue;

        // Avoid duplicates — check by position
        const alreadyInNext = nextFrontier.some(f => f.tx === nx && f.ty === ny);
        if (alreadyInNext) continue;

        nextFrontier.push({ tx: nx, ty: ny, dist: minDist, owner: faction });
      }
    }
    i++;
  }

  state.frontier = nextFrontier;
}

/** Get the minimum Chebyshev distance from (tx,ty) to any territory source center. */
function getMinDistFromSources(state: TerritoryState, tx: number, ty: number): number {
  let minDist = Infinity;
  for (const source of state.sources) {
    const dist = Math.max(Math.abs(tx - source.cx), Math.abs(ty - source.cy));
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

/** Get the 4-connected neighbors of a tile within map bounds. */
function getNeighbors(tx: number, ty: number, width: number, height: number): Array<[number, number]> {
  const neighbors: Array<[number, number]> = [];
  if (tx > 0) neighbors.push([tx - 1, ty]);
  if (tx < width - 1) neighbors.push([tx + 1, ty]);
  if (ty > 0) neighbors.push([tx, ty - 1]);
  if (ty < height - 1) neighbors.push([tx, ty + 1]);
  return neighbors;
}

// ── Queries ──────────────────────────────────────────────────────────

/** Get the territory tile data at (tx, ty). Returns undefined for out-of-bounds. */
export function getTerritoryTile(
  state: TerritoryState,
  tx: number,
  ty: number,
): TerritoryTile | undefined {
  if (tx < 0 || ty < 0 || tx >= state.width || ty >= state.height) return undefined;
  return state.tiles[ty * state.width + tx];
}

/** Count total claimed tiles (progress > 0). */
export function countClaimedTiles(state: TerritoryState): number {
  let count = 0;
  for (const tile of state.tiles) {
    if (tile.progress > 0) count++;
  }
  return count;
}

/** Check if a tile is claimed by any faction (progress > 0). */
export function isTileClaimed(state: TerritoryState, tx: number, ty: number): boolean {
  const tile = getTerritoryTile(state, tx, ty);
  return tile !== undefined && tile.progress > 0;
}
