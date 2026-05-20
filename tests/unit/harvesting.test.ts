import { describe, it, expect } from 'vitest';
import {
  tickHarvesting,
  createInitialHarvesters,
  createResourceNodeStates,
  findNearestDropoff,
  HARVESTER_CONTROL_COST,
  HARVESTER_SPEED,
  HARVESTER_GATHER_TIME,
  HARVESTER_CARRY_AMOUNT,
  type HarvesterState,
  type ResourceNodeState,
} from '../../src/systems/harvesting.js';
import { createGameState } from '../../src/game/game-state.js';
import { BUILDER_CONTROL_COST } from '../../src/systems/construction.js';
import type { GameState } from '../../src/game/game-state.js';
import type { ResourceType, MapData } from '../../src/game/map-types.js';
import { HQ_FOOTPRINT } from '../../src/core/constants.js';
import { buildPassabilityGrid } from '../../src/systems/passability.js';
import { findPathToAdjacent } from '../../src/systems/pathfinding.js';
import { RESOURCE_FOOTPRINTS } from '../../src/game/map-types.js';

/** Create a minimal GameState for testing. Wraps createGameState for convenience. */
function createState(): GameState {
  return createGameState('standard', 'cyan');
}

/** Default dropoff/path fields for test harvester construction. */
const DEFAULT_EXTRA = { targetDropoffTx: 0, targetDropoffTy: 0, path: [] as Array<{ tx: number; ty: number }>, pathIndex: 0 };

/** Create a minimal GameState with a harvester at a specific position and resource nodes. */
function createTestState(
  harvesterTx: number,
  harvesterTy: number,
  harvesterPhase: HarvesterState['phase'],
  nodes: Array<{ tx: number; ty: number; type: ResourceType; remaining?: number }>,
): GameState {
  const state = createState();
  state.harvesters = [{
    tx: harvesterTx,
    ty: harvesterTy,
    phase: harvesterPhase,
    targetNodeIndex: -1,
    gatherProgress: 0,
    carry: 0,
    ...DEFAULT_EXTRA,
  }];
  state.resourceNodes = nodes.map((n) => ({
    tx: n.tx,
    ty: n.ty,
    type: n.type,
    infinite: n.type === 'infinite',
    remaining: n.remaining ?? (n.type === 'infinite' ? Infinity : 100),
  }));
  return state;
}

/** Create a minimal MapData for passability tests. */
function createMinimalMap(overrides: Partial<MapData> = {}): MapData {
  return {
    width: 20,
    height: 20,
    terrain: Array.from({ length: 20 }, () => Array(20).fill('sand') as string[]),
    hq: { tx: 4, ty: 4, faction: 'cyan' },
    resources: [],
    obstacles: [],
    decor: [],
    buildings: [],
    builders: [{ tx: 3, ty: 4, busy: false }],
    constructionSites: [],
    ...overrides,
  };
}

/** Create a GameState from a minimal MapData with no resources by default. */
function createTestStateFromMap(mapOverrides: Partial<MapData> = {}): GameState {
  const map = createMinimalMap(mapOverrides);
  return {
    map,
    economy: createState().economy,
    power: createState().power,
    control: createState().control,
    constructionStatusMessage: '',
    harvesters: [{
      tx: 7.5,
      ty: 7.5,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      ...DEFAULT_EXTRA,
    }],
    resourceNodes: (map.resources ?? []).map((r) => ({
      tx: r.tx,
      ty: r.ty,
      type: r.type,
      infinite: r.type === 'infinite',
      remaining: r.type === 'infinite' ? Infinity : 100,
    })),
    production: createState().production,
    territory: createState().territory,
  };
}

// ── createInitialHarvesters ──────────────────────────────────────────

describe('createInitialHarvesters', () => {
  it('creates exactly two harvesters', () => {
    const state = createState();
    expect(state.harvesters).toHaveLength(2);
  });

  it('places harvester near HQ', () => {
    const state = createState();
    const hq = state.map.hq;
    for (const h of state.harvesters) {
      const dist = Math.hypot(h.tx - (hq.tx + 1.5), h.ty - (hq.ty + 1.5));
      expect(dist).toBeLessThan(5);
    }
  });

  it('initial harvester starts in idle phase', () => {
    const state = createState();
    expect(state.harvesters[0]!.phase).toBe('idle');
  });

  it('initial harvester has no carry', () => {
    const state = createState();
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('initial harvester has targetDropoffTx and targetDropoffTy fields', () => {
    const state = createState();
    expect(state.harvesters[0]!).toHaveProperty('targetDropoffTx');
    expect(state.harvesters[0]!).toHaveProperty('targetDropoffTy');
  });

  it('initial harvester has path and pathIndex fields', () => {
    const state = createState();
    expect(state.harvesters[0]!).toHaveProperty('path');
    expect(state.harvesters[0]!).toHaveProperty('pathIndex');
    expect(state.harvesters[0]!.path).toEqual([]);
    expect(state.harvesters[0]!.pathIndex).toBe(0);
  });
});

// ── createResourceNodeStates ─────────────────────────────────────────

describe('createResourceNodeStates', () => {
  it('creates runtime nodes matching map resources', () => {
    const state = createState();
    expect(state.resourceNodes).toHaveLength(state.map.resources.length);
  });

  it('marks infinite type as infinite', () => {
    const state = createState();
    const infiniteNodes = state.resourceNodes.filter((n) => n.infinite);
    const mapInfinite = state.map.resources.filter((r) => r.type === 'infinite');
    expect(infiniteNodes).toHaveLength(mapInfinite.length);
    for (const node of infiniteNodes) {
      expect(node.remaining).toBe(Infinity);
    }
  });

  it('gives finite nodes a positive remaining amount', () => {
    const nodes = createResourceNodeStates([
      { tx: 10, ty: 10, type: 'small' },
      { tx: 20, ty: 20, type: 'medium' },
      { tx: 30, ty: 30, type: 'large' },
    ]);
    expect(nodes[0]!.remaining).toBe(50);
    expect(nodes[1]!.remaining).toBe(100);
    expect(nodes[2]!.remaining).toBe(200);
    expect(nodes.every((n) => !n.infinite)).toBe(true);
  });
});

// ── HARVESTER_CONTROL_COST ──────────────────────────────────────────

describe('HARVESTER_CONTROL_COST', () => {
  it('is included in initial control.used', () => {
    const state = createState();
    const expectedUsed = state.map.builders.length * BUILDER_CONTROL_COST
      + state.harvesters.length * HARVESTER_CONTROL_COST;
    expect(state.control.used).toBe(expectedUsed);
  });
});

// ── tickHarvesting — idle → moving-to-resource ─────────────────────

describe('tickHarvesting idle phase', () => {
  it('transitions idle harvester to moving-to-resource when nodes exist', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(0);
  });

  it('keeps harvester idle when no resource nodes exist', () => {
    const state = createTestState(7.5, 7.5, 'idle', []);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('idle');
  });

  it('skips depleted resource nodes', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 0 },
      { tx: 15, ty: 15, type: 'medium' },
    ]);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(1);
  });

  it('computes path to resource when transitioning', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.path.length).toBeGreaterThan(0);
    expect(state.harvesters[0]!.pathIndex).toBe(0);
  });
});

// ── tickHarvesting — moving-to-resource ─────────────────────────────

describe('tickHarvesting moving-to-resource phase', () => {
  it('moves harvester toward target resource node', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    const txBefore = state.harvesters[0]!.tx;
    tickHarvesting(state, 0.5);
    // Harvester should have moved toward the resource
    const resourceCenter = { tx: 10.5, ty: 10.5 };
    const distBefore = Math.hypot(resourceCenter.tx - txBefore, resourceCenter.ty - state.harvesters[0]!.ty);
    const distAfter = Math.hypot(resourceCenter.tx - state.harvesters[0]!.tx, resourceCenter.ty - state.harvesters[0]!.ty);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('goes idle if target node depleted while moving', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    // Deplete the node
    state.resourceNodes[0]!.remaining = 0;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('idle');
  });
});

// ── tickHarvesting — gathering ──────────────────────────────────────

describe('tickHarvesting gathering phase', () => {
  it('transitions to moving-to-dropoff when gathering complete', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    // Run to moving-to-resource
    tickHarvesting(state, 0.1);
    // Fast-forward to arrival and gathering
    for (let i = 0; i < 50; i++) {
      tickHarvesting(state, 0.1);
      if (state.harvesters[0]!.phase === 'gathering') break;
    }
    expect(state.harvesters[0]!.phase).toBe('gathering');
    // Complete gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-dropoff');
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
  });

  it('decrements finite node remaining on extraction', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1);
    for (let i = 0; i < 50; i++) {
      tickHarvesting(state, 0.1);
      if (state.harvesters[0]!.phase === 'gathering') break;
    }
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.resourceNodes[0]!.remaining).toBe(100 - HARVESTER_CARRY_AMOUNT);
  });

  it('does not decrement infinite node remaining', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'infinite' },
    ]);
    tickHarvesting(state, 0.1);
    for (let i = 0; i < 50; i++) {
      tickHarvesting(state, 0.1);
      if (state.harvesters[0]!.phase === 'gathering') break;
    }
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.resourceNodes[0]!.remaining).toBe(Infinity);
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
  });

  it('goes idle if node depleted while gathering', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 5 },
    ]);
    tickHarvesting(state, 0.1);
    for (let i = 0; i < 50; i++) {
      tickHarvesting(state, 0.1);
      if (state.harvesters[0]!.phase === 'gathering') break;
    }
    // Deplete node during gathering
    state.resourceNodes[0]!.remaining = 0;
    tickHarvesting(state, 1.0);
    expect(state.harvesters[0]!.phase).toBe('idle');
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('computes dropoff path when transitioning to moving-to-dropoff', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1);
    for (let i = 0; i < 50; i++) {
      tickHarvesting(state, 0.1);
      if (state.harvesters[0]!.phase === 'gathering') break;
    }
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-dropoff');
    expect(state.harvesters[0]!.path.length).toBeGreaterThan(0);
  });
});

// ── tickHarvesting — moving-to-dropoff ───────────────────────────────

describe('tickHarvesting moving-to-dropoff phase', () => {
  it('transitions to delivering when harvester arrives at dropoff', () => {
    // Place harvester near HQ (already adjacent to HQ)
    const state = createState();
    const hq = state.map.hq;
    // Adjacent tile to HQ
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'moving-to-dropoff',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    // Empty path means already at destination
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('delivering');
  });
});

// ── tickHarvesting — delivering ─────────────────────────────────────

describe('tickHarvesting delivering phase', () => {
  it('adds carry to economy.resources.raw', () => {
    const state = createState();
    const initialRaw = state.economy.resources.raw;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(initialRaw + HARVESTER_CARRY_AMOUNT);
  });

  it('deposits partial carry when raw cap is nearly full and preserves remainder', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap - 3;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(state.economy.resources.rawCap);
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT - 3);
    expect(state.harvesters[0]!.phase).toBe('waiting-full-storage');
  });

  it('resets carry and transitions to idle when full deposit fits', () => {
    const state = createState();
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.carry).toBe(0);
    expect(state.harvesters[0]!.phase).toBe('idle');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(-1);
  });

  it('enters waiting-full-storage when raw cap is completely full', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(state.economy.resources.rawCap);
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
    expect(state.harvesters[0]!.phase).toBe('waiting-full-storage');
  });
});

// ── tickHarvesting — waiting-full-storage ─────────────────────────────

describe('tickHarvesting waiting-full-storage phase', () => {
  it('stays in waiting-full-storage while raw cap is full', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'waiting-full-storage',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    for (let i = 0; i < 5; i++) {
      tickHarvesting(state, 0.1);
      expect(state.harvesters[0]!.phase).toBe('waiting-full-storage');
      expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
    }
  });

  it('resumes delivering when raw cap frees up', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'waiting-full-storage',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    state.economy.resources.raw -= HARVESTER_CARRY_AMOUNT;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('delivering');
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('idle');
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('delivers partial carry and waits again when only some space frees up', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'waiting-full-storage',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    state.economy.resources.raw -= 3;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('delivering');
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(state.economy.resources.rawCap);
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT - 3);
    expect(state.harvesters[0]!.phase).toBe('waiting-full-storage');
  });
});

// ── findNearestDropoff (legacy) ────────────────────────────────────────

describe('findNearestDropoff', () => {
  it('prefers HQ fallback when no raw-storage exists', () => {
    const state = createState();
    const harvester: HarvesterState = {
      tx: 10,
      ty: 10,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      ...DEFAULT_EXTRA,
    };
    const dropoff = findNearestDropoff(harvester, state.map);
    expect(dropoff.tx).toBe(state.map.hq.tx + 1.5);
    expect(dropoff.ty).toBe(state.map.hq.ty + 1.5);
  });

  it('prefers nearest raw-storage over HQ when raw-storage exists', () => {
    const state = createState();
    const rawStorageTx = state.map.hq.tx + 10;
    const rawStorageTy = state.map.hq.ty + 10;
    state.map.buildings.push({ tx: rawStorageTx, ty: rawStorageTy, type: 'raw-storage' });

    const harvester: HarvesterState = {
      tx: rawStorageTx + 1,
      ty: rawStorageTy + 1,
      phase: 'idle',
      targetNodeIndex: -1,
      gatherProgress: 0,
      carry: 0,
      ...DEFAULT_EXTRA,
    };
    const dropoff = findNearestDropoff(harvester, state.map);
    const rawStorageCenterTx = rawStorageTx + 1;
    const rawStorageCenterTy = rawStorageTy + 1;
    expect(dropoff.tx).toBe(rawStorageCenterTx);
    expect(dropoff.ty).toBe(rawStorageCenterTy);
  });
});

// ── no Raw loss ───────────────────────────────────────────────────────

describe('no Raw loss in harvester delivery', () => {
  it('total raw in system (economy + carry) never decreases during delivery', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap - 3;
    const hq = state.map.hq;
    const adjTx = hq.tx - 1;
    const adjTy = hq.ty + 1;
    state.harvesters = [{
      tx: adjTx + 0.5,
      ty: adjTy + 0.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
      targetDropoffTx: adjTx + 0.5,
      targetDropoffTy: adjTy + 0.5,
      path: [],
      pathIndex: 0,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);

    const totalBefore = state.economy.resources.raw + state.harvesters[0]!.carry;
    tickHarvesting(state, 0.1);
    const totalAfter = state.economy.resources.raw + state.harvesters[0]!.carry;
    expect(totalAfter).toBe(totalBefore);
  });
});

// ── tickHarvesting — full cycle ─────────────────────────────────────

describe('tickHarvesting full delivery cycle', () => {
  it('completes a full idle→resource→gather→dropoff→deliver→idle cycle', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'infinite' },
    ]);
    const initialRaw = state.economy.resources.raw;

    // Run enough ticks to complete a full cycle
    for (let i = 0; i < 200; i++) {
      tickHarvesting(state, 0.1);
    }

    expect(state.economy.resources.raw).toBeGreaterThan(initialRaw);
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('completes multiple delivery cycles over time', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 9, ty: 9, type: 'infinite' },
    ]);
    const initialRaw = state.economy.resources.raw;

    // Run 30 seconds of simulation
    for (let i = 0; i < 300; i++) {
      tickHarvesting(state, 0.1);
    }

    const rawDelivered = state.economy.resources.raw - initialRaw;
    expect(rawDelivered).toBeGreaterThanOrEqual(HARVESTER_CARRY_AMOUNT * 2);
  });
});

// ── tickHarvesting — edge cases ─────────────────────────────────────

describe('tickHarvesting edge cases', () => {
  it('handles zero dt without errors', () => {
    const state = createTestState(7.5, 7.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    expect(() => tickHarvesting(state, 0)).not.toThrow();
  });

  it('handles empty harvesters array', () => {
    const state = createState();
    state.harvesters = [];
    expect(() => tickHarvesting(state, 1)).not.toThrow();
  });

  it('handles empty resource nodes array with idle harvester', () => {
    const state = createState();
    state.resourceNodes = [];
    state.harvesters[0]!.phase = 'idle';
    tickHarvesting(state, 1);
    expect(state.harvesters[0]!.phase).toBe('idle');
  });
});

// ── PATHFINDING INTEGRATION TESTS ───────────────────────────────────

describe('harvester pathfinding: resource targeting', () => {
  it('harvester paths to adjacent tile of 1x1 resource', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 10, ty: 10, type: 'small', footprint: 1 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 10.5;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    // Path should lead to a tile adjacent to (10,10), not to (10,10) itself
    const path = state.harvesters[0]!.path;
    expect(path.length).toBeGreaterThan(0);
    // Last waypoint should be adjacent to resource tile
    const last = path[path.length - 1]!;
    const manhattan = Math.abs(last.tx - 10) + Math.abs(last.ty - 10);
    expect(manhattan).toBe(1);
  });

  it('harvester paths to adjacent tile of 3x3 infinite resource', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 10.5;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    const path = state.harvesters[0]!.path;
    expect(path.length).toBeGreaterThan(0);
    const last = path[path.length - 1]!;
    // Last waypoint should be adjacent to the 3x3 footprint (10,10)-(12,12)
    const isAdjacent =
      (last.ty === 9 && last.tx >= 10 && last.tx <= 12) ||  // top edge
      (last.ty === 13 && last.tx >= 10 && last.tx <= 12) ||  // bottom edge
      (last.tx === 13 && last.ty >= 10 && last.ty <= 12) ||  // right edge
      (last.tx === 9 && last.ty >= 10 && last.ty <= 12);     // left edge
    expect(isAdjacent).toBe(true);
  });

  it('harvester does not enter resource footprint', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 10.5;
    tickHarvesting(state, 0.1);
    const path = state.harvesters[0]!.path;
    // No waypoint should be inside the resource footprint
    for (const wp of path) {
      const inFootprint = wp.tx >= 10 && wp.tx <= 12 && wp.ty >= 10 && wp.ty <= 12;
      expect(inFootprint).toBe(false);
    }
  });

  it('harvester routes around obstacle to reach resource', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 12, ty: 10, type: 'small', footprint: 1 }],
      obstacles: [{ tx: 10, ty: 10, type: 'mountain-small', footprint: 1 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 10.5;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    const path = state.harvesters[0]!.path;
    // Path must avoid the obstacle at (10,10)
    expect(path.some((p) => p.tx === 10 && p.ty === 10)).toBe(false);
  });

  it('harvester skips unreachable resource and chooses reachable one', () => {
    // Create a map with two resources: one enclosed by walls, one open
    const state = createTestStateFromMap({
      resources: [
        { tx: 2, ty: 2, type: 'small', footprint: 1 },     // enclosed
        { tx: 15, ty: 15, type: 'medium', footprint: 1 },   // open
      ],
      obstacles: [
        { tx: 1, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 2, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 1, ty: 2, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 2, type: 'rock-cluster', footprint: 1 },
        { tx: 1, ty: 3, type: 'rock-cluster', footprint: 1 },
        { tx: 2, ty: 3, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 3, type: 'rock-cluster', footprint: 1 },
      ],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 7.5;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    // Should choose the reachable resource (index 1), not the enclosed one (index 0)
    expect(state.harvesters[0]!.targetNodeIndex).toBe(1);
  });

  it('harvester goes idle if no reachable resource exists', () => {
    // Enclose the only resource with walls
    const state = createTestStateFromMap({
      resources: [{ tx: 2, ty: 2, type: 'small', footprint: 1 }],
      obstacles: [
        { tx: 1, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 2, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 1, type: 'rock-cluster', footprint: 1 },
        { tx: 1, ty: 2, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 2, type: 'rock-cluster', footprint: 1 },
        { tx: 1, ty: 3, type: 'rock-cluster', footprint: 1 },
        { tx: 2, ty: 3, type: 'rock-cluster', footprint: 1 },
        { tx: 3, ty: 3, type: 'rock-cluster', footprint: 1 },
      ],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 7.5;
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('idle');
  });
});

describe('harvester pathfinding: dropoff targeting', () => {
  it('harvester paths to adjacent tile of HQ for dropoff', () => {
    const state = createTestStateFromMap();
    const grid = buildPassabilityGrid(state.map);
    const result = findPathToAdjacent(grid, 15, 15, state.map.hq.tx, state.map.hq.ty, HQ_FOOTPRINT);
    expect(result.found).toBe(true);
    // Verify the path leads to an adjacent tile
    const last = result.path[result.path.length - 1]!;
    const isAdjacentToHq =
      (last.ty === state.map.hq.ty - 1) ||
      (last.ty === state.map.hq.ty + HQ_FOOTPRINT) ||
      (last.tx === state.map.hq.tx - 1) ||
      (last.tx === state.map.hq.tx + HQ_FOOTPRINT);
    expect(isAdjacentToHq).toBe(true);
  });

  it('harvester paths to adjacent tile of raw-storage for dropoff', () => {
    const state = createTestStateFromMap({
      buildings: [{ tx: 12, ty: 12, type: 'raw-storage' }],
    });
    const grid = buildPassabilityGrid(state.map);
    const result = findPathToAdjacent(grid, 7, 7, 12, 12, 2);
    expect(result.found).toBe(true);
    // Last waypoint should be adjacent to the 2x2 raw-storage
    const last = result.path[result.path.length - 1]!;
    const isAdjacent =
      (last.ty === 11 && last.tx >= 12 && last.tx <= 13) ||  // top edge
      (last.ty === 14 && last.tx >= 12 && last.tx <= 13) ||  // bottom edge
      (last.tx === 14 && last.ty >= 12 && last.ty <= 13) ||  // right edge
      (last.tx === 11 && last.ty >= 12 && last.ty <= 13);    // left edge
    expect(isAdjacent).toBe(true);
  });

  it('harvester does not enter HQ/building footprint', () => {
    const state = createTestStateFromMap();
    const grid = buildPassabilityGrid(state.map);
    const result = findPathToAdjacent(grid, 7, 7, state.map.hq.tx, state.map.hq.ty, HQ_FOOTPRINT);
    expect(result.found).toBe(true);
    // No waypoint should be inside HQ footprint
    for (const wp of result.path) {
      const inHq = wp.tx >= state.map.hq.tx && wp.tx < state.map.hq.tx + HQ_FOOTPRINT &&
                    wp.ty >= state.map.hq.ty && wp.ty < state.map.hq.ty + HQ_FOOTPRINT;
      expect(inHq).toBe(false);
    }
  });
});

describe('harvester pathfinding: full cycle with pathfinding', () => {
  it('completes idle→moving-to-resource→gathering→moving-to-dropoff→delivering→idle', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 7.5;
    const initialRaw = state.economy.resources.raw;

    // Run enough ticks
    for (let i = 0; i < 400; i++) {
      tickHarvesting(state, 0.1);
    }

    expect(state.economy.resources.raw).toBeGreaterThan(initialRaw);
  });

  it('waiting-full-storage behavior still works with pathfinding', () => {
    const state = createTestStateFromMap({
      resources: [{ tx: 10, ty: 10, type: 'infinite', footprint: 3 }],
    });
    state.harvesters[0]!.tx = 7.5;
    state.harvesters[0]!.ty = 7.5;
    // Fill raw cap
    state.economy.resources.raw = state.economy.resources.rawCap;

    // Run enough ticks to gather and try to deliver
    for (let i = 0; i < 400; i++) {
      tickHarvesting(state, 0.1);
      // If harvester reaches waiting-full-storage, verify carry is preserved
      if (state.harvesters[0]!.phase === 'waiting-full-storage') {
        expect(state.harvesters[0]!.carry).toBeGreaterThan(0);
        break;
      }
    }
  });
});
