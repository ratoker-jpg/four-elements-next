import { describe, it, expect } from 'vitest';
import { generateMap } from '../../src/game/mapgen.js';
import { createEconomyState, getSeparatorPositions, getStorageCount } from '../../src/systems/economy.js';
import {
  AUTO_BUILD_MAX_RADIUS,
  buildOccupiedTileSet,
  findAutoPlacement,
  startConstruction,
  tickConstruction,
} from '../../src/systems/construction.js';

describe('construction system', () => {
  function createBaseline() {
    const map = generateMap(48, 48, 'cyan', 42);
    const economy = createEconomyState(
      getSeparatorPositions(map.buildings),
      getStorageCount(map.buildings),
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

  it('rejects a second construction while the Builder is busy', () => {
    const { map, economy } = createBaseline();
    expect(startConstruction(map, economy, 'separator').ok).toBe(true);

    const result = startConstruction(map, economy, 'storage');

    expect(result).toEqual({
      ok: false,
      reason: 'busy',
      buildingType: 'storage',
    });
    expect(map.constructionSites).toHaveLength(1);
  });

  it('derives occupied tiles from HQ, buildings, resources, decor, sites, and builder', () => {
    const { map, economy } = createBaseline();
    startConstruction(map, economy, 'separator');
    const occupied = buildOccupiedTileSet(map);

    expect(occupied.has(`${map.hq.tx},${map.hq.ty}`)).toBe(true);
    expect(occupied.has(`${map.buildings[0]!.tx},${map.buildings[0]!.ty}`)).toBe(true);
    expect(occupied.has(`${map.builders[0]!.tx},${map.builders[0]!.ty}`)).toBe(true);
    expect(occupied.has(`${map.constructionSites[0]!.tx},${map.constructionSites[0]!.ty}`)).toBe(true);
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

    expect(findAutoPlacement(map, builder)).toBeNull();
  });

  it('completes construction into a real building and frees the Builder', () => {
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
