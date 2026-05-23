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
    expect(START_RAW).toBe(30);
    expect(START_MATTER).toBe(120);
    expect(START_ELEMENT).toBe(30); // 30 elementUnits = 3.0 displayed elements
  });

  it('separator conversion params are correct', () => {
    expect(SEP_RAW_COST).toBe(12);
    expect(SEP_MATTER_YIELD).toBe(10);
    expect(SEP_ELEMENT_YIELD).toBe(2); // 2 elementUnits = 0.2 displayed element per cycle
    expect(SEP_CYCLE_SECONDS).toBe(5);
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

  it('no floating-point drift: 5 cycles produce exactly 1.0 displayed element', () => {
    let elementUnits = 30;
    for (let i = 0; i < 5; i++) {
      elementUnits += 2; // +2 elementUnits per separator cycle
    }
    expect(elementUnits).toBe(40);
    expect(toDisplayElements(elementUnits)).toBe(4);
    expect(formatDisplayElements(elementUnits)).toBe('4.0');
    expect(Number.isInteger(elementUnits)).toBe(true);
  });

  it('no floating-point drift over 1000 cycles', () => {
    let elementUnits = 0;
    for (let i = 0; i < 1000; i++) {
      elementUnits += 2;
    }
    expect(elementUnits).toBe(2000);
    expect(Number.isInteger(elementUnits)).toBe(true);
    expect(toDisplayElements(elementUnits)).toBe(200);
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
    expect(state.resources.raw).toBe(30);
    expect(state.resources.matter).toBe(120);
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
    const state = createStateWithRaw(12);
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(true);
    expect(state.separators[0]!.progress).toBeGreaterThan(0);
  });

  it('separator adds exactly 2 elementUnits per cycle', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    const elementBefore = state.resources.elements.purple;
    tickEconomy(state, SEP_CYCLE_SECONDS);

    expect(state.resources.raw).toBe(100 - SEP_RAW_COST);
    expect(state.resources.matter).toBe(120 + SEP_MATTER_YIELD);
    expect(state.resources.elements.purple).toBe(elementBefore + 2); // +2 elementUnits
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator +2 elementUnits = +0.2 displayed element per cycle', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    const displayBefore = toDisplayElements(state.resources.elements.purple);
    tickEconomy(state, SEP_CYCLE_SECONDS);
    const displayAfter = toDisplayElements(state.resources.elements.purple);
    expect(displayAfter).toBeCloseTo(displayBefore + 0.2, 10);
  });

  it('5 separator cycles accumulate exactly 10 elementUnits = 1.0 displayed element', () => {
    const state = createStateWithRaw(200, 1, 0, 'cyan');
    state.resources.matterCap = 99999;
    const elementBefore = state.resources.elements.cyan;

    for (let i = 0; i < 5; i++) {
      tickEconomy(state, SEP_CYCLE_SECONDS);
    }

    expect(state.resources.elements.cyan).toBe(elementBefore + 10); // +10 elementUnits
    expect(toDisplayElements(state.resources.elements.cyan)).toBe(toDisplayElements(elementBefore) + 1);
    expect(formatDisplayElements(state.resources.elements.cyan)).toBe('4.0');
    expect(Number.isInteger(state.resources.elements.cyan)).toBe(true);
  });

  it('no floating-point drift over many separator cycles', () => {
    const state = createStateWithRaw(99999, 1, 15, 'cyan'); // 15 matter-storages for high element cap (3200)
    state.resources.matterCap = 99999;
    const elementBefore = state.resources.elements.cyan;

    for (let i = 0; i < 1000; i++) {
      tickEconomy(state, SEP_CYCLE_SECONDS);
    }

    expect(state.resources.elements.cyan).toBe(elementBefore + 2000);
    expect(Number.isInteger(state.resources.elements.cyan)).toBe(true);
  });

  it('separator completes cycle after 5 seconds and adds active faction element', () => {
    const state = createStateWithRaw(100, 1, 0, 'purple');
    tickEconomy(state, 5);

    expect(state.resources.raw).toBe(100 - SEP_RAW_COST);
    expect(state.resources.matter).toBe(120 + SEP_MATTER_YIELD);
    expect(state.resources.elements).toEqual({ cyan: 0, green: 0, yellow: 0, purple: 32 }); // 30 + 2
    expect(getFactionElement(state, 'purple')).toBe(32);
    expect(toDisplayElements(getFactionElement(state, 'purple'))).toBe(3.2);
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
    // With SEP_ELEMENT_YIELD = 2, the separator needs at least 2 elementUnits of cap space.
    // Set to cap - 2 so one more cycle exactly fills to cap.
    state.resources.elements.cyan = state.resources.elementCap - 2; // 198 elementUnits
    tickEconomy(state, SEP_CYCLE_SECONDS);
    expect(state.resources.elements.cyan).toBe(state.resources.elementCap); // 200 exactly
    // Second cycle should not exceed cap (only 0 space left)
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
    const state = createStateWithRaw(12);
    tickEconomy(state, 2.5);
    expect(state.separators[0]!.progress).toBeCloseTo(0.5, 2);

    state.resources.raw = 0;
    tickEconomy(state, 1);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[0]!.progress).toBeCloseTo(0.5, 2);

    state.resources.raw = 12;
    tickEconomy(state, 2.5);
    expect(state.resources.raw).toBe(0);
    expect(state.separators[0]!.progress).toBeCloseTo(0, 2);
  });

  it('multiple separators cannot overspend raw in the same tick', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }, { tx: 10, ty: 5 }], 1, 0, 'cyan');
    state.resources.raw = 12;
    tickEconomy(state, 5);
    expect(state.resources.raw).toBe(0);
    expect(state.resources.matter).toBe(130); // 120 + 10
    expect(state.resources.elements.cyan).toBe(32); // 30 + 2 elementUnits
  });
  it('separator pauses when offline (power deficit)', () => {
    const state = createStateWithRaw(12);
    const offlineMap = new Map<string, boolean>([['7,4', false]]);
    tickEconomy(state, 1, offlineMap);
    expect(state.separators[0]!.active).toBe(false);
    expect(state.separators[0]!.progress).toBe(0);
  });

  it('separator works when online map says true', () => {
    const state = createStateWithRaw(12);
    const onlineMap = new Map<string, boolean>([['7,4', true]]);
    tickEconomy(state, 1, onlineMap);
    expect(state.separators[0]!.active).toBe(true);
    expect(state.separators[0]!.progress).toBeGreaterThan(0);
  });

  it('separator defaults to online when no map provided', () => {
    const state = createStateWithRaw(12);
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

// ── ECONOMY-PACE-01: MVP pacing baseline ───────────────────────────────

describe('ECONOMY-PACE-01: first 5–8 minutes pacing baseline', () => {
  it('starting resources match new MVP baseline', () => {
    expect(START_RAW).toBe(30);
    expect(START_MATTER).toBe(120);
    expect(START_ELEMENT).toBe(30);
  });

  it('separator is affordable immediately from starting matter', async () => {
    const { BUILDING_DEFINITIONS } = await import('../../src/config/buildings.js');
    const separatorCost = BUILDING_DEFINITIONS['separator'].costMatter;
    expect(separatorCost).toBeLessThanOrEqual(START_MATTER);
    expect(separatorCost).toBe(60);
  });

  it('separator cycle uses 12 raw and produces 10 matter + 2 elementUnits after 5s', () => {
    const state = createEconomyState([{ tx: 7, ty: 4 }], 1, 0, 'cyan');
    // Set raw to enough for a cycle
    state.resources.raw = 50;

    tickEconomy(state, SEP_CYCLE_SECONDS);

    expect(state.resources.raw).toBe(50 - SEP_RAW_COST); // 50 - 12 = 38
    expect(state.resources.matter).toBe(START_MATTER + SEP_MATTER_YIELD); // 120 + 10 = 130
    expect(state.resources.elements.cyan).toBe(START_ELEMENT + SEP_ELEMENT_YIELD); // 30 + 2 = 32
    // Verify the display: 32 elementUnits = 3.2 displayed elements
    expect(formatDisplayElements(state.resources.elements.cyan)).toBe('3.2');
  });

  it('power-plant and units-factory costs match new MVP baseline', async () => {
    const { BUILDING_DEFINITIONS } = await import('../../src/config/buildings.js');
    expect(BUILDING_DEFINITIONS['power-plant'].costMatter).toBe(100);
    expect(BUILDING_DEFINITIONS['units-factory'].costMatter).toBe(120);
  });

  it('builder and harvester production costs and durations match new baseline', async () => {
    const { PRODUCTION_COSTS: costs } = await import('../../src/systems/production.js');
    expect(costs.builder.matter).toBe(40);
    expect(costs.builder.duration).toBe(15);
    expect(costs.builder.element).toBe(10); // 10 elementUnits = 1 displayed element, unchanged
    expect(costs.harvester.matter).toBe(50);
    expect(costs.harvester.duration).toBe(20);
    expect(costs.harvester.element).toBe(10); // 10 elementUnits = 1 displayed element, unchanged
  });

  it('no early soft-lock: separator + power-plant + units-factory path is affordable', async () => {
    const { BUILDING_DEFINITIONS } = await import('../../src/config/buildings.js');
    // Total cost of the critical path: separator + power-plant + units-factory
    const sepCost = BUILDING_DEFINITIONS['separator'].costMatter;
    const ppCost = BUILDING_DEFINITIONS['power-plant'].costMatter;
    const facCost = BUILDING_DEFINITIONS['units-factory'].costMatter;
    const totalBuildingCost = sepCost + ppCost + facCost; // 60 + 100 + 120 = 280

    // Starting matter is 120, but separator cycles produce matter (10 per 5s cycle).
    // After building separator (60), remaining matter = 60.
    // Need 2 separator cycles (10s) to get back to 80 matter.
    // Then need 2 more cycles (10s) to reach 100 matter for power-plant.
    // After power-plant (100), remaining = 0.
    // Need 12 separator cycles (60s) to accumulate 120 matter for factory.
    // Total: ~20s building + 80s separator cycles ≈ 100s, well within 5 minutes.

    // Verify the total is reachable with separator income
    // Starting matter: 120. After separator (60): 60 remaining.
    // Need: 100 (power-plant) + 120 (factory) = 220 more matter.
    // Separator produces 10 matter per 5s cycle = 2 matter/second.
    // 220 / 2 = 110 seconds ≈ 1.8 minutes for matter alone.
    expect(totalBuildingCost).toBe(280);
    expect(START_MATTER).toBeGreaterThanOrEqual(sepCost);

    // Verify production costs are also reachable
    const { PRODUCTION_COSTS: costs } = await import('../../src/systems/production.js');
    // After building factory (120 matter), need builder (40 matter) or harvester (50 matter)
    // These are affordable from separator income in reasonable time
    expect(costs.builder.matter).toBeLessThanOrEqual(SEP_MATTER_YIELD * 5); // 40 <= 50 ✓
    expect(costs.harvester.matter).toBeLessThanOrEqual(SEP_MATTER_YIELD * 5); // 50 <= 50 ✓
  });

  it('SEP_ELEMENT_YIELD is elementUnits, not displayed Elements', () => {
    // This test explicitly verifies the critical distinction:
    // SEP_ELEMENT_YIELD = 2 elementUnits = 0.2 displayed Elements per cycle
    // NOT 2.0 displayed Elements per cycle
    expect(SEP_ELEMENT_YIELD).toBe(2);
    expect(toDisplayElements(SEP_ELEMENT_YIELD)).toBeCloseTo(0.2, 10);
    // 5 cycles produce 10 elementUnits = 1.0 displayed Element
    const afterFiveCycles = START_ELEMENT + SEP_ELEMENT_YIELD * 5;
    expect(afterFiveCycles).toBe(40); // 30 + 10
    expect(toDisplayElements(afterFiveCycles)).toBe(4.0);
    expect(formatDisplayElements(afterFiveCycles)).toBe('4.0');
  });
});
