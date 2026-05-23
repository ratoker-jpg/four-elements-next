/**
 * Map validation and passability helpers.
 *
 * Pure functions — no mutation, no DOM. Used by mapgen to validate generated
 * maps and by construction to check placement feasibility.
 *
 * VALIDATION-BFS-01: Reachability checks use BFS/flood-fill on the
 * passability grid instead of straight-line obstacle checks. This ensures
 * validation is consistent with the runtime passability model.
 *
 * The old isStraightLineClearOfObstacles() is still exported for backward
 * compatibility (used as a conservative precheck in mapgen obstacle cluster
 * placement) but is DEPRECATED for map validation purposes.
 */

import type { MapData, ObstaclePlacement } from './map-types.js';
import { HQ_FOOTPRINT, START_CORE_RADIUS } from '../core/constants.js';

// ── Validation report ────────────────────────────────────────────────

export interface MapValidationReport {
  ok: boolean;
  seed: number;
  mapWidth: number;
  mapHeight: number;
  reachableStarterResources: number;
  centerReachable: boolean;
  infiniteReachable: boolean;
  startCoreBlockedTiles: number;
  rejectedClusters: number;
  /** Reachability method used for validation. Always 'bfs' since VALIDATION-BFS-01. */
  reachabilityMethod: 'bfs';
  warnings: string[];
  errors: string[];
}

// ── Passability grid ─────────────────────────────────────────────────

/** Build a 2D passability grid. `true` = passable, `false` = blocked. */
export function buildPassabilityMap(map: MapData): boolean[][] {
  const grid: boolean[][] = Array.from({ length: map.height }, () =>
    Array(map.width).fill(true) as boolean[],
  );

  // Mark HQ footprint as blocked
  for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
    for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
      const tx = map.hq.tx + dx;
      const ty = map.hq.ty + dy;
      if (tx < map.width && ty < map.height) {
        grid[ty]![tx] = false;
      }
    }
  }

  // Mark building footprints as blocked
  for (const building of map.buildings) {
    markBuildingBlocked(grid, building.tx, building.ty, 2, map.width, map.height);
  }

  // Mark construction site footprints as blocked
  for (const site of map.constructionSites) {
    markBuildingBlocked(grid, site.tx, site.ty, 2, map.width, map.height);
  }

  // Mark obstacle footprints as blocked
  for (const obstacle of map.obstacles) {
    markBuildingBlocked(grid, obstacle.tx, obstacle.ty, obstacle.footprint, map.width, map.height);
  }

  // Resources block their footprint tiles
  for (const resource of map.resources) {
    for (let dy = 0; dy < resource.footprint; dy++) {
      for (let dx = 0; dx < resource.footprint; dx++) {
        const rx = resource.tx + dx;
        const ry = resource.ty + dy;
        if (rx < map.width && ry < map.height) {
          grid[ry]![rx] = false;
        }
      }
    }
  }

  return grid;
}

function markBuildingBlocked(
  grid: boolean[][],
  tx: number,
  ty: number,
  footprint: number,
  mapWidth: number,
  mapHeight: number,
): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      const x = tx + dx;
      const y = ty + dy;
      if (x < mapWidth && y < mapHeight) {
        grid[y]![x] = false;
      }
    }
  }
}

// ── Tile-level queries ───────────────────────────────────────────────

/** Check whether a single tile is passable according to the passability map. */
export function isTilePassable(passability: boolean[][], tx: number, ty: number): boolean {
  if (ty < 0 || ty >= passability.length) return false;
  if (tx < 0 || tx >= passability[0]!.length) return false;
  return passability[ty]![tx]!;
}

/**
 * Check whether a tile is blocked by an obstacle specifically.
 * Useful for distinguishing obstacle-blocked tiles from building/HQ-blocked tiles.
 */
export function isTileBlockedByObstacle(
  obstacles: readonly ObstaclePlacement[],
  tx: number,
  ty: number,
): boolean {
  for (const obs of obstacles) {
    for (let dy = 0; dy < obs.footprint; dy++) {
      for (let dx = 0; dx < obs.footprint; dx++) {
        if (obs.tx + dx === tx && obs.ty + dy === ty) {
          return true;
        }
      }
    }
  }
  return false;
}

// ── Straight-line walkability (DEPRECATED for validation) ────────────

/**
 * Check whether a straight line from (fromTx, fromTy) to (toTx, toTy)
 * is clear of obstacle-blocked tiles.
 *
 * DEPRECATED for map validation. Use BFS reachability instead.
 * Still used as a conservative precheck in mapgen obstacle cluster placement
 * to avoid expensive BFS on every cluster candidate.
 *
 * This uses a DDA-style traversal to sample every tile the line crosses.
 * It does NOT check buildings, HQ, or resources — only obstacles.
 *
 * Returns true if no obstacle blocks the straight-line path.
 */
export function isStraightLineClearOfObstacles(
  obstacles: readonly ObstaclePlacement[],
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
  mapWidth: number,
  mapHeight: number,
): boolean {
  // Build a set of obstacle-blocked tile keys for O(1) lookup
  const blocked = new Set<string>();
  for (const obs of obstacles) {
    for (let dy = 0; dy < obs.footprint; dy++) {
      for (let dx = 0; dx < obs.footprint; dx++) {
        blocked.add(`${obs.tx + dx},${obs.ty + dy}`);
      }
    }
  }

  // Walk the line using DDA and check each tile
  const dx = toTx - fromTx;
  const dy = toTy - fromTy;
  const steps = Math.max(Math.abs(dx), Math.abs(dy));
  if (steps === 0) return true;

  const stepX = dx / steps;
  const stepY = dy / steps;

  for (let i = 0; i <= steps; i++) {
    const cx = Math.round(fromTx + stepX * i);
    const cy = Math.round(fromTy + stepY * i);
    if (cx < 0 || cy < 0 || cx >= mapWidth || cy >= mapHeight) continue;
    if (blocked.has(`${cx},${cy}`)) return false;
  }

  return true;
}

// ── Start zone helpers ───────────────────────────────────────────────

/** Count tiles blocked by obstacles inside the start core zone around HQ. */
export function countStartZoneBlockedTiles(map: MapData): number {
  let count = 0;
  for (let dy = -START_CORE_RADIUS; dy <= START_CORE_RADIUS; dy++) {
    for (let dx = -START_CORE_RADIUS; dx <= START_CORE_RADIUS; dx++) {
      const tx = map.hq.tx + HQ_FOOTPRINT / 2 + dx;
      const ty = map.hq.ty + HQ_FOOTPRINT / 2 + dy;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      if (isTileBlockedByObstacle(map.obstacles, Math.floor(tx), Math.floor(ty))) {
        count++;
      }
    }
  }
  return count;
}

// ── BFS/flood-fill reachability ──────────────────────────────────────

/** 4-way cardinal neighbor offsets for BFS (N, E, S, W). */
const BFS_NEIGHBORS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
];

/**
 * Compute the set of passable tiles reachable from any passable tile
 * adjacent to the HQ footprint.
 *
 * Uses 4-way BFS (flood-fill) on the passability grid.
 * Returns a Set of tile keys ("x,y") that are reachable from the start area.
 */
export function computeReachableSet(map: MapData, passability: boolean[][]): Set<string> {
  const reachable = new Set<string>();
  const queue: Array<{ tx: number; ty: number }> = [];

  // Seed the BFS with all passable tiles adjacent to the HQ footprint.
  // We check the ring of tiles around the HQ rectangle.
  for (let ty = map.hq.ty - 1; ty <= map.hq.ty + HQ_FOOTPRINT; ty++) {
    for (let tx = map.hq.tx - 1; tx <= map.hq.tx + HQ_FOOTPRINT; tx++) {
      // Only include tiles on the ring (not inside the footprint)
      const onRing =
        tx === map.hq.tx - 1
        || tx === map.hq.tx + HQ_FOOTPRINT
        || ty === map.hq.ty - 1
        || ty === map.hq.ty + HQ_FOOTPRINT;
      if (!onRing) continue;
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
      if (!passability[ty]![tx]!) continue;
      const key = `${tx},${ty}`;
      if (!reachable.has(key)) {
        reachable.add(key);
        queue.push({ tx, ty });
      }
    }
  }

  // BFS flood-fill
  let head = 0;
  while (head < queue.length) {
    const { tx, ty } = queue[head]!;
    head++;

    for (const { dx, dy } of BFS_NEIGHBORS) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) continue;
      const key = `${nx},${ny}`;
      if (reachable.has(key)) continue;
      if (!passability[ny]![nx]!) continue;
      reachable.add(key);
      queue.push({ tx: nx, ty: ny });
    }
  }

  return reachable;
}

/**
 * Check whether a footprint at (tx, ty) with the given size has at least
 * one adjacent passable tile that is in the reachable set.
 *
 * Adjacent means sharing a cardinal edge with the footprint rectangle.
 * The footprint tile itself does NOT need to be passable or reachable.
 */
export function isFootprintReachable(
  reachable: Set<string>,
  tx: number,
  ty: number,
  footprint: number,
  mapWidth: number,
  mapHeight: number,
  passability: boolean[][],
): boolean {
  // Top edge: y = ty - 1, x from tx to tx + footprint - 1
  for (let dx = 0; dx < footprint; dx++) {
    const x = tx + dx;
    const y = ty - 1;
    if (y >= 0 && x < mapWidth && passability[y]![x]! && reachable.has(`${x},${y}`)) {
      return true;
    }
  }

  // Right edge: x = tx + footprint, y from ty to ty + footprint - 1
  for (let dy = 0; dy < footprint; dy++) {
    const x = tx + footprint;
    const y = ty + dy;
    if (x < mapWidth && y >= 0 && y < mapHeight && passability[y]![x]! && reachable.has(`${x},${y}`)) {
      return true;
    }
  }

  // Bottom edge: y = ty + footprint, x from tx to tx + footprint - 1
  for (let dx = 0; dx < footprint; dx++) {
    const x = tx + dx;
    const y = ty + footprint;
    if (y < mapHeight && x >= 0 && x < mapWidth && passability[y]![x]! && reachable.has(`${x},${y}`)) {
      return true;
    }
  }

  // Left edge: x = tx - 1, y from ty to ty + footprint - 1
  for (let dy = 0; dy < footprint; dy++) {
    const x = tx - 1;
    const y = ty + dy;
    if (x >= 0 && y >= 0 && y < mapHeight && passability[y]![x]! && reachable.has(`${x},${y}`)) {
      return true;
    }
  }

  return false;
}

/**
 * Check whether any passable tile near a center point is in the reachable set.
 * Searches in a small area (2-tile radius) around the center point.
 * Used for center reachability where the exact center tile may be blocked
 * by mineral_infinite or other intended features.
 */
export function isAreaReachable(
  reachable: Set<string>,
  cx: number,
  cy: number,
  radius: number,
  mapWidth: number,
  mapHeight: number,
  passability: boolean[][],
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 0 || ty < 0 || tx >= mapWidth || ty >= mapHeight) continue;
      if (!passability[ty]![tx]!) continue;
      if (reachable.has(`${tx},${ty}`)) return true;
    }
  }
  return false;
}

// ── Full map validation ──────────────────────────────────────────────

/**
 * Validate a generated map. Returns a MapValidationReport.
 *
 * VALIDATION-BFS-01: Reachability uses BFS/flood-fill on the passability
 * grid, starting from passable tiles adjacent to HQ. This replaces the
 * old straight-line obstacle checks and provides validation consistent
 * with the runtime passability model.
 *
 * Checks:
 * 1. Start core zone is not blocked by obstacles.
 * 2. At least one small/medium starter resource is reachable via BFS.
 * 3. Center area is reachable via BFS (2-tile radius around exact center).
 * 4. Infinite mineral has at least one reachable adjacent passable tile via BFS.
 * 5. No resource footprint overlaps an obstacle.
 */
export function validateMap(map: MapData, seed: number, rejectedClusters: number = 0): MapValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  const mapCx = Math.floor(map.width / 2);
  const mapCy = Math.floor(map.height / 2);

  // 1. Start core zone blocked tiles
  const startCoreBlockedTiles = countStartZoneBlockedTiles(map);
  if (startCoreBlockedTiles > 0) {
    errors.push(`Start core zone has ${startCoreBlockedTiles} obstacle-blocked tile(s)`);
  }

  // Build passability grid and compute reachable set once
  const passability = buildPassabilityMap(map);
  const reachable = computeReachableSet(map, passability);

  // 2. Starter resources reachable via BFS (adjacent passable tile in reachable set)
  const starterResources = map.resources.filter(
    (r) => r.type === 'small' || r.type === 'medium',
  );
  let reachableStarterResources = 0;
  for (const r of starterResources) {
    if (isFootprintReachable(reachable, r.tx, r.ty, r.footprint, map.width, map.height, passability)) {
      reachableStarterResources++;
    }
  }
  if (reachableStarterResources === 0 && starterResources.length > 0) {
    errors.push('No starter resources are reachable from HQ (BFS)');
  } else if (reachableStarterResources < starterResources.length) {
    warnings.push(`Only ${reachableStarterResources}/${starterResources.length} starter resources reachable from HQ (BFS)`);
  }

  // 3. Center reachable via BFS (check area near center, not just exact center tile)
  const centerReachable = isAreaReachable(reachable, mapCx, mapCy, 2, map.width, map.height, passability);
  if (!centerReachable) {
    errors.push('Map center area is not reachable from HQ (BFS)');
  }

  // 4. Infinite mineral reachable via BFS (adjacent passable tile in reachable set)
  const infiniteResources = map.resources.filter((r) => r.type === 'infinite');
  let infiniteReachable = false;
  for (const r of infiniteResources) {
    if (isFootprintReachable(reachable, r.tx, r.ty, r.footprint, map.width, map.height, passability)) {
      infiniteReachable = true;
      break;
    }
  }
  if (!infiniteReachable && infiniteResources.length > 0) {
    errors.push('Infinite mineral is not reachable from HQ (BFS)');
  }

  // 5. No resource footprint overlaps obstacle
  const obstacleBlocked = new Set<string>();
  for (const obs of map.obstacles) {
    for (let dy = 0; dy < obs.footprint; dy++) {
      for (let dx = 0; dx < obs.footprint; dx++) {
        obstacleBlocked.add(`${obs.tx + dx},${obs.ty + dy}`);
      }
    }
  }
  for (const r of map.resources) {
    for (let dy = 0; dy < r.footprint; dy++) {
      for (let dx = 0; dx < r.footprint; dx++) {
        if (obstacleBlocked.has(`${r.tx + dx},${r.ty + dy}`)) {
          errors.push(`Resource at (${r.tx},${r.ty}) footprint tile (${r.tx + dx},${r.ty + dy}) overlaps an obstacle`);
        }
      }
    }
  }

  const ok = errors.length === 0;

  return {
    ok,
    seed,
    mapWidth: map.width,
    mapHeight: map.height,
    reachableStarterResources,
    centerReachable,
    infiniteReachable,
    startCoreBlockedTiles,
    rejectedClusters,
    reachabilityMethod: 'bfs',
    warnings,
    errors,
  };
}
