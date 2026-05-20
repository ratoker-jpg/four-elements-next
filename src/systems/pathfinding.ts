/**
 * Deterministic pathfinding on a PassabilityGrid.
 *
 * PR1 implementation: BFS on unweighted 4-way cardinal grid.
 *
 * Why BFS instead of A*:
 * - All moves have equal cost (unweighted grid), so BFS produces optimal shortest paths.
 * - BFS is inherently deterministic with fixed neighbor order.
 * - For 64x64 maps (4096 tiles), BFS completes in well under 1 ms.
 * - No heuristic tuning required; zero risk of non-optimality from heuristic.
 *
 * Movement model: 4-way cardinal (N, E, S, W) only.
 * Diagonal movement is NOT included in PR1 because:
 * - Diagonal movement on a grid can cause corner-cutting through blocked tiles
 *   (a diagonal move between two blocked tiles is geometrically invalid).
 * - Adding diagonal movement with proper corner-cutting checks is deferred
 *   to a future PR if gameplay requires it.
 * - This decision is documented here so future changes can be evaluated consciously.
 *
 * All path coordinates are tile-integers. Floating tile positions are NOT used
 * in PR1 pathfinding; path consumers (movement systems) are responsible for
 * any sub-tile positioning.
 */

import type { PassabilityGrid } from './passability.js';
import { isTileBlocked, findAdjacentPassableTiles } from './passability.js';

// ── Result types ──────────────────────────────────────────────────────

/** Result of a pathfinding query. */
export interface PathResult {
  /** Whether a valid path was found. */
  found: boolean;
  /**
   * Sequence of tile positions from start (exclusive) to target (inclusive).
   * Empty when start equals target and found is true.
   */
  path: Array<{ tx: number; ty: number }>;
  /** Reason when found is false. Undefined when found is true. */
  reason?: 'unreachable' | 'budget-exceeded' | 'blocked-start' | 'blocked-target';
  /** Total path cost in tile steps. 0 when start equals target. */
  cost: number;
}

/** Options for pathfinding queries. */
export interface PathfindingOptions {
  /** Maximum number of nodes to explore before giving up. Default: width * height * 2. */
  maxVisited?: number;
}

// ── Constants ─────────────────────────────────────────────────────────

/**
 * 4-way neighbor offsets in deterministic order: N, E, S, W.
 * This order ensures BFS explores tiles in a consistent, repeatable sequence,
 * which makes path results deterministic across runs.
 */
const NEIGHBOR_OFFSETS: ReadonlyArray<{ dx: number; dy: number }> = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
];

// ── findPath ──────────────────────────────────────────────────────────

/**
 * Find a shortest path from (fromTx, fromTy) to (toTx, toTy) on the grid.
 *
 * Behavior:
 * - Deterministic neighbor order (N, E, S, W).
 * - No path through blocked tiles.
 * - Out-of-bounds handled safely (always blocked).
 * - Unreachable returns found:false with reason 'unreachable'.
 * - Budget exceeded returns found:false with reason 'budget-exceeded'.
 * - Start equals target returns found:true with empty path (if start is passable).
 * - Blocked start returns found:false with reason 'blocked-start'.
 * - Blocked target returns found:false with reason 'blocked-target'.
 * - Path never contains blocked tiles.
 * - Path is exclusive of start tile, inclusive of target tile.
 */
export function findPath(
  grid: PassabilityGrid,
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
  options?: PathfindingOptions,
): PathResult {
  // Start equals target
  if (fromTx === toTx && fromTy === toTy) {
    if (isTileBlocked(grid, fromTx, fromTy)) {
      return { found: false, path: [], reason: 'blocked-start', cost: 0 };
    }
    return { found: true, path: [], cost: 0 };
  }

  // Check start passable
  if (isTileBlocked(grid, fromTx, fromTy)) {
    return { found: false, path: [], reason: 'blocked-start', cost: 0 };
  }

  // Check target passable
  if (isTileBlocked(grid, toTx, toTy)) {
    return { found: false, path: [], reason: 'blocked-target', cost: 0 };
  }

  const maxVisited = options?.maxVisited ?? grid.width * grid.height * 2;
  return bfs(grid, fromTx, fromTy, toTx, toTy, maxVisited);
}

// ── findPathToAdjacent ────────────────────────────────────────────────

/**
 * Find a shortest path from (fromTx, fromTy) to any passable tile adjacent
 * (cardinal) to a footprint rectangle at (targetTx, targetTy).
 *
 * This is used when the target itself is blocked (e.g., a building, resource,
 * or obstacle) and the unit needs to stand next to it.
 *
 * If the start position is already an adjacent passable tile, returns
 * found:true with an empty path.
 */
export function findPathToAdjacent(
  grid: PassabilityGrid,
  fromTx: number,
  fromTy: number,
  targetTx: number,
  targetTy: number,
  targetFootprint: number,
  options?: PathfindingOptions,
): PathResult {
  // Check start passable
  if (isTileBlocked(grid, fromTx, fromTy)) {
    return { found: false, path: [], reason: 'blocked-start', cost: 0 };
  }

  // Get all adjacent passable tiles around the target footprint
  const adjacentTiles = findAdjacentPassableTiles(grid, targetTx, targetTy, targetFootprint);

  // No adjacent passable tiles at all
  if (adjacentTiles.length === 0) {
    return { found: false, path: [], reason: 'unreachable', cost: 0 };
  }

  // Check if start is already one of the adjacent tiles
  for (const adj of adjacentTiles) {
    if (fromTx === adj.tx && fromTy === adj.ty) {
      return { found: true, path: [], cost: 0 };
    }
  }

  const maxVisited = options?.maxVisited ?? grid.width * grid.height * 2;

  // BFS toward multiple targets
  return bfsMultiTarget(grid, fromTx, fromTy, adjacentTiles, maxVisited);
}

// ── Internal BFS implementations ──────────────────────────────────────

/** BFS to a single target tile. Returns PathResult. */
function bfs(
  grid: PassabilityGrid,
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
  maxVisited: number,
): PathResult {
  const { width, height } = grid;
  const totalTiles = width * height;

  // parent storage: -1 = unvisited, otherwise flat index of parent
  const parent = new Int32Array(totalTiles).fill(-1);

  // BFS queue as flat index array
  const queue: number[] = [];
  let queueHead = 0;
  let visitedCount = 0;

  const startIndex = fromTy * width + fromTx;
  parent[startIndex] = startIndex; // self-referencing = start marker
  queue.push(startIndex);
  visitedCount++;

  const targetIndex = toTy * width + toTx;

  while (queueHead < queue.length) {
    if (visitedCount > maxVisited) {
      return { found: false, path: [], reason: 'budget-exceeded', cost: 0 };
    }

    const currentIdx = queue[queueHead]!;
    queueHead++;

    if (currentIdx === targetIndex) {
      return reconstructPath(parent, startIndex, targetIndex, width);
    }

    const cx = currentIdx % width;
    const cy = (currentIdx - cx) / width; // exact integer division

    for (const { dx, dy } of NEIGHBOR_OFFSETS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (parent[nIdx] !== -1) continue; // already visited or queued
      if (grid.cells[nIdx] === 1) continue; // blocked
      parent[nIdx] = currentIdx;
      queue.push(nIdx);
      visitedCount++;
    }
  }

  return { found: false, path: [], reason: 'unreachable', cost: 0 };
}

/** BFS toward multiple target tiles. First reached wins. */
function bfsMultiTarget(
  grid: PassabilityGrid,
  fromTx: number,
  fromTy: number,
  targets: ReadonlyArray<{ tx: number; ty: number }>,
  maxVisited: number,
): PathResult {
  const { width, height } = grid;
  const totalTiles = width * height;

  const parent = new Int32Array(totalTiles).fill(-1);
  const queue: number[] = [];
  let queueHead = 0;
  let visitedCount = 0;

  // Build a set of target indices for O(1) lookup
  const targetSet = new Set<number>();
  for (const t of targets) {
    targetSet.add(t.ty * width + t.tx);
  }

  const startIndex = fromTy * width + fromTx;
  parent[startIndex] = startIndex;
  queue.push(startIndex);
  visitedCount++;

  while (queueHead < queue.length) {
    if (visitedCount > maxVisited) {
      return { found: false, path: [], reason: 'budget-exceeded', cost: 0 };
    }

    const currentIdx = queue[queueHead]!;
    queueHead++;

    if (targetSet.has(currentIdx)) {
      return reconstructPath(parent, startIndex, currentIdx, width);
    }

    const cx = currentIdx % width;
    const cy = (currentIdx - cx) / width;

    for (const { dx, dy } of NEIGHBOR_OFFSETS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (parent[nIdx] !== -1) continue;
      if (grid.cells[nIdx] === 1) continue;
      parent[nIdx] = currentIdx;
      queue.push(nIdx);
      visitedCount++;
    }
  }

  return { found: false, path: [], reason: 'unreachable', cost: 0 };
}

/** Reconstruct path from parent array. Path is exclusive of start, inclusive of target. */
function reconstructPath(
  parent: Int32Array,
  startIndex: number,
  targetIndex: number,
  width: number,
): PathResult {
  const path: Array<{ tx: number; ty: number }> = [];
  let idx = targetIndex;
  let cost = 0;

  while (idx !== startIndex) {
    path.push({ tx: idx % width, ty: (idx - (idx % width)) / width });
    idx = parent[idx]!;
    cost++;
  }

  // Reverse to get start→target order
  path.reverse();

  return { found: true, path, cost };
}
