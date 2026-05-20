import { describe, it, expect } from 'vitest';
import {
  findPath,
  findPathToAdjacent,
  type PathResult,
  type PathfindingOptions,
} from '../../src/systems/pathfinding.js';
import {
  buildPassabilityGrid,
  type PassabilityGrid,
} from '../../src/systems/passability.js';
import type { MapData } from '../../src/game/map-types.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';

// ── Test helpers ──────────────────────────────────────────────────────

/** Create a minimal MapData for pathfinding tests. */
function createMinimalMap(overrides: Partial<MapData> = {}): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
    hq: { tx: 4, ty: 4, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [{ tx: 3, ty: 4, busy: false }],
    constructionSites: [],
    ...overrides,
  };
}

/** Create an entirely empty grid (no blocked tiles). */
function createEmptyGrid(width: number = 10, height: number = 10): PassabilityGrid {
  return {
    width,
    height,
    cells: new Uint8Array(width * height),
  };
}

/** Set a tile as blocked in a grid. Mutates the grid's cells. */
function blockTile(grid: PassabilityGrid, tx: number, ty: number): void {
  grid.cells[ty * grid.width + tx] = 1;
}

/** Mark a rectangular footprint as blocked. */
function blockFootprint(grid: PassabilityGrid, tx: number, ty: number, footprint: number): void {
  for (let dy = 0; dy < footprint; dy++) {
    for (let dx = 0; dx < footprint; dx++) {
      blockTile(grid, tx + dx, ty + dy);
    }
  }
}

/** Check that a path is valid: starts near from, ends at to, no blocked tiles. */
function assertPathValid(
  grid: PassabilityGrid,
  result: PathResult,
  fromTx: number,
  fromTy: number,
  toTx: number,
  toTy: number,
): void {
  expect(result.found).toBe(true);
  expect(result.cost).toBe(result.path.length);

  if (result.path.length === 0) {
    // start equals target
    expect(fromTx).toBe(toTx);
    expect(fromTy).toBe(toTy);
    return;
  }

  // First step must be adjacent to start
  const first = result.path[0]!;
  const startDist = Math.abs(first.tx - fromTx) + Math.abs(first.ty - fromTy);
  expect(startDist).toBe(1);

  // Last step must be the target
  const last = result.path[result.path.length - 1]!;
  expect(last.tx).toBe(toTx);
  expect(last.ty).toBe(toTy);

  // All steps are adjacent
  for (let i = 1; i < result.path.length; i++) {
    const prev = result.path[i - 1]!;
    const curr = result.path[i]!;
    const dist = Math.abs(curr.tx - prev.tx) + Math.abs(curr.ty - prev.ty);
    expect(dist).toBe(1);
  }

  // No blocked tiles in the path
  for (const step of result.path) {
    expect(grid.cells[step.ty * grid.width + step.tx]).toBe(0);
  }
}

// ── findPath: straight path ───────────────────────────────────────────

describe('findPath: straight paths', () => {
  it('finds straight horizontal path on empty grid', () => {
    const grid = createEmptyGrid();
    const result = findPath(grid, 0, 5, 5, 5);
    assertPathValid(grid, result, 0, 5, 5, 5);
    expect(result.cost).toBe(5);
    // Should be a straight line: (1,5),(2,5),(3,5),(4,5),(5,5)
    expect(result.path).toEqual([
      { tx: 1, ty: 5 }, { tx: 2, ty: 5 }, { tx: 3, ty: 5 }, { tx: 4, ty: 5 }, { tx: 5, ty: 5 },
    ]);
  });

  it('finds straight vertical path on empty grid', () => {
    const grid = createEmptyGrid();
    const result = findPath(grid, 5, 0, 5, 5);
    assertPathValid(grid, result, 5, 0, 5, 5);
    expect(result.cost).toBe(5);
  });
});

// ── findPath: obstacle avoidance ──────────────────────────────────────

describe('findPath: obstacle avoidance', () => {
  it('finds path around one obstacle', () => {
    const grid = createEmptyGrid(10, 10);
    // Block (3,5) — directly on the straight line from (0,5) to (5,5)
    blockTile(grid, 3, 5);
    const result = findPath(grid, 0, 5, 5, 5);
    expect(result.found).toBe(true);
    // Path must avoid (3,5)
    expect(result.path.some((p) => p.tx === 3 && p.ty === 5)).toBe(false);
    assertPathValid(grid, result, 0, 5, 5, 5);
  });

  it('finds path around obstacle wall with gap', () => {
    const grid = createEmptyGrid(10, 10);
    // Wall of obstacles at x=5, y=0..9, with a gap at y=4
    for (let y = 0; y < 10; y++) {
      if (y === 4) continue; // gap
      blockTile(grid, 5, y);
    }
    const result = findPath(grid, 2, 7, 8, 7);
    expect(result.found).toBe(true);
    // Path must go through the gap at (5,4)
    expect(result.path.some((p) => p.tx === 5 && p.ty === 4)).toBe(true);
    assertPathValid(grid, result, 2, 7, 8, 7);
  });
});

// ── findPath: unreachable ─────────────────────────────────────────────

describe('findPath: unreachable', () => {
  it('returns unreachable when target is fully enclosed', () => {
    const grid = createEmptyGrid(10, 10);
    // Enclose (8,8) with walls
    blockTile(grid, 7, 7); blockTile(grid, 8, 7); blockTile(grid, 9, 7);
    blockTile(grid, 7, 8); blockTile(grid, 9, 8);
    blockTile(grid, 7, 9); blockTile(grid, 8, 9); blockTile(grid, 9, 9);
    // Start is outside
    const result = findPath(grid, 0, 0, 8, 8);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('unreachable');
  });
});

// ── findPath: budget exceeded ─────────────────────────────────────────

describe('findPath: budget exceeded', () => {
  it('returns budget-exceeded when maxVisited is too low', () => {
    const grid = createEmptyGrid(20, 20);
    // Set a very low budget
    const options: PathfindingOptions = { maxVisited: 3 };
    const result = findPath(grid, 0, 0, 19, 19, options);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('budget-exceeded');
  });
});

// ── findPath: start equals target ─────────────────────────────────────

describe('findPath: start equals target', () => {
  it('returns empty path when start equals target on passable tile', () => {
    const grid = createEmptyGrid();
    const result = findPath(grid, 5, 5, 5, 5);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(0);
  });
});

// ── findPath: blocked start/target ────────────────────────────────────

describe('findPath: blocked start and target', () => {
  it('returns blocked-start when start tile is blocked', () => {
    const grid = createEmptyGrid();
    blockTile(grid, 3, 3);
    const result = findPath(grid, 3, 3, 8, 8);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('blocked-start');
  });

  it('returns blocked-target when target tile is blocked', () => {
    const grid = createEmptyGrid();
    blockTile(grid, 8, 8);
    const result = findPath(grid, 0, 0, 8, 8);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('blocked-target');
  });

  it('returns blocked-start when start equals target and both are blocked', () => {
    const grid = createEmptyGrid();
    blockTile(grid, 5, 5);
    const result = findPath(grid, 5, 5, 5, 5);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('blocked-start');
  });
});

// ── findPath: path never contains blocked tiles ───────────────────────

describe('findPath: path integrity', () => {
  it('path never contains blocked tiles', () => {
    const grid = createEmptyGrid(15, 15);
    // Scatter some obstacles
    blockTile(grid, 5, 5);
    blockTile(grid, 6, 5);
    blockTile(grid, 7, 5);
    blockTile(grid, 5, 6);
    blockTile(grid, 10, 10);
    blockTile(grid, 11, 10);
    blockTile(grid, 10, 11);

    const result = findPath(grid, 2, 2, 12, 12);
    expect(result.found).toBe(true);
    for (const step of result.path) {
      expect(grid.cells[step.ty * grid.width + step.tx]).toBe(0);
    }
  });
});

// ── findPath: determinism ─────────────────────────────────────────────

describe('findPath: determinism', () => {
  it('returns identical result on repeated calls with same input', () => {
    const grid = createEmptyGrid(10, 10);
    blockTile(grid, 5, 5);
    blockTile(grid, 5, 4);
    blockTile(grid, 5, 6);

    const result1 = findPath(grid, 2, 5, 8, 5);
    const result2 = findPath(grid, 2, 5, 8, 5);
    expect(result1).toEqual(result2);
  });
});

// ── findPathToAdjacent: 1x1 target ────────────────────────────────────

describe('findPathToAdjacent: 1x1 target', () => {
  it('finds path to tile adjacent to 1x1 blocked target', () => {
    const grid = createEmptyGrid(10, 10);
    blockTile(grid, 8, 8);
    const result = findPathToAdjacent(grid, 5, 5, 8, 8, 1);
    expect(result.found).toBe(true);
    expect(result.cost).toBeGreaterThan(0);
    // Last tile in path must be adjacent to (8,8)
    const last = result.path[result.path.length - 1]!;
    const manhattan = Math.abs(last.tx - 8) + Math.abs(last.ty - 8);
    expect(manhattan).toBe(1);
  });

  it('returns empty path when start is already adjacent to 1x1 target', () => {
    const grid = createEmptyGrid(10, 10);
    blockTile(grid, 8, 8);
    // Start at (7,8) — adjacent to the blocked tile
    const result = findPathToAdjacent(grid, 7, 8, 8, 8, 1);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(0);
  });
});

// ── findPathToAdjacent: 3x3 target ────────────────────────────────────

describe('findPathToAdjacent: 3x3 target', () => {
  it('finds path to tile adjacent to 3x3 blocked footprint', () => {
    const grid = createEmptyGrid(10, 10);
    blockFootprint(grid, 5, 5, 3);
    const result = findPathToAdjacent(grid, 0, 0, 5, 5, 3);
    expect(result.found).toBe(true);
    // Last tile must be adjacent to the 3x3 footprint at (5,5)-(7,7)
    const last = result.path[result.path.length - 1]!;
    const isAdjacent =
      (last.ty === 4 && last.tx >= 5 && last.tx <= 7) ||  // top edge
      (last.ty === 8 && last.tx >= 5 && last.tx <= 7) ||  // bottom edge
      (last.tx === 8 && last.ty >= 5 && last.ty <= 7) ||  // right edge
      (last.tx === 4 && last.ty >= 5 && last.ty <= 7);    // left edge
    expect(isAdjacent).toBe(true);
  });

  it('returns empty path when start is already adjacent to 3x3 footprint', () => {
    const grid = createEmptyGrid(10, 10);
    blockFootprint(grid, 5, 5, 3);
    // Start at (4,5) — adjacent to the left edge of the footprint
    const result = findPathToAdjacent(grid, 4, 5, 5, 5, 3);
    expect(result.found).toBe(true);
    expect(result.path).toEqual([]);
    expect(result.cost).toBe(0);
  });
});

// ── findPathToAdjacent: all adjacent blocked ──────────────────────────

describe('findPathToAdjacent: all adjacent blocked', () => {
  it('returns unreachable when all adjacent tiles to target are blocked', () => {
    const grid = createEmptyGrid(5, 5);
    // Block center tile and all its neighbors
    blockTile(grid, 2, 2); // target
    blockTile(grid, 2, 1); // top
    blockTile(grid, 3, 2); // right
    blockTile(grid, 2, 3); // bottom
    blockTile(grid, 1, 2); // left
    const result = findPathToAdjacent(grid, 0, 0, 2, 2, 1);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('unreachable');
  });

  it('returns unreachable when all adjacent tiles to 3x3 footprint are blocked', () => {
    const grid = createEmptyGrid(7, 7);
    // Block the 3x3 footprint at (2,2)-(4,4)
    blockFootprint(grid, 2, 2, 3);
    // Block all perimeter tiles
    // Top edge: (2,1),(3,1),(4,1)
    blockTile(grid, 2, 1); blockTile(grid, 3, 1); blockTile(grid, 4, 1);
    // Right edge: (5,2),(5,3),(5,4)
    blockTile(grid, 5, 2); blockTile(grid, 5, 3); blockTile(grid, 5, 4);
    // Bottom edge: (2,5),(3,5),(4,5)
    blockTile(grid, 2, 5); blockTile(grid, 3, 5); blockTile(grid, 4, 5);
    // Left edge: (1,2),(1,3),(1,4)
    blockTile(grid, 1, 2); blockTile(grid, 1, 3); blockTile(grid, 1, 4);
    const result = findPathToAdjacent(grid, 0, 0, 2, 2, 3);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('unreachable');
  });
});

// ── findPathToAdjacent: blocked start ─────────────────────────────────

describe('findPathToAdjacent: blocked start', () => {
  it('returns blocked-start when start tile is blocked', () => {
    const grid = createEmptyGrid(10, 10);
    blockTile(grid, 2, 2);
    blockTile(grid, 8, 8);
    const result = findPathToAdjacent(grid, 2, 2, 8, 8, 1);
    expect(result.found).toBe(false);
    expect(result.reason).toBe('blocked-start');
  });
});

// ── Integration: pathfinding on MapData-built grid ────────────────────

describe('pathfinding on MapData-built grid', () => {
  it('finds path from one side of HQ to the other', () => {
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    // Start to the left of HQ, target to the right
    const fromTx = map.hq.tx - 2;
    const fromTy = map.hq.ty + 1;
    const toTx = map.hq.tx + HQ_FOOTPRINT + 1;
    const toTy = map.hq.ty + 1;
    const result = findPath(grid, fromTx, fromTy, toTx, toTy);
    expect(result.found).toBe(true);
    // Path must not go through HQ footprint
    for (const step of result.path) {
      const inHq = step.tx >= map.hq.tx && step.tx < map.hq.tx + HQ_FOOTPRINT &&
                    step.ty >= map.hq.ty && step.ty < map.hq.ty + HQ_FOOTPRINT;
      expect(inHq).toBe(false);
    }
  });

  it('finds path to adjacent tile of a resource', () => {
    const map = createMinimalMap({
      resources: [{ tx: 15, ty: 5, type: 'small', footprint: 1 }],
    });
    const grid = buildPassabilityGrid(map);
    const result = findPathToAdjacent(grid, 10, 5, 15, 5, 1);
    expect(result.found).toBe(true);
    const last = result.path[result.path.length - 1]!;
    expect(Math.abs(last.tx - 15) + Math.abs(last.ty - 5)).toBe(1);
  });
});
