/**
 * Runtime passability grid for current MapData.
 *
 * Blocking rules:
 * - Out of bounds = blocked
 * - HQ footprint blocks
 * - Completed buildings block
 * - Construction sites block
 * - Obstacles block by footprint
 * - Resources block by footprint (including mineral_infinite 3x3)
 * - Decor does NOT block
 * - Territory does NOT block
 * - Units/builders/harvesters do NOT block in this MVP
 *
 * This module is the foundation for runtime pathfinding (PR1).
 * It does NOT change any existing gameplay behavior.
 */

import type { MapData } from '../game/map-types.js';
import { HQ_FOOTPRINT } from '../core/constants.js';
import { getBuildingFootprint } from '../config/buildings.js';
import type { ResourceNodeState } from './harvesting.js';

// ── PassabilityGrid type ─────────────────────────────────────────────

/**
 * Runtime passability grid backed by a flat Uint8Array.
 *
 * Layout: row-major, index = y * width + x.
 * Cell values: 0 = passable, 1 = blocked.
 */
export interface PassabilityGrid {
  readonly width: number;
  readonly height: number;
  /** Flat Uint8Array, row-major. 0 = passable, 1 = blocked. */
  readonly cells: Uint8Array;
}

// ── Grid builder ──────────────────────────────────────────────────────

/**
 * Build a runtime passability grid from the current MapData.
 *
 * Applies all blocking rules listed in the module docstring.
 * Decor and territory are intentionally NOT represented as blocking.
 * Units are NOT blocking in this MVP to avoid dynamic rebuilds every tick.
 */
export function buildPassabilityGrid(map: MapData, resourceNodes?: readonly ResourceNodeState[]): PassabilityGrid {
  const { width, height } = map;
  const cells = new Uint8Array(width * height);

  /** Mark a footprint rectangle as blocked. Clamps to grid bounds. */
  const markBlocked = (tx: number, ty: number, footprint: number): void => {
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        const x = tx + dx;
        const y = ty + dy;
        if (x >= 0 && x < width && y >= 0 && y < height) {
          cells[y * width + x] = 1;
        }
      }
    }
  };

  // HQ footprint blocks
  markBlocked(map.hq.tx, map.hq.ty, HQ_FOOTPRINT);

  // Completed buildings block
  for (const building of map.buildings) {
    markBlocked(building.tx, building.ty, getBuildingFootprint(building.type));
  }

  // Construction sites block
  for (const site of map.constructionSites) {
    markBlocked(site.tx, site.ty, getBuildingFootprint(site.type));
  }

  // Obstacles block by footprint
  for (const obstacle of map.obstacles) {
    markBlocked(obstacle.tx, obstacle.ty, obstacle.footprint);
  }

  // Resources block by footprint (including mineral_infinite 3x3)
  // Depleted finite resources no longer block passability
  for (let i = 0; i < map.resources.length; i++) {
    const resource = map.resources[i]!;
    if (resourceNodes) {
      const node = resourceNodes[i];
      if (node && !node.infinite && node.remaining <= 0) continue;
    }
    markBlocked(resource.tx, resource.ty, resource.footprint);
  }

  // Decor does NOT block (bush, sand-bump)
  // Territory does NOT block (ownership layer, not physical)
  // Units/builders/harvesters do NOT block in this MVP

  return { width, height, cells };
}

// ── Tile queries ──────────────────────────────────────────────────────

/**
 * Check whether a tile is blocked.
 * Out-of-bounds coordinates are always blocked.
 */
export function isTileBlocked(grid: PassabilityGrid, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= grid.width || ty >= grid.height) return true;
  return grid.cells[ty * grid.width + tx] === 1;
}

/**
 * Check whether a tile is passable.
 * Out-of-bounds coordinates are never passable.
 */
export function isTilePassable(grid: PassabilityGrid, tx: number, ty: number): boolean {
  return !isTileBlocked(grid, tx, ty);
}

// ── Adjacent passable tiles ──────────────────────────────────────────

/**
 * Find all passable tiles adjacent (cardinal 4-way) to the outside of a
 * footprint rectangle.
 *
 * The footprint occupies tiles from (tx, ty) to (tx + footprint - 1, ty + footprint - 1).
 * Adjacent means sharing a cardinal edge with the footprint rectangle.
 * Corner tiles (diagonal to footprint corners) are NOT included.
 *
 * Return order is deterministic:
 *   top edge left→right, right edge top→bottom,
 *   bottom edge left→right, left edge top→bottom.
 *
 * Out-of-bounds and blocked tiles are excluded from the result.
 */
export function findAdjacentPassableTiles(
  grid: PassabilityGrid,
  tx: number,
  ty: number,
  footprint: number,
): Array<{ tx: number; ty: number }> {
  const result: Array<{ tx: number; ty: number }> = [];

  // Top edge: y = ty - 1, x from tx to tx + footprint - 1
  for (let dx = 0; dx < footprint; dx++) {
    const x = tx + dx;
    const y = ty - 1;
    if (isTilePassable(grid, x, y)) {
      result.push({ tx: x, ty: y });
    }
  }

  // Right edge: x = tx + footprint, y from ty to ty + footprint - 1
  for (let dy = 0; dy < footprint; dy++) {
    const x = tx + footprint;
    const y = ty + dy;
    if (isTilePassable(grid, x, y)) {
      result.push({ tx: x, ty: y });
    }
  }

  // Bottom edge: y = ty + footprint, x from tx to tx + footprint - 1
  for (let dx = 0; dx < footprint; dx++) {
    const x = tx + dx;
    const y = ty + footprint;
    if (isTilePassable(grid, x, y)) {
      result.push({ tx: x, ty: y });
    }
  }

  // Left edge: x = tx - 1, y from ty to ty + footprint - 1
  for (let dy = 0; dy < footprint; dy++) {
    const x = tx - 1;
    const y = ty + dy;
    if (isTilePassable(grid, x, y)) {
      result.push({ tx: x, ty: y });
    }
  }

  return result;
}
