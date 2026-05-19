import { describe, it, expect } from 'vitest';
import {
  createTerritoryState,
  initTerritoryFromHq,
  addBuildingSource,
  tickTerritory,
  getTerritoryTile,
  countClaimedTiles,
  isTileClaimed,
} from '../../src/systems/territory.js';
import { buildOccupiedTileSet } from '../../src/systems/construction.js';
import {
  HQ_FOOTPRINT,
  TERRITORY_TILE_FILL_SECONDS,
  TERRITORY_MAX_RADIUS,
  TERRITORY_SPREAD_BASE_DELAY,
  territorySpreadDelay,
} from '../../src/core/constants.js';
import type { MapData, BuildingPlacement } from '../../src/game/map-types.js';

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

describe('createTerritoryState', () => {
  it('creates state with correct dimensions', () => {
    const state = createTerritoryState(48, 48);
    expect(state.width).toBe(48);
    expect(state.height).toBe(48);
    expect(state.tiles).toHaveLength(48 * 48);
  });

  it('all tiles start unclaimed', () => {
    const state = createTerritoryState(20, 20);
    for (const tile of state.tiles) {
      expect(tile.progress).toBe(0);
      expect(tile.owner).toBeNull();
    }
    expect(countClaimedTiles(state)).toBe(0);
  });

  it('starts with empty sources and frontier', () => {
    const state = createTerritoryState(20, 20);
    expect(state.sources).toHaveLength(0);
    expect(state.frontier).toHaveLength(0);
  });
});

describe('initTerritoryFromHq', () => {
  it('marks HQ footprint as fully owned', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        const tile = getTerritoryTile(state, 4 + dx, 4 + dy);
        expect(tile!.progress).toBe(1);
        expect(tile!.owner).toBe('cyan');
      }
    }
  });

  it('HQ footprint has correct number of claimed tiles', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    expect(countClaimedTiles(state)).toBe(HQ_FOOTPRINT * HQ_FOOTPRINT);
  });

  it('adds HQ as a territory source', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    expect(state.sources).toHaveLength(1);
    expect(state.sources[0]!.footprintClaimed).toBe(true);
  });

  it('seeds frontier from HQ footprint', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    // Frontier should contain unclaimed neighbors of the HQ footprint
    expect(state.frontier.length).toBeGreaterThan(0);
  });

  it('uses specified faction color', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'green');
    const tile = getTerritoryTile(state, 4, 4);
    expect(tile!.owner).toBe('green');
  });
});

describe('addBuildingSource', () => {
  it('registers a building as territory source', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state, building, 'cyan');
    expect(state.sources).toHaveLength(2);
  });

  it('building footprint starts unclaimed (nextFillIndex=0)', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state, building, 'cyan');
    const source = state.sources[1]!;
    expect(source.footprintClaimed).toBe(false);
    expect(source.nextFillIndex).toBe(0);
  });
});

describe('tickTerritory — footprint fill', () => {
  it('2x2 building footprint fills sequentially over about 45-60s', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state, building, 'cyan');

    // After 15s, first tile should be fully claimed
    tickTerritory(state, map, 15);
    const tile0 = getTerritoryTile(state, 8, 4);
    expect(tile0!.progress).toBe(1);

    // After 30s total, second tile should be fully claimed
    tickTerritory(state, map, 15);
    const tile1 = getTerritoryTile(state, 9, 4);
    expect(tile1!.progress).toBe(1);

    // After 45s total, third tile should be fully claimed
    tickTerritory(state, map, 15);
    const tile2 = getTerritoryTile(state, 8, 5);
    expect(tile2!.progress).toBe(1);

    // After 60s total, all four tiles should be fully claimed
    tickTerritory(state, map, 15);
    const tile3 = getTerritoryTile(state, 9, 5);
    expect(tile3!.progress).toBe(1);
  });

  it('footprint fill is sequential (one tile at a time)', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state, building, 'cyan');

    // After 7.5s (half of TERRITORY_TILE_FILL_SECONDS), only first tile has progress
    tickTerritory(state, map, 7.5);
    const tile0 = getTerritoryTile(state, 8, 4);
    const tile1 = getTerritoryTile(state, 9, 4);
    expect(tile0!.progress).toBeCloseTo(0.5, 1);
    expect(tile1!.progress).toBe(0); // not started yet
  });

  it('building source seeds frontier after footprint is fully claimed', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // Place building far from HQ so its footprint tiles are NOT pre-claimed by spread
    const building: BuildingPlacement = { tx: 16, ty: 16, type: 'separator' };
    addBuildingSource(state, building, 'cyan');

    // Tick enough time for footprint fill — each tile takes TERRITORY_TILE_FILL_SECONDS
    // and there are 4 tiles (2x2 footprint), so 4 * TERRITORY_TILE_FILL_SECONDS total
    // Add a small buffer to account for floating point
    tickTerritory(state, map, 4 * TERRITORY_TILE_FILL_SECONDS + 0.1);

    // After footprint is claimed, frontier should include building's neighbors
    expect(state.sources[1]!.footprintClaimed).toBe(true);
    // Verify building tiles are claimed
    expect(getTerritoryTile(state, 16, 16)!.progress).toBe(1);
    expect(getTerritoryTile(state, 17, 17)!.progress).toBe(1);
    // Frontier should have grown from the building's neighbors
    expect(state.frontier.length).toBeGreaterThan(0);
  });

  it('partial fill progress is tracked', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state, building, 'cyan');

    tickTerritory(state, map, 5);
    const tile = getTerritoryTile(state, 8, 4);
    expect(tile!.progress).toBeGreaterThan(0);
    expect(tile!.progress).toBeLessThan(1);
    expect(tile!.owner).toBe('cyan');
  });
});

describe('tickTerritory — spread timing', () => {
  it('no outward spread before 45 seconds', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const hqTiles = HQ_FOOTPRINT * HQ_FOOTPRINT; // 9

    // Tick 44 seconds — not enough for even one radius-1 spread
    tickTerritory(state, map, 44);
    expect(countClaimedTiles(state)).toBe(hqTiles);
  });

  it('after 45 seconds, exactly one radius-1 tile is claimed', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const hqTiles = HQ_FOOTPRINT * HQ_FOOTPRINT; // 9

    // Tick exactly 45 seconds — one radius-1 tile should be claimed
    tickTerritory(state, map, 45);
    expect(countClaimedTiles(state)).toBe(hqTiles + 1);
  });

  it('radius-2 tile is not claimed at 45 seconds', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // Tick 45 seconds — only one radius-1 tile, no radius-2 tile claimed
    tickTerritory(state, map, 45);

    // Check that no tile at expansion radius 2 or higher is claimed
    // HQ center is at (5,5). Expansion radius 2 tiles are at Chebyshev dist 3 from center.
    const hqCx = 4 + Math.floor(HQ_FOOTPRINT / 2);
    const hqCy = 4 + Math.floor(HQ_FOOTPRINT / 2);
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        const tile = getTerritoryTile(state, tx, ty);
        if (tile!.progress > 0) {
          const chebyshevDist = Math.max(Math.abs(tx - hqCx), Math.abs(ty - hqCy));
          const expansionRadius = chebyshevDist - Math.floor(HQ_FOOTPRINT / 2);
          if (expansionRadius >= 2) {
            expect.fail(`Tile at (${tx},${ty}) with expansion radius ${expansionRadius} should not be claimed after 45s`);
          }
        }
      }
    }
  });

  it('spread remains one tile per spread event', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const hqTiles = HQ_FOOTPRINT * HQ_FOOTPRINT; // 9

    // 45s → one tile
    tickTerritory(state, map, 45);
    expect(countClaimedTiles(state)).toBe(hqTiles + 1);

    // Another 45s → one more tile
    tickTerritory(state, map, 45);
    expect(countClaimedTiles(state)).toBe(hqTiles + 2);

    // Another 45s → one more tile
    tickTerritory(state, map, 45);
    expect(countClaimedTiles(state)).toBe(hqTiles + 3);
  });

  it('radius-2 tiles require 90 seconds per tile after becoming next frontier', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const hqTiles = HQ_FOOTPRINT * HQ_FOOTPRINT; // 9

    // Count radius-1 frontier tiles around the HQ
    // HQ center at (5,5), footprint size 3. Expansion radius 1 = Chebyshev dist 2.
    // We need to claim all radius-1 tiles before radius-2 tiles become the next frontier.
    // There are 16 radius-1 tiles around the 3x3 footprint.
    // Each takes 45s. So 16 * 45 = 720s to fill all radius-1 tiles.
    // Then radius-2 tiles need 90s each.

    // Tick enough to fill all radius-1 tiles (16 tiles * 45s = 720s)
    tickTerritory(state, map, 16 * 45);
    expect(countClaimedTiles(state)).toBe(hqTiles + 16);

    // Now the frontier should contain radius-2 tiles
    // 89 seconds is not enough for one radius-2 tile (needs 90s)
    tickTerritory(state, map, 89);
    expect(countClaimedTiles(state)).toBe(hqTiles + 16); // no new tile

    // 1 more second (total 90s for radius-2) → one radius-2 tile claimed
    tickTerritory(state, map, 1);
    expect(countClaimedTiles(state)).toBe(hqTiles + 17);
  });

  it('territorySpreadDelay formula matches expected values', () => {
    expect(territorySpreadDelay(1)).toBe(45);
    expect(territorySpreadDelay(2)).toBe(90);
    expect(territorySpreadDelay(3)).toBe(180);
    expect(territorySpreadDelay(4)).toBe(360);
    expect(territorySpreadDelay(5)).toBe(720);
  });

  it('max radius is 5', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // Advance a lot of time (enough for many spread steps)
    // Ring 1: 16 tiles * 45s = 720s
    // Ring 2: 20 tiles * 90s = 1800s
    // Ring 3: 24 tiles * 180s = 4320s
    // Ring 4: 28 tiles * 360s = 10080s
    // Ring 5: 32 tiles * 720s = 23040s
    // Total ≈ 40000s
    // Use a generous amount to ensure all tiles up to radius 5 are claimed
    for (let i = 0; i < 500; i++) {
      tickTerritory(state, map, 100);
    }

    // No tile should be claimed beyond expansion radius 5 from HQ
    const hqCx = 4 + Math.floor(HQ_FOOTPRINT / 2);
    const hqCy = 4 + Math.floor(HQ_FOOTPRINT / 2);
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        const tile = getTerritoryTile(state, tx, ty);
        if (tile!.progress > 0) {
          const chebyshevDist = Math.max(Math.abs(tx - hqCx), Math.abs(ty - hqCy));
          const expansionRadius = chebyshevDist - Math.floor(HQ_FOOTPRINT / 2);
          expect(expansionRadius).toBeLessThanOrEqual(TERRITORY_MAX_RADIUS);
        }
      }
    }
  });

  it('spread does not fill the entire radius instantly', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // One spread step (45s) should not claim everything
    tickTerritory(state, map, 45);

    // Check that there are unclaimed tiles within max radius
    const hqCx = 4 + Math.floor(HQ_FOOTPRINT / 2);
    const hqCy = 4 + Math.floor(HQ_FOOTPRINT / 2);
    let unclaimedWithinRadius = 0;
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        const chebyshevDist = Math.max(Math.abs(tx - hqCx), Math.abs(ty - hqCy));
        const expansionRadius = chebyshevDist - Math.floor(HQ_FOOTPRINT / 2);
        if (expansionRadius >= 1 && expansionRadius <= TERRITORY_MAX_RADIUS) {
          const tile = getTerritoryTile(state, tx, ty);
          if (tile!.progress === 0) unclaimedWithinRadius++;
        }
      }
    }
    expect(unclaimedWithinRadius).toBeGreaterThan(0);
  });
});

describe('tickTerritory — safety', () => {
  it('dt=0 is safe and idempotent', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const countBefore = countClaimedTiles(state);
    tickTerritory(state, map, 0);
    const countAfter = countClaimedTiles(state);
    expect(countAfter).toBe(countBefore);
  });

  it('negative dt is safe', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const countBefore = countClaimedTiles(state);
    tickTerritory(state, map, -5);
    const countAfter = countClaimedTiles(state);
    expect(countAfter).toBe(countBefore);
  });
});

describe('territory does not block construction', () => {
  it('claimed territory tiles are not present in the construction occupied set', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // Tick enough for territory to spread beyond HQ (one radius-1 tile at 45s)
    tickTerritory(state, map, 45);

    // Collect all territory-claimed tile coordinates
    const claimedCoords: string[] = [];
    for (let ty = 0; ty < state.height; ty++) {
      for (let tx = 0; tx < state.width; tx++) {
        const tile = getTerritoryTile(state, tx, ty);
        if (tile && tile.progress > 0) {
          claimedCoords.push(`${tx},${ty}`);
        }
      }
    }

    // Territory must have spread beyond just the HQ footprint
    expect(claimedCoords.length).toBeGreaterThan(HQ_FOOTPRINT * HQ_FOOTPRINT);

    // Build the construction occupied set from the same map data
    const occupied = buildOccupiedTileSet(map);

    // No territory-claimed tile outside the HQ footprint should appear in
    // the construction occupied set. HQ tiles will overlap (expected — HQ
    // occupies itself), so filter those out.
    const hqTileSet = new Set<string>();
    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        hqTileSet.add(`${map.hq.tx + dx},${map.hq.ty + dy}`);
      }
    }

    let territoryOnlyButOccupied = 0;
    for (const coord of claimedCoords) {
      if (hqTileSet.has(coord)) continue; // HQ overlap is expected
      if (occupied.has(coord)) {
        territoryOnlyButOccupied++;
      }
    }

    // Territory spread tiles must NOT be in the construction occupied set
    expect(territoryOnlyButOccupied).toBe(0);
  });
});

describe('getTerritoryTile', () => {
  it('returns undefined for out-of-bounds', () => {
    const state = createTerritoryState(20, 20);
    expect(getTerritoryTile(state, -1, 0)).toBeUndefined();
    expect(getTerritoryTile(state, 0, -1)).toBeUndefined();
    expect(getTerritoryTile(state, 20, 0)).toBeUndefined();
    expect(getTerritoryTile(state, 0, 20)).toBeUndefined();
  });

  it('returns tile for in-bounds coordinates', () => {
    const state = createTerritoryState(20, 20);
    const tile = getTerritoryTile(state, 5, 5);
    expect(tile).toBeDefined();
    expect(tile!.progress).toBe(0);
  });
});

describe('isTileClaimed', () => {
  it('returns false for unclaimed tiles', () => {
    const state = createTerritoryState(20, 20);
    expect(isTileClaimed(state, 10, 10)).toBe(false);
  });

  it('returns true for claimed tiles', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    expect(isTileClaimed(state, 4, 4)).toBe(true);
  });

  it('returns false for out-of-bounds', () => {
    const state = createTerritoryState(20, 20);
    expect(isTileClaimed(state, -1, 0)).toBe(false);
  });
});

describe('countClaimedTiles', () => {
  it('counts all tiles with progress > 0', () => {
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    // HQ footprint = 3x3 = 9 tiles
    expect(countClaimedTiles(state)).toBe(9);
  });

  it('increases as territory spreads', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const initial = countClaimedTiles(state);
    // 3 spread steps at 45s each
    tickTerritory(state, map, 3 * TERRITORY_SPREAD_BASE_DELAY);
    expect(countClaimedTiles(state)).toBeGreaterThan(initial);
  });
});

describe('deterministic behavior', () => {
  it('territory state evolves deterministically with same inputs', () => {
    const map1 = createMinimalMap();
    const state1 = createTerritoryState(20, 20);
    initTerritoryFromHq(state1, 4, 4, 'cyan');

    const map2 = createMinimalMap();
    const state2 = createTerritoryState(20, 20);
    initTerritoryFromHq(state2, 4, 4, 'cyan');

    // Add same building to both
    const building: BuildingPlacement = { tx: 8, ty: 4, type: 'separator' };
    addBuildingSource(state1, building, 'cyan');
    addBuildingSource(state2, building, 'cyan');

    // Tick both with same dt
    for (let i = 0; i < 20; i++) {
      tickTerritory(state1, map1, 50);
      tickTerritory(state2, map2, 50);
    }

    expect(countClaimedTiles(state1)).toBe(countClaimedTiles(state2));
    for (let i = 0; i < state1.tiles.length; i++) {
      expect(state1.tiles[i]!.progress).toBeCloseTo(state2.tiles[i]!.progress, 5);
    }
  });
});
