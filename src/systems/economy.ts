/** Economy system: resources, caps, separator conversion. Pure logic, no DOM. */

/** Resource pool tracked by the economy. */
export interface ResourcePool {
  raw: number;
  matter: number;
  element: number;
  rawCap: number;
  matterCap: number;
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
  resources: ResourcePool;
  separators: SeparatorState[];
}

// ── Constants ────────────────────────────────────────────────────────

/** HQ base capacity (no Storage buildings). */
export const HQ_RAW_CAP = 200;
export const HQ_MATTER_CAP = 200;
export const HQ_ELEMENT_CAP = 10;

/** Capacity bonus per Storage building. */
export const STORAGE_RAW_BONUS = 200;
export const STORAGE_MATTER_BONUS = 200;
export const STORAGE_ELEMENT_BONUS = 10;

/** Starting resources. */
export const START_RAW = 0;
export const START_MATTER = 100;
export const START_ELEMENT = 3;

/** Separator conversion: 15 Raw → 10 Matter + 1 Element per cycle. */
export const SEP_RAW_COST = 15;
export const SEP_MATTER_YIELD = 10;
export const SEP_ELEMENT_YIELD = 1;
export const SEP_CYCLE_SECONDS = 6;

// ── Factory ──────────────────────────────────────────────────────────

/** Create initial EconomyState from building placements. */
export function createEconomyState(
  separatorPositions: ReadonlyArray<{ readonly tx: number; readonly ty: number }>,
  storageCount: number,
): EconomyState {
  const rawCap = HQ_RAW_CAP + storageCount * STORAGE_RAW_BONUS;
  const matterCap = HQ_MATTER_CAP + storageCount * STORAGE_MATTER_BONUS;
  const elementCap = HQ_ELEMENT_CAP + storageCount * STORAGE_ELEMENT_BONUS;

  return {
    resources: {
      raw: START_RAW,
      matter: Math.min(START_MATTER, matterCap),
      element: Math.min(START_ELEMENT, elementCap),
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
 * For each separator:
 * - If there is enough Raw and both output caps have room → active, progress accumulates.
 * - When progress >= 1 → consume Raw, add Matter + Element (clamped to caps), reset progress.
 * - If preconditions fail → idle (progress pauses, does not reset).
 */
export function tickEconomy(state: EconomyState, dt: number): void {
  const r = state.resources;
  for (const sep of state.separators) {
    const canConvert =
      r.raw >= SEP_RAW_COST &&
      r.matter + SEP_MATTER_YIELD <= r.matterCap &&
      r.element + SEP_ELEMENT_YIELD <= r.elementCap;

    if (canConvert) {
      sep.active = true;
      sep.progress += dt / SEP_CYCLE_SECONDS;
      if (sep.progress >= 1) {
        // Execute conversion
        r.raw -= SEP_RAW_COST;
        r.matter += SEP_MATTER_YIELD;
        r.element += SEP_ELEMENT_YIELD;
        sep.progress -= 1; // preserve overshoot for consistency
      }
    } else {
      sep.active = false;
      // progress stays (paused), does not reset
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Type-safe read-only view of EconomyState for UI/rendering. */
export type ReadonlyEconomyState = Readonly<EconomyState>;
