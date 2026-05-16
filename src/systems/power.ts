/** Power system: building power supply, demand, and online/offline state. Pure logic, no DOM. */

import type { BuildingType } from '../game/map-types.js';

// ── Building power definitions ───────────────────────────────────────

/** Power produced (>0) or consumed (<0) by each building type. HQ is always online. */
export const BUILDING_POWER: Record<BuildingType | 'hq', number> = {
  hq: 0,
  separator: -1,
  storage: 0,
  'power-plant': 4,
  'command-relay': -1,
};

/** Power priority for shutdown order. Lower = shed first. HQ and producers are immune. */
export const POWER_PRIORITY: Record<BuildingType | 'hq', number> = {
  hq: 100,          // always online (immune)
  'power-plant': 99, // always online (immune)
  'command-relay': 70, // high — Control is important
  separator: 50,    // medium
  storage: 30,      // passive — lowest
};

// ── State types ──────────────────────────────────────────────────────

/** Runtime state for a single building in the power grid. */
export interface BuildingPowerState {
  tx: number;
  ty: number;
  type: BuildingType | 'hq';
  /** Whether this building is currently online (receiving power). */
  online: boolean;
}

/** Full power system state. */
export interface PowerState {
  buildings: BuildingPowerState[];
  totalSupply: number;
  totalDemand: number;
  /** Net power = supply - demand of online buildings. Negative = deficit. */
  netPower: number;
}

/** Read-only view for rendering/HUD. */
export type ReadonlyPowerState = Readonly<PowerState>;

// ── Factory ──────────────────────────────────────────────────────────

/** Create initial PowerState from map buildings and HQ. */
export function createPowerState(
  hq: { readonly tx: number; readonly ty: number },
  buildings: ReadonlyArray<{ readonly tx: number; readonly ty: number; readonly type: BuildingType }>,
): PowerState {
  const allBuildings: BuildingPowerState[] = [
    { tx: hq.tx, ty: hq.ty, type: 'hq', online: true },
    ...buildings.map((b) => ({ tx: b.tx, ty: b.ty, type: b.type, online: true })),
  ];

  const state: PowerState = {
    buildings: allBuildings,
    totalSupply: 0,
    totalDemand: 0,
    netPower: 0,
  };

  recalculate(state);
  return state;
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Recalculate power grid: compute supply, demand, and online/offline status.
 *
 * Death spiral prevention:
 * - HQ is always online.
 * - Power producers (supply > 0) are always online.
 * - Other buildings are sorted by priority; lowest priority sheds first.
 * - A building goes offline only if net power after including it would be negative.
 */
export function tickPower(state: PowerState): void {
  recalculate(state);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Check if a specific building position is online. */
export function isBuildingOnline(state: ReadonlyPowerState, tx: number, ty: number): boolean {
  return state.buildings.find((b) => b.tx === tx && b.ty === ty)?.online ?? false;
}

/** Get the power value for a building type. Positive = supply, negative = demand. */
export function getBuildingPower(type: BuildingType | 'hq'): number {
  return BUILDING_POWER[type];
}

export function addBuildingToPowerState(
  state: PowerState,
  building: { tx: number; ty: number; type: BuildingType },
): void {
  state.buildings.push({
    tx: building.tx,
    ty: building.ty,
    type: building.type,
    online: true,
  });
  recalculate(state);
}

// ── Internal ─────────────────────────────────────────────────────────

function recalculate(state: PowerState): void {
  let supply = 0;
  let demand = 0;

  // Phase 1: HQ and power producers are always online
  for (const b of state.buildings) {
    const power = BUILDING_POWER[b.type];
    if (b.type === 'hq' || power > 0) {
      b.online = true;
      if (power > 0) supply += power;
      // HQ has 0 power value — neither supply nor demand
    }
  }

  // Phase 2: Sort non-immune buildings by priority (ascending = shed first)
  const nonImmune = state.buildings.filter(
    (b) => b.type !== 'hq' && BUILDING_POWER[b.type] <= 0,
  );
  // Sort descending by priority — highest priority stays online longest
  nonImmune.sort((a, b) => POWER_PRIORITY[b.type] - POWER_PRIORITY[a.type]);

  // Phase 3: Grant power in priority order
  let runningDemand = 0;
  for (const b of nonImmune) {
    const power = BUILDING_POWER[b.type]; // negative or zero
    if (power < 0) {
      // Can we afford to keep this building online?
      if (supply + runningDemand + power >= 0) {
        // Yes — enough headroom
        b.online = true;
        runningDemand += power; // power is negative, so this reduces headroom
      } else {
        // No — shed this building
        b.online = false;
      }
    } else {
      // Zero demand (e.g. storage) — always online if there's any supply
      b.online = true;
    }
  }

  // Phase 4: Calculate totals from online buildings
  for (const b of state.buildings) {
    if (!b.online) continue;
    const power = BUILDING_POWER[b.type];
    if (power > 0) {
      // Already counted in supply above
    } else if (power < 0) {
      demand += Math.abs(power);
    }
  }

  state.totalSupply = supply;
  state.totalDemand = demand;
  state.netPower = supply - demand;
}
