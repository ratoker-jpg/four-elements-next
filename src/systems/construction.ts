import { HQ_FOOTPRINT } from '../core/constants.js';
import { BUILDING_DEFINITIONS, getBuildingFootprint } from '../config/buildings.js';
import type {
  BuildingPlacement,
  BuildingType,
  BuilderPlacement,
  ConstructionSitePlacement,
  MapData,
} from '../game/map-types.js';
import type { EconomyState } from './economy.js';
import { buildPassabilityGrid, findAdjacentPassableTiles, type PassabilityGrid } from './passability.js';
import { findPathToAdjacent } from './pathfinding.js';

export const BUILDER_CONTROL_COST = 1;
export const AUTO_BUILD_MAX_RADIUS = 15;

export type ConstructionFailureReason = 'busy' | 'insufficient-matter' | 'no-placement' | 'no-route';

export interface ConstructionCommandResult {
  ok: boolean;
  reason?: ConstructionFailureReason;
  buildingType: BuildingType;
  site?: ConstructionSitePlacement;
}

export interface ConstructionTickResult {
  completedBuildings: BuildingPlacement[];
}

export function startConstruction(
  map: MapData,
  economy: EconomyState,
  buildingType: BuildingType,
): ConstructionCommandResult {
  // No builders at all → no-placement
  if (map.builders.length === 0) {
    return { ok: false, reason: 'no-placement', buildingType };
  }

  // Collect idle (non-busy) builder indices
  const idleIndices: number[] = [];
  for (let i = 0; i < map.builders.length; i++) {
    if (!map.builders[i]!.busy) {
      idleIndices.push(i);
    }
  }

  // All builders busy → busy
  if (idleIndices.length === 0) {
    return { ok: false, reason: 'busy', buildingType };
  }

  const definition = BUILDING_DEFINITIONS[buildingType];
  if (economy.resources.matter < definition.costMatter) {
    return { ok: false, reason: 'insufficient-matter', buildingType };
  }

  // Try each idle builder for auto-placement; use the first that succeeds
  let anyUnreachableSite = false;
  for (const builderIndex of idleIndices) {
    const builder = map.builders[builderIndex]!;
    const result = findAutoPlacement(map, builder, buildingType);
    if (result.hasUnreachableSite) anyUnreachableSite = true;
    if (result.placement) {
      economy.resources.matter -= definition.costMatter;
      builder.busy = true;

      const site: ConstructionSitePlacement = {
        tx: result.placement.tx,
        ty: result.placement.ty,
        type: buildingType,
        elapsed: 0,
        duration: definition.buildTimeSeconds,
        progress: 0,
        builderIndex,
      };
      map.constructionSites.push(site);

      return { ok: true, buildingType, site };
    }
  }

  // Idle builders exist but none can place the building
  // Distinguish: buildable sites exist but unreachable → no-route
  //              no buildable sites at all → no-placement
  if (anyUnreachableSite) {
    return { ok: false, reason: 'no-route', buildingType };
  }
  return { ok: false, reason: 'no-placement', buildingType };
}

export function tickConstruction(map: MapData, dt: number): ConstructionTickResult {
  const completedBuildings: BuildingPlacement[] = [];

  for (let index = map.constructionSites.length - 1; index >= 0; index--) {
    const site = map.constructionSites[index]!;
    site.elapsed += dt;
    site.progress = Math.min(site.elapsed / site.duration, 1);

    if (site.elapsed < site.duration) continue;

    const building: BuildingPlacement = {
      tx: site.tx,
      ty: site.ty,
      type: site.type,
    };
    map.buildings.push(building);
    completedBuildings.push(building);

    // Free only the builder assigned to this completed site
    const assignedBuilder = map.builders[site.builderIndex];
    if (assignedBuilder) {
      assignedBuilder.busy = false;
    }

    map.constructionSites.splice(index, 1);
  }

  return { completedBuildings };
}

export function canAffordBuilding(economy: EconomyState, buildingType: BuildingType): boolean {
  return economy.resources.matter >= BUILDING_DEFINITIONS[buildingType].costMatter;
}

/** Result of auto-placement search for a single builder. */
export interface AutoPlacementResult {
  /** A reachable buildable site was found. */
  placement: { tx: number; ty: number } | null;
  /** At least one buildable site exists but none are reachable by this builder. */
  hasUnreachableSite: boolean;
}

export function findAutoPlacement(
  map: MapData,
  builder: BuilderPlacement,
  buildingType: BuildingType,
  maxRadius: number = AUTO_BUILD_MAX_RADIUS,
): AutoPlacementResult {
  const occupied = buildOccupiedTileSet(map);
  const footprint = getBuildingFootprint(buildingType);
  let hasUnreachableSite = false;

  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let ty = builder.ty - radius; ty <= builder.ty + radius; ty++) {
      for (let tx = builder.tx - radius; tx <= builder.tx + radius; tx++) {
        const onRing = Math.max(Math.abs(tx - builder.tx), Math.abs(ty - builder.ty)) === radius;
        if (!onRing) continue;
        if (!isFootprintWithSpacingBuildable(map, occupied, tx, ty, footprint)) continue;
        // Reachability check: builder must be able to reach an adjacent passable tile
        // with the candidate footprint treated as blocked.
        if (!isSiteReachableByBuilder(map, builder, tx, ty, footprint)) {
          hasUnreachableSite = true;
          continue;
        }
        return { placement: { tx, ty }, hasUnreachableSite: false };
      }
    }
  }

  return { placement: null, hasUnreachableSite };
}

/**
 * Check whether a builder can reach at least one passable tile adjacent to
 * a candidate construction site footprint, treating the candidate footprint
 * as blocked for the route query.
 *
 * Uses the existing passability grid and pathfinding: builds a grid from
 * current map state, temporarily marks the candidate footprint as blocked,
 * then checks whether any adjacent passable tile is reachable from the
 * builder's position.
 */
export function isSiteReachableByBuilder(
  map: MapData,
  builder: BuilderPlacement,
  siteTx: number,
  siteTy: number,
  siteFootprint: number,
): boolean {
  const grid = buildPassabilityGrid(map);
  // Temporarily block the candidate footprint on the grid
  markGridBlocked(grid, siteTx, siteTy, siteFootprint);

  // Find adjacent passable tiles (after blocking the candidate)
  const adjacentTiles = findAdjacentPassableTiles(grid, siteTx, siteTy, siteFootprint);
  if (adjacentTiles.length === 0) return false;

  // Check if builder is already on an adjacent tile
  for (const adj of adjacentTiles) {
    if (builder.tx === adj.tx && builder.ty === adj.ty) return true;
  }

  // Use BFS to check reachability from builder to any adjacent tile
  const pathResult = findPathToAdjacent(grid, builder.tx, builder.ty, siteTx, siteTy, siteFootprint);
  return pathResult.found;
}

/**
 * Mark a footprint rectangle as blocked on a mutable passability grid.
 * Clamps to grid bounds. Mutates grid.cells in place.
 */
function markGridBlocked(grid: PassabilityGrid, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (x >= 0 && x < grid.width && y >= 0 && y < grid.height) {
        grid.cells[y * grid.width + x] = 1;
      }
    }
  }
}

export function buildOccupiedTileSet(map: MapData): Set<string> {
  const occupied = new Set<string>();

  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      occupied.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }

  for (const building of map.buildings) {
    markFootprintOccupied(occupied, building.tx, building.ty, getBuildingFootprint(building.type));
  }
  for (const site of map.constructionSites) {
    markFootprintOccupied(occupied, site.tx, site.ty, getBuildingFootprint(site.type));
  }
  for (const resource of map.resources) {
    markFootprintOccupied(occupied, resource.tx, resource.ty, resource.footprint);
  }
  // Obstacle footprints block building placement
  for (const obstacle of map.obstacles) {
    markFootprintOccupied(occupied, obstacle.tx, obstacle.ty, obstacle.footprint);
  }
  // Decor is non-blocking (bush, sand-bump) — does NOT block building placement
  for (const builder of map.builders) {
    occupied.add(`${builder.tx},${builder.ty}`);
  }

  return occupied;
}

export function isFootprintBuildable(
  map: MapData,
  occupied: ReadonlySet<string>,
  tx: number,
  ty: number,
  footprint: number,
): boolean {
  if (tx < 0 || ty < 0) return false;
  if (tx + footprint > map.width || ty + footprint > map.height) return false;

  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  return true;
}

/**
 * Build a set of tiles occupied by structures that reserve building spacing:
 * HQ footprint, completed building footprints, and construction site footprints.
 * Resources and builders are NOT included — they block the footprint
 * itself (via buildOccupiedTileSet) but do not reserve spacing perimeter.
 * Decor is entirely non-blocking and is not included in either set.
 */
export function buildBuildingTileSet(map: MapData): Set<string> {
  const tiles = new Set<string>();

  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      tiles.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
    }
  }

  for (const building of map.buildings) {
    markFootprintOccupied(tiles, building.tx, building.ty, getBuildingFootprint(building.type));
  }
  for (const site of map.constructionSites) {
    markFootprintOccupied(tiles, site.tx, site.ty, getBuildingFootprint(site.type));
  }

  return tiles;
}

/**
 * Check whether a building of the given footprint can be placed at (tx, ty)
 * with a spacing buffer around it.
 *
 * Rules:
 * 1. The actual footprint must be inside map bounds.
 * 2. No footprint tile may be in the `occupied` set (all objects block the footprint).
 * 3. The expanded perimeter rectangle (tx-spacing .. tx+footprint+spacing-1,
 *    ty-spacing .. ty+footprint+spacing-1) must not overlap any tile from
 *    `buildBuildingTileSet` (HQ, completed buildings, construction sites).
 *    Out-of-bounds perimeter cells are silently ignored.
 *    Resources and builders do NOT block the spacing perimeter.
 *    Decor is non-blocking and does not appear in the occupied set at all.
 */
export function isFootprintWithSpacingBuildable(
  map: MapData,
  occupied: ReadonlySet<string>,
  tx: number,
  ty: number,
  footprint: number,
  spacing: number = 1,
): boolean {
  // 1. Footprint inside map bounds
  if (tx < 0 || ty < 0) return false;
  if (tx + footprint > map.width || ty + footprint > map.height) return false;

  // 2. No footprint tile may be occupied (any object blocks the footprint)
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      if (occupied.has(`${tx + dx},${ty + dy}`)) return false;
    }
  }

  // 3. Spacing perimeter — only HQ/buildings/construction-sites matter
  const buildingTiles = buildBuildingTileSet(map);
  const perimMinX = tx - spacing;
  const perimMinY = ty - spacing;
  const perimMaxX = tx + footprint + spacing - 1;
  const perimMaxY = ty + footprint + spacing - 1;

  for (let py = perimMinY; py <= perimMaxY; py++) {
    for (let px = perimMinX; px <= perimMaxX; px++) {
      // Ignore out-of-bounds perimeter cells
      if (px < 0 || py < 0 || px >= map.width || py >= map.height) continue;
      // Skip tiles inside the actual footprint (already validated in step 2)
      if (px >= tx && px < tx + footprint && py >= ty && py < ty + footprint) continue;
      // Reject if this perimeter cell overlaps a building-type tile
      if (buildingTiles.has(`${px},${py}`)) return false;
    }
  }

  return true;
}

function markFootprintOccupied(occupied: Set<string>, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      occupied.add(`${tx + dx},${ty + dy}`);
    }
  }
}
