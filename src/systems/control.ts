/** Control system: unit capacity from HQ and Command Relays. Pure logic, no DOM. */


// ── Constants ────────────────────────────────────────────────────────

/** Control provided by HQ. */
export const HQ_CONTROL = 10;

/** Control provided by each Command Relay (consumes 1 Power). */
export const RELAY_CONTROL = 5;

/** MVP maximum Control cap. */
export const CONTROL_CAP_MVP = 50;

// ── State types ──────────────────────────────────────────────────────

export interface ControlState {
  /** Current Control capacity (from online HQ + online Command Relays). */
  current: number;
  /** Hard cap on Control. */
  cap: number;
  /** Number of currently used control slots (0 in NEXT-04 — no units yet). */
  used: number;
}

/** Read-only view for rendering/HUD. */
export type ReadonlyControlState = Readonly<ControlState>;

// ── Factory ──────────────────────────────────────────────────────────

/** Create initial ControlState from building counts and power online status. */
export function createControlState(
  _relayCount: number,
  relayOnlineCount: number,
): ControlState {
  const current = HQ_CONTROL + relayOnlineCount * RELAY_CONTROL;
  return {
    current: Math.min(current, CONTROL_CAP_MVP),
    cap: CONTROL_CAP_MVP,
    used: 0, // No units in NEXT-04
  };
}

// ── Tick ─────────────────────────────────────────────────────────────

/**
 * Recalculate Control based on how many Command Relays are online.
 * HQ always contributes +10 regardless of power state.
 */
export function tickControl(
  state: ControlState,
  relayOnlineCount: number,
): void {
  state.current = Math.min(HQ_CONTROL + relayOnlineCount * RELAY_CONTROL, CONTROL_CAP_MVP);
}

// ── Helpers ──────────────────────────────────────────────────────────

/** How many control slots are available for new units. */
export function availableControl(state: ReadonlyControlState): number {
  return state.current - state.used;
}
