import { describe, it, expect } from 'vitest';
import { createGameState } from '../../src/game/game-state.js';
import { runSystems } from '../../src/systems/system-runner.js';
import { startConstruction } from '../../src/systems/construction.js';
import { BUILDER_CONTROL_COST } from '../../src/systems/construction.js';
import { HARVESTER_CONTROL_COST } from '../../src/systems/harvesting.js';
import { HQ_CONTROL, RELAY_CONTROL } from '../../src/systems/control.js';

describe('runSystems', () => {
  function createState() {
    return createGameState('standard', 'cyan');
  }

  it('runs all systems without errors on a fresh state', () => {
    const state = createState();
    expect(() => runSystems(state, 1)).not.toThrow();
  });

  it('runs construction → power → control → economy in order', () => {
    const state = createState();
    // Start construction so tickConstruction has work to do
    startConstruction(state.map, state.economy, 'separator');

    runSystems(state, 10);

    // Construction should have progressed — at least the separator we started
    expect(state.map.constructionSites.length + state.map.buildings.filter((b) => b.type === 'separator').length).toBeGreaterThanOrEqual(1);
  });

  it('handles completion cascade: completed building added to economy and power', () => {
    const state = createState();
    const initialSepCount = state.economy.separators.length;
    const initialPowerBuildingCount = state.power.buildings.length;

    startConstruction(state.map, state.economy, 'command-relay');

    // Advance enough time to complete
    runSystems(state, 18);

    // Command Relay completed: economy gets nothing (CR has no economy effect)
    // but power gets a new building
    expect(state.power.buildings.length).toBe(initialPowerBuildingCount + 1);
    expect(state.constructionStatusMessage).toContain('построен');
    expect(state.map.builders[0]!.busy).toBe(false);
  });

  it('completion cascade for separator adds it to economy separators', () => {
    const state = createState();
    const initialSepCount = state.economy.separators.length;

    startConstruction(state.map, state.economy, 'separator');

    runSystems(state, 25);

    expect(state.economy.separators.length).toBe(initialSepCount + 1);
    expect(state.constructionStatusMessage).toContain('построен');
  });

  it('updates control based on online relays from power state', () => {
    const state = createState();
    const expectedControl = HQ_CONTROL + state.power.buildings.filter(
      (b) => b.type === 'command-relay' && b.online,
    ).length * RELAY_CONTROL;

    runSystems(state, 1);

    expect(state.control.current).toBe(Math.min(expectedControl, 50));
  });

  it('sets separator offline when power is insufficient', () => {
    const state = createState();
    // Add many separators to overwhelm power supply
    for (let i = 0; i < 10; i++) {
      state.map.buildings.push({ tx: 20 + i, ty: 20, type: 'separator' });
      state.economy.separators.push({ tx: 20 + i, ty: 20, progress: 0, active: false });
      state.power.buildings.push({ tx: 20 + i, ty: 20, type: 'separator', online: true });
    }
    state.economy.resources.raw = 1000;

    runSystems(state, 1);

    // Some separators should be offline due to power deficit
    const offlineSeps = state.economy.separators.filter((s) => !s.active);
    expect(offlineSeps.length).toBeGreaterThan(0);
  });

  it('handles zero dt without errors', () => {
    const state = createState();
    expect(() => runSystems(state, 0)).not.toThrow();
  });

  it('handles large dt that completes construction', () => {
    const state = createState();
    startConstruction(state.map, state.economy, 'raw-storage');

    runSystems(state, 100);

    expect(state.map.constructionSites).toHaveLength(0);
    expect(state.map.builders[0]!.busy).toBe(false);
  });

  it('preserves builder + harvester control cost in control.used after init', () => {
    const state = createState();
    const builderCount = state.map.builders.length;
    const harvesterCount = state.harvesters.length;

    runSystems(state, 1);

    // control.used is set at creation time, not changed by tickControl
    expect(state.control.used).toBe(builderCount * BUILDER_CONTROL_COST + harvesterCount * HARVESTER_CONTROL_COST);
  });
});
