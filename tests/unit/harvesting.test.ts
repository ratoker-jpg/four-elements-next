import { describe, it, expect } from 'vitest';
import {
  tickHarvesting,
  createInitialHarvesters,
  createResourceNodeStates,
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
import type { ResourceType } from '../../src/game/map-types.js';

/** Create a minimal GameState for testing. Wraps createGameState for convenience. */
function createState(): GameState {
  return createGameState('standard', 'cyan');
}

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

// ── createInitialHarvesters ──────────────────────────────────────────

describe('createInitialHarvesters', () => {
  it('creates at least one harvester', () => {
    const state = createState();
    expect(state.harvesters.length).toBeGreaterThanOrEqual(1);
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
    const state = createTestState(5.5, 5.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(0);
  });

  it('keeps harvester idle when no resource nodes exist', () => {
    const state = createTestState(5.5, 5.5, 'idle', []);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('idle');
  });

  it('skips depleted resource nodes', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 0 },
      { tx: 15, ty: 15, type: 'medium' },
    ]);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-resource');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(1);
  });
});

// ── tickHarvesting — moving-to-resource ─────────────────────────────

describe('tickHarvesting moving-to-resource phase', () => {
  it('moves harvester toward target resource node', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    const txBefore = state.harvesters[0]!.tx;
    tickHarvesting(state, 0.5);
    // Harvester should have moved toward node at (10.5, 10.5)
    const distBefore = Math.hypot(10.5 - txBefore, 10.5 - state.harvesters[0]!.ty);
    const distAfter = Math.hypot(10.5 - state.harvesters[0]!.tx, 10.5 - state.harvesters[0]!.ty);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('transitions to gathering when harvester arrives at node', () => {
    // Place harvester very close to node
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // should arrive → gathering
    expect(state.harvesters[0]!.phase).toBe('gathering');
  });

  it('goes idle if target node depleted while moving', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
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
  it('increases gatherProgress over time', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    expect(state.harvesters[0]!.phase).toBe('gathering');
    tickHarvesting(state, 1.0);
    expect(state.harvesters[0]!.gatherProgress).toBeGreaterThan(0);
  });

  it('transitions to moving-to-hq when gathering complete', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    // Complete gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.harvesters[0]!.phase).toBe('moving-to-hq');
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
  });

  it('decrements finite node remaining on extraction', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.resourceNodes[0]!.remaining).toBe(100 - HARVESTER_CARRY_AMOUNT);
  });

  it('does not decrement infinite node remaining', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'infinite' },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.resourceNodes[0]!.remaining).toBe(Infinity);
    expect(state.harvesters[0]!.carry).toBe(HARVESTER_CARRY_AMOUNT);
  });

  it('goes idle if node depleted while gathering', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 5 },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    // Deplete node during gathering
    state.resourceNodes[0]!.remaining = 0;
    tickHarvesting(state, 1.0);
    expect(state.harvesters[0]!.phase).toBe('idle');
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('extracts less than HARVESTER_CARRY_AMOUNT if node has less remaining', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 3 },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.harvesters[0]!.carry).toBe(3);
    expect(state.resourceNodes[0]!.remaining).toBe(0);
  });

  it('extracts exact remaining when node has less than carry amount', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small', remaining: 7 },
    ]);
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1);
    expect(state.harvesters[0]!.carry).toBe(7);
    expect(state.resourceNodes[0]!.remaining).toBe(0);
  });
});

// ── tickHarvesting — moving-to-hq ───────────────────────────────────

describe('tickHarvesting moving-to-hq phase', () => {
  it('moves harvester toward HQ center', () => {
    const state = createTestState(10.45, 10.45, 'idle', [
      { tx: 10, ty: 10, type: 'small' },
    ]);
    // Complete gathering to reach moving-to-hq
    tickHarvesting(state, 0.1); // idle → moving-to-resource
    tickHarvesting(state, 0.1); // arrive → gathering
    tickHarvesting(state, HARVESTER_GATHER_TIME + 0.1); // gathering → moving-to-hq
    expect(state.harvesters[0]!.phase).toBe('moving-to-hq');

    const hqCenterTx = state.map.hq.tx + 1.5;
    const hqCenterTy = state.map.hq.ty + 1.5;
    const distBefore = Math.hypot(hqCenterTx - state.harvesters[0]!.tx, hqCenterTy - state.harvesters[0]!.ty);
    tickHarvesting(state, 1.0);
    const distAfter = Math.hypot(hqCenterTx - state.harvesters[0]!.tx, hqCenterTy - state.harvesters[0]!.ty);
    expect(distAfter).toBeLessThan(distBefore);
  });

  it('transitions to delivering when harvester arrives at HQ', () => {
    // Place harvester near HQ center
    const state = createState();
    const hqCx = state.map.hq.tx + 1.5;
    const hqCy = state.map.hq.ty + 1.5;
    state.harvesters = [{
      tx: hqCx + 0.05,
      ty: hqCy + 0.05,
      phase: 'moving-to-hq',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.phase).toBe('delivering');
  });
});

// ── tickHarvesting — delivering ─────────────────────────────────────

describe('tickHarvesting delivering phase', () => {
  it('adds carry to economy.resources.raw', () => {
    const state = createState();
    const initialRaw = state.economy.resources.raw;
    state.harvesters = [{
      tx: state.map.hq.tx + 1.5,
      ty: state.map.hq.ty + 1.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(initialRaw + HARVESTER_CARRY_AMOUNT);
  });

  it('clamps raw to rawCap', () => {
    const state = createState();
    state.economy.resources.raw = state.economy.resources.rawCap - 3;
    state.harvesters = [{
      tx: state.map.hq.tx + 1.5,
      ty: state.map.hq.ty + 1.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.economy.resources.raw).toBe(state.economy.resources.rawCap);
  });

  it('resets carry and transitions to idle', () => {
    const state = createState();
    state.harvesters = [{
      tx: state.map.hq.tx + 1.5,
      ty: state.map.hq.ty + 1.5,
      phase: 'delivering',
      targetNodeIndex: 0,
      gatherProgress: 0,
      carry: HARVESTER_CARRY_AMOUNT,
    }];
    state.resourceNodes = createResourceNodeStates(state.map.resources);
    tickHarvesting(state, 0.1);
    expect(state.harvesters[0]!.carry).toBe(0);
    expect(state.harvesters[0]!.phase).toBe('idle');
    expect(state.harvesters[0]!.targetNodeIndex).toBe(-1);
  });
});

// ── tickHarvesting — full cycle ─────────────────────────────────────

describe('tickHarvesting full delivery cycle', () => {
  it('completes a full idle→resource→gather→hq→deliver→idle cycle', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
      { tx: 7, ty: 7, type: 'infinite' },
    ]);
    const initialRaw = state.economy.resources.raw;

    // Run enough ticks to complete a full cycle
    // Distance from (5.5,5.5) to (7.5,7.5) = ~2.83 tiles
    // At 2.5 tiles/s, that's ~1.13s each way
    // Plus 3s gathering + 0.1s delivering
    // Total ≈ 1.13 + 3 + 1.13 + 0.1 ≈ 5.36s
    for (let i = 0; i < 60; i++) {
      tickHarvesting(state, 0.1);
    }

    // Harvester should have delivered at least once
    expect(state.economy.resources.raw).toBeGreaterThan(initialRaw);
    expect(state.harvesters[0]!.carry).toBe(0);
  });

  it('completes multiple delivery cycles over time', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
      { tx: 6, ty: 6, type: 'infinite' },
    ]);
    const initialRaw = state.economy.resources.raw;

    // Run 30 seconds of simulation
    for (let i = 0; i < 300; i++) {
      tickHarvesting(state, 0.1);
    }

    // Should have multiple deliveries
    const rawDelivered = state.economy.resources.raw - initialRaw;
    expect(rawDelivered).toBeGreaterThanOrEqual(HARVESTER_CARRY_AMOUNT * 2);
  });
});

// ── tickHarvesting — edge cases ─────────────────────────────────────

describe('tickHarvesting edge cases', () => {
  it('handles zero dt without errors', () => {
    const state = createTestState(5.5, 5.5, 'idle', [
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
