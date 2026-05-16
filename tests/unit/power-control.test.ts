import { describe, it, expect } from 'vitest';
import {
  createPowerState,
  tickPower,
  isBuildingOnline,
  BUILDING_POWER,
  POWER_PRIORITY,
  type PowerState,
} from '../../src/systems/power.js';
import {
  createControlState,
  tickControl,
  HQ_CONTROL,
  RELAY_CONTROL,
  CONTROL_CAP_MVP,
  availableControl,
} from '../../src/systems/control.js';

// ── Power system ─────────────────────────────────────────────────────

describe('power constants', () => {
  it('building power values are correct', () => {
    expect(BUILDING_POWER.hq).toBe(0);
    expect(BUILDING_POWER.separator).toBe(-1);
    expect(BUILDING_POWER.storage).toBe(0);
    expect(BUILDING_POWER['power-plant']).toBe(4);
    expect(BUILDING_POWER['command-relay']).toBe(-1);
  });

  it('power priorities are correct', () => {
    expect(POWER_PRIORITY.hq).toBe(100);
    expect(POWER_PRIORITY['power-plant']).toBe(99);
    expect(POWER_PRIORITY['command-relay']).toBe(70);
    expect(POWER_PRIORITY.separator).toBe(50);
    expect(POWER_PRIORITY.storage).toBe(30);
  });
});

describe('createPowerState', () => {
  it('creates state with HQ and buildings', () => {
    const state = createPowerState(
      { tx: 4, ty: 4 },
      [
        { tx: 7, ty: 4, type: 'separator' },
        { tx: 7, ty: 5, type: 'storage' },
        { tx: 5, ty: 7, type: 'power-plant' },
        { tx: 6, ty: 7, type: 'command-relay' },
      ],
    );
    expect(state.buildings).toHaveLength(5); // HQ + 4 buildings
    expect(state.totalSupply).toBe(4); // 1 power-plant × 4
    expect(state.totalDemand).toBe(2); // separator 1 + command-relay 1
    expect(state.netPower).toBe(2); // 4 - 2
  });

  it('HQ is always online', () => {
    const state = createPowerState({ tx: 4, ty: 4 }, []);
    const hq = state.buildings.find((b) => b.type === 'hq');
    expect(hq!.online).toBe(true);
  });

  it('all buildings online when supply >= demand', () => {
    const state = createPowerState(
      { tx: 4, ty: 4 },
      [
        { tx: 7, ty: 4, type: 'separator' },
        { tx: 5, ty: 7, type: 'power-plant' },
      ],
    );
    for (const b of state.buildings) {
      expect(b.online).toBe(true);
    }
  });
});

describe('tickPower — shedding', () => {
  it('sheds lowest priority first when power deficit', () => {
    // 1 Power Plant (supply=4), 4 Separators (demand=4) + 1 Command Relay (demand=1) = total demand 5 > supply 4
    const state = createPowerState(
      { tx: 4, ty: 4 },
      [
        { tx: 7, ty: 4, type: 'separator' },
        { tx: 8, ty: 4, type: 'separator' },
        { tx: 9, ty: 4, type: 'separator' },
        { tx: 10, ty: 4, type: 'separator' },
        { tx: 5, ty: 7, type: 'power-plant' },
        { tx: 6, ty: 7, type: 'command-relay' },
      ],
    );
    tickPower(state);

    // Supply: 4. Priority order online: power-plant (immune), command-relay (70), separators (50)
    // demand: relay=1, sep=1 each. Can afford relay+3 seps = 4 demand = 4 supply. 4th sep goes offline.
    expect(state.totalSupply).toBe(4);
    const onlineSeparators = state.buildings.filter((b) => b.type === 'separator' && b.online);
    const offlineSeparators = state.buildings.filter((b) => b.type === 'separator' && !b.online);
    expect(onlineSeparators.length + offlineSeparators.length).toBe(4);
    expect(offlineSeparators.length).toBeGreaterThanOrEqual(1);
  });

  it('never sheds HQ or power producers', () => {
    const state = createPowerState(
      { tx: 4, ty: 4 },
      [
        { tx: 7, ty: 4, type: 'separator' },
        { tx: 8, ty: 4, type: 'separator' },
        { tx: 9, ty: 4, type: 'separator' },
        { tx: 5, ty: 7, type: 'power-plant' },
      ],
    );
    tickPower(state);
    const hq = state.buildings.find((b) => b.type === 'hq')!;
    const pp = state.buildings.find((b) => b.type === 'power-plant')!;
    expect(hq.online).toBe(true);
    expect(pp.online).toBe(true);
  });
});

describe('isBuildingOnline', () => {
  it('returns online status for a building at given coords', () => {
    const state = createPowerState(
      { tx: 4, ty: 4 },
      [{ tx: 7, ty: 4, type: 'power-plant' }],
    );
    expect(isBuildingOnline(state, 7, 4)).toBe(true);
  });

  it('returns false for unknown coords', () => {
    const state = createPowerState({ tx: 4, ty: 4 }, []);
    expect(isBuildingOnline(state, 99, 99)).toBe(false);
  });
});

// ── Control system ───────────────────────────────────────────────────

describe('control constants', () => {
  it('HQ gives 10 Control', () => {
    expect(HQ_CONTROL).toBe(10);
  });

  it('Command Relay gives 5 Control', () => {
    expect(RELAY_CONTROL).toBe(5);
  });

  it('MVP cap is 50', () => {
    expect(CONTROL_CAP_MVP).toBe(50);
  });
});

describe('createControlState', () => {
  it('HQ only gives 10 control', () => {
    const state = createControlState(0, 0);
    expect(state.current).toBe(10);
    expect(state.cap).toBe(50);
    expect(state.used).toBe(0);
  });

  it('HQ + 1 online relay gives 15 control', () => {
    const state = createControlState(1, 1);
    expect(state.current).toBe(15);
  });

  it('HQ + 2 online relays gives 20 control', () => {
    const state = createControlState(2, 2);
    expect(state.current).toBe(20);
  });

  it('offline relay does not contribute', () => {
    const state = createControlState(1, 0);
    expect(state.current).toBe(10);
  });

  it('control is capped at MVP max', () => {
    // 8 relays would give 10 + 40 = 50, exactly at cap
    const state = createControlState(8, 8);
    expect(state.current).toBe(50);
  });

  it('control cannot exceed cap even with more relays', () => {
    const state = createControlState(10, 10);
    expect(state.current).toBe(50); // 10 + 50 = 60 but capped at 50
  });
});

describe('tickControl', () => {
  it('updates control when relays go online/offline', () => {
    const state = createControlState(2, 2);
    expect(state.current).toBe(20);

    // One relay goes offline
    tickControl(state, 1);
    expect(state.current).toBe(15);

    // Both back online
    tickControl(state, 2);
    expect(state.current).toBe(20);
  });
});

describe('availableControl', () => {
  it('returns remaining slots', () => {
    const state = createControlState(1, 1);
    expect(availableControl(state)).toBe(15); // 15 - 0 used
  });

  it('returns 0 when used equals current', () => {
    const state = createControlState(0, 0);
    state.used = state.current;
    expect(availableControl(state)).toBe(0);
  });
});

// ── Integration: Power + Control ─────────────────────────────────────

describe('power + control integration', () => {
  it('control decreases when Command Relay loses power', () => {
    // Start with: 1 PP (supply=4), 1 CMD (demand=1), 3 SEP (demand=3)
    // net = 0, all online. Control = 10 + 5 = 15
    const power = createPowerState(
      { tx: 4, ty: 4 },
      [
        { tx: 5, ty: 7, type: 'power-plant' },
        { tx: 6, ty: 7, type: 'command-relay' },
        { tx: 7, ty: 4, type: 'separator' },
        { tx: 8, ty: 4, type: 'separator' },
        { tx: 9, ty: 4, type: 'separator' },
      ],
    );
    const relayCount = power.buildings.filter((b) => b.type === 'command-relay').length;
    const relayOnline = power.buildings.filter((b) => b.type === 'command-relay' && b.online).length;
    const control = createControlState(relayCount, relayOnline);
    expect(control.current).toBe(15); // HQ + 1 relay

    // Add another separator to overload: demand exceeds supply
    power.buildings.push({ tx: 10, ty: 4, type: 'separator', online: true });
    tickPower(power);
    // Now supply=4, demand: relay(1) + 4 seps(4) = 5 > 4
    // Separator (priority 50) should shed before Command Relay (priority 70)
    const relayAfter = power.buildings.find((b) => b.type === 'command-relay')!;
    expect(relayAfter.online).toBe(true); // relay has higher priority than separators

    // But if we add MORE demand that can't be covered even after shedding all separators:
    // Let's remove the power plant and add lots of demand
    power.buildings = power.buildings.filter((b) => b.type !== 'power-plant');
    // Add another command relay
    power.buildings.push({ tx: 11, ty: 7, type: 'command-relay', online: true });
    tickPower(power);
    // No power plant = 0 supply. Everything except HQ goes offline.
    const relayOnlineAfter = power.buildings.filter((b) => b.type === 'command-relay' && b.online).length;
    expect(relayOnlineAfter).toBe(0);

    tickControl(control, relayOnlineAfter);
    expect(control.current).toBe(10); // only HQ contribution
  });
});
