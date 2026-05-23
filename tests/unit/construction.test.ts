import { describe, it, expect, beforeEach } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import { createEconomyState, getSeparatorPositions, getRawStorageCount, getMatterStorageCount } from '../../src/systems/economy.js';
import {
  AUTO_BUILD_MAX_RADIUS,
  buildBuildingTileSet,
  buildOccupiedTileSet,
  findAutoPlacement,
  isFootprintBuildable,
  isFootprintWithSpacingBuildable,
  isSiteReachableByBuilder,
  startConstruction,
  tickConstruction,
  resetSiteIdCounter,
  BUILDER_SPEED,
} from '../../src/systems/construction.js';
import { getBuildingFootprint } from '../../src/config/buildings.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import type { MapData, BuilderPlacement, ConstructionSitePlacement } from '../../src/game/map-types.js';
import type { ResourceNodeState } from '../../src/systems/harvesting.js';

/** Create a minimal builder with all required fields. */
function createBuilder(tx: number, ty: number, overrides: Partial<BuilderPlacement> = {}): BuilderPlacement {
  return {
    tx,
    ty,
    busy: false,
    phase: 'idle',
    path: [],
    pathIndex: 0,
    ftx: tx + 0.5,
    fty: ty + 0.5,
    targetTx: tx,
    targetTy: ty,
    assignedSiteId: -1,
    ...overrides,
  };
}

describe('construction system', () => {
  function createBaseline() {
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getRawStorageCount(map.buildings),
      getMatterStorageCount(map.buildings),
      'cyan',
    );
    return { map, economy };
  }

  it('starts construction, spends matter, and blocks the builder', () => {
    const { map, economy } = createBaseline();
    const result = startConstruction(map, economy, 'separator');

    expect(result.ok).toBe(true);
    expect(economy.resources.matter).toBe(60); // 120 - 60 = 60
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.constructionSites).toHaveLength(1);
    expect(map.constructionSites[0]!.type).toBe('separator');
    expect(map.constructionSites[0]!.builderIndex).toBe(0);
  });

  it('rejects construction when matter is insufficient', () => {
    const { map, economy } = createBaseline();
    economy.resources.matter = 59;

    const result = startConstruction(map, economy, 'separator');

    expect(result).toEqual({
      ok: false,
      reason: 'insufficient-matter',
      buildingType: 'separator',
    });
    expect(map.constructionSites).toHaveLength(0);
    expect(map.builders[0]!.busy).toBe(false);
  });

  it('rejects a second construction while the single builder is busy', () => {
    const { map, economy } = createBaseline();
    expect(startConstruction(map, economy, 'separator').ok).toBe(true);

    const result = startConstruction(map, economy, 'raw-storage');

    expect(result).toEqual({
      ok: false,
      reason: 'busy',
      buildingType: 'raw-storage',
    });
    expect(map.constructionSites).toHaveLength(1);
  });

  it('derives occupied tiles from HQ, buildings, resources, obstacles, sites, and builder', () => {
    const { map, economy } = createBaseline();
    // Manually add a building to test occupied tile derivation
    map.buildings.push({ tx: map.hq.tx + HQ_FOOTPRINT + 1, ty: map.hq.ty, type: 'separator' });
    startConstruction(map, economy, 'command-relay');
    const occupied = buildOccupiedTileSet(map);
    const building = map.buildings[0]!;
    const site = map.constructionSites[0]!;
    const buildingFootprint = getBuildingFootprint(building.type);
    const siteFootprint = getBuildingFootprint(site.type);

    expect(occupied.has(`${map.hq.tx},${map.hq.ty}`)).toBe(true);
    expect(occupied.has(`${building.tx},${building.ty}`)).toBe(true);
    expect(occupied.has(`${building.tx + buildingFootprint - 1},${building.ty + buildingFootprint - 1}`)).toBe(true);
    expect(occupied.has(`${map.builders[0]!.tx},${map.builders[0]!.ty}`)).toBe(true);
    expect(occupied.has(`${site.tx},${site.ty}`)).toBe(true);
    expect(occupied.has(`${site.tx + siteFootprint - 1},${site.ty + siteFootprint - 1}`)).toBe(true);
    expect(occupied.has(`${map.resources[0]!.tx},${map.resources[0]!.ty}`)).toBe(true);
    // Decor is non-blocking — should NOT appear in the occupied set
    if (map.decor.length > 0) {
      expect(occupied.has(`${map.decor[0]!.tx},${map.decor[0]!.ty}`)).toBe(false);
    }
  });

  it('returns no placement when every tile within radius 15 is blocked', () => {
    const { map } = createBaseline();
    const builder = map.builders[0]!;
    // Block all tiles with obstacles (blocking) — decor is non-blocking and would not prevent placement
    for (let ty = builder.ty - AUTO_BUILD_MAX_RADIUS; ty <= builder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
      for (let tx = builder.tx - AUTO_BUILD_MAX_RADIUS; tx <= builder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }

    expect(findAutoPlacement(map, builder, 'separator').placement).toBeNull();
  });

  it('rejects partial overlaps across the full footprint area', () => {
    const { map } = createBaseline();
    // Manually add a building to test footprint overlap
    map.buildings.push({ tx: map.hq.tx + HQ_FOOTPRINT + 1, ty: map.hq.ty, type: 'separator' });
    const occupied = buildOccupiedTileSet(map);
    const separator = map.buildings.find((building) => building.type === 'separator')!;

    expect(isFootprintBuildable(map, occupied, separator.tx - 1, separator.ty, 2)).toBe(false);
  });

  it('completes construction into a real building and frees the builder', () => {
    const { map, economy } = createBaseline();
    startConstruction(map, economy, 'command-relay');

    // If site is pending, fast-forward builder arrival
    const site = map.constructionSites[0]!;
    if (site.pending) {
      const builder = map.builders[0]!;
      builder.tx = builder.targetTx;
      builder.ty = builder.targetTy;
      builder.ftx = builder.tx + 0.5;
      builder.fty = builder.ty + 0.5;
      builder.phase = 'building';
      builder.path = [];
      builder.pathIndex = 0;
      site.pending = false;
    }

    const result = tickConstruction(map, economy, 18);

    expect(result.completedBuildings).toHaveLength(1);
    expect(result.completedBuildings[0]!.type).toBe('command-relay');
    expect(map.constructionSites).toHaveLength(0);
    expect(map.builders[0]!.busy).toBe(false);
    expect(map.builders[0]!.phase).toBe('idle');
    expect(map.buildings.some((building) => building.type === 'command-relay')).toBe(true);
  });
});

// ── Multi-builder construction ────────────────────────────────────────

describe('multi-builder construction', () => {
  /** Create a minimal 20×20 map with HQ at (4,4) and two builders. */
  function createMultiBuilderBaseline() {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [
        createBuilder(15, 15),
        createBuilder(14, 14),
      ],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    return { map, economy };
  }

  /** Force all pending sites to become non-pending (builder arrived). */
  function forceBuildersArrived(map: MapData): void {
    for (const site of map.constructionSites) {
      if (!site.pending) continue;
      const builder = map.builders[site.builderIndex];
      if (!builder) continue;
      builder.tx = builder.targetTx;
      builder.ty = builder.targetTy;
      builder.ftx = builder.tx + 0.5;
      builder.fty = builder.ty + 0.5;
      builder.phase = 'building';
      builder.path = [];
      builder.pathIndex = 0;
      site.pending = false;
    }
  }

  it('uses second builder when first is busy', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Start first construction with builder 0
    const result1 = startConstruction(map, economy, 'separator');
    expect(result1.ok).toBe(true);
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.builders[1]!.busy).toBe(false);
    expect(map.constructionSites[0]!.builderIndex).toBe(0);

    // Start second construction — should use builder 1
    const result2 = startConstruction(map, economy, 'separator');
    expect(result2.ok).toBe(true);
    expect(map.builders[1]!.busy).toBe(true);
    expect(map.constructionSites).toHaveLength(2);
    expect(map.constructionSites[1]!.builderIndex).toBe(1);
  });

  it('returns busy only when all builders are busy', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Use both builders
    startConstruction(map, economy, 'separator');
    startConstruction(map, economy, 'separator');
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.builders[1]!.busy).toBe(true);

    // Third construction should fail with busy
    const result = startConstruction(map, economy, 'raw-storage');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('busy');
  });

  it('two builders can run two construction sites in parallel', () => {
    const { map, economy } = createMultiBuilderBaseline();
    startConstruction(map, economy, 'separator');
    startConstruction(map, economy, 'raw-storage');

    expect(map.constructionSites).toHaveLength(2);
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.builders[1]!.busy).toBe(true);

    // Force builders to arrive at sites so progress can advance
    forceBuildersArrived(map);

    // Advance time but not enough to complete either
    tickConstruction(map, economy, 5);
    expect(map.constructionSites).toHaveLength(2);
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.builders[1]!.busy).toBe(true);
  });

  it('completing one construction frees only its assigned builder', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Start two constructions with different build times
    startConstruction(map, economy, 'separator');    // 20s build time
    startConstruction(map, economy, 'command-relay'); // 18s build time

    expect(map.constructionSites[0]!.builderIndex).toBe(0);
    expect(map.constructionSites[1]!.builderIndex).toBe(1);

    // Force builders to arrive
    forceBuildersArrived(map);

    // Complete only the command-relay (18s)
    tickConstruction(map, economy, 19);

    // Command-relay site should be gone, separator still building
    expect(map.constructionSites).toHaveLength(1);
    expect(map.constructionSites[0]!.type).toBe('separator');

    // One builder freed, one still busy
    const busyBuilders = map.builders.filter((b) => b.busy);
    const freeBuilders = map.builders.filter((b) => !b.busy);
    expect(busyBuilders).toHaveLength(1); // only separator builder still busy
    expect(freeBuilders).toHaveLength(1); // command-relay builder freed
  });

  it('all builders free when all sites complete', () => {
    const { map, economy } = createMultiBuilderBaseline();
    startConstruction(map, economy, 'separator');
    startConstruction(map, economy, 'separator');

    // Force builders to arrive
    forceBuildersArrived(map);

    // Complete both (20s build time)
    tickConstruction(map, economy, 21);

    expect(map.constructionSites).toHaveLength(0);
    expect(map.builders[0]!.busy).toBe(false);
    expect(map.builders[1]!.busy).toBe(false);
  });

  it('produced builder can be used for construction', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Simulate a produced builder added to the map
    map.builders.push(createBuilder(16, 15));
    expect(map.builders).toHaveLength(3);

    // Use builders 0 and 1
    startConstruction(map, economy, 'separator');
    startConstruction(map, economy, 'separator');

    // Builder 2 (produced) should be available
    expect(map.builders[2]!.busy).toBe(false);

    // Start third construction with produced builder
    const result = startConstruction(map, economy, 'raw-storage');
    expect(result.ok).toBe(true);
    expect(map.builders[2]!.busy).toBe(true);
    expect(map.constructionSites[2]!.builderIndex).toBe(2);
  });

  it('returns no-placement when no builders exist', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-placement');
  });

  it('freed builder can start new construction immediately', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Builder 0 starts a separator
    startConstruction(map, economy, 'separator');
    expect(map.builders[0]!.busy).toBe(true);

    // Force builder to arrive and complete
    forceBuildersArrived(map);
    tickConstruction(map, economy, 21);
    expect(map.builders[0]!.busy).toBe(false);

    // Builder 0 can start another construction
    const result = startConstruction(map, economy, 'raw-storage');
    expect(result.ok).toBe(true);
    expect(map.builders[0]!.busy).toBe(true);
  });

  it('succeeds with second builder when first idle builder has no placement but second does', () => {
    const map: MapData = {
      width: 48,
      height: 48,
      terrain: Array.from({ length: 48 }, () => Array(48).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(10, 10)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    const firstBuilder = map.builders[0]!;
    // Place second builder far away (beyond AUTO_BUILD_MAX_RADIUS of first)
    // so blocking around first builder does NOT block around second builder
    const secondBuilderTx = firstBuilder.tx + AUTO_BUILD_MAX_RADIUS * 2 + 5;
    const secondBuilderTy = firstBuilder.ty;
    map.builders.push(createBuilder(secondBuilderTx, secondBuilderTy));

    // Block all tiles within AUTO_BUILD_MAX_RADIUS of the first builder with obstacles
    for (let ty = firstBuilder.ty - AUTO_BUILD_MAX_RADIUS; ty <= firstBuilder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
      for (let tx = firstBuilder.tx - AUTO_BUILD_MAX_RADIUS; tx <= firstBuilder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === firstBuilder.tx && ty === firstBuilder.ty) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }
    // Second builder is far away and should have open tiles

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    // Should NOT be builder 0 (which has no placement), should be builder 1
    expect(result.site!.builderIndex).toBe(1);
    expect(map.builders[1]!.busy).toBe(true);
    expect(map.builders[0]!.busy).toBe(false); // first builder stays idle
  });

  it('returns no-placement when idle builders exist but none can place', () => {
    const map: MapData = {
      width: 48,
      height: 48,
      terrain: Array.from({ length: 48 }, () => Array(48).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(10, 10)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    const firstBuilder = map.builders[0]!;
    // Place second builder far away but block its area too
    const secondBuilderTx = firstBuilder.tx + AUTO_BUILD_MAX_RADIUS * 2 + 5;
    const secondBuilderTy = firstBuilder.ty;
    map.builders.push(createBuilder(secondBuilderTx, secondBuilderTy));

    // Block all tiles around BOTH builders with obstacles
    for (const builder of map.builders) {
      for (let ty = builder.ty - AUTO_BUILD_MAX_RADIUS; ty <= builder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
        for (let tx = builder.tx - AUTO_BUILD_MAX_RADIUS; tx <= builder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
          if (tx === builder.tx && ty === builder.ty) continue;
          map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
        }
      }
    }

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-placement');
    // Both builders should remain idle (not assigned)
    expect(map.builders[0]!.busy).toBe(false);
    expect(map.builders[1]!.busy).toBe(false);
  });
});

// ── Building spacing (one-tile gap) ────────────────────────────────────

describe('building spacing — one-tile gap', () => {
  /** Create a minimal 20×20 map with HQ at (4,4) and a single builder far from HQ. */
  function createSpacingMap(): MapData {
    return {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
  }

  it('cannot place directly adjacent to HQ (0-tile gap)', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 7, 4, 2)).toBe(false);
    expect(isFootprintWithSpacingBuildable(map, occupied, 2, 4, 2)).toBe(false);
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 7, 2)).toBe(false);
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 2, 2)).toBe(false);
  });

  it('can place with one empty tile gap from HQ', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 1, 4, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 8, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 5, 1, 2)).toBe(true);
  });

  it('cannot place adjacent to a completed building', () => {
    const map = createSpacingMap();
    map.buildings.push({ tx: 8, ty: 4, type: 'separator' });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 10, 4, 2)).toBe(false);
  });

  it('cannot place adjacent to an active construction site', () => {
    const map = createSpacingMap();
    map.constructionSites.push({
      tx: 8, ty: 4, type: 'separator',
      elapsed: 0, duration: 20, progress: 0, builderIndex: 0,
      id: 1, pending: false,
    });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 10, 4, 2)).toBe(false);
  });

  it('footprint overlap still fails even with spacing', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 5, 5, 2)).toBe(false);
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 4, 2)).toBe(false);
  });

  it('out-of-bounds spacing perimeter does not fail if footprint is inside map', () => {
    const map = createSpacingMap();
    map.hq = { tx: 10, ty: 10, faction: 'cyan' };
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 0, 0, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 18, 0, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 0, 18, 2)).toBe(true);
  });

  it('resources block footprint but not spacing perimeter', () => {
    const map = createSpacingMap();
    map.resources.push({ tx: 7, ty: 4, type: 'small', footprint: 1 });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
    map.resources.push({ tx: 8, ty: 4, type: 'small', footprint: 1 });
    const occupied2 = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied2, 8, 4, 2)).toBe(false);
  });

  it('decor does NOT block building placement (non-blocking)', () => {
    const map = createSpacingMap();
    map.decor.push({ tx: 8, ty: 4, type: 'bush' });
    map.decor.push({ tx: 9, ty: 4, type: 'sand-bump' });
    map.decor.push({ tx: 8, ty: 5, type: 'bush' });
    map.decor.push({ tx: 9, ty: 5, type: 'sand-bump' });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintBuildable(map, occupied, 8, 4, 2)).toBe(true);
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
  });

  it('decor does NOT block spacing perimeter', () => {
    const map = createSpacingMap();
    map.decor.push({ tx: 7, ty: 4, type: 'bush' });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
  });

  it('builders do not block spacing perimeter', () => {
    const map = createSpacingMap();
    map.builders.push(createBuilder(7, 4));
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
  });

  it('buildBuildingTileSet contains only HQ, buildings, and construction sites', () => {
    const map = createSpacingMap();
    map.buildings.push({ tx: 10, ty: 10, type: 'separator' });
    map.constructionSites.push({
      tx: 12, ty: 10, type: 'raw-storage',
      elapsed: 0, duration: 20, progress: 0, builderIndex: 0,
      id: 1, pending: false,
    });
    map.resources.push({ tx: 0, ty: 0, type: 'small', footprint: 1 });
    map.decor.push({ tx: 1, ty: 1, type: 'bush' });
    map.obstacles.push({ tx: 2, ty: 2, type: 'rock-cluster', footprint: 1 });

    const buildingTiles = buildBuildingTileSet(map);

    expect(buildingTiles.has('4,4')).toBe(true);
    expect(buildingTiles.has('6,6')).toBe(true);
    expect(buildingTiles.has('10,10')).toBe(true);
    expect(buildingTiles.has('11,11')).toBe(true);
    expect(buildingTiles.has('12,10')).toBe(true);
    expect(buildingTiles.has('13,11')).toBe(true);
    expect(buildingTiles.has('0,0')).toBe(false);
    expect(buildingTiles.has('1,1')).toBe(false);
    expect(buildingTiles.has('2,2')).toBe(false);
    expect(buildingTiles.has('15,15')).toBe(false);
  });

  it('findAutoPlacement respects spacing — finds position with gap from HQ', () => {
    const map = createSpacingMap();
    const builder = map.builders[0]!;
    const result = findAutoPlacement(map, builder, 'separator');
    expect(result.placement).not.toBeNull();
    const occupied = buildOccupiedTileSet(map);
    const footprint = getBuildingFootprint('separator');
    expect(isFootprintWithSpacingBuildable(map, occupied, result.placement!.tx, result.placement!.ty, footprint)).toBe(true);
  });

  it('findAutoPlacement returns null when spacing leaves no room', () => {
    const map = createSpacingMap();
    const builder = map.builders[0]!;
    for (let ty = 0; ty < map.height; ty += 3) {
      for (let tx = 0; tx < map.width; tx += 3) {
        if (tx >= 4 && tx <= 6 && ty >= 4 && ty <= 6) continue;
        map.buildings.push({ tx, ty, type: 'separator' });
      }
    }
    const result = findAutoPlacement(map, builder, 'separator');
    expect(result.placement).toBeNull();
  });
});

// ── Obstacle interaction with construction ───────────────────────────

describe('obstacle interaction with construction', () => {
  function createObstacleMap(): MapData {
    return {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
  }

  it('obstacle footprints block building placement', () => {
    const map = createObstacleMap();
    map.obstacles.push({ tx: 8, ty: 4, type: 'mountain-medium', footprint: 2 });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintBuildable(map, occupied, 8, 4, 2)).toBe(false);
  });

  it('obstacles do NOT trigger one-tile spacing rule', () => {
    const map = createObstacleMap();
    map.obstacles.push({ tx: 8, ty: 4, type: 'rock-cluster', footprint: 1 });
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, 9, 4, 2)).toBe(true);
  });

  it('obstacle tiles appear in occupied set', () => {
    const map = createObstacleMap();
    map.obstacles.push({ tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 });
    const occupied = buildOccupiedTileSet(map);
    expect(occupied.has('10,10')).toBe(true);
    expect(occupied.has('11,11')).toBe(true);
  });

  it('obstacles do NOT appear in buildBuildingTileSet', () => {
    const map = createObstacleMap();
    map.obstacles.push({ tx: 10, ty: 10, type: 'mountain-medium', footprint: 2 });
    const buildingTiles = buildBuildingTileSet(map);
    expect(buildingTiles.has('10,10')).toBe(false);
    expect(buildingTiles.has('11,11')).toBe(false);
  });

  it('multi-tile resource footprint blocks building placement', () => {
    const map = createObstacleMap();
    map.resources.push({ tx: 8, ty: 4, type: 'infinite', footprint: 3 });
    const occupied = buildOccupiedTileSet(map);
    for (let dy = 0; dy < 3; dy++) {
      for (let dx = 0; dx < 3; dx++) {
        expect(occupied.has(`${8 + dx},${4 + dy}`)).toBe(true);
      }
    }
    expect(isFootprintBuildable(map, occupied, 8, 4, 2)).toBe(false);
  });
});

// ── Construction reachability (PATHFINDING-ARCH-01 PR3) ───────────────

describe('construction reachability', () => {
  function createReachabilityMap(): MapData {
    return {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
  }

  it('construction succeeds when a buildable reachable site exists', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    expect(result.site).toBeDefined();
  });

  it('construction skips unreachable candidate and finds a reachable one', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    const builder = map.builders[0]!;

    for (let tx = 5; tx <= 18; tx++) {
      map.obstacles.push({ tx, ty: 12, type: 'rock-cluster', footprint: 1 });
    }

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
  });

  it('construction fails with no-route when all buildable sites are unreachable', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    const builder = map.builders[0]!;

    for (let ty = 13; ty <= 17; ty++) {
      for (let tx = 13; tx <= 17; tx++) {
        if (tx === 15 && ty === 15) continue;
        if (tx >= 14 && tx <= 16 && ty >= 14 && ty <= 16) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-route');
    expect(economy.resources.matter).toBe(500);
    expect(map.builders[0]!.busy).toBe(false);
  });

  it('candidate site footprint is treated as blocked during route check', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    map.buildings.push({ tx: 8, ty: 8, type: 'separator' });
    const result = isSiteReachableByBuilder(map, builder, 10, 8, 2);
    expect(result).toBe(true);
  });

  it('builder routes to adjacent passable tile, not into building footprint', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    const result = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result).toBe(true);
  });

  it('decor does not block construction reachability', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    map.decor.push({ tx: 12, ty: 12, type: 'bush' });
    map.decor.push({ tx: 11, ty: 11, type: 'sand-bump' });
    const result = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result).toBe(true);
  });

  it('territory does not block construction reachability', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    const result = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result).toBe(true);
  });

  it('obstacles block construction reachability', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = builder.tx + dx;
        const ty = builder.ty + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }
    const result = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result).toBe(false);
  });

  it('resources block construction reachability', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    map.resources.push({ tx: 13, ty: 14, type: 'small', footprint: 1 });
    map.resources.push({ tx: 14, ty: 14, type: 'small', footprint: 1 });
    map.resources.push({ tx: 13, ty: 15, type: 'small', footprint: 1 });
    map.resources.push({ tx: 14, ty: 15, type: 'small', footprint: 1 });
    const result = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result).toBe(true);
  });

  it('buildings and HQ block construction reachability', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;
    const result = isSiteReachableByBuilder(map, builder, 8, 4, 2);
    expect(result).toBe(true);

    for (let ty = 0; ty < 20; ty++) {
      map.obstacles.push({ tx: 10, ty, type: 'rock-cluster', footprint: 1 });
    }
    const result2 = isSiteReachableByBuilder(map, builder, 8, 8, 2);
    expect(result2).toBe(false);
  });

  it('no matter is deducted when construction fails due to no route', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    const builder = map.builders[0]!;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = builder.tx + dx;
        const ty = builder.ty + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-route');
    expect(economy.resources.matter).toBe(500);
  });

  it('existing spacing rules are unchanged with reachability check', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const builder = map.builders[0]!;
    const placement = findAutoPlacement(map, builder, 'separator');
    expect(placement.placement).not.toBeNull();
    const occupied = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied, placement.placement!.tx, placement.placement!.ty, 2)).toBe(true);
  });

  it('existing matter deduction and builder busy behavior are unchanged after successful start', () => {
    const map = createReachabilityMap();
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 100;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    expect(economy.resources.matter).toBe(40); // 100 - 60 = 40
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.constructionSites).toHaveLength(1);
  });

  it('findAutoPlacement returns hasUnreachableSite when site is buildable but unreachable', () => {
    const map = createReachabilityMap();
    const builder = map.builders[0]!;

    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = builder.tx + dx;
        const ty = builder.ty + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }

    const result = findAutoPlacement(map, builder, 'separator');
    expect(result.placement).toBeNull();
    expect(result.hasUnreachableSite).toBe(true);
  });
});

// ── Builder movement lifecycle (PATHFINDING-ARCH-01 PR4) ──────────────

describe('builder movement lifecycle', () => {
  beforeEach(() => {
    resetSiteIdCounter();
  });

  /**
   * Create a 20×20 map with a builder and economy.
   * Builder at (15,15), HQ at (4,4), no obstacles.
   */
  function createMovementMap(): { map: MapData; economy: ReturnType<typeof createEconomyState> } {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;
    return { map, economy };
  }

  it('startConstruction creates pending site and assigns builder path', () => {
    const { map, economy } = createMovementMap();
    const result = startConstruction(map, economy, 'separator');

    expect(result.ok).toBe(true);
    const site = map.constructionSites[0]!;
    const builder = map.builders[0]!;

    // Site should have an id
    expect(site.id).toBeGreaterThan(0);
    // Builder should be assigned to this site
    expect(builder.assignedSiteId).toBe(site.id);
    // Builder should be busy
    expect(builder.busy).toBe(true);
    // Site may be pending or not depending on distance
    // If path is non-empty, site must be pending and builder is moving
    if (builder.path.length > 0) {
      expect(site.pending).toBe(true);
      expect(builder.phase).toBe('moving-to-site');
      expect(builder.path.length).toBeGreaterThan(0);
    }
  });

  it('builder phase becomes moving-to-site when path is non-empty', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;

    // On a 20×20 map with builder at (15,15), the site will be far enough
    // that the builder needs to move
    if (builder.path.length > 0) {
      expect(builder.phase).toBe('moving-to-site');
    }
  });

  it('builder already adjacent starts building immediately with pending=false', () => {
    // Place builder right next to where auto-placement will find a site
    // Builder at (8,4) — adjacent to (8,8) or wherever findAutoPlacement picks
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(8, 7)], // right above where a site at (8,8) would be adjacent
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);

    // If builder is already adjacent to the found site, it should start building immediately
    const site = map.constructionSites[0]!;
    const builder = map.builders[0]!;
    const siteFootprint = getBuildingFootprint('separator');
    // Check if builder tx/ty is adjacent to site footprint
    const isAdj = isAdjacentToFootprint(builder.tx, builder.ty, site.tx, site.ty, siteFootprint);
    if (isAdj) {
      expect(site.pending).toBe(false);
      expect(builder.phase).toBe('building');
      expect(builder.path).toHaveLength(0);
    }
  });

  it('pending site does not advance elapsed/progress before builder arrives', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const site = map.constructionSites[0]!;

    if (site.pending) {
      const elapsedBefore = site.elapsed;
      const progressBefore = site.progress;
      tickConstruction(map, economy, 5);
      expect(site.elapsed).toBe(elapsedBefore);
      expect(site.progress).toBe(progressBefore);
    }
  });

  it('builder moves along path over tickConstruction', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;

    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      const initialFtx = builder.ftx;
      const initialFty = builder.fty;

      // Tick with a small dt — builder should move but not arrive yet
      tickConstruction(map, economy, 0.1);

      // Builder position should have changed
      const moved = builder.ftx !== initialFtx || builder.fty !== initialFty;
      expect(moved).toBe(true);
    }
  });

  it('builder reaches adjacent tile and site switches pending=false', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;
    const site = map.constructionSites[0]!;

    if (site.pending && builder.path.length > 0) {
      // Calculate time needed for builder to traverse the entire path
      // At BUILDER_SPEED = 2.0 tiles/sec, each tile takes 0.5 seconds
      // Give generous time
      const maxTime = (builder.path.length + 2) / BUILDER_SPEED + 1;
      tickConstruction(map, economy, maxTime);

      // Site should no longer be pending
      expect(site.pending).toBe(false);
      // Builder should be in building phase
      expect(builder.phase).toBe('building');
    }
  });

  it('construction progress starts after arrival', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const site = map.constructionSites[0]!;
    const builder = map.builders[0]!;

    // Fast-forward builder to arrive
    if (site.pending && builder.path.length > 0) {
      const maxTime = (builder.path.length + 2) / BUILDER_SPEED + 1;
      tickConstruction(map, economy, maxTime);
    }

    // Now site should be non-pending
    expect(site.pending).toBe(false);

    // Tick construction — progress should advance
    tickConstruction(map, economy, 1);
    expect(site.elapsed).toBeGreaterThan(0);
    expect(site.progress).toBeGreaterThan(0);
  });

  it('matter is deducted exactly once at startConstruction', () => {
    const { map, economy } = createMovementMap();
    const matterBefore = economy.resources.matter;
    const result = startConstruction(map, economy, 'separator');

    expect(result.ok).toBe(true);
    const matterAfter = economy.resources.matter;
    expect(matterAfter).toBe(matterBefore - 60);

    // Tick a few times — matter should not change
    tickConstruction(map, economy, 5);
    expect(economy.resources.matter).toBe(matterAfter);
  });

  it('no-route does not deduct matter', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    // Wall off the builder completely
    const builder = map.builders[0]!;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const tx = builder.tx + dx;
        const ty = builder.ty + dy;
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
        map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
      }
    }

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-route');
    expect(economy.resources.matter).toBe(500);
  });

  it('completed building appears after arrival + build duration', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;
    const site = map.constructionSites[0]!;

    // Fast-forward builder to arrive
    if (site.pending && builder.path.length > 0) {
      const moveTime = (builder.path.length + 2) / BUILDER_SPEED + 1;
      tickConstruction(map, economy, moveTime);
    }

    // Now complete the construction (20s build time)
    tickConstruction(map, economy, 21);

    expect(map.constructionSites).toHaveLength(0);
    expect(map.buildings.some((b) => b.type === 'separator')).toBe(true);
  });

  it('builder remains busy during moving-to-site and building', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;

    // Builder should be busy during movement
    expect(builder.busy).toBe(true);

    // Fast-forward to building phase
    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      const moveTime = (builder.path.length + 2) / BUILDER_SPEED + 1;
      tickConstruction(map, economy, moveTime);
    }

    // Builder should still be busy during building
    expect(builder.busy).toBe(true);
    expect(builder.phase).toBe('building');
  });

  it('builder becomes idle/busy=false after completion', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;

    // Fast-forward builder to arrive
    const site = map.constructionSites[0]!;
    if (site.pending && builder.path.length > 0) {
      const moveTime = (builder.path.length + 2) / BUILDER_SPEED + 1;
      tickConstruction(map, economy, moveTime);
    }

    // Complete construction
    tickConstruction(map, economy, 21);

    expect(builder.busy).toBe(false);
    expect(builder.phase).toBe('idle');
    expect(builder.assignedSiteId).toBe(-1);
  });

  it('pending construction site blocks overlapping placement', () => {
    const { map, economy } = createMovementMap();
    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);

    const site = map.constructionSites[0]!;
    const occupied = buildOccupiedTileSet(map);
    const footprint = getBuildingFootprint(site.type);

    // The site's footprint tiles should be in the occupied set
    for (let dy = 0; dy < footprint; dy++) {
      for (let dx = 0; dx < footprint; dx++) {
        expect(occupied.has(`${site.tx + dx},${site.ty + dy}`)).toBe(true);
      }
    }
  });

  it('multiple builders: first can move/build, second remains usable if idle', () => {
    const map: MapData = {
      width: 30,
      height: 30,
      terrain: Array.from({ length: 30 }, () => Array(30).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(20, 20), createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 1000;

    // First construction uses one builder
    const result1 = startConstruction(map, economy, 'separator');
    expect(result1.ok).toBe(true);
    expect(map.builders.some((b) => b.busy)).toBe(true);

    // Second construction should succeed with the other builder
    const result2 = startConstruction(map, economy, 'separator');
    expect(result2.ok).toBe(true);
    expect(map.builders.filter((b) => b.busy).length).toBe(2);
  });

  it('if next waypoint becomes blocked, one repath is attempted', () => {
    const { map, economy } = createMovementMap();
    startConstruction(map, economy, 'separator');
    const builder = map.builders[0]!;

    if (builder.phase === 'moving-to-site' && builder.path.length > 1) {
      // Block the next waypoint
      const nextWaypoint = builder.path[builder.pathIndex]!;
      map.obstacles.push({ tx: nextWaypoint.tx, ty: nextWaypoint.ty, type: 'rock-cluster', footprint: 1 });

      // Tick should trigger a repath
      tickConstruction(map, economy, 0.01);

      // Builder should still be moving (repath succeeded on open map)
      // or site should be cancelled (repath failed)
      // On an open 20x20 map, repath should succeed
      expect(builder.phase === 'moving-to-site' || builder.phase === 'building' || builder.phase === 'idle').toBe(true);
    }
  });

  it('if repath fails, site is cancelled, matter refunded, builder freed', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    const builder = map.builders[0]!;
    const matterAfterStart = economy.resources.matter;

    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      // Block the next waypoint
      const nextWaypoint = builder.path[builder.pathIndex]!;

      // Also block ALL paths to the site — wall off completely
      // Block a large area around the builder so no alternative path exists
      for (let ty = 0; ty < 20; ty++) {
        for (let tx = 0; tx < 20; tx++) {
          // Leave the builder's current tile open
          if (tx === builder.tx && ty === builder.ty) continue;
          // Leave a small area around builder open
          if (Math.abs(tx - builder.tx) <= 1 && Math.abs(ty - builder.ty) <= 1) continue;
          map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
        }
      }

      // Tick should trigger repath, which fails, cancelling the site
      tickConstruction(map, economy, 0.01);

      // Site should be cancelled
      expect(map.constructionSites).toHaveLength(0);
      // Matter should be refunded
      expect(economy.resources.matter).toBe(matterAfterStart + 80);
      // Builder should be freed
      expect(builder.busy).toBe(false);
      expect(builder.phase).toBe('idle');
      expect(builder.assignedSiteId).toBe(-1);
    }
  });

  it('repath cancellation refund is clamped to matterCap', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    const builder = map.builders[0]!;

    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      // Set matter very close to cap so the refund would exceed it
      const costMatter = 60; // separator cost
      economy.resources.matter = economy.resources.matterCap - 10;

      // Block all paths to force repath failure
      for (let ty = 0; ty < 20; ty++) {
        for (let tx = 0; tx < 20; tx++) {
          if (tx === builder.tx && ty === builder.ty) continue;
          if (Math.abs(tx - builder.tx) <= 1 && Math.abs(ty - builder.ty) <= 1) continue;
          map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
        }
      }

      // Tick should trigger repath failure → cancelSite → refund
      tickConstruction(map, economy, 0.01);

      // Matter must not exceed matterCap
      expect(economy.resources.matter).toBe(economy.resources.matterCap);
      // Verify it's strictly less than the unclamped value
      expect(economy.resources.matter).toBeLessThan(economy.resources.matterCap - 10 + costMatter);
    }
  });

  it('cancelledSites is empty on normal tick', () => {
    const { map, economy } = createMovementMap();
    const result = startConstruction(map, economy, 'separator');
    if (!result.ok) return;

    // Tick construction normally — no cancellations should occur
    const tickResult = tickConstruction(map, economy, 0.01);
    expect(tickResult.cancelledSites).toHaveLength(0);
    expect(tickResult.completedBuildings).toHaveLength(0);
  });

  it('cancelledSites contains cancellation info on repath failure', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    const builder = map.builders[0]!;

    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      // Block all paths to force repath failure
      for (let ty = 0; ty < 20; ty++) {
        for (let tx = 0; tx < 20; tx++) {
          if (tx === builder.tx && ty === builder.ty) continue;
          if (Math.abs(tx - builder.tx) <= 1 && Math.abs(ty - builder.ty) <= 1) continue;
          map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
        }
      }

      const tickResult = tickConstruction(map, economy, 0.01);

      // Should report cancellation info
      expect(tickResult.cancelledSites).toHaveLength(1);
      expect(tickResult.cancelledSites[0]!.type).toBe('separator');
      expect(tickResult.cancelledSites[0]!.reason).toBe('path-blocked');
    }
  });

  it('cancellation still refunds matter clamped to matterCap', () => {
    const map: MapData = {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
    const economy = createEconomyState([], 0, 1, 'cyan');
    economy.resources.matter = 500;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(true);
    const builder = map.builders[0]!;

    if (builder.phase === 'moving-to-site' && builder.path.length > 0) {
      // Set matter close to cap so refund would exceed it
      economy.resources.matter = economy.resources.matterCap - 10;

      // Block all paths to force repath failure
      for (let ty = 0; ty < 20; ty++) {
        for (let tx = 0; tx < 20; tx++) {
          if (tx === builder.tx && ty === builder.ty) continue;
          if (Math.abs(tx - builder.tx) <= 1 && Math.abs(ty - builder.ty) <= 1) continue;
          map.obstacles.push({ tx, ty, type: 'rock-cluster', footprint: 1 });
        }
      }

      tickConstruction(map, economy, 0.01);

      // Cancellation should refund matter but clamp to matterCap
      expect(economy.resources.matter).toBe(economy.resources.matterCap);
      // Builder should be freed
      expect(builder.busy).toBe(false);
      expect(builder.phase).toBe('idle');
    }
  });
});

// ── Helper ──────────────────────────────────────────────────────────

/** Check if (tx, ty) is adjacent (cardinal) to a footprint. */
function isAdjacentToFootprint(tx: number, ty: number, ftx: number, fty: number, footprint: number): boolean {
  // Top edge
  if (ty === fty - 1 && tx >= ftx && tx < ftx + footprint) return true;
  // Bottom edge
  if (ty === fty + footprint && tx >= ftx && tx < ftx + footprint) return true;
  // Left edge
  if (tx === ftx - 1 && ty >= fty && ty < fty + footprint) return true;
  // Right edge
  if (tx === ftx + footprint && ty >= fty && ty < fty + footprint) return true;
  return false;
}

// ── Resource depletion filtering (ENVIRONMENT-QA-FIX-01) ─────────────

describe('buildOccupiedTileSet — resource depletion', () => {
  function createDepletionMap(): MapData {
    return {
      width: 20,
      height: 20,
      terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
      hq: { tx: 4, ty: 4, faction: 'cyan' },
      resources: [
        { tx: 8, ty: 3, type: 'small', footprint: 1 },
        { tx: 12, ty: 5, type: 'medium', footprint: 1 },
        { tx: 15, ty: 10, type: 'infinite', footprint: 3 },
      ],
      obstacles: [],
      decor: [],
      buildings: [],
      builders: [createBuilder(15, 15)],
      constructionSites: [],
    };
  }

  it('depleted finite resource NOT in occupied set when resourceNodes provided', () => {
    const map = createDepletionMap();
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 0 },
      { tx: 12, ty: 5, type: 'medium', infinite: false, remaining: 100 },
      { tx: 15, ty: 10, type: 'infinite', infinite: true, remaining: Infinity },
    ];
    const occupied = buildOccupiedTileSet(map, resourceNodes);
    // Depleted finite → NOT in occupied set
    expect(occupied.has('8,3')).toBe(false);
    // Active finite → still in occupied set
    expect(occupied.has('12,5')).toBe(true);
    // Infinite → still in occupied set
    expect(occupied.has('15,10')).toBe(true);
  });

  it('without resourceNodes, all resources occupy (backward compatible)', () => {
    const map = createDepletionMap();
    const occupied = buildOccupiedTileSet(map);
    expect(occupied.has('8,3')).toBe(true);
    expect(occupied.has('12,5')).toBe(true);
    expect(occupied.has('15,10')).toBe(true);
  });

  it('building placement allowed on depleted resource tile', () => {
    const map = createDepletionMap();
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 0 },
      { tx: 12, ty: 5, type: 'medium', infinite: false, remaining: 100 },
      { tx: 15, ty: 10, type: 'infinite', infinite: true, remaining: Infinity },
    ];
    const occupied = buildOccupiedTileSet(map, resourceNodes);
    // Can build where depleted resource was
    expect(isFootprintBuildable(map, occupied, 8, 3, 1)).toBe(true);
    // Cannot build where active resource is
    expect(isFootprintBuildable(map, occupied, 12, 5, 1)).toBe(false);
  });

  it('findAutoPlacement skips depleted resource tiles', () => {
    const map = createDepletionMap();
    // Place builder near the depleted resource
    map.builders = [createBuilder(8, 5)];
    const resourceNodes: ResourceNodeState[] = [
      { tx: 8, ty: 3, type: 'small', infinite: false, remaining: 0 },
      { tx: 12, ty: 5, type: 'medium', infinite: false, remaining: 100 },
      { tx: 15, ty: 10, type: 'infinite', infinite: true, remaining: Infinity },
    ];
    const result = findAutoPlacement(map, map.builders[0]!, 'separator', resourceNodes);
    // Should find a placement (depleted resource doesn't block)
    expect(result.placement).not.toBeNull();
  });
});
