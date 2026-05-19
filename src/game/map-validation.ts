/**
 * Map validation and passability helpers.
 *
 * Pure functions — no mutation, no DOM. Used by mapgen to validate generated
 * maps and by construction to check placement feasibility.
 *
 * IMPORTANT: Runtime pathfinding (A* / JPS / etc.) is NOT implemented here.
 * Movement validation uses straight-line checks that match the current
 * harvester movement model. If real pathfinding becomes necessary, this
 * module should be extended, not bypassed.
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

// ── Straight-line walkability ────────────────────────────────────────

/**
 * Check whether a straight line from (fromTx, fromTy) to (toTx, toTy)
 * is clear of obstacle-blocked tiles.
 *
 * This uses a DDA-style traversal to sample every tile the line crosses.
 * It does NOT check buildings, HQ, or resources — only obstacles.
 * This is intentionally narrow: it validates that the current straight-line
 * harvester movement model can traverse between two points without hitting
 * an obstacle.
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

// ── Full map validation ──────────────────────────────────────────────

/**
 * Validate a generated map. Returns a MapValidationReport.
 *
 * Checks:
 * 1. Start core zone is not blocked by obstacles.
 * 2. Starting units have valid spawn cells (already ensured by mapgen).
 * 3. At least one small/medium starter resource is reachable from HQ via straight line.
 * 4. Map center is reachable from HQ center via straight line clear of obstacles.
 * 5. Infinite mineral is reachable from HQ center via straight line.
 * 6. No resource overlaps an obstacle.
 * 7. No obstacle cluster fully encloses start or center (approximated by straight-line checks).
 */
export function validateMap(map: MapData, seed: number, rejectedClusters: number = 0): MapValidationReport {
  const warnings: string[] = [];
  const errors: string[] = [];

  const hqCx = map.hq.tx + HQ_FOOTPRINT / 2;
  const hqCy = map.hq.ty + HQ_FOOTPRINT / 2;
  const mapCx = Math.floor(map.width / 2);
  const mapCy = Math.floor(map.height / 2);

  // 1. Start core zone blocked tiles
  const startCoreBlockedTiles = countStartZoneBlockedTiles(map);
  if (startCoreBlockedTiles > 0) {
    errors.push(`Start core zone has ${startCoreBlockedTiles} obstacle-blocked tile(s)`);
  }

  // 2. Starter resources reachable (straight line from HQ center)
  const starterResources = map.resources.filter(
    (r) => r.type === 'small' || r.type === 'medium',
  );
  let reachableStarterResources = 0;
  for (const r of starterResources) {
    if (isStraightLineClearOfObstacles(map.obstacles, Math.floor(hqCx), Math.floor(hqCy), r.tx, r.ty, map.width, map.height)) {
      reachableStarterResources++;
    }
  }
  if (reachableStarterResources === 0 && starterResources.length > 0) {
    errors.push('No starter resources are reachable from HQ via straight line');
  } else if (reachableStarterResources < starterResources.length) {
    warnings.push(`Only ${reachableStarterResources}/${starterResources.length} starter resources reachable from HQ via straight line`);
  }

  // 3. Center reachable
  const centerReachable = isStraightLineClearOfObstacles(
    map.obstacles,
    Math.floor(hqCx),
    Math.floor(hqCy),
    mapCx,
    mapCy,
    map.width,
    map.height,
  );
  if (!centerReachable) {
    errors.push('Map center is not reachable from HQ via straight line');
  }

  // 4. Infinite mineral reachable (check any tile of infinite footprint)
  const infiniteResources = map.resources.filter((r) => r.type === 'infinite');
  let infiniteReachable = false;
  for (const r of infiniteResources) {
    // Check if any tile of the infinite footprint is reachable from HQ
    for (let dy = 0; dy < r.footprint && !infiniteReachable; dy++) {
      for (let dx = 0; dx < r.footprint && !infiniteReachable; dx++) {
        if (isStraightLineClearOfObstacles(map.obstacles, Math.floor(hqCx), Math.floor(hqCy), r.tx + dx, r.ty + dy, map.width, map.height)) {
          infiniteReachable = true;
        }
      }
    }
  }
  if (!infiniteReachable && infiniteResources.length > 0) {
    errors.push('Infinite mineral is not reachable from HQ via straight line');
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
    warnings,
    errors,
  };
}
