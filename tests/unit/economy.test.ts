import { describe, it, expect } from 'vitest';
import {
  createEconomyState,
  tickEconomy,
  getFactionElement,
  HQ_RAW_CAP,
  HQ_MATTER_CAP,
  HQ_ELEMENT_CAP,
  RAW_STORAGE_RAW_BONUS,
  MATTER_STORAGE_MATTER_BONUS,
  MATTER_STORAGE_ELEMENT_BONUS,
  START_RAW,
  START_MATTER,
  START_ELEMENT,
  SEP_RAW_COST,
  SEP_MATTER_YIELD,
  SEP_ELEMENT_YIELD,
  SEP_CYCLE_SECONDS,
  ELEMENT_UNITS_PER_ELEMENT,
  toDisplayElements,
  formatDisplayElements,
  type EconomyState,
} from '../../src/systems/economy.js';

describe('economy constants', () => {
  it('HQ base caps are correct', () => {
    expect(HQ_RAW_CAP).toBe(200);
    expect(HQ_MATTER_CAP).toBe(200);
    expect(HQ_ELEMENT_CAP).toBe(200); // 200 elementUnits = 20 displayed elements
  });

  it('ELEMENT_UNITS_PER_ELEMENT is 10', () => {
    expect(ELEMENT_UNITS_PER_ELEMENT).toBe(10);
  });

  it('Raw Storage bonuses are correct', () => {
    expect(RAW_STORAGE_RAW_BONUS).toBe(200);
  });

  it('Matter Storage bonuses are correct', () => {
    expect(MATTER_STORAGE_MATTER_BONUS).toBe(200);
    expect(MATTER_STORAGE_ELEMENT_BONUS).toBe(200); // 200 elementUnits = +20 displayed elements
  });

  it('starting resources are correct (elementUnits)', () => {
    expect(START_RAW).toBe(0);
    expect(START_MATTER).toBe(100);
    expect(START_ELEMENT).toBe(30); // 30 elementUnits = 3.0 displayed elements
  });

  it('separator conversion params are correct', () => {
    expect(SEP_RAW_COST).toBe(15);
    expect(SEP_MATTER_YIELD).toBe(10);
    expect(SEP_ELEMENT_YIELD).toBe(1); // 1 elementUnit = 0.1 displayed element per cycle
    expect(SEP_CYCLE_SECONDS).toBe(6);
  });
});

describe('element display helpers', () => {
  it('toDisplayElements converts elementUnits to displayed elements', () => {
    expect(toDisplayElements(30)).toBe(3);
    expect(toDisplayElements(31)).toBe(3.1);
    expect(toDisplayElements(200)).toBe(20);
    expect(toDisplayElements(0)).toBe(0);
  });

  it('formatDisplayElements formats elementUnits with 1 decimal place', () => {
    expect(formatDisplayElements(30)).toBe('3.0');
    expect(formatDisplayElements(31)).toBe('3.1');
    expect(formatDisplayElements(200)).toBe('20.0');
    expect(formatDisplayElements(0)).toBe('0.0');
  });

  it('no floating-point drift: 10 cycles produce exactly 1.0 displayed element', () => {
    let elementUnits = 30;
    for (let i = 0; i < 10; i++) {
      elementUnits += 1; // +1 elementUnit per separator cycle
    }
    expect(elementUnits).toBe(40);
    expect(toDisplayElements(elementUnits)).toBe(4);
    expect(formatDisplayElements(elementUnits)).toBe('4.0');
    expect(Number.isInteger(elementUnits)).toBe(true);
  });

  it('no floating-point drift over 1000 cycles', () => {
    let elementUnits = 0;
    for (let i = 0; i < 1000; i++) {
      elementUnits += 1;
    }
    expect(elementUnits).toBe(1000);
    expect(Number.isInteger(elementUnits)).toBe(true);
    expect(toDisplayElements(elementUnits)).toBe(100);
  });
});

describe('createEconomyState', () => {
  it('creates state with HQ-only caps when no storages', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 0, 0, 'cyan');
    expect(state.resources.rawCap).toBe(200);
    expect(state.resources.matterCap).toBe(200);
    expect(state.resources.elementCap).toBe(200); // 200 elementUnits = 20 displayed elements
  });

  it('creates state with correct caps for raw-storage', () => {
    const one = createEconomyState([{ tx: 7, ty: 4 }], 1, 0, 'cyan');
    expect(one.resources.rawCap).toBe(400);
    expect(one.resources.matterCap).toBe(200);
    expect(one.resources.elementCap).toBe(200); // raw-storage doesn't affect element cap

    const two = createEconomyState([{ tx: 7, ty: 4 }], 2, 0, 'cyan');
    expect(two.resources.rawCap).toBe(600);
    expect(two.resources.matterCap).toBe(200);
    expect(two.resources.elementCap).toBe(200);
  });

  it('creates state with correct caps for matter-storage', () => {
    const one = createEconomyState([{ tx: 7, ty: 4 }], 0, 1, 'cyan');
    expect(one.resources.rawCap).toBe(200);
    expect(one.resources.matterCap).toBe(400);
    expect(one.resources.elementCap).toBe(400); // 200 + 200 = 400 elementUnits = 40 displayed elements

    const two = createEconomyState([{ tx: 7, ty: 4 }], 0, 2, 'cyan');
    expect(two.resources.rawCap).toBe(200);
    expect(two.resources.matterCap).toBe(600);
    expect(two.resources.elementCap).toBe(600); // 200 + 400 = 600 elementUnits = 60 displayed elements
  });

  it('creates state with correct caps for mixed storage types', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 1, 1, 'cyan');
    expect(state.resources.rawCap).toBe(400);
    expect(state.resources.matterCap).toBe(400);
    expect(state.resources.elementCap).toBe(400); // 200 + 200 = 400 elementUnits
  });

  it('sets starting raw, matter and active faction element only (elementUnits)', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 1, 0, 'green');
    expect(state.faction).toBe('green');
    expect(state.resources.raw).toBe(0);
    expect(state.resources.matter).toBe(100);
    expect(state.resources.elements).toEqual({ cyan: 0, green: 30, yellow: 0, purple: 0 }); // 30 elementUnits = 3.0 displayed
    expect(getFactionElement(state, 'green')).toBe(30);
    // Verify display conversion
    expect(toDisplayElements(getFactionElement(state, 'green'))).toBe(3);
  });

  it('starting element amounts display as 3.0', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 0, 0, 'cyan');
    expect(formatDisplayElements(getFactionElement(state, 'cyan'))).toBe('3.0');
    expect(formatDisplayElements(state.resources.elementCap)).toBe('20.0');
  });

  it('creates separator states from positions', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }, { tx: 10, ty: 5 }], 0, 0, 'cyan');
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
  function createStateWithRaw(raw: number, rawStorageCount = 1, matterStorageCount = 0, faction: 'cyan' | 'green' | 'yellow' | 'purple' = 'cyan'): EconomyState {
    const state = createEconomyState([{ tx: 7, ty: 4 }], rawStorageCount, matterStorageCount, faction);
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

  it('separator adds exactly 1 elementUnit per cycle', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    const elementBefore = state.resources.elements.purple;
    tickEconomy(state, SEP_CYCLE_SECONDS);

    expect(state.resources.raw).toBe(100 - SEP_RAW_COST);
    expect(state.resources.matter).toBe(100 + SEP_MATTER_YIELD);
    expect(state.resources.elements.purple).toBe(elementBefore + 1); // +1 elementUnit
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator +1 elementUnit = +0.1 displayed element per cycle', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    const displayBefore = toDisplayElements(state.resources.elements.purple);
    tickEconomy(state, SEP_CYCLE_SECONDS);
    const displayAfter = toDisplayElements(state.resources.elements.purple);
    expect(displayAfter).toBeCloseTo(displayBefore + 0.1, 10);
  });

  it('10 separator cycles accumulate exactly 10 elementUnits = 1.0 displayed element', () => {
    const state = createStateWithRaw(200, 1, 0, 'cyan');
    state.resources.matterCap = 99999;
    const elementBefore = state.resources.elements.cyan;

    for (let i = 0; i < 10; i++) {
      tickEconomy(state, SEP_CYCLE_SECONDS);
    }

    expect(state.resources.elements.cyan).toBe(elementBefore + 10); // +10 elementUnits
    expect(toDisplayElements(state.resources.elements.cyan)).toBe(toDisplayElements(elementBefore) + 1);
    expect(formatDisplayElements(state.resources.elements.cyan)).toBe('4.0');
    expect(Number.isInteger(state.resources.elements.cyan)).toBe(true);
  });

  it('no floating-point drift over many separator cycles', () => {
    const state = createStateWithRaw(99999, 1, 5, 'cyan'); // 5 matter-storages for high element cap
    state.resources.matterCap = 99999;
    const elementBefore = state.resources.elements.cyan;

    for (let i = 0; i < 1000; i++) {
      tickEconomy(state, SEP_CYCLE_SECONDS);
    }

    expect(state.resources.elements.cyan).toBe(elementBefore + 1000);
    expect(Number.isInteger(state.resources.elements.cyan)).toBe(true);
  });

  it('separator completes cycle after 6 seconds and adds active faction element', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    tickEconomy(state, 6);

    expect(state.resources.raw).toBe(100 - SEP_RAW_COST);
    expect(state.resources.matter).toBe(100 + SEP_MATTER_YIELD);
    expect(state.resources.elements).toEqual({ cyan: 0, green: 0, yellow: 0, purple: 31 }); // 30 + 1
    expect(getFactionElement(state, 'purple')).toBe(31);
    expect(toDisplayElements(getFactionElement(state, 'purple'))).toBe(3.1);
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator pauses when active faction element cap is reached', () => {
    const state = createStateWithRaw(100, 1, 0, 'yellow');
    state.resources.elements.yellow = state.resources.elementCap;
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
  });

  it('element cap prevents overproduction at elementUnit scale', () => {
    const state = createStateWithRaw(99999, 1, 0, 'cyan');
    state.resources.matterCap = 99999;
    state.resources.elements.cyan = state.resources.elementCap - 1; // 199 elementUnits
    tickEconomy(state, SEP_CYCLE_SECONDS);
    expect(state.resources.elements.cyan).toBe(state.resources.elementCap); // 200 exactly
    // Second cycle should not exceed cap
    state.resources.raw = 99999;
    tickEconomy(state, SEP_CYCLE_SECONDS);
    expect(state.resources.elements.cyan).toBe(state.resources.elementCap); // still 200
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
    const state = createEconomyState([{ tx: 7, ty: 4 }, { tx: 10, ty: 5 }], 1, 0, 'cyan');
    state.resources.raw = 15;
    tickEconomy(state, 6);
    expect(state.resources.raw).toBe(0);
    expect(state.resources.matter).toBe(110);
    expect(state.resources.elements.cyan).toBe(31); // 30 + 1 elementUnit
  });
  it('separator pauses when offline (power deficit)', () => {
    const state = createStateWithRaw(15);
    const offlineMap = new Map<string, boolean>([['7,4', false]]);
    tickEconomy(state, 1, offlineMap);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator works when online map says true', () => {
    const state = createStateWithRaw(15);
    const onlineMap = new Map<string, boolean>([['7,4', true]]);
    tickEconomy(state, 1, onlineMap);
    expect(state.separators[0]!.active).toBe(true);
    expect(state.separators[0]!.progress).toBeGreaterThan(0);
  });

  it('separator defaults to online when no map provided', () => {
    const state = createStateWithRaw(15);
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(true);
  });
});

describe('matter-storage adds +200 elementUnits to cap', () => {
  it('starting element cap is 200 elementUnits (20.0 displayed elements)', () => {
    const state = createEconomyState([], 0, 0, 'cyan');
    expect(state.resources.elementCap).toBe(200);
    expect(toDisplayElements(state.resources.elementCap)).toBe(20);
    expect(formatDisplayElements(state.resources.elementCap)).toBe('20.0');
  });

  it('one matter-storage adds +200 elementUnits (+20.0 displayed elements)', () => {
    const state = createEconomyState([], 0, 1, 'cyan');
    expect(state.resources.elementCap).toBe(400); // 200 + 200
    expect(toDisplayElements(state.resources.elementCap)).toBe(40);
    expect(formatDisplayElements(state.resources.elementCap)).toBe('40.0');
  });

  it('two matter-storages add +400 elementUnits (+40.0 displayed elements)', () => {
    const state = createEconomyState([], 0, 2, 'cyan');
    expect(state.resources.elementCap).toBe(600); // 200 + 400
    expect(toDisplayElements(state.resources.elementCap)).toBe(60);
  });
});

describe('mapgen integration — buildings in MapData', () => {
  it('generated map has zero starting buildings', async () => {
    const { generateMap } = await import('../../src/game/mapgen.js');
    const map = generateMap(48, 48, 'cyan');
    expect(map.buildings).toHaveLength(0);
    expect(map.buildings.filter((b) => b.type === 'separator')).toHaveLength(0);
    expect(map.buildings.filter((b) => b.type === 'raw-storage')).toHaveLength(0);
    expect(map.buildings.filter((b) => b.type === 'power-plant')).toHaveLength(0);
    expect(map.buildings.filter((b) => b.type === 'command-relay')).toHaveLength(0);
  });

  it('no initial separator/raw-storage/power-plant/command-relay', async () => {
    const { generateMap } = await import('../../src/game/mapgen.js');
    const map = generateMap(48, 48, 'cyan');
    const disallowed = new Set(['separator', 'raw-storage', 'power-plant', 'command-relay']);
    for (const b of map.buildings) {
      expect(disallowed.has(b.type)).toBe(false);
    }
  });
});
