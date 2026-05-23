/**
 * Pathfinding/passability telemetry and passability grid cache.
 *
 * PATH-TELEMETRY-CACHE-01: Lightweight telemetry counters for pathfinding
 * operations and a safe passability grid cache that avoids rebuilding the
 * grid when blockers have not changed since the last build.
 *
 * Telemetry:
 * - Counters for path calls, grid builds, cache hits/misses
 * - Accessible in tests and optionally in dev mode
 * - Reset function for tests/dev panel
 * - Does NOT affect gameplay determinism
 * - Does NOT spam console
 *
 * PassabilityCache:
 * - Caches the PassabilityGrid built from MapData + ResourceNodeState
 * - Invalidates when passability-relevant state changes
 * - Does not mutate canonical MapData
 * - Safe against stale blockers via version tracking
 *
 * Invalidation rules (must invalidate when any of these happen):
 * - Construction site is created
 * - Construction site is completed into a building
 * - Construction site is cancelled/removed
 * - Finite resource depletes to 0 and becomes non-blocking
 * - Map load / new game map replacement
 * - Editor map change / editor placement/removal
 * - Dev tool: add obstacle, add resource, clear construction
 */

import type { PassabilityGrid } from './passability.js';
import { buildPassabilityGrid } from './passability.js';
import type { MapData } from '../game/map-types.js';
import type { ResourceNodeState } from './harvesting.js';

// ── Telemetry counters ───────────────────────────────────────────────

/**
 * Snapshot of pathfinding/passability telemetry counters.
 * All fields are read-only numbers safe to expose via window.__pathfindingTelemetry.
 */
export interface PathfindingTelemetrySnapshot {
  /** Total number of pathfinding/BFS path calls (findPath, findPathToAdjacent). */
  pathCalls: number;
  /** Total number of passability grid builds (cache misses + initial). */
  gridBuilds: number;
  /** Total number of passability cache hits (grid reused without rebuild). */
  cacheHits: number;
  /** Total number of passability cache misses (grid needed rebuild). */
  cacheMisses: number;
  /** Current passability version (incremented on each invalidation). */
  passabilityVersion: number;
}

/**
 * Internal mutable telemetry state. Not exported directly.
 * Use getTelemetrySnapshot() for read-only access and resetTelemetry() to reset.
 */
const telemetry: {
  pathCalls: number;
  gridBuilds: number;
  cacheHits: number;
  cacheMisses: number;
  passabilityVersion: number;
} = {
  pathCalls: 0,
  gridBuilds: 0,
  cacheHits: 0,
  cacheMisses: 0,
  passabilityVersion: 0,
};

/** Get a read-only snapshot of current telemetry counters. */
export function getTelemetrySnapshot(): PathfindingTelemetrySnapshot {
  return { ...telemetry };
}

/** Reset all telemetry counters to zero. Useful for tests and dev panel. */
export function resetTelemetry(): void {
  telemetry.pathCalls = 0;
  telemetry.gridBuilds = 0;
  telemetry.cacheHits = 0;
  telemetry.cacheMisses = 0;
  // Note: passabilityVersion is NOT reset — it must remain monotonically
  // increasing to prevent stale cache hits after reset.
}

/** Increment path call counter. Called by pathfinding functions. */
export function recordPathCall(): void {
  telemetry.pathCalls++;
}

/** Increment grid build counter. Called when the grid is actually rebuilt. */
export function recordGridBuild(): void {
  telemetry.gridBuilds++;
}

/** Increment cache hit counter. Called when a cached grid is reused. */
export function recordCacheHit(): void {
  telemetry.cacheHits++;
}

/** Increment cache miss counter. Called when the cache is invalid and a rebuild is needed. */
export function recordCacheMiss(): void {
  telemetry.cacheMisses++;
}

// ── Passability cache ────────────────────────────────────────────────

/**
 * Fingerprint of passability-relevant state.
 * Used to detect changes without deep-comparing the entire MapData.
 *
 * The fingerprint captures counts and content hashes of all arrays that
 * affect passability: buildings, construction sites, obstacles, resources,
 * and resource node depletion states.
 */
interface PassabilityFingerprint {
  /** Number of completed buildings. */
  buildingCount: number;
  /** Hash of building positions and types. */
  buildingHash: string;
  /** Number of construction sites. */
  siteCount: number;
  /** Hash of construction site positions and types. */
  siteHash: string;
  /** Number of obstacles. */
  obstacleCount: number;
  /** Hash of obstacle positions and footprints. */
  obstacleHash: string;
  /** Number of resources. */
  resourceCount: number;
  /** Hash of resource positions, types, footprints, and depletion state. */
  resourceHash: string;
  /** Map dimensions (width x height). */
  mapDimensions: string;
  /** HQ position. */
  hqPosition: string;
}

/** Cached passability grid with its fingerprint and version. */
interface CachedGrid {
  grid: PassabilityGrid;
  fingerprint: PassabilityFingerprint;
  version: number;
}

/** The singleton cache. Null means no cached grid. */
let cachedGrid: CachedGrid | null = null;

/**
 * Compute a simple hash string from an array of objects.
 * Uses JSON.stringify for deterministic serialization, then a fast
 * character-sum hash to keep the fingerprint small.
 */
function fingerprintHash(items: ReadonlyArray<unknown>): string {
  if (items.length === 0) return '0';
  const json = JSON.stringify(items);
  let h = 0;
  for (let i = 0; i < json.length; i++) {
    // Simple DJB2-style hash
    h = ((h << 5) - h + json.charCodeAt(i)) | 0;
  }
  return h.toString(36);
}

/**
 * Compute a fingerprint of passability-relevant state from MapData + ResourceNodeState.
 *
 * This captures everything that affects the passability grid:
 * - HQ position (tx, ty)
 * - Buildings (tx, ty, type)
 * - Construction sites (tx, ty, type)
 * - Obstacles (tx, ty, footprint)
 * - Resources with depletion state (tx, ty, type, footprint, depleted)
 * - Map dimensions
 */
function computeFingerprint(
  map: MapData,
  resourceNodes?: readonly ResourceNodeState[],
): PassabilityFingerprint {
  // Buildings: only tx, ty, type affect passability
  const buildingData = map.buildings.map((b) => `${b.tx},${b.ty},${b.type}`);
  // Construction sites: tx, ty, type affect passability
  const siteData = map.constructionSites.map((s) => `${s.tx},${s.ty},${s.type}`);
  // Obstacles: tx, ty, footprint affect passability
  const obstacleData = map.obstacles.map((o) => `${o.tx},${o.ty},${o.footprint}`);
  // Resources: tx, ty, footprint, and whether depleted (which changes passability)
  const resourceData = map.resources.map((r, i) => {
    let depleted = false;
    if (resourceNodes) {
      const node = resourceNodes[i];
      depleted = !!node && !node.infinite && node.remaining <= 0;
    }
    return `${r.tx},${r.ty},${r.footprint},${r.type},${depleted}`;
  });

  return {
    buildingCount: map.buildings.length,
    buildingHash: fingerprintHash(buildingData),
    siteCount: map.constructionSites.length,
    siteHash: fingerprintHash(siteData),
    obstacleCount: map.obstacles.length,
    obstacleHash: fingerprintHash(obstacleData),
    resourceCount: map.resources.length,
    resourceHash: fingerprintHash(resourceData),
    mapDimensions: `${map.width}x${map.height}`,
    hqPosition: `${map.hq.tx},${map.hq.ty}`,
  };
}

/**
 * Check if a fingerprint matches the cached one.
 * Returns true if they are identical (no passability-relevant change).
 */
function fingerprintMatches(a: PassabilityFingerprint, b: PassabilityFingerprint): boolean {
  return (
    a.buildingCount === b.buildingCount
    && a.buildingHash === b.buildingHash
    && a.siteCount === b.siteCount
    && a.siteHash === b.siteHash
    && a.obstacleCount === b.obstacleCount
    && a.obstacleHash === b.obstacleHash
    && a.resourceCount === b.resourceCount
    && a.resourceHash === b.resourceHash
    && a.mapDimensions === b.mapDimensions
    && a.hqPosition === b.hqPosition
  );
}

/**
 * Get or build the passability grid for the current MapData + ResourceNodeState.
 *
 * If the cached grid's fingerprint still matches the current state, the
 * cached grid is returned without rebuilding. Otherwise, a new grid is
 * built, cached, and returned.
 *
 * This function is the primary integration point for the passability cache.
 * Systems that currently call buildPassabilityGrid() directly should call
 * getPassabilityGrid() instead to benefit from caching.
 *
 * The grid returned is a new reference on cache miss (rebuild), or the
 * same reference on cache hit. Callers MUST NOT mutate the returned grid.
 */
export function getPassabilityGrid(
  map: MapData,
  resourceNodes?: readonly ResourceNodeState[],
): PassabilityGrid {
  const newFingerprint = computeFingerprint(map, resourceNodes);

  if (cachedGrid && fingerprintMatches(cachedGrid.fingerprint, newFingerprint)) {
    // Cache hit — fingerprint unchanged, reuse cached grid
    recordCacheHit();
    return cachedGrid.grid;
  }

  // Cache miss — rebuild the grid
  recordCacheMiss();
  const grid = buildPassabilityGrid(map, resourceNodes);
  recordGridBuild();

  telemetry.passabilityVersion++;

  cachedGrid = {
    grid,
    fingerprint: newFingerprint,
    version: telemetry.passabilityVersion,
  };

  return grid;
}

/**
 * Invalidate the passability cache unconditionally.
 *
 * Called when a passability-relevant event occurs that cannot be detected
 * by fingerprint comparison alone (e.g., map replacement where the new map
 * happens to have the same fingerprint by coincidence).
 *
 * Also used as an explicit invalidation hook for events like:
 * - Map load / new game
 * - Editor map change
 * - Dev tool actions that modify map state
 */
export function invalidatePassabilityCache(): void {
  cachedGrid = null;
  telemetry.passabilityVersion++;
}

/**
 * Clear the cache entirely (for tests or game reset).
 * Also resets the cached grid reference.
 */
export function clearPassabilityCache(): void {
  cachedGrid = null;
}

// ── Dev/test exposure ────────────────────────────────────────────────

/**
 * Pathfinding telemetry API exposed on window.__pathfindingTelemetry
 * in dev/test mode. Uses the existing window.__* pattern from game-world.ts.
 */
export interface PathfindingTelemetryAPI {
  /** Get a read-only snapshot of current telemetry counters. */
  getSnapshot(): PathfindingTelemetrySnapshot;
  /** Reset all telemetry counters to zero. */
  reset(): void;
}

/**
 * Create the PathfindingTelemetryAPI object for window exposure.
 * Called once from GameWorld when the game starts.
 */
export function createPathfindingTelemetryAPI(): PathfindingTelemetryAPI {
  return {
    getSnapshot: getTelemetrySnapshot,
    reset: resetTelemetry,
  };
}
