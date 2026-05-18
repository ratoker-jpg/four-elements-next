import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import { createEconomyState, getSeparatorPositions, getRawStorageCount, getMatterStorageCount } from '../../src/systems/economy.js';
import {
  AUTO_BUILD_MAX_RADIUS,
  buildOccupiedTileSet,
  findAutoPlacement,
  isFootprintBuildable,
  startConstruction,
  tickConstruction,
} from '../../src/systems/construction.js';
import { getBuildingFootprint } from '../../src/config/buildings.js';

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
    startConstruction(map, economy, 'separator');
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
