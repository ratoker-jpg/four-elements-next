import { describe, it, expect, beforeEach } from 'vitest';
import {
  getTelemetrySnapshot,
  resetTelemetry,
  getPassabilityGrid,
  invalidatePassabilityCache,
  clearPassabilityCache,
  createPathfindingTelemetryAPI,
  type PathfindingTelemetrySnapshot,
} from '../../src/systems/path-telemetry.js';
import { buildPassabilityGrid, isTilePassable, isTileBlocked } from '../../src/systems/passability.js';
import { findPath, findPathToAdjacent } from '../../src/systems/pathfinding.js';
import type { MapData } from '../../src/game/map-types.js';
import type { ResourceNodeState } from '../../src/systems/harvesting.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';

// ── Test helpers ──────────────────────────────────────────────────────

/** Create a minimal MapData for telemetry tests. */
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

/** Reset telemetry and cache before each test. */
function resetAll(): void {
  resetTelemetry();
  clearPassabilityCache();
}

// ── Telemetry counters ────────────────────────────────────────────────

describe('pathfinding telemetry: counters', () => {
  beforeEach(() => {
    resetAll();
  });

  it('starts with all counters at zero', () => {
    const snap = getTelemetrySnapshot();
    expect(snap.pathCalls).toBe(0);
    expect(snap.gridBuilds).toBe(0);
    expect(snap.cacheHits).toBe(0);
    expect(snap.cacheMisses).toBe(0);
  });

  it('resetTelemetry resets counters to zero but preserves version', () => {
    const map = createMinimalMap();
    getPassabilityGrid(map); // causes a cache miss + grid build
    const versionBefore = getTelemetrySnapshot().passabilityVersion;
    expect(getTelemetrySnapshot().gridBuilds).toBe(1);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    resetTelemetry();
    const snap = getTelemetrySnapshot();
    expect(snap.pathCalls).toBe(0);
    expect(snap.gridBuilds).toBe(0);
    expect(snap.cacheHits).toBe(0);
    expect(snap.cacheMisses).toBe(0);
    // Version is NOT reset — must remain monotonically increasing
    expect(snap.passabilityVersion).toBe(versionBefore);
  });

  it('path call counter increments on findPath', () => {
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    findPath(grid, 0, 0, 5, 5);
    expect(getTelemetrySnapshot().pathCalls).toBe(1);
    findPath(grid, 5, 5, 10, 10);
    expect(getTelemetrySnapshot().pathCalls).toBe(2);
  });

  it('path call counter increments on findPathToAdjacent', () => {
    const map = createMinimalMap();
    const grid = buildPassabilityGrid(map);
    findPathToAdjacent(grid, 0, 0, 5, 5, 1);
    expect(getTelemetrySnapshot().pathCalls).toBe(1);
  });

  it('telemetry counters increment for grid builds and cache hits/misses', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss, triggers grid build
    getPassabilityGrid(map, nodes);
    let snap = getTelemetrySnapshot();
    expect(snap.cacheMisses).toBe(1);
    expect(snap.cacheHits).toBe(0);
    expect(snap.gridBuilds).toBe(1);

    // Second call: same map, no changes → cache hit
    getPassabilityGrid(map, nodes);
    snap = getTelemetrySnapshot();
    expect(snap.cacheMisses).toBe(1);
    expect(snap.cacheHits).toBe(1);
    expect(snap.gridBuilds).toBe(1);
  });
});

// ── Cache hit/miss ───────────────────────────────────────────────────

describe('passability cache: hit and miss', () => {
  beforeEach(() => {
    resetAll();
  });

  it('repeated passability request without changes uses cache hit', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    const grid1 = getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);

    // Second call: cache hit
    const grid2 = getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheHits).toBe(1);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Grids should be the same reference
    expect(grid2).toBe(grid1);
  });

  it('cache miss after map state change', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Modify map: add a building
    map.buildings.push({ tx: 15, ty: 5, type: 'raw-storage' });

    // Second call: cache miss because state changed
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });
});

// ── Cache invalidation: construction site ────────────────────────────

describe('passability cache: construction site invalidation', () => {
  beforeEach(() => {
    resetAll();
  });

  it('creating construction site invalidates cache', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Add a construction site
    map.constructionSites.push({
      tx: 10, ty: 8, type: 'separator', elapsed: 0, duration: 25, progress: 0,
      builderIndex: 0, id: 1, pending: false,
    });

    // Second call: cache miss because state changed
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });

  it('completing construction (site → building) invalidates cache', () => {
    const map = createMinimalMap({
      constructionSites: [{
        tx: 10, ty: 8, type: 'separator', elapsed: 24, duration: 25, progress: 0.96,
        builderIndex: 0, id: 1, pending: false,
      }],
    });
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Complete construction: remove site, add building
    map.constructionSites.length = 0;
    map.buildings.push({ tx: 10, ty: 8, type: 'separator' });

    // Second call: cache miss because state changed
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });

  it('cancelling construction site invalidates cache', () => {
    const map = createMinimalMap({
      constructionSites: [{
        tx: 10, ty: 8, type: 'separator', elapsed: 0, duration: 25, progress: 0,
        builderIndex: 0, id: 1, pending: false,
      }],
    });
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Cancel construction: remove site
    map.constructionSites.length = 0;

    // Second call: cache miss because state changed
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });
});

// ── Cache invalidation: resource depletion ───────────────────────────

describe('passability cache: finite resource depletion invalidation', () => {
  beforeEach(() => {
    resetAll();
  });

  it('finite resource depleting to 0 invalidates cache', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const nodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 50 },
    ];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Deplete resource
    nodes[0]!.remaining = 0;

    // Second call: cache miss because depletion changed passability
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });

  it('partial resource depletion (still > 0) does not invalidate cache', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const nodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 50 },
    ];

    // First call: cache miss
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Partial depletion (still positive) — still blocking, fingerprint unchanged
    nodes[0]!.remaining = 30;

    // Second call: cache hit because passability didn't change (still > 0)
    getPassabilityGrid(map, nodes);
    expect(getTelemetrySnapshot().cacheHits).toBe(1);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);
  });
});

// ── Cache invalidation: map replacement ──────────────────────────────

describe('passability cache: map replacement', () => {
  beforeEach(() => {
    resetAll();
  });

  it('map replacement creates fresh cache via invalidatePassabilityCache', () => {
    const map1 = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: cache miss
    getPassabilityGrid(map1, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(1);

    // Simulate map replacement (new game / editor launch)
    invalidatePassabilityCache();

    // Second call on same map: still cache miss because cache was invalidated
    getPassabilityGrid(map1, nodes);
    expect(getTelemetrySnapshot().cacheMisses).toBe(2);
    expect(getTelemetrySnapshot().cacheHits).toBe(0);
  });
});

// ── Stale grid prevention ────────────────────────────────────────────

describe('passability cache: stale grid prevention', () => {
  beforeEach(() => {
    resetAll();
  });

  it('grid correctly reflects new building after invalidation', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    // First call: no building
    const grid1 = getPassabilityGrid(map, nodes);
    expect(isTileBlocked(grid1, 15, 5)).toBe(false);
    expect(isTileBlocked(grid1, 16, 5)).toBe(false);

    // Add a building (2x2 footprint at 15,5)
    map.buildings.push({ tx: 15, ty: 5, type: 'raw-storage' });

    // Second call: should detect change and rebuild
    const grid2 = getPassabilityGrid(map, nodes);
    expect(isTileBlocked(grid2, 15, 5)).toBe(true);
    expect(isTileBlocked(grid2, 16, 5)).toBe(true);

    // Grids should be different references
    expect(grid2).not.toBe(grid1);
  });

  it('grid correctly reflects depleted resource becoming passable', () => {
    const map = createMinimalMap({
      resources: [{ tx: 8, ty: 3, type: 'small', footprint: 1 }],
    });
    const nodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 50 },
    ];

    // First call: resource is active, tile is blocked
    const grid1 = getPassabilityGrid(map, nodes);
    expect(isTileBlocked(grid1, 8, 3)).toBe(true);

    // Deplete resource
    nodes[0]!.remaining = 0;

    // Second call: resource depleted, tile should be passable
    const grid2 = getPassabilityGrid(map, nodes);
    expect(isTilePassable(grid2, 8, 3)).toBe(true);
  });
});

// ── Pathfinding result consistency ───────────────────────────────────

describe('passability cache: pathfinding result consistency', () => {
  beforeEach(() => {
    resetAll();
  });

  it('pathfinding result remains the same before/after cache introduction on a fixed map', () => {
    const map = createMinimalMap({
      obstacles: [{ tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 }],
    });
    const nodes: ResourceNodeState[] = [];

    // Build grid directly (bypass cache) for reference result
    const directGrid = buildPassabilityGrid(map, nodes);
    const directResult = findPath(directGrid, 5, 5, 15, 15);

    // Get grid via cache
    const cachedGrid = getPassabilityGrid(map, nodes);
    const cachedResult = findPath(cachedGrid, 5, 5, 15, 15);

    // Results should be identical
    expect(cachedResult).toEqual(directResult);
  });
});

// ── Dev/test API ─────────────────────────────────────────────────────

describe('pathfinding telemetry API', () => {
  beforeEach(() => {
    resetAll();
  });

  it('createPathfindingTelemetryAPI provides getSnapshot and reset', () => {
    const api = createPathfindingTelemetryAPI();
    expect(typeof api.getSnapshot).toBe('function');
    expect(typeof api.reset).toBe('function');
  });

  it('API getSnapshot returns same structure as direct getTelemetrySnapshot', () => {
    const api = createPathfindingTelemetryAPI();
    const map = createMinimalMap();
    getPassabilityGrid(map);

    const apiSnap = api.getSnapshot();
    const directSnap = getTelemetrySnapshot();

    expect(apiSnap).toEqual(directSnap);
  });

  it('API reset resets counters', () => {
    const api = createPathfindingTelemetryAPI();
    const map = createMinimalMap();
    getPassabilityGrid(map);
    expect(api.getSnapshot().gridBuilds).toBe(1);

    api.reset();
    expect(api.getSnapshot().gridBuilds).toBe(0);
  });
});

// ── Version tracking ─────────────────────────────────────────────────

describe('passability version tracking', () => {
  beforeEach(() => {
    resetAll();
  });

  it('version increments on each cache miss', () => {
    const map = createMinimalMap();
    const nodes: ResourceNodeState[] = [];

    const v0 = getTelemetrySnapshot().passabilityVersion;
    getPassabilityGrid(map, nodes);
    const v1 = getTelemetrySnapshot().passabilityVersion;
    expect(v1).toBeGreaterThan(v0);

    // Same state → cache hit, version unchanged
    getPassabilityGrid(map, nodes);
    const v2 = getTelemetrySnapshot().passabilityVersion;
    expect(v2).toBe(v1);

    // Change state → cache miss, version increments
    map.buildings.push({ tx: 15, ty: 5, type: 'raw-storage' });
    getPassabilityGrid(map, nodes);
    const v3 = getTelemetrySnapshot().passabilityVersion;
    expect(v3).toBeGreaterThan(v2);
  });

  it('invalidatePassabilityCache increments version', () => {
    const v0 = getTelemetrySnapshot().passabilityVersion;
    invalidatePassabilityCache();
    const v1 = getTelemetrySnapshot().passabilityVersion;
    expect(v1).toBeGreaterThan(v0);
  });
});
