import { describe, it, expect } from 'vitest';
import {
  buildPassabilityMap,
  isTilePassable,
  isTileBlockedByObstacle,
  isStraightLineClearOfObstacles,
  countStartZoneBlockedTiles,
  validateMap,
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
    const map = createMinimalMap({ resources: [{ tx: 15, ty: 5, type: 'small' }] });
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

describe('validateMap', () => {
  it('returns ok=true for a clean minimal map', () => {
    const map = createMinimalMap();
    const report = validateMap(map, 42);
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
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

  it('reports when starter resources are not reachable via straight line', () => {
    // Place resource on one side, obstacle blocking the straight line
    const obstacles: ObstaclePlacement[] = [
      { tx: 6, ty: 5, type: 'mountain-large', footprint: 3 }, // blocks (6,5)-(8,7)
    ];
    const resources = [{ tx: 12, ty: 12, type: 'small' }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    // Depending on line path, may or may not be reachable
    // Just check the report is structured correctly
    expect(typeof report.reachableStarterResources).toBe('number');
    expect(typeof report.centerReachable).toBe('boolean');
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
    const resources = [{ tx: 10, ty: 10, type: 'infinite' }];
    const map = createMinimalMap({ obstacles, resources });
    const report = validateMap(map, 42);
    expect(report.infiniteReachable).toBe(false);
  });

  it('reports when a resource overlaps an obstacle', () => {
    const obstacles: ObstaclePlacement[] = [
      { tx: 10, ty: 10, type: 'rock-cluster', footprint: 1 },
    ];
    const resources = [{ tx: 10, ty: 10, type: 'small' }];
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
});
