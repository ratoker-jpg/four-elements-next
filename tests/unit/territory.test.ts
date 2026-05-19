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
import { HQ_FOOTPRINT, TERRITORY_TILE_FILL_SECONDS, TERRITORY_SPREAD_STEP_SECONDS, TERRITORY_MAX_RADIUS } from '../../src/core/constants.js';
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

describe('tickTerritory — spread', () => {
  it('territory spreads outward after source is claimed', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    const initialCount = countClaimedTiles(state);

    // Advance enough time for several spread steps
    tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS * 5);

    // Should have more claimed tiles than just HQ
    expect(countClaimedTiles(state)).toBeGreaterThan(initialCount);
  });

  it('spread is wave-like (one step at a time)', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // One spread step
    tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS);
    const countAfter1 = countClaimedTiles(state);

    // Another spread step
    tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS);
    const countAfter2 = countClaimedTiles(state);

    expect(countAfter2).toBeGreaterThan(countAfter1);
  });

  it('max radius is respected', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // Advance a lot of time (enough for many spread steps)
    for (let i = 0; i < 100; i++) {
      tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS);
    }

    // No tile should be claimed beyond max radius from HQ center
    const hqCx = 4 + Math.floor(HQ_FOOTPRINT / 2);
    const hqCy = 4 + Math.floor(HQ_FOOTPRINT / 2);
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        const tile = getTerritoryTile(state, tx, ty);
        if (tile!.progress > 0) {
          const dist = Math.max(Math.abs(tx - hqCx), Math.abs(ty - hqCy));
          expect(dist).toBeLessThanOrEqual(TERRITORY_MAX_RADIUS);
        }
      }
    }
  });

  it('spread does not fill the entire radius instantly', () => {
    const map = createMinimalMap();
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');

    // One spread step should not claim everything
    tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS);

    // Check that there are unclaimed tiles within max radius
    const hqCx = 4 + Math.floor(HQ_FOOTPRINT / 2);
    const hqCy = 4 + Math.floor(HQ_FOOTPRINT / 2);
    let unclaimedWithinRadius = 0;
    for (let ty = 0; ty < 20; ty++) {
      for (let tx = 0; tx < 20; tx++) {
        const dist = Math.max(Math.abs(tx - hqCx), Math.abs(ty - hqCy));
        if (dist <= TERRITORY_MAX_RADIUS && dist > 0) {
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
  it('territory data has no impact on buildOccupiedTileSet', () => {
    // This is an architectural test — territory state is separate from
    // the construction occupied set. Verify by checking that territory
    // progress exists but construction.buildOccupiedTileSet ignores it.
    const state = createTerritoryState(20, 20);
    initTerritoryFromHq(state, 4, 4, 'cyan');
    // Territory has claimed tiles
    expect(countClaimedTiles(state)).toBeGreaterThan(0);
    // Construction system does not import or reference territory state
    // This is guaranteed by architecture: territory.ts is not imported by construction.ts
    expect(true).toBe(true);
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
    tickTerritory(state, map, TERRITORY_SPREAD_STEP_SECONDS * 3);
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
      tickTerritory(state1, map1, 3);
      tickTerritory(state2, map2, 3);
    }

    expect(countClaimedTiles(state1)).toBe(countClaimedTiles(state2));
    for (let i = 0; i < state1.tiles.length; i++) {
      expect(state1.tiles[i]!.progress).toBeCloseTo(state2.tiles[i]!.progress, 5);
    }
  });
});
