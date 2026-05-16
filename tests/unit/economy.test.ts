import { describe, it, expect } from 'vitest';
import {
  createEconomyState,
  tickEconomy,
  getFactionElement,
  HQ_RAW_CAP,
  HQ_MATTER_CAP,
  HQ_ELEMENT_CAP,
  STORAGE_RAW_BONUS,
  STORAGE_MATTER_BONUS,
  STORAGE_ELEMENT_BONUS,
  START_RAW,
  START_MATTER,
  START_ELEMENT,
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEP_CYCLE_SECONDS,
  type EconomyState,
} from '../../src/systems/economy.js';

describe('economy constants', () => {
  it('HQ base caps are correct', () => {
    expect(HQ_RAW_CAP).toBe(200);
    expect(HQ_MATTER_CAP).toBe(200);
    expect(HQ_ELEMENT_CAP).toBe(10);
  });

  it('Storage bonuses are correct', () => {
    expect(STORAGE_RAW_BONUS).toBe(200);
    expect(STORAGE_MATTER_BONUS).toBe(200);
    expect(STORAGE_ELEMENT_BONUS).toBe(10);
  });

  it('starting resources are correct', () => {
    expect(START_RAW).toBe(0);
    expect(START_MATTER).toBe(100);
    expect(START_ELEMENT).toBe(3);
  });

  it('separator conversion params are correct', () => {
    expect(SEP_RAW_COST).toBe(15);
    expect(SEP_MATTER_YIELD).toBe(10);
    expect(SEP_ELEMENT_YIELD).toBe(1);
    expect(SEP_CYCLE_SECONDS).toBe(6);
  });
});

describe('createEconomyState', () => {
  it('creates state with HQ-only caps when no storages', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 0, 'cyan');
    expect(state.resources.rawCap).toBe(200);
    expect(state.resources.matterCap).toBe(200);
    expect(state.resources.elementCap).toBe(10);
  });

  it('creates state with correct caps for storages', () => {
    const one = createEconomyState([{ tx: 7, ty: 4 }], 1, 'cyan');
    expect(one.resources.rawCap).toBe(400);
    expect(one.resources.matterCap).toBe(400);
    expect(one.resources.elementCap).toBe(20);

    const two = createEconomyState([{ tx: 7, ty: 4 }], 2, 'cyan');
    expect(two.resources.rawCap).toBe(600);
    expect(two.resources.matterCap).toBe(600);
    expect(two.resources.elementCap).toBe(30);
  });

  it('sets starting raw, matter and active faction element only', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 1, 'green');
    expect(state.faction).toBe('green');
    expect(state.resources.raw).toBe(0);
    expect(state.resources.matter).toBe(100);
    expect(state.resources.elements).toEqual({ cyan: 0, green: 3, yellow: 0, purple: 0 });
    expect(getFactionElement(state, 'green')).toBe(3);
  });

  it('creates separator states from positions', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }, { tx: 10, ty: 5 }], 0, 'cyan');
    expect(state.separators).toHaveLength(2);
    expect(state.separators[0]!.tx).toBe(7);
    expect(state.separators[0]!.ty).toBe(4);
    expect(state.separators[0]!.progress).toBe(0);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[1]!.tx).toBe(10);
    expect(state.separators[1]!.ty).toBe(5);
  });
});

describe('tickEconomy', () => {
  function createStateWithRaw(raw: number, storageCount = 1, faction: 'cyan' | 'green' | 'yellow' | 'purple' = 'cyan'): EconomyState {
    const state = createEconomyState([{ tx: 7, ty: 4 }], storageCount, faction);
    state.resources.raw = raw;
    return state;
  }

  it('separator is idle when raw is 0', () => {
    const state = createStateWithRaw(0);
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator is active when raw is enough and caps have room', () => {
    const state = createStateWithRaw(15);
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(true);
    expect(state.separators[0]!.progress).toBeGreaterThan(0);
  });

  it('separator completes cycle after 6 seconds and adds active faction element', () => {
    const state = createStateWithRaw(100, 1, 'purple');
    tickEconomy(state, 6);

    expect(state.resources.raw).toBe(100 - SEP_RAW_COST);
    expect(state.resources.matter).toBe(100 + SEP_MATTER_YIELD);
    expect(state.resources.elements).toEqual({ cyan: 0, green: 0, yellow: 0, purple: 4 });
    expect(getFactionElement(state, 'purple')).toBe(4);
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator pauses when active faction element cap is reached', () => {
    const state = createStateWithRaw(100, 1, 'yellow');
    state.resources.elements.yellow = state.resources.elementCap;
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
  });

  it('separator pauses when matter cap is reached', () => {
    const state = createStateWithRaw(100);
    state.resources.matter = state.resources.matterCap;
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
  });

  it('separator preserves progress while idle and resumes later', () => {
    const state = createStateWithRaw(15);
    tickEconomy(state, 3);
    expect(state.separators[0]!.progress).toBeCloseTo(0.5, 2);

    state.resources.raw = 0;
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[0]!.progress).toBeCloseTo(0.5, 2);

    state.resources.raw = 15;
    tickEconomy(state, 3);
    expect(state.resources.raw).toBe(0);
    expect(state.separators[0]!.progress).toBeCloseTo(0, 2);
  });

  it('multiple separators cannot overspend raw in the same tick', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }, { tx: 10, ty: 5 }], 1, 'cyan');
    state.resources.raw = 15;
    tickEconomy(state, 6);
    expect(state.resources.raw).toBe(0);
    expect(state.resources.matter).toBe(110);
    expect(state.resources.elements.cyan).toBe(4);
  });
});

describe('mapgen integration — buildings in MapData', () => {
  it('generated map has one separator and one storage', async () => {
    const { generateMap } = await import('../../src/game/mapgen.js');
    const map = generateMap(48, 48, 'cyan');
    expect(map.buildings.filter((b) => b.type === 'separator')).toHaveLength(1);
    expect(map.buildings.filter((b) => b.type === 'storage')).toHaveLength(1);
  });

  it('buildings are placed adjacent to HQ and do not overlap resources', async () => {
    const { generateMap } = await import('../../src/game/mapgen.js');
    const { HQ_FOOTPRINT } = await import('../../src/core/constants.js');
    const map = generateMap(48, 48, 'cyan');
    const sep = map.buildings.find((b) => b.type === 'separator')!;
    const sto = map.buildings.find((b) => b.type === 'storage')!;

    expect(sep.tx).toBe(map.hq.tx + HQ_FOOTPRINT);
    expect(sep.ty).toBe(map.hq.ty);
    expect(sto.tx).toBe(sep.tx);
    expect(sto.ty).toBe(sep.ty + 1);

    for (const b of map.buildings) {
      const overlap = map.resources.some((r) => r.tx === b.tx && r.ty === b.ty);
      expect(overlap).toBe(false);
    }
  });
});
