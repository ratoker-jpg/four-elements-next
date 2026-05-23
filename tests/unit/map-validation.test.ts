import { describe, it, expect } from 'vitest';
import {
  buildPassabilityMap,
  isTilePassable,
  isTileBlockedByObstacle,
  isStraightLineClearOfObstacles,
  countStartZoneBlockedTiles,
  validateMap,
  computeReachableSet,
  isFootprintReachable,
  isAreaReachable,
} from '../../src/game/map-validation.js';
import type { MapData, ObstaclePlacement } from '../../src/game/map-types.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import { generateMap } from '../../src/game/mapgen.js';

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

describe('buildPassabilityMap', () => {
  it('marks HQ footprint as blocked', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        expect(passability[map.hq.ty + dy]![map.hq.tx + dx]!).toBe(false);
      }
    }
  });

  it('marks obstacle footprints as blocked', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 },
    ];
    const map = createMinimalMap({ obstacles });
    const passability = buildPassabilityMap(map);
    expect(passability[10]![10]!).toBe(false);
    expect(passability[10]![11]!).toBe(false);
    expect(passability[11]![10]!).toBe(false);
    expect(passability[11]![11]!).toBe(false);
  });

  it('marks resource tiles as blocked', () => {
    const map = createMinimalMap({ resources: [{ tx: 15, ty: 5, type: 'small', footprint: 1 }] });
    const passability = buildPassabilityMap(map);
    expect(passability[5]![15]!).toBe(false);
  });

  it('unoccupied tiles are passable', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    // Far from HQ should be passable
    expect(passability[0]![0]!).toBe(true);
    expect(passability[19]![19]!).toBe(true);
  });
});

describe('isTilePassable', () => {
  it('returns false for out-of-bounds tiles', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    expect(isTilePassable(passability, -1, 0)).toBe(false);
    expect(isTilePassable(passability, 0, -1)).toBe(false);
    expect(isTilePassable(passability, 20, 0)).toBe(false);
    expect(isTilePassable(passability, 0, 20)).toBe(false);
  });

  it('returns true for open tiles', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    expect(isTilePassable(passability, 0, 0)).toBe(true);
  });
});

describe('isTileBlockedByObstacle', () => {
  it('returns true for tiles inside obstacle footprint', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 },
    ];
    expect(isTileBlockedByObstacle(obstacles, 10, 10)).toBe(true);
    expect(isTileBlockedByObstacle(obstacles, 11, 11)).toBe(true);
  });

  it('returns false for tiles outside obstacle footprint', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 },
    ];
    expect(isTileBlockedByObstacle(obstacles, 9, 10)).toBe(false);
    expect(isTileBlockedByObstacle(obstacles, 12, 10)).toBe(false);
  });

  it('returns false for empty obstacles array', () => {
    expect(isTileBlockedByObstacle([], 5, 5)).toBe(false);
  });
});

describe('isStraightLineClearOfObstacles', () => {
  it('returns true when no obstacles exist', () => {
    expect(isStraightLineClearOfObstacles([], 0, 0, 10, 10, 20, 20)).toBe(true);
  });

  it('returns true when obstacle is not on the line', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 0, ty: 0, type: 'rock-cluster', footprint: 1 },
    ];
    // Line from (5,5) to (15,15) doesn't cross (0,0)
    expect(isStraightLineClearOfObstacles(obstacles, 5, 5, 15, 15, 20, 20)).toBe(true);
  });

  it('returns false when obstacle blocks the line', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 5, ty: 5, type: 'rock-cluster', footprint: 1 },
    ];
    // Line from (0,0) to (10,10) crosses (5,5)
    expect(isStraightLineClearOfObstacles(obstacles, 0, 0, 10, 10, 20, 20)).toBe(false);
  });

  it('returns true for zero-length path', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 5, ty: 5, type: 'rock-cluster', footprint: 1 },
    ];
    expect(isStraightLineClearOfObstacles(obstacles, 5, 5, 5, 5, 20, 20)).toBe(true);
  });

  it('handles multi-tile obstacle footprints blocking the line', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 4, ty: 4, type: 'mountain-medium', footprint: 2 },
    ];
    // Line from (0,0) to (10,10) should cross (4,4) or (5,5)
    expect(isStraightLineClearOfObstacles(obstacles, 0, 0, 10, 10, 20, 20)).toBe(false);
  });
});

describe('countStartZoneBlockedTiles', () => {
  it('returns 0 when no obstacles in start zone', () => {
    const map = createMinimalMap();
    expect(countStartZoneBlockedTiles(map)).toBe(0);
  });

  it('counts obstacle tiles in start zone', () => {
    // Place obstacle near HQ (inside core zone)
    const obstacles: ObstaclePlacement[] = [
      { tx: 7, ty: 7, type: 'rock-cluster', footprint: 1 },
    ];
    const map = createMinimalMap({ obstacles });
    expect(countStartZoneBlockedTiles(map)).toBeGreaterThan(0);
  });
});

// ── BFS reachability tests ───────────────────────────────────────────

describe('computeReachableSet', () => {
  it('returns at least the HQ-adjacent passable tiles on an open map', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // HQ is at (4,4) with 3x3 footprint, so adjacent passable tiles exist
    expect(reachable.size).toBeGreaterThan(0);
    // On an open 20x20 map, most tiles should be reachable (minus HQ footprint)
    expect(reachable.size).toBeGreaterThan(350);
  });

  it('returns only tiles reachable around obstacles', () => {
    // Create a wall of obstacles that blocks passage
    const obstacles: ObstaclePlacement[] = [];
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const map = createMinimalMap({ obstacles });
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // Tiles below the wall (y >= 9) should not be reachable from HQ at (4,4)
    expect(reachable.has('10,10')).toBe(false);
    // Tiles above the wall (y < 8) should be reachable
    expect(reachable.has('10,5')).toBe(true);
  });
});

describe('isFootprintReachable', () => {
  it('returns true when an adjacent passable tile is in the reachable set', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // A small resource at (8,8) should be reachable from HQ at (4,4)
    expect(isFootprintReachable(reachable, 8, 8, 1, 20, 20, passability)).toBe(true);
  });

  it('returns false when no adjacent passable tile is reachable', () => {
    // Create a wall that fully encloses a resource
    const obstacles: ObstaclePlacement[] = [];
    // Wall at y=8 across the entire map
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const map = createMinimalMap({ obstacles });
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // Resource at (10,10) is behind the wall
    expect(isFootprintReachable(reachable, 10, 10, 1, 20, 20, passability)).toBe(false);
  });

  it('returns true for infinite resource (3x3) with reachable adjacent tile', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // 3x3 infinite at (10,10) — adjacent tiles should be reachable
    expect(isFootprintReachable(reachable, 10, 10, 3, 20, 20, passability)).toBe(true);
  });
});

describe('isAreaReachable', () => {
  it('returns true when any passable tile near center is reachable', () => {
    const map = createMinimalMap();
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    expect(isAreaReachable(reachable, 10, 10, 2, 20, 20, passability)).toBe(true);
  });

  it('returns false when center area is fully blocked off', () => {
    const obstacles: ObstaclePlacement[] = [];
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const map = createMinimalMap({ obstacles });
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    expect(isAreaReachable(reachable, 10, 10, 2, 20, 20, passability)).toBe(false);
  });

  it('returns true when exact center is blocked but nearby tile is reachable', () => {
    // Place obstacle exactly at center tile but leave adjacent tiles open
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'rock-cluster', footprint: 1 },
    ];
    const map = createMinimalMap({ obstacles });
    const passability = buildPassabilityMap(map);
    const reachable = computeReachableSet(map, passability);
    // Center tile is blocked, but with radius=2, nearby tiles should be reachable
    expect(isAreaReachable(reachable, 10, 10, 2, 20, 20, passability)).toBe(true);
  });
});

// ── validateMap with BFS ─────────────────────────────────────────────

describe('validateMap', () => {
  it('returns ok=true for a clean minimal map', () => {
    const map = createMinimalMap();
    const report = validateMap(map, 42);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
    expect(report.reachabilityMethod).toBe('bfs');
  });

  it('reports errors when start zone has obstacles', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 7, ty: 7, type: 'rock-cluster', footprint: 1 },
    ];
    const map = createMinimalMap({ obstacles });
    const report = validateMap(map, 42);
    expect(report.startCoreBlockedTiles).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it('reports when starter resources are not reachable via BFS', () => {
    // Create a wall of obstacles that encloses resources on the far side
    const obstacles: ObstaclePlacement[] = [];
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const resources = [{ tx: 12, ty: 12, type: 'small', footprint: 1 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.reachableStarterResources).toBe(0);
    expect(report.ok).toBe(false);
  });

  it('BFS: map with blocked straight line but reachable around obstacle passes', () => {
    // Place an obstacle that blocks the straight line from HQ to a resource,
    // but the resource is still reachable by going around.
    const obstacles: ObstaclePlacement[] = [
      { tx: 6, ty: 5, type: 'mountain-large', footprint: 3 }, // blocks (6,5)-(8,7)
    ];
    const resources = [{ tx: 10, ty: 10, type: 'small', footprint: 1 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    // Straight line from HQ (4,5) to (10,10) might be blocked by (6,5)-(8,7),
    // but BFS should find a path around the mountain
    expect(report.reachableStarterResources).toBe(1);
  });

  it('BFS: starter resource fully enclosed should fail', () => {
    // Create a 3x3 box of obstacles that encloses a resource
    const obstacles: ObstaclePlacement[] = [
      // Top wall
      { tx: 14, ty: 12, type: 'rock-cluster', footprint: 1 },
      { tx: 15, ty: 12, type: 'rock-cluster', footprint: 1 },
      { tx: 16, ty: 12, type: 'rock-cluster', footprint: 1 },
      // Bottom wall
      { tx: 14, ty: 16, type: 'rock-cluster', footprint: 1 },
      { tx: 15, ty: 16, type: 'rock-cluster', footprint: 1 },
      { tx: 16, ty: 16, type: 'rock-cluster', footprint: 1 },
      // Left wall
      { tx: 13, ty: 13, type: 'rock-cluster', footprint: 1 },
      { tx: 13, ty: 14, type: 'rock-cluster', footprint: 1 },
      { tx: 13, ty: 15, type: 'rock-cluster', footprint: 1 },
      // Right wall
      { tx: 17, ty: 13, type: 'rock-cluster', footprint: 1 },
      { tx: 17, ty: 14, type: 'rock-cluster', footprint: 1 },
      { tx: 17, ty: 15, type: 'rock-cluster', footprint: 1 },
    ];
    const resources = [{ tx: 15, ty: 14, type: 'small', footprint: 1 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.reachableStarterResources).toBe(0);
    expect(report.ok).toBe(false);
  });

  it('reports when center is not reachable', () => {
    // Create a wall of obstacles between HQ and center
    const obstacles: ObstaclePlacement[] = [];
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const map = createMinimalMap({ obstacles });
    const report = validateMap(map, 42);
    expect(report.centerReachable).toBe(false);
    expect(report.ok).toBe(false);
  });

  it('reports when infinite resource is not reachable', () => {
    // Create a wall of obstacles between HQ and center
    const obstacles: ObstaclePlacement[] = [];
    for (let x = 0; x < 20; x++) {
      obstacles.push({ tx: x, ty: 8, type: 'rock-cluster', footprint: 1 });
    }
    const resources = [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.infiniteReachable).toBe(false);
  });

  it('BFS: mineral_infinite with reachable adjacent tile passes', () => {
    // Place infinite near center with no obstacles blocking
    const resources = [{ tx: 9, ty: 9, type: 'infinite', footprint: 3 }];
    const map = createMinimalMap({ resources });
    const report = validateMap(map, 42);
    expect(report.infiniteReachable).toBe(true);
  });

  it('BFS: mineral_infinite fully enclosed should fail', () => {
    // Create a wall that fully encloses the infinite resource
    const obstacles: ObstaclePlacement[] = [];
    // Infinite at (9,9), footprint 3 → occupies (9,9)-(11,11)
    // Build a wall around it with no gap
    for (let x = 8; x <= 12; x++) {
      obstacles.push({ tx: x, ty: 7, type: 'rock-cluster', footprint: 1 }); // top
      obstacles.push({ tx: x, ty: 13, type: 'rock-cluster', footprint: 1 }); // bottom
    }
    for (let y = 8; y <= 12; y++) {
      obstacles.push({ tx: 7, ty: y, type: 'rock-cluster', footprint: 1 }); // left
      obstacles.push({ tx: 13, ty: y, type: 'rock-cluster', footprint: 1 }); // right
    }
    const resources = [{ tx: 9, ty: 9, type: 'infinite', footprint: 3 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.infiniteReachable).toBe(false);
  });

  it('reports when a resource overlaps an obstacle', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'rock-cluster', footprint: 1 },
    ];
    const resources = [{ tx: 10, ty: 10, type: 'small', footprint: 1 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes('overlaps an obstacle'))).toBe(true);
  });

  it('includes seed and map dimensions in report', () => {
    const map = createMinimalMap();
    const report = validateMap(map, 99);
    expect(report.seed).toBe(99);
    expect(report.mapWidth).toBe(20);
    expect(report.mapHeight).toBe(20);
  });

  it('generated map passes validation', () => {
    const map = generateMap(48, 48, 'cyan', 42);
    const report = validateMap(map, 42);
    expect(report.ok).toBe(true);
    expect(report.startCoreBlockedTiles).toBe(0);
    expect(report.reachabilityMethod).toBe('bfs');
  });

  it('rejectedClusters defaults to 0 when not provided', () => {
    const map = createMinimalMap();
    const report = validateMap(map, 42);
    expect(report.rejectedClusters).toBe(0);
  });

  it('rejectedClusters is passed through to the report', () => {
    const map = createMinimalMap();
    const report = validateMap(map, 42, 5);
    expect(report.rejectedClusters).toBe(5);
  });

  it('marks multi-tile resource footprint as blocked', () => {
    const resources = [{ tx: 15, ty: 5, type: 'infinite' as const, footprint: 3 }];
    const map = createMinimalMap({ resources });
    const passability = buildPassabilityMap(map);
    // All 9 tiles of 3×3 infinite should be blocked
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(passability[5 + dy]![15 + dx]!).toBe(false);
      }
    }
    // Adjacent tile should be passable
    expect(passability[5]![14]!).toBe(true);
  });

  it('reports when multi-tile resource footprint overlaps obstacle', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'rock-cluster', footprint: 1 },
    ];
    const resources = [{ tx: 9, ty: 9, type: 'infinite' as const, footprint: 3 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.ok).toBe(false);
    expect(report.errors.some((e) => e.includes('overlaps an obstacle'))).toBe(true);
  });

  it('BFS: infinite resource reachable via adjacent tile (not footprint tile)', () => {
    // Place a 3×3 infinite at (10,10). Its footprint tiles are blocked,
    // but adjacent passable tiles should still be reachable from HQ.
    const obstacles: ObstaclePlacement[] = [
      { tx: 8, ty: 8, type: 'rock-cluster', footprint: 1 }, // blocks (8,8) only
    ];
    const resources = [{ tx: 10, ty: 10, type: 'infinite' as const, footprint: 3 }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    // Adjacent passable tiles around the 3×3 footprint should be reachable
    expect(report.infiniteReachable).toBe(true);
  });
});
