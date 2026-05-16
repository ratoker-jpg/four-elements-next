import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/game-state.js';
import { BUILDER_CONTROL_COST } from '../../src/systems/construction.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import { getBuildingFootprint } from '../../src/config/buildings.js';

describe('createGameState', () => {
  it('creates state with map, economy, power, and control', () => {
    const state = createGameState('standard', 'cyan');

    expect(state.map).toBeDefined();
    expect(state.economy).toBeDefined();
    expect(state.power).toBeDefined();
    expect(state.control).toBeDefined();
    expect(state.constructionStatusMessage).toBe('Строитель готов к строительству.');
  });

  it('initializes map with correct dimensions for standard size', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.width).toBe(48);
    expect(state.map.height).toBe(48);
  });

  it('initializes map with correct dimensions for large size', () => {
    const state = createGameState('large', 'cyan');
    expect(state.map.width).toBe(48); // large = standard for now
    expect(state.map.height).toBe(48);
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

  it('creates economy separators matching map separator buildings', () => {
    const state = createGameState('standard', 'cyan');
    const mapSeparators = state.map.buildings.filter((b) => b.type === 'separator');
    expect(state.economy.separators).toHaveLength(mapSeparators.length);
    for (const sep of state.economy.separators) {
      expect(mapSeparators.some((b) => b.tx === sep.tx && b.ty === sep.ty)).toBe(true);
    }
  });

  it('creates power state with HQ plus all map buildings', () => {
    const state = createGameState('standard', 'cyan');
    // HQ + 4 pre-placed buildings
    expect(state.power.buildings).toHaveLength(1 + state.map.buildings.length);
    const hqEntry = state.power.buildings.find((b) => b.type === 'hq');
    expect(hqEntry).toBeDefined();
    expect(hqEntry!.online).toBe(true);
  });

  it('sets control used to builder count times BUILDER_CONTROL_COST', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.control.used).toBe(state.map.builders.length * BUILDER_CONTROL_COST);
  });

  it('has builders placed on the map', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.builders.length).toBeGreaterThanOrEqual(1);
  });

  it('has no construction sites at start', () => {
    const state = createGameState('standard', 'cyan');
    expect(state.map.constructionSites).toHaveLength(0);
  });

  it('map buildings have 2x2 footprints and do not overlap', () => {
    const state = createGameState('standard', 'cyan');
    const occupied = new Map<string, string>();

    const claim = (owner: string, tx: number, ty: number) => {
      const key = `${tx},${ty}`;
      expect(occupied.has(key)).toBe(false);
      occupied.set(key, owner);
    };

    for (let dy = 0; dy < HQ_FOOTPRINT; dy++) {
      for (let dx = 0; dx < HQ_FOOTPRINT; dx++) {
        claim('hq', state.map.hq.tx + dx, state.map.hq.ty + dy);
      }
    }

    for (const building of state.map.buildings) {
      const footprint = getBuildingFootprint(building.type);
      for (let dy = 0; dy < footprint; dy++) {
        for (let dx = 0; dx < footprint; dx++) {
          claim(building.type, building.tx + dx, building.ty + dy);
        }
      }
    }
  });
});
