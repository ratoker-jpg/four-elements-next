import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import { createEconomyState, getSeparatorPositions, getRawStorageCount, getMatterStorageCount } from '../../src/systems/economy.js';
import {
  AUTO_BUILD_MAX_RADIUS,
  buildBuildingTileSet,
  buildOccupiedTileSet,
  findAutoPlacement,
  isFootprintBuildable,
  isFootprintWithSpacingBuildable,
  startConstruction,
  tickConstruction,
} from '../../src/systems/construction.js';
import { getBuildingFootprint } from '../../src/config/buildings.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import type { MapData } from '../../src/game/map-types.js';

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
    expect(economy.resources.matter).toBe(20);
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.constructionSites).toHaveLength(1);
    expect(map.constructionSites[0]!.type).toBe('separator');
    expect(map.constructionSites[0]!.builderIndex).toBe(0);
  });

  it('rejects construction when matter is insufficient', () => {
    const { map, economy } = createBaseline();
    economy.resources.matter = 79;

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

  it('derives occupied tiles from HQ, buildings, resources, decor, sites, and builder', () => {
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
    expect(occupied.has(`${map.decor[0]!.tx},${map.decor[0]!.ty}`)).toBe(true);
  });

  it('returns no placement when every tile within radius 15 is blocked', () => {
    const { map } = createBaseline();
    const builder = map.builders[0]!;
    for (let ty = builder.ty - AUTO_BUILD_MAX_RADIUS; ty <= builder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
      for (let tx = builder.tx - AUTO_BUILD_MAX_RADIUS; tx <= builder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === builder.tx && ty === builder.ty) continue;
        map.decor.push({ tx, ty, type: 'bush' });
      }
    }

    expect(findAutoPlacement(map, builder, 'separator')).toBeNull();
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

    const result = tickConstruction(map, 18);

    expect(result.completedBuildings).toHaveLength(1);
    expect(result.completedBuildings[0]!.type).toBe('command-relay');
    expect(map.constructionSites).toHaveLength(0);
    expect(map.builders[0]!.busy).toBe(false);
    expect(map.buildings.some((building) => building.type === 'command-relay')).toBe(true);
  });
});

// ── Multi-builder construction ────────────────────────────────────────

describe('multi-builder construction', () => {
  function createMultiBuilderBaseline() {
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getRawStorageCount(map.buildings),
      getMatterStorageCount(map.buildings),
      'cyan',
    );
    // Place second builder at the first builder's position offset by a few tiles
    // to guarantee findAutoPlacement works from a different position
    const firstBuilder = map.builders[0]!;
    map.builders.push({ tx: firstBuilder.tx + 2, ty: firstBuilder.ty + 2, busy: false });
    // Give plenty of matter for multiple constructions
    economy.resources.matter = 500;
    return { map, economy };
  }

  const HQ_FOOTPRINT = 3; // match the constant

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

    // Advance time but not enough to complete either
    tickConstruction(map, 5);
    expect(map.constructionSites).toHaveLength(2);
    expect(map.builders[0]!.busy).toBe(true);
    expect(map.builders[1]!.busy).toBe(true);
  });

  it('completing one construction frees only its assigned builder', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Start two constructions with different build times
    startConstruction(map, economy, 'separator');    // 25s build time
    startConstruction(map, economy, 'command-relay'); // 18s build time

    expect(map.constructionSites[0]!.builderIndex).toBe(0);
    expect(map.constructionSites[1]!.builderIndex).toBe(1);

    // Complete only the command-relay (18s)
    tickConstruction(map, 19);

    // Command-relay site should be gone, separator still building
    expect(map.constructionSites).toHaveLength(1);
    expect(map.constructionSites[0]!.type).toBe('separator');

    // Builder 1 (assigned to command-relay) should be free, builder 0 still busy
    // Note: builderIndex assignments may vary, find the one assigned to the completed site
    const busyBuilders = map.builders.filter((b) => b.busy);
    const freeBuilders = map.builders.filter((b) => !b.busy);
    expect(busyBuilders).toHaveLength(1); // only separator builder still busy
    expect(freeBuilders).toHaveLength(1); // command-relay builder freed
  });

  it('all builders free when all sites complete', () => {
    const { map, economy } = createMultiBuilderBaseline();
    startConstruction(map, economy, 'separator');
    startConstruction(map, economy, 'separator');

    // Complete both (25s build time)
    tickConstruction(map, 26);

    expect(map.constructionSites).toHaveLength(0);
    expect(map.builders[0]!.busy).toBe(false);
    expect(map.builders[1]!.busy).toBe(false);
  });

  it('produced builder can be used for construction', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Simulate a produced builder added to the map — place near first builder
    const firstBuilder = map.builders[0]!;
    map.builders.push({ tx: firstBuilder.tx + 4, ty: firstBuilder.ty, busy: false });
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
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getRawStorageCount(map.buildings),
      getMatterStorageCount(map.buildings),
      'cyan',
    );
    // Remove all builders
    map.builders.length = 0;

    const result = startConstruction(map, economy, 'separator');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no-placement');
  });

  it('freed builder can start new construction immediately', () => {
    const { map, economy } = createMultiBuilderBaseline();
    // Builder 0 starts a separator
    startConstruction(map, economy, 'separator');
    expect(map.builders[0]!.busy).toBe(true);

    // Complete it (25s build time)
    tickConstruction(map, 26);
    expect(map.builders[0]!.busy).toBe(false);

    // Builder 0 can start another construction
    const result = startConstruction(map, economy, 'raw-storage');
    expect(result.ok).toBe(true);
    expect(map.builders[0]!.busy).toBe(true);
  });

  it('succeeds with second builder when first idle builder has no placement but second does', () => {
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getRawStorageCount(map.buildings),
      getMatterStorageCount(map.buildings),
      'cyan',
    );
    economy.resources.matter = 500;
    const firstBuilder = map.builders[0]!;
    // Place second builder far away (beyond AUTO_BUILD_MAX_RADIUS of first)
    // so blocking around first builder does NOT block around second builder
    const secondBuilderTx = firstBuilder.tx + AUTO_BUILD_MAX_RADIUS * 2 + 5;
    const secondBuilderTy = firstBuilder.ty;
    map.builders.push({ tx: secondBuilderTx, ty: secondBuilderTy, busy: false });

    // Block all tiles within AUTO_BUILD_MAX_RADIUS of the first builder with decor
    for (let ty = firstBuilder.ty - AUTO_BUILD_MAX_RADIUS; ty <= firstBuilder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
      for (let tx = firstBuilder.tx - AUTO_BUILD_MAX_RADIUS; tx <= firstBuilder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
        if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
        if (tx === firstBuilder.tx && ty === firstBuilder.ty) continue;
        map.decor.push({ tx, ty, type: 'bush' });
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
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getRawStorageCount(map.buildings),
      getMatterStorageCount(map.buildings),
      'cyan',
    );
    economy.resources.matter = 500;
    const firstBuilder = map.builders[0]!;
    // Place second builder far away but block its area too
    const secondBuilderTx = firstBuilder.tx + AUTO_BUILD_MAX_RADIUS * 2 + 5;
    const secondBuilderTy = firstBuilder.ty;
    map.builders.push({ tx: secondBuilderTx, ty: secondBuilderTy, busy: false });

    // Block all tiles around BOTH builders
    for (const builder of map.builders) {
      for (let ty = builder.ty - AUTO_BUILD_MAX_RADIUS; ty <= builder.ty + AUTO_BUILD_MAX_RADIUS; ty++) {
        for (let tx = builder.tx - AUTO_BUILD_MAX_RADIUS; tx <= builder.tx + AUTO_BUILD_MAX_RADIUS; tx++) {
          if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) continue;
          if (tx === builder.tx && ty === builder.ty) continue;
          map.decor.push({ tx, ty, type: 'bush' });
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
      builders: [{ tx: 15, ty: 15, busy: false }],
      constructionSites: [],
    };
  }

  it('cannot place directly adjacent to HQ (0-tile gap)', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    // HQ at (4,4) footprint 3 → occupies (4,4)-(6,6)
    // Place 2×2 at (7,4): perimeter includes x=6 which is HQ → rejected
    expect(isFootprintWithSpacingBuildable(map, occupied, 7, 4, 2)).toBe(false);
    // Also test adjacent on other sides
    expect(isFootprintWithSpacingBuildable(map, occupied, 2, 4, 2)).toBe(false); // left
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 7, 2)).toBe(false); // below
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 2, 2)).toBe(false); // above
  });

  it('can place with one empty tile gap from HQ', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    // 2×2 at (8,4): footprint (8,4)-(9,5), perimeter (7,3)-(10,6)
    // HQ occupies (4,4)-(6,6), no overlap with perimeter → accepted
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
    // Also test gap on other sides
    expect(isFootprintWithSpacingBuildable(map, occupied, 1, 4, 2)).toBe(true); // left (gap at col 3)
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 8, 2)).toBe(true); // below (gap at row 7)
    expect(isFootprintWithSpacingBuildable(map, occupied, 5, 1, 2)).toBe(true); // above (gap at row 3)
  });

  it('cannot place adjacent to a completed building', () => {
    const map = createSpacingMap();
    // Add a completed building at (8,4) footprint 2 → occupies (8,4)-(9,5)
    map.buildings.push({ tx: 8, ty: 4, type: 'separator' });
    const occupied = buildOccupiedTileSet(map);

    // Try placing adjacent (0 gap) to the right of the building at (10,4)
    // Perimeter of candidate includes x=9 which is the building → rejected
    expect(isFootprintWithSpacingBuildable(map, occupied, 10, 4, 2)).toBe(false);
  });

  it('cannot place adjacent to an active construction site', () => {
    const map = createSpacingMap();
    // Add an active construction site at (8,4) footprint 2
    map.constructionSites.push({
      tx: 8, ty: 4, type: 'separator',
      elapsed: 0, duration: 25, progress: 0, builderIndex: 0,
    });
    const occupied = buildOccupiedTileSet(map);

    // Try placing adjacent at (10,4) → perimeter overlaps construction site tile at (9,4)
    expect(isFootprintWithSpacingBuildable(map, occupied, 10, 4, 2)).toBe(false);
  });

  it('footprint overlap still fails even with spacing', () => {
    const map = createSpacingMap();
    const occupied = buildOccupiedTileSet(map);
    // HQ at (4,4)-(6,6): trying to place overlapping HQ footprint should fail
    expect(isFootprintWithSpacingBuildable(map, occupied, 5, 5, 2)).toBe(false);
    expect(isFootprintWithSpacingBuildable(map, occupied, 4, 4, 2)).toBe(false);
  });

  it('out-of-bounds spacing perimeter does not fail if footprint is inside map', () => {
    const map = createSpacingMap();
    // Move HQ away from the edge to make room
    map.hq = { tx: 10, ty: 10, faction: 'cyan' };
    const occupied = buildOccupiedTileSet(map);
    // Place 2×2 at (0,0): footprint (0,0)-(1,1) is in bounds
    // Perimeter extends to (-1,-1)-(2,2), but out-of-bounds cells are ignored
    // No building tiles in the in-bounds portion of the perimeter → accepted
    expect(isFootprintWithSpacingBuildable(map, occupied, 0, 0, 2)).toBe(true);

    // Near right edge: map width=20, place at (18,0) footprint 2 → (18,0)-(19,1)
    // Perimeter extends to x=20 which is out of bounds → ignored
    expect(isFootprintWithSpacingBuildable(map, occupied, 18, 0, 2)).toBe(true);

    // Near bottom edge: place at (0,18) footprint 2 → (0,18)-(1,19)
    // Perimeter extends to y=20 which is out of bounds → ignored
    expect(isFootprintWithSpacingBuildable(map, occupied, 0, 18, 2)).toBe(true);
  });

  it('resources and decor block footprint but not spacing perimeter', () => {
    const map = createSpacingMap();
    // Place a resource on the perimeter ring of a candidate position (8,4)
    // Perimeter of (8,4) footprint 2 → (7,3)-(10,6)
    map.resources.push({ tx: 7, ty: 4, type: 'small' });
    const occupied = buildOccupiedTileSet(map);

    // Resource at (7,4) is on the perimeter but NOT on the footprint (8,4)-(9,5)
    // Resources should not block spacing perimeter → accepted
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);

    // Now place a resource ON the footprint → should block
    map.resources.push({ tx: 8, ty: 4, type: 'small' });
    const occupied2 = buildOccupiedTileSet(map);
    expect(isFootprintWithSpacingBuildable(map, occupied2, 8, 4, 2)).toBe(false);
  });

  it('builders do not block spacing perimeter', () => {
    const map = createSpacingMap();
    // Builder at (15,15) is already there. Let's add another builder on the perimeter
    // of a candidate at (8,4) → perimeter includes (7,3)-(10,6)
    map.builders.push({ tx: 7, ty: 4, busy: false });
    const occupied = buildOccupiedTileSet(map);

    // Builder on perimeter should not block spacing → accepted
    expect(isFootprintWithSpacingBuildable(map, occupied, 8, 4, 2)).toBe(true);
  });

  it('buildBuildingTileSet contains only HQ, buildings, and construction sites', () => {
    const map = createSpacingMap();
    map.buildings.push({ tx: 10, ty: 10, type: 'separator' });
    // Place construction site away from the default builder at (15,15) to avoid overlap
    map.constructionSites.push({
      tx: 12, ty: 10, type: 'raw-storage',
      elapsed: 0, duration: 20, progress: 0, builderIndex: 0,
    });
    map.resources.push({ tx: 0, ty: 0, type: 'small' });
    map.decor.push({ tx: 1, ty: 1, type: 'bush' });

    const buildingTiles = buildBuildingTileSet(map);

    // HQ tiles should be present
    expect(buildingTiles.has('4,4')).toBe(true);
    expect(buildingTiles.has('6,6')).toBe(true);
    // Building tiles should be present (separator at (10,10) footprint 2)
    expect(buildingTiles.has('10,10')).toBe(true);
    expect(buildingTiles.has('11,11')).toBe(true);
    // Construction site tiles should be present (raw-storage at (12,10) footprint 2)
    expect(buildingTiles.has('12,10')).toBe(true);
    expect(buildingTiles.has('13,11')).toBe(true);
    // Resources, decor, and builders should NOT be in building tiles
    expect(buildingTiles.has('0,0')).toBe(false); // resource
    expect(buildingTiles.has('1,1')).toBe(false); // decor
    expect(buildingTiles.has('15,15')).toBe(false); // builder (no overlap with any building/site)
  });

  it('findAutoPlacement respects spacing — finds position with gap from HQ', () => {
    const map = createSpacingMap();
    const builder = map.builders[0]!;
    // findAutoPlacement should find a spot with 1-tile gap from HQ
    const result = findAutoPlacement(map, builder, 'separator');
    expect(result).not.toBeNull();
    // Verify the found position passes the spacing check
    const occupied = buildOccupiedTileSet(map);
    const footprint = getBuildingFootprint('separator');
    expect(isFootprintWithSpacingBuildable(map, occupied, result!.tx, result!.ty, footprint)).toBe(true);
  });

  it('findAutoPlacement returns null when spacing leaves no room', () => {
    const map = createSpacingMap();
    const builder = map.builders[0]!;
    // Fill all tiles with buildings in a tight grid so there's no room with spacing
    for (let ty = 0; ty < map.height; ty += 3) {
      for (let tx = 0; tx < map.width; tx += 3) {
        // Check if this position overlaps HQ before adding
        if (tx >= 4 && tx <= 6 && ty >= 4 && ty <= 6) continue;
        map.buildings.push({ tx, ty, type: 'separator' });
      }
    }
    // With buildings every 3 tiles (footprint 2 + spacing 1 = 3), there should be no room
    const result = findAutoPlacement(map, builder, 'separator');
    expect(result).toBeNull();
  });
});

// ── Obstacle interaction with construction ───────────────────────────

describe('obstacle interaction with construction', () => {
  /** Create a minimal 20×20 map with HQ at (4,4) and a single builder far from HQ. */
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
      builders: [{ tx: 15, ty: 15, busy: false }],
      constructionSites: [],
    };
  }

  it('obstacle footprints block building placement', () => {
    const map = createObstacleMap();
    // Place a 2x2 mountain-medium at (8,4)
    map.obstacles.push({ tx: 8, ty: 4, type: 'mountain-medium', footprint: 2 });
    const occupied = buildOccupiedTileSet(map);

    // Trying to place a 2x2 building at (8,4) should fail — overlaps obstacle
    expect(isFootprintBuildable(map, occupied, 8, 4, 2)).toBe(false);
  });

  it('obstacles do NOT trigger one-tile spacing rule', () => {
    const map = createObstacleMap();
    // Place a 1x1 obstacle at (8,4)
    map.obstacles.push({ tx: 8, ty: 4, type: 'rock-cluster', footprint: 1 });
    const occupied = buildOccupiedTileSet(map);

    // Trying to place a 2x2 building at (9,4) — adjacent to obstacle
    // Footprint (9,4)-(10,5) does not overlap obstacle at (8,4)
    // Obstacle is on the spacing perimeter but should NOT block spacing
    // (obstacles are not in buildBuildingTileSet)
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

    // Only HQ tiles should be present, not obstacle tiles
    expect(buildingTiles.has('10,10')).toBe(false);
    expect(buildingTiles.has('11,11')).toBe(false);
  });
});
