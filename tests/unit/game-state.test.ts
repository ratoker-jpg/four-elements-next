import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/game-state.js';
import { BUILDER_CONTROL_COST } from '../../src/systems/construction.js';
import { HARVESTER_CONTROL_COST } from '../../src/systems/harvesting.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';

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
});
