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
import { findAdjacentPassableTiles, isTileBlocked, clonePassabilityGrid, type PassabilityGrid } from './passability.js';
import { getPassabilityGrid } from './path-telemetry.js';
import { findPathToAdjacent } from './pathfinding.js';
import type { ResourceNodeState } from './harvesting.js';

export const BUILDER_CONTROL_COST = 1;
export const AUTO_BUILD_MAX_RADIUS = 15;

/** Builder movement speed in tiles per second. */
export const BUILDER_SPEED = 2.0;

/** Arrival threshold in tile-space distance. */
const ARRIVAL_THRESHOLD = 0.15;

/** Monotonically increasing site ID counter. */
let nextSiteId = 1;

/** Reset the site ID counter (for tests). */
export function resetSiteIdCounter(): void {
  nextSiteId = 1;
}

export type ConstructionFailureReason = 'busy' | 'insufficient-matter' | 'no-placement' | 'no-route' | 'path-blocked';

export interface ConstructionCommandResult {
  ok: boolean;
  reason?: ConstructionFailureReason;
  buildingType: BuildingType;
  site?: ConstructionSitePlacement;
}

/** Info about a construction site that was cancelled during a tick. */
export interface CancelledSiteInfo {
  type: BuildingType;
  reason: string;
}

export interface ConstructionTickResult {
  completedBuildings: BuildingPlacement[];
  cancelledSites: CancelledSiteInfo[];
}

export function startConstruction(
  map: MapData,
  economy: EconomyState,
  buildingType: BuildingType,
  resourceNodes?: readonly ResourceNodeState[],
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
    const result = findAutoPlacement(map, builder, buildingType, resourceNodes);
    if (result.hasUnreachableSite) anyUnreachableSite = true;
    if (result.placement) {
      economy.resources.matter -= definition.costMatter;
      builder.busy = true;

      // Get path to the site (reuse reachability computation)
      const pathResult = findPathToSite(map, builder, result.placement.tx, result.placement.ty, buildingType, resourceNodes);

      // Determine the final adjacent tile (last waypoint or current position)
      const isAdjacent = pathResult.path.length === 0 && pathResult.found;
      const lastWaypoint = pathResult.path.length > 0
        ? pathResult.path[pathResult.path.length - 1]!
        : { tx: builder.tx, ty: builder.ty };

      const siteId = nextSiteId++;

      // If builder is already adjacent, site starts non-pending and builder goes to building
      const pending = !isAdjacent;

      const site: ConstructionSitePlacement = {
        tx: result.placement.tx,
        ty: result.placement.ty,
        type: buildingType,
        elapsed: 0,
        duration: definition.buildTimeSeconds,
        progress: 0,
        builderIndex,
        id: siteId,
        pending,
      };
      map.constructionSites.push(site);

      // Assign builder state
      builder.assignedSiteId = siteId;
      builder.path = pathResult.path;
      builder.pathIndex = 0;
      builder.targetTx = lastWaypoint.tx;
      builder.targetTy = lastWaypoint.ty;

      if (isAdjacent) {
        // Builder already adjacent — start building immediately
        builder.phase = 'building';
        builder.ftx = builder.tx + 0.5;
        builder.fty = builder.ty + 0.5;
      } else {
        builder.phase = 'moving-to-site';
        builder.ftx = builder.tx + 0.5;
        builder.fty = builder.ty + 0.5;
      }

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

export function tickConstruction(map: MapData, economy: EconomyState, dt: number, resourceNodes?: readonly ResourceNodeState[]): ConstructionTickResult {
  const completedBuildings: BuildingPlacement[] = [];
  const cancelledSites: CancelledSiteInfo[] = [];

  for (let index = map.constructionSites.length - 1; index >= 0; index--) {
    const site = map.constructionSites[index]!;
    const builder = map.builders[site.builderIndex];

    if (site.pending) {
      // Builder should be moving to the site
      if (builder && builder.phase === 'moving-to-site' && builder.assignedSiteId === site.id) {
        // Check if next waypoint is still passable
        if (builder.pathIndex < builder.path.length) {
          const grid = getPassabilityGrid(map, resourceNodes);
          const waypoint = builder.path[builder.pathIndex]!;
          if (isTileBlocked(grid, waypoint.tx, waypoint.ty)) {
            // Try one immediate repath
            const repathResult = tryRepath(map, builder, site, resourceNodes);
            if (!repathResult) {
              // Repath failed — cancel site, refund matter, free builder
              cancelledSites.push({ type: site.type, reason: 'path-blocked' });
              cancelSite(map, economy, site, builder, index);
              continue;
            }
          }
        }

        // Move builder along path
        if (followBuilderPath(builder, dt)) {
          // Builder arrived at adjacent tile
          builder.tx = builder.targetTx;
          builder.ty = builder.targetTy;
          builder.ftx = builder.tx + 0.5;
          builder.fty = builder.ty + 0.5;
          builder.phase = 'building';
          builder.path = [];
          builder.pathIndex = 0;
          site.pending = false;
        } else {
          // Update integer tile position when crossing into a new tile
          updateBuilderTilePosition(builder);
        }
      }
      // Pending site: do NOT advance elapsed/progress
      continue;
    }

    // Non-pending site: advance construction progress
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
    if (builder) {
      resetBuilderToIdle(builder);
    }

    map.constructionSites.splice(index, 1);
  }

  return { completedBuildings, cancelledSites };
}

/**
 * Cancel a construction site: refund matter, free builder, remove site from array.
 */
function cancelSite(
  map: MapData,
  economy: EconomyState,
  site: ConstructionSitePlacement,
  builder: BuilderPlacement,
  siteIndex: number,
): void {
  const definition = BUILDING_DEFINITIONS[site.type];
  economy.resources.matter = Math.min(
    economy.resources.matter + definition.costMatter,
    economy.resources.matterCap,
  );
  resetBuilderToIdle(builder);
  map.constructionSites.splice(siteIndex, 1);
}

/**
 * Reset a builder to the idle state.
 */
function resetBuilderToIdle(builder: BuilderPlacement): void {
  builder.busy = false;
  builder.phase = 'idle';
  builder.path = [];
  builder.pathIndex = 0;
  builder.targetTx = builder.tx;
  builder.targetTy = builder.ty;
  builder.assignedSiteId = -1;
}

/**
 * Try to repath the builder to the assigned site's adjacent tile.
 * Returns true if repath succeeded, false otherwise.
 * On success, replaces builder.path and builder.pathIndex.
 */
function tryRepath(
  map: MapData,
  builder: BuilderPlacement,
  site: ConstructionSitePlacement,
  resourceNodes?: readonly ResourceNodeState[],
): boolean {
  const footprint = getBuildingFootprint(site.type);
  // Clone the cached grid before mutating it with markGridBlocked.
  // This avoids contaminating the passability cache with temporary mutations.
  const grid = clonePassabilityGrid(getPassabilityGrid(map, resourceNodes));
  // Temporarily block the site footprint on the grid
  markGridBlocked(grid, site.tx, site.ty, footprint);

  const pathResult = findPathToAdjacent(grid, builder.tx, builder.ty, site.tx, site.ty, footprint);
  if (!pathResult.found) {
    return false;
  }

  builder.path = pathResult.path;
  builder.pathIndex = 0;
  if (pathResult.path.length > 0) {
    const last = pathResult.path[pathResult.path.length - 1]!;
    builder.targetTx = last.tx;
    builder.targetTy = last.ty;
  }
  return true;
}

/**
 * Move builder along the current path by BUILDER_SPEED * dt.
 * Returns true when the path is complete (all waypoints visited).
 */
function followBuilderPath(builder: BuilderPlacement, dt: number): boolean {
  if (builder.pathIndex >= builder.path.length) {
    return true; // already at destination or empty path
  }

  const waypoint = builder.path[builder.pathIndex]!;
  const targetTx = waypoint.tx + 0.5; // tile center
  const targetTy = waypoint.ty + 0.5;

  if (moveBuilderToward(builder, targetTx, targetTy, dt)) {
    // Arrived at this waypoint — advance to next
    builder.pathIndex++;
    // If no more waypoints, path is complete
    return builder.pathIndex >= builder.path.length;
  }

  return false;
}

/**
 * Move builder toward target by BUILDER_SPEED * dt.
 * Returns true if arrived (within ARRIVAL_THRESHOLD).
 */
function moveBuilderToward(
  builder: BuilderPlacement,
  targetTx: number,
  targetTy: number,
  dt: number,
): boolean {
  const dx = targetTx - builder.ftx;
  const dy = targetTy - builder.fty;
  const dist = Math.hypot(dx, dy);

  if (dist <= ARRIVAL_THRESHOLD) return true;

  const step = BUILDER_SPEED * dt;
  if (dist <= step) {
    builder.ftx = targetTx;
    builder.fty = targetTy;
    return true;
  }

  builder.ftx += (dx / dist) * step;
  builder.fty += (dy / dist) * step;
  return false;
}

/**
 * Update integer tile position from floating-point position.
 * Called during movement to keep tx/ty in sync with ftx/fty.
 */
function updateBuilderTilePosition(builder: BuilderPlacement): void {
  const newTx = Math.floor(builder.ftx);
  const newTy = Math.floor(builder.fty);
  if (newTx !== builder.tx || newTy !== builder.ty) {
    builder.tx = newTx;
    builder.ty = newTy;
  }
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
  resourceNodes?: readonly ResourceNodeState[],
  maxRadius: number = AUTO_BUILD_MAX_RADIUS,
): AutoPlacementResult {
  const occupied = buildOccupiedTileSet(map, resourceNodes);
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
        if (!isSiteReachableByBuilder(map, builder, tx, ty, footprint, resourceNodes)) {
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
 * Result of a path query to a construction site.
 * Includes the path and the target adjacent tile.
 */
export interface PathToSiteResult {
  found: boolean;
  path: Array<{ tx: number; ty: number }>;
  targetAdjacentTx: number;
  targetAdjacentTy: number;
}

/**
 * Find a path from the builder to an adjacent passable tile of the site.
 * Also returns the target adjacent tile coordinates.
 * The candidate site footprint is treated as blocked during the path query.
 */
export function findPathToSite(
  map: MapData,
  builder: BuilderPlacement,
  siteTx: number,
  siteTy: number,
  buildingType: BuildingType,
  resourceNodes?: readonly ResourceNodeState[],
): PathToSiteResult {
  const footprint = getBuildingFootprint(buildingType);
  // Clone the cached grid before mutating it with markGridBlocked.
  // This avoids contaminating the passability cache with temporary mutations.
  const grid = clonePassabilityGrid(getPassabilityGrid(map, resourceNodes));
  // Temporarily block the candidate footprint on the grid
  markGridBlocked(grid, siteTx, siteTy, footprint);

  // Find adjacent passable tiles (after blocking the candidate)
  const adjacentTiles = findAdjacentPassableTiles(grid, siteTx, siteTy, footprint);
  if (adjacentTiles.length === 0) {
    return { found: false, path: [], targetAdjacentTx: 0, targetAdjacentTy: 0 };
  }

  // Check if builder is already on an adjacent tile
  for (const adj of adjacentTiles) {
    if (builder.tx === adj.tx && builder.ty === adj.ty) {
      return { found: true, path: [], targetAdjacentTx: adj.tx, targetAdjacentTy: adj.ty };
    }
  }

  // Use BFS to find path to any adjacent tile
  const pathResult = findPathToAdjacent(grid, builder.tx, builder.ty, siteTx, siteTy, footprint);
  if (!pathResult.found) {
    return { found: false, path: [], targetAdjacentTx: 0, targetAdjacentTy: 0 };
  }

  // Determine target adjacent tile from path
  const lastWaypoint = pathResult.path.length > 0
    ? pathResult.path[pathResult.path.length - 1]!
    : { tx: builder.tx, ty: builder.ty };

  return {
    found: true,
    path: pathResult.path,
    targetAdjacentTx: lastWaypoint.tx,
    targetAdjacentTy: lastWaypoint.ty,
  };
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
  resourceNodes?: readonly ResourceNodeState[],
): boolean {
  // Clone the cached grid before mutating it with markGridBlocked.
  // This avoids contaminating the passability cache with temporary mutations.
  const grid = clonePassabilityGrid(getPassabilityGrid(map, resourceNodes));
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

export function buildOccupiedTileSet(map: MapData, resourceNodes?: readonly ResourceNodeState[]): Set<string> {
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
  for (let i = 0; i < map.resources.length; i++) {
    const resource = map.resources[i]!;
    // Depleted finite resources no longer block construction placement
    if (resourceNodes) {
      const node = resourceNodes[i];
      if (node && !node.infinite && node.remaining <= 0) continue;
    }
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
