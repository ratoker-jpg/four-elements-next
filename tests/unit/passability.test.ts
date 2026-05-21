import { describe, it, expect } from 'vitest';
import {
  buildPassabilityGrid,
  isTileBlocked,
  isTilePassable,
  findAdjacentPassableTiles,
  type PassabilityGrid,
} from '../../src/systems/passability.js';
import type { MapData } from '../../src/game/map-types.js';
import type { ResourceNodeState } from '../../src/systems/harvesting.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';

// ── Test helpers ──────────────────────────────────────────────────────

/** Create a minimal MapData for passability tests. All tiles are open by default. */
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

/** Create an entirely empty grid (no HQ, no objects) for isolated pathfinding tests. */
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

// ── buildPassabilityGrid ──────────────────────────────────────────────

describe('buildPassabilityGrid', () => {
  it('marks HQ footprint as blocked', () => {
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        expect(isTileBlocked(grid, map.hq.tx + dx, map.hq.ty + dy)).toBe(true);
      }
    }
  });

  it('marks completed building footprint as blocked', () => {
    const map = createMinimalMap({
      buildings: [{ tx: 15, ty: 5, type: 'raw-storage' }], // footprint = 2
    });
    const grid = buildPassabilityGrid(map);
    expect(isTileBlocked(grid, 15, 5)).toBe(true);
    expect(isTileBlocked(grid, 16, 5)).toBe(true);
    expect(isTileBlocked(grid, 15, 6)).toBe(true);
    expect(isTileBlocked(grid, 16, 6)).toBe(true);
    // Adjacent tile should be passable
    expect(isTilePassable(grid, 14, 5)).toBe(true);
  });

  it('marks construction site footprint as blocked', () => {
    const map = createMinimalMap({
      constructionSites: [{
        tx: 12, ty: 8, type: 'separator', elapsed: 0, duration: 25, progress: 0, builderIndex: 0,
      }], // footprint = 2
    });
    const grid = buildPassabilityGrid(map);
    expect(isTileBlocked(grid, 12, 8)).toBe(true);
    expect(isTileBlocked(grid, 13, 8)).toBe(true);
    expect(isTileBlocked(grid, 12, 9)).toBe(true);
    expect(isTileBlocked(grid, 13, 9)).toBe(true);
  });

  it('marks obstacle footprint as blocked', () => {
    const map = createMinimalMap({
      obstacles: [{ tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 }],
    });
    const grid = buildPassabilityGrid(map);
    expect(isTileBlocked(grid, 10, 10)).toBe(true);
    expect(isTileBlocked(grid, 11, 10)).toBe(true);
    expect(isTileBlocked(grid, 10, 11)).toBe(true);
    expect(isTileBlocked(grid, 11, 11)).toBe(true);
  });

  it('marks resource footprint as blocked', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const grid = buildPassabilityGrid(map);
    expect(isTileBlocked(grid, 8, 3)).toBe(true);
    // Adjacent should be passable
    expect(isTilePassable(grid, 7, 3)).toBe(true);
  });

  it('marks mineral_infinite 3x3 footprint as 9 blocked tiles', () => {
    const map = createMinimalMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    const grid = buildPassabilityGrid(map);
    // All 9 tiles of 3x3 infinite should be blocked
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isTileBlocked(grid, 10 + dx, 10 + dy)).toBe(true);
      }
    }
    // Adjacent tile should be passable
    expect(isTilePassable(grid, 9, 10)).toBe(true);
    expect(isTilePassable(grid, 13, 10)).toBe(true);
  });

  it('does NOT mark decor as blocked', () => {
    const map = createMinimalMap({
      decor: [{ tx: 10, ty: 10, type: 'bush' }, { tx: 15, ty: 15, type: 'sand-bump' }],
    });
    const grid = buildPassabilityGrid(map);
    // Decor tiles should be passable (decor does not block)
    expect(isTilePassable(grid, 10, 10)).toBe(true);
    expect(isTilePassable(grid, 15, 15)).toBe(true);
  });

  it('does NOT represent territory as blocking', () => {
    // This test verifies that territory is not part of the passability grid.
    // Since PassabilityGrid has no territory concept, all non-structural tiles are passable.
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    // Any tile not occupied by HQ, buildings, obstacles, or resources should be passable
    expect(isTilePassable(grid, 0, 0)).toBe(true);
    expect(isTilePassable(grid, 19, 19)).toBe(true);
  });

  it('does NOT block tiles occupied by builders', () => {
    const map = createMinimalMap({
      builders: [{ tx: 10, ty: 10, busy: false }],
    });
    const grid = buildPassabilityGrid(map);
    // Builder position should still be passable in MVP
    expect(isTilePassable(grid, 10, 10)).toBe(true);
  });

  it('does NOT block tiles occupied by harvesters', () => {
    // Harvesters are not in MapData, they're in GameState.harvesters.
    // This confirms that the grid built from MapData alone doesn't block harvester positions.
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    // Tile (3,4) is the builder position from createMinimalMap, should be passable
    expect(isTilePassable(grid, 3, 4)).toBe(true);
  });
});

// ── isTileBlocked ─────────────────────────────────────────────────────

describe('isTileBlocked', () => {
  it('returns true for out-of-bounds (negative)', () => {
    const grid = createEmptyGrid();
    expect(isTileBlocked(grid, -1, 0)).toBe(true);
    expect(isTileBlocked(grid, 0, -1)).toBe(true);
  });

  it('returns true for out-of-bounds (exceeding dimensions)', () => {
    const grid = createEmptyGrid(10, 10);
    expect(isTileBlocked(grid, 10, 0)).toBe(true);
    expect(isTileBlocked(grid, 0, 10)).toBe(true);
  });

  it('returns false for passable tiles', () => {
    const grid = createEmptyGrid();
    expect(isTileBlocked(grid, 0, 0)).toBe(false);
    expect(isTileBlocked(grid, 9, 9)).toBe(false);
  });

  it('returns true for blocked tiles', () => {
    const grid = createEmptyGrid();
    blockTile(grid, 5, 5);
    expect(isTileBlocked(grid, 5, 5)).toBe(true);
  });
});

// ── isTilePassable ────────────────────────────────────────────────────

describe('isTilePassable', () => {
  it('returns false for out-of-bounds', () => {
    const grid = createEmptyGrid();
    expect(isTilePassable(grid, -1, 0)).toBe(false);
    expect(isTilePassable(grid, 0, -1)).toBe(false);
    expect(isTilePassable(grid, 10, 0)).toBe(false);
    expect(isTilePassable(grid, 0, 10)).toBe(false);
  });

  it('returns true for open tiles', () => {
    const grid = createEmptyGrid();
    expect(isTilePassable(grid, 0, 0)).toBe(true);
    expect(isTilePassable(grid, 5, 5)).toBe(true);
  });

  it('returns false for blocked tiles', () => {
    const grid = createEmptyGrid();
    blockTile(grid, 3, 3);
    expect(isTilePassable(grid, 3, 3)).toBe(false);
  });
});

// ── findAdjacentPassableTiles ─────────────────────────────────────────

describe('findAdjacentPassableTiles', () => {
  it('returns 4 adjacent passable tiles for 1x1 footprint on empty grid', () => {
    const grid = createEmptyGrid(10, 10);
    const result = findAdjacentPassableTiles(grid, 5, 5, 1);
    expect(result).toHaveLength(4);
    // Top, Right, Bottom, Left in order
    expect(result).toEqual([
      { tx: 5, ty: 4 },  // top
      { tx: 6, ty: 5 },  // right
      { tx: 5, ty: 6 },  // bottom
      { tx: 4, ty: 5 },  // left
    ]);
  });

  it('returns 12 adjacent passable tiles for 3x3 footprint on empty grid', () => {
    const grid = createEmptyGrid(10, 10);
    const result = findAdjacentPassableTiles(grid, 3, 3, 3);
    expect(result).toHaveLength(12);
    // Top edge: (3,2), (4,2), (5,2)
    // Right edge: (6,3), (6,4), (6,5)
    // Bottom edge: (3,6), (4,6), (5,6)
    // Left edge: (2,3), (2,4), (2,5)
    expect(result).toEqual([
      { tx: 3, ty: 2 }, { tx: 4, ty: 2 }, { tx: 5, ty: 2 },
      { tx: 6, ty: 3 }, { tx: 6, ty: 4 }, { tx: 6, ty: 5 },
      { tx: 3, ty: 6 }, { tx: 4, ty: 6 }, { tx: 5, ty: 6 },
      { tx: 2, ty: 3 }, { tx: 2, ty: 4 }, { tx: 2, ty: 5 },
    ]);
  });

  it('excludes blocked tiles from adjacent results', () => {
    const grid = createEmptyGrid(10, 10);
    // Block the tile directly above the footprint
    blockTile(grid, 5, 4);
    const result = findAdjacentPassableTiles(grid, 5, 5, 1);
    expect(result).toHaveLength(3);
    expect(result).toEqual([
      { tx: 6, ty: 5 },  // right
      { tx: 5, ty: 6 },  // bottom
      { tx: 4, ty: 5 },  // left
    ]);
  });

  it('excludes out-of-bounds tiles from adjacent results', () => {
    const grid = createEmptyGrid(10, 10);
    // Footprint at top-left corner: (0,0), 1x1
    // Top and left are out of bounds
    const result = findAdjacentPassableTiles(grid, 0, 0, 1);
    expect(result).toHaveLength(2);
    expect(result).toEqual([
      { tx: 1, ty: 0 },  // right
      { tx: 0, ty: 1 },  // bottom
    ]);
  });

  it('excludes blocked and out-of-bounds tiles from adjacent results for 3x3', () => {
    const grid = createEmptyGrid(10, 10);
    // Footprint at (0,0), 3x3: occupies (0,0)-(2,2)
    // Top edge and left edge are out of bounds
    // Block one tile on the right edge
    blockTile(grid, 3, 1);
    const result = findAdjacentPassableTiles(grid, 0, 0, 3);
    // Right edge: (3,0), (3,1 blocked), (3,2) → 2 tiles
    // Bottom edge: (0,3), (1,3), (2,3) → 3 tiles
    // Top and left edges: all out of bounds
    expect(result).toHaveLength(5);
    expect(result).toEqual([
      { tx: 3, ty: 0 },  // right edge, top
      { tx: 3, ty: 2 },  // right edge, bottom
      { tx: 0, ty: 3 }, { tx: 1, ty: 3 }, { tx: 2, ty: 3 }, // bottom edge
    ]);
  });

  it('returns empty array when all adjacent tiles are blocked or out-of-bounds', () => {
    const grid = createEmptyGrid(3, 3);
    // Block the entire grid except center
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        grid.cells[y * 3 + x] = 1;
      }
    }
    // Clear the center for the footprint
    grid.cells[1 * 3 + 1] = 0;
    const result = findAdjacentPassableTiles(grid, 1, 1, 1);
    // All 4 neighbors are blocked
    expect(result).toHaveLength(0);
  });

  it('output order is deterministic (same result on repeated calls)', () => {
    const grid = createEmptyGrid(10, 10);
    const result1 = findAdjacentPassableTiles(grid, 5, 5, 1);
    const result2 = findAdjacentPassableTiles(grid, 5, 5, 1);
    expect(result1).toEqual(result2);
  });

  it('output order is deterministic for 3x3 footprint', () => {
    const grid = createEmptyGrid(10, 10);
    const result1 = findAdjacentPassableTiles(grid, 3, 3, 3);
    const result2 = findAdjacentPassableTiles(grid, 3, 3, 3);
    expect(result1).toEqual(result2);
  });
});

// ── Resource depletion filtering ────────────────────────────────────

describe('buildPassabilityGrid — resource depletion', () => {
  it('depleted finite resource does NOT block passability when resourceNodes provided', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 0 },
    ];
    const grid = buildPassabilityGrid(map, resourceNodes);
    // Depleted finite resource tile should be passable
    expect(isTilePassable(grid, 8, 3)).toBe(true);
  });

  it('active finite resource still blocks passability when resourceNodes provided', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 50 },
    ];
    const grid = buildPassabilityGrid(map, resourceNodes);
    // Active finite resource should still block
    expect(isTileBlocked(grid, 8, 3)).toBe(true);
  });

  it('infinite resource always blocks passability regardless of remaining', () => {
    const map = createMinimalMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    const resourceNodes: ResourceNodeState[] = [
      { tx: 10, ty: 10, type: 'infinite', infinite: true, remaining: Infinity },
    ];
    const grid = buildPassabilityGrid(map, resourceNodes);
    // All 9 tiles of 3x3 infinite should still be blocked
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isTileBlocked(grid, 10 + dx, 10 + dy)).toBe(true);
      }
    }
  });

  it('without resourceNodes, all resources block (backward compatible)', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    // No resourceNodes → all resources block regardless of depletion
    const grid = buildPassabilityGrid(map);
    expect(isTileBlocked(grid, 8, 3)).toBe(true);
  });

  it('depleted finite 3x3 infinite-type footprint does not block', () => {
    // Edge case: a finite resource with a large footprint (if such ever existed)
    const map = createMinimalMap({
      resources: [{ tx: 10, ty: 10, type: 'small', footprint: 1 }],
    });
    const resourceNodes: ResourceNodeState[] = [
      { tx: 10, ty: 10, type: 'small', infinite: false, remaining: 0 },
    ];
    const grid = buildPassabilityGrid(map, resourceNodes);
    expect(isTilePassable(grid, 10, 10)).toBe(true);
  });

  it('mixed: depleted finite passable, active finite blocked, infinite blocked', () => {
    const map = createMinimalMap({
      resources: [
        { tx: 8, ty: 3, type: 'small', footprint: 1 },     // depleted
        { tx: 12, ty: 5, type: 'medium', footprint: 1 },   // active
        { tx: 15, ty: 10, type: 'infinite', footprint: 3 }, // infinite
      ],
    });
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 0 },
      { tx: 12, ty: 5, type: 'medium', infinite: false, remaining: 100 },
      { tx: 15, ty: 10, type: 'infinite', infinite: true, remaining: Infinity },
    ];
    const grid = buildPassabilityGrid(map, resourceNodes);
    // Depleted finite → passable
    expect(isTilePassable(grid, 8, 3)).toBe(true);
    // Active finite → blocked
    expect(isTileBlocked(grid, 12, 5)).toBe(true);
    // Infinite → blocked
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(isTileBlocked(grid, 15 + dx, 10 + dy)).toBe(true);
      }
    }
  });
});
