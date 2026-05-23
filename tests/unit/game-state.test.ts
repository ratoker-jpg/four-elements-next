import { describe, it, expect } from 'vitest';
import { createGameState, createGameStateFromMap, deepCloneMapData } from '../../src/game/game-state.js';
import { BUILDER_CONTROL_COST } from '../../src/systems/construction.js';
import { HARVESTER_CONTROL_COST } from '../../src/systems/harvesting.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import { generateMap } from '../../src/game/mapgen.js';
import type { MapData } from '../../src/game/map-types.js';

describe('createGameState', () => {
  it('creates state with map, economy, power, control, harvesters, and resourceNodes', () => {
    const state = createGameState('standard', 'cyan');

    expect(state.map).toBeDefined();
    expect(state.economy).toBeDefined();
    expect(state.power).toBeDefined();
    expect(state.control).toBeDefined();
    expect(state.constructionStatusMessage).toBe('Строитель готов к строительству.');
    expect(state.harvesters).toBeDefined();
    expect(state.resourceNodes).toBeDefined();
  });

  it('initializes map with correct dimensions for standard size', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.width).toBe(48);
    expect(state.map.height).toBe(48);
  });

  it('initializes map with correct dimensions for large size', () => {
    const state = createGameState('large', 'cyan');
    expect(state.map.width).toBe(64);
    expect(state.map.height).toBe(64);
  });

  it('resolves random faction to a valid FactionId', () => {
    const validFactions = new Set(['cyan', 'green', 'yellow', 'purple']);
    const state = createGameState('standard', 'random');
    expect(validFactions.has(state.economy.faction)).toBe(true);
  });

  it('sets economy faction to the resolved faction', () => {
    const state = createGameState('standard', 'green');
    expect(state.economy.faction).toBe('green');
  });

  it('creates economy with zero separators at start', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.economy.separators).toHaveLength(0);
  });

  it('creates power state with HQ only (no starting buildings)', () => {
    const state = createGameState('standard', 'cyan');
    // HQ only — no starting buildings
    expect(state.power.buildings).toHaveLength(1);
    const hqEntry = state.power.buildings.find((b) => b.type === 'hq');
    expect(hqEntry).toBeDefined();
    expect(hqEntry!.online).toBe(true);
  });

  it('sets control used to builder + harvester control cost', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.control.used).toBe(
      state.map.builders.length * BUILDER_CONTROL_COST + state.harvesters.length * HARVESTER_CONTROL_COST,
    );
  });

  it('has builders placed on the map', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.builders.length).toBeGreaterThanOrEqual(1);
  });

  it('has no construction sites at start', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.constructionSites).toHaveLength(0);
  });

  it('creates exactly 2 harvesters near HQ at start', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.harvesters).toHaveLength(2);
    for (const h of state.harvesters) {
      expect(h.phase).toBe('idle');
      expect(h.carry).toBe(0);
      expect(h.gatherProgress).toBe(0);
      expect(h.targetNodeIndex).toBe(-1);
    }
  });

  it('creates resource node runtime states matching map resources', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.resourceNodes).toHaveLength(state.map.resources.length);
    for (const node of state.resourceNodes) {
      expect(node.remaining).toBeGreaterThan(0);
    }
  });

  it('map has zero starting buildings and HQ does not overlap resources', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.buildings).toHaveLength(0);
    // Verify HQ tiles don't overlap resources
    for (const r of state.map.resources) {
      const inHqX = r.tx >= state.map.hq.tx && r.tx < state.map.hq.tx + HQ_FOOTPRINT;
      const inHqY = r.ty >= state.map.hq.ty && r.ty < state.map.hq.ty + HQ_FOOTPRINT;
      expect(inHqX && inHqY).toBe(false);
    }
  });

  // ── Seed determinism ────────────────────────────────────────────────

  it('same seed + same size + same faction produces identical map', () => {
    const a = createGameState('standard', 'cyan', 12345);
    const b = createGameState('standard', 'cyan', 12345);
    expect(a.map.hq.tx).toBe(b.map.hq.tx);
    expect(a.map.hq.ty).toBe(b.map.hq.ty);
    expect(a.map.resources.length).toBe(b.map.resources.length);
    expect(a.map.obstacles.length).toBe(b.map.obstacles.length);
    expect(a.map.decor.length).toBe(b.map.decor.length);
    for (let i = 0; i < a.map.resources.length; i++) {
      expect(a.map.resources[i]!.tx).toBe(b.map.resources[i]!.tx);
      expect(a.map.resources[i]!.ty).toBe(b.map.resources[i]!.ty);
      expect(a.map.resources[i]!.type).toBe(b.map.resources[i]!.type);
    }
  });

  it('different seeds produce different resource layouts', () => {
    const a = createGameState('standard', 'cyan', 1);
    const b = createGameState('standard', 'cyan', 99999);
    // Extremely unlikely that two very different seeds produce the same resource count
    // and positions. At minimum, some resource position should differ.
    const samePositions = a.map.resources.every(
      (r, i) => r.tx === b.map.resources[i]?.tx && r.ty === b.map.resources[i]?.ty,
    );
    expect(samePositions).toBe(false);
  });

  it('createGameState with no seed uses default (backward compatible)', () => {
    // Calling without seed should still work — uses default seed 42
    const state = createGameState('standard', 'cyan');
    expect(state.map.width).toBe(48);
    expect(state.map.resources.length).toBeGreaterThan(0);
  });
});

// ── PR10: createGameStateFromMap tests ─────────────────────────────────

/** Helper: create a valid MapData for testing. */
function createTestMapData(faction: 'cyan' | 'green' | 'yellow' | 'purple' = 'cyan'): MapData {
  return generateMap(48, 48, faction);
}

describe('createGameStateFromMap', () => {
  it('creates state with all required subsystems', () => {
    const mapData = createTestMapData('green');
    const state = createGameStateFromMap(mapData, 'green');

    expect(state.map).toBeDefined();
    expect(state.economy).toBeDefined();
    expect(state.power).toBeDefined();
    expect(state.control).toBeDefined();
    expect(state.constructionStatusMessage).toBe('Строитель готов к строительству.');
    expect(state.constructionCancelledCount).toBe(0);
    expect(state.harvesters).toBeDefined();
    expect(state.resourceNodes).toBeDefined();
    expect(state.production).toBeDefined();
    expect(state.territory).toBeDefined();
  });

  it('preserves map dimensions from custom map', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.width).toBe(48);
    expect(state.map.height).toBe(48);
  });

  it('preserves resources from custom map', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.resources.length).toBe(mapData.resources.length);
    expect(state.resourceNodes.length).toBe(mapData.resources.length);
  });

  it('preserves obstacles from custom map', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.obstacles.length).toBe(mapData.obstacles.length);
  });

  it('preserves decor from custom map', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.decor.length).toBe(mapData.decor.length);
  });

  it('sets economy faction to the provided faction', () => {
    const mapData = createTestMapData('purple');
    const state = createGameStateFromMap(mapData, 'purple');
    expect(state.economy.faction).toBe('purple');
  });

  it('deep-clones input MapData — runtime mutations do not affect original', () => {
    const mapData = createTestMapData('cyan');
    const originalResourceCount = mapData.resources.length;
    const state = createGameStateFromMap(mapData, 'cyan');

    // Mutate runtime state
    state.map.resources.length = 0;

    // Original should be unaffected
    expect(mapData.resources.length).toBe(originalResourceCount);
  });

  it('creates 2 harvesters near HQ', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.harvesters).toHaveLength(2);
    for (const h of state.harvesters) {
      expect(h.phase).toBe('idle');
      expect(h.carry).toBe(0);
    }
  });

  it('creates a builder when map has no builders', () => {
    const mapData = createTestMapData('cyan');
    // Remove builders from the map data
    mapData.builders = [];
    const state = createGameStateFromMap(mapData, 'cyan');
    // Should have created one builder
    expect(state.map.builders.length).toBeGreaterThanOrEqual(1);
    expect(state.map.builders[0]!.busy).toBe(false);
    expect(state.map.builders[0]!.phase).toBe('idle');
  });

  it('preserves existing builders from map', () => {
    const mapData = createTestMapData('cyan');
    // mapgen creates builders; verify they are preserved
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.builders.length).toBeGreaterThanOrEqual(1);
  });

  it('creates power state with HQ', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.power.buildings.length).toBeGreaterThanOrEqual(1);
    const hqEntry = state.power.buildings.find((b) => b.type === 'hq');
    expect(hqEntry).toBeDefined();
    expect(hqEntry!.online).toBe(true);
  });

  it('sets control used to builder + harvester control cost', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.control.used).toBe(
      state.map.builders.length * BUILDER_CONTROL_COST + state.harvesters.length * HARVESTER_CONTROL_COST,
    );
  });

  it('initializes territory with HQ footprint as owned', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.territory.width).toBe(48);
    expect(state.territory.height).toBe(48);
    // HQ tiles should be claimed
    const hqTile = state.territory.tiles[mapData.hq.ty * 48 + mapData.hq.tx];
    expect(hqTile).toBeDefined();
    expect(hqTile!.progress).toBe(1);
    expect(hqTile!.owner).toBe('cyan');
  });

  it('creates resource node states matching map resources', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.resourceNodes.length).toBe(mapData.resources.length);
    for (const node of state.resourceNodes) {
      expect(node.remaining).toBeGreaterThan(0);
    }
  });

  it('has no construction sites at start', () => {
    const mapData = createTestMapData('cyan');
    const state = createGameStateFromMap(mapData, 'cyan');
    expect(state.map.constructionSites).toHaveLength(0);
  });
});

describe('deepCloneMapData', () => {
  it('returns a deep clone of the MapData', () => {
    const mapData = createTestMapData('cyan');
    const cloned = deepCloneMapData(mapData);
    expect(cloned).not.toBeNull();
    expect(cloned!.resources.length).toBe(mapData.resources.length);
    // Mutate clone
    cloned!.resources.length = 0;
    // Original should be unaffected
    expect(mapData.resources.length).toBeGreaterThan(0);
  });

  it('returns null for non-serializable objects', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const result = deepCloneMapData(cyclic as unknown as MapData);
    expect(result).toBeNull();
  });
});
