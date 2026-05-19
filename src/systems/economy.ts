/** Economy system: resources, caps, separator conversion. Pure logic, no DOM. */

import type { BuildingPlacement, BuildingType, FactionId } from '../game/map-types.js';

/** Element stock by faction. Enables future trophies/trade without changing the economy shape. */
export type FactionElements = Record<FactionId, number>;

/** Resource pool tracked by the economy. */
export interface ResourcePool {
  raw: number;
  matter: number;
  /** Elements are stored separately for all factions. The active player's faction is shown in HUD. */
  elements: FactionElements;
  rawCap: number;
  matterCap: number;
  /** Shared per-faction cap. Each faction element uses the same current cap. */
  elementCap: number;
}

/** Runtime state for a single Separator building. */
export interface SeparatorState {
  tx: number;
  ty: number;
  /** Cycle progress 0..1. Stays at current value when idle (paused, not reset). */
  progress: number;
  /** Whether the separator is actively converting this frame. */
  active: boolean;
}

/** Full economy state: resources + all separator instances. */
export interface EconomyState {
  /** Player faction. Separator produces this faction's element. */
  faction: FactionId;
  resources: ResourcePool;
  separators: SeparatorState[];
}

// ── Constants ────────────────────────────────────────────────────────

/** Number of internal elementUnits per displayed element.
 *  10 elementUnits = 1 displayed element.
 *  All element amounts and caps are stored internally as elementUnits
 *  to avoid floating-point drift.
 */
export const ELEMENT_UNITS_PER_ELEMENT = 10;

/** HQ base capacity (no Storage buildings). Values in elementUnits for element fields. */
export const HQ_RAW_CAP = 200;
export const HQ_MATTER_CAP = 200;
/** HQ element cap: 200 elementUnits = 20 displayed elements. */
export const HQ_ELEMENT_CAP = 200;

/** Capacity bonus per Raw Storage building. */
export const RAW_STORAGE_RAW_BONUS = 200;

/** Capacity bonus per Matter Storage building. Element bonus in elementUnits. */
export const MATTER_STORAGE_MATTER_BONUS = 200;
/** Matter-storage element cap bonus: 200 elementUnits = +20 displayed elements. */
export const MATTER_STORAGE_ELEMENT_BONUS = 200;

/** Starting resources. START_ELEMENT is in elementUnits: 30 units = 3.0 displayed elements. */
export const START_RAW = 0;
export const START_MATTER = 100;
export const START_ELEMENT = 30;

/** Separator conversion: 15 Raw → 10 Matter + 1 elementUnit (= 0.1 displayed element) per cycle. */
export const SEP_RAW_COST = 15;
export const SEP_MATTER_YIELD = 10;
/** Separator element yield: 1 elementUnit per cycle = 0.1 displayed element.
 *  10 cycles produce 10 elementUnits = 1.0 displayed element. */
export const SEP_ELEMENT_YIELD = 1;
export const SEP_CYCLE_SECONDS = 6;

export const FACTION_IDS: readonly FactionId[] = ['cyan', 'green', 'yellow', 'purple'];

// ── Factory ──────────────────────────────────────────────────────────

function createStartingElements(faction: FactionId, elementCap: number): FactionElements {
  return {
    cyan: faction === 'cyan' ? Math.min(START_ELEMENT, elementCap) : 0,
    green: faction === 'green' ? Math.min(START_ELEMENT, elementCap) : 0,
    yellow: faction === 'yellow' ? Math.min(START_ELEMENT, elementCap) : 0,
    purple: faction === 'purple' ? Math.min(START_ELEMENT, elementCap) : 0,
  };
}

/** Create initial EconomyState from building placements. */
export function createEconomyState(
  separatorPositions: ReadonlyArray<{ readonly tx: number; readonly ty: number }>,
  rawStorageCount: number,
  matterStorageCount: number,
  faction: FactionId,
): EconomyState {
  const rawCap = HQ_RAW_CAP + rawStorageCount * RAW_STORAGE_RAW_BONUS;
  const matterCap = HQ_MATTER_CAP + matterStorageCount * MATTER_STORAGE_MATTER_BONUS;
  const elementCap = HQ_ELEMENT_CAP + matterStorageCount * MATTER_STORAGE_ELEMENT_BONUS;

  return {
    faction,
    resources: {
      raw: START_RAW,
      matter: Math.min(START_MATTER, matterCap),
      elements: createStartingElements(faction, elementCap),
      rawCap,
      matterCap,
      elementCap,
    },
    separators: separatorPositions.map((s) => ({
      tx: s.tx,
      ty: s.ty,
      progress: 0,
      active: false,
    })),
  };
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Advance the economy by `dt` seconds.
 *
 * @param separatorOnlineMap - Map of "tx,ty" → boolean for separator power status.
 *   Only online separators can convert. Offline separators pause progress.
 */
export function tickEconomy(state: EconomyState, dt: number, separatorOnlineMap?: ReadonlyMap<string, boolean>): void {
  const r = state.resources;
  const faction = state.faction;
  for (const sep of state.separators) {
    // Check power status — offline separators cannot convert
    const isOnline = separatorOnlineMap?.get(`${sep.tx},${sep.ty}`) ?? true;
    const canConvert =
      isOnline &&
      r.raw >= SEP_RAW_COST &&
      r.matter + SEP_MATTER_YIELD <= r.matterCap &&
      r.elements[faction] + SEP_ELEMENT_YIELD <= r.elementCap;

    if (canConvert) {
      sep.active = true;
      sep.progress += dt / SEP_CYCLE_SECONDS;
      if (sep.progress >= 1) {
        // Re-check at completion time because previous separators may have consumed resources.
        const canComplete =
          r.raw >= SEP_RAW_COST &&
          r.matter + SEP_MATTER_YIELD <= r.matterCap &&
          r.elements[faction] + SEP_ELEMENT_YIELD <= r.elementCap;
        if (canComplete) {
          r.raw -= SEP_RAW_COST;
          r.matter += SEP_MATTER_YIELD;
          r.elements[faction] += SEP_ELEMENT_YIELD;
          sep.progress -= 1; // preserve overshoot for consistency
        } else {
          sep.active = false;
        }
      }
    } else {
      sep.active = false;
      // progress stays (paused), does not reset
    }
  }
}

/** Read a specific faction element amount. */
export function getFactionElement(state: ReadonlyEconomyState, faction: FactionId): number {
  return state.resources.elements[faction];
}

export function applyCompletedBuildingToEconomy(
  state: EconomyState,
  building: Pick<BuildingPlacement, 'tx' | 'ty' | 'type'>,
): void {
  if (building.type === 'separator') {
    state.separators.push({
      tx: building.tx,
      ty: building.ty,
      progress: 0,
      active: false,
    });
    return;
  }

  if (building.type === 'raw-storage') {
    state.resources.rawCap += RAW_STORAGE_RAW_BONUS;
    state.resources.raw = Math.min(state.resources.raw, state.resources.rawCap);
  }

  if (building.type === 'matter-storage') {
    state.resources.matterCap += MATTER_STORAGE_MATTER_BONUS;
    state.resources.elementCap += MATTER_STORAGE_ELEMENT_BONUS;
    state.resources.matter = Math.min(state.resources.matter, state.resources.matterCap);
    for (const faction of FACTION_IDS) {
      state.resources.elements[faction] = Math.min(
        state.resources.elements[faction],
        state.resources.elementCap,
      );
    }
  }
}

export function getRawStorageCount(buildings: ReadonlyArray<Pick<BuildingPlacement, 'type'>>): number {
  return buildings.filter((building) => building.type === 'raw-storage').length;
}

export function getMatterStorageCount(buildings: ReadonlyArray<Pick<BuildingPlacement, 'type'>>): number {
  return buildings.filter((building) => building.type === 'matter-storage').length;
}

export function getSeparatorPositions(
  buildings: ReadonlyArray<Pick<BuildingPlacement, 'tx' | 'ty' | 'type'>>,
): Array<{ tx: number; ty: number }> {
  return buildings
    .filter((building): building is { tx: number; ty: number; type: BuildingType } => building.type === 'separator')
    .map((building) => ({ tx: building.tx, ty: building.ty }));
}

// ── Element display helpers ───────────────────────────────────────────

/** Convert internal elementUnits to displayed element value.
 *  Example: 31 elementUnits → 3.1 */
export function toDisplayElements(elementUnits: number): number {
  return elementUnits / ELEMENT_UNITS_PER_ELEMENT;
}

/** Format elementUnits as a displayed element string with 1 decimal place.
 *  Example: 31 → "3.1", 30 → "3.0", 200 → "20.0" */
export function formatDisplayElements(elementUnits: number): string {
  return (elementUnits / ELEMENT_UNITS_PER_ELEMENT).toFixed(1);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Type-safe read-only view of EconomyState for UI/rendering. */
export type ReadonlyEconomyState = Readonly<EconomyState>;
