/**
 * Visual-only motion inertia for the harvester.
 * Applies subtle tilt/shift during acceleration/deceleration.
 * Does NOT affect logical worldX/worldY, pathing, depth, or tile position.
 *
 * Design:
 * - Idle = no body motion (all offsets/rotations decay to 0)
 * - Movement start = short forward/acceleration impulse
 * - Sustained movement = subtle stable offset, not constant bouncing
 * - Movement stop = short settle impulse back to zero
 *
 * Amplitude constraints:
 * - Rotation max 1–3 degrees
 * - X/Y visual offset max 1–3 px
 */

// ─── Inertia amplitude constants ──────────────────────────────────
const MAX_OFFSET_PX = 3;             // max visual offset (px)
const MAX_ROTATION_DEG = 2.5;        // max visual rotation (degrees)
const IMPULSE_OFFSET_PX = 2.5;       // start/stop impulse amplitude (px)
const IMPULSE_ROTATION_DEG = 2;      // start/stop impulse rotation (degrees)
const SUSTAINED_OFFSET_PX = 0.8;     // subtle sustained offset while moving (px)
const SUSTAINED_ROTATION_DEG = 0.3;  // subtle sustained rotation while moving (deg)
const LERP_RATE = 0.12;              // how fast visual catches up to target
const IMPULSE_DECAY = 0.88;          // per-frame impulse decay factor

export interface InertiaState {
  /** Current visual X offset (px) */
  offsetX: number;
  /** Current visual Y offset (px) */
  offsetY: number;
  /** Current visual rotation (degrees) */
  rotation: number;
  /** Decaying impulse offset X */
  impulseOffsetX: number;
  /** Decaying impulse offset Y */
  impulseOffsetY: number;
  /** Decaying impulse rotation */
  impulseRotation: number;
  /** Previous frame's moving state, for edge detection */
  wasMoving: boolean;
}

/** Create a new inertia state with all values at rest. */
export function createInertiaState(): InertiaState {
  return {
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    impulseOffsetX: 0,
    impulseOffsetY: 0,
    impulseRotation: 0,
    wasMoving: false,
  };
}

/**
 * Update inertia state based on current movement.
 * Mutates `state` in place.
 *
 * @param state       - Inertia state to update
 * @param isMoving    - Whether the unit is logically moving this frame
 * @param dirScreenX  - Normalized screen-space X direction of movement (-1 to 1)
 * @param dirScreenY  - Normalized screen-space Y direction of movement (-1 to 1)
 */
export function updateInertia(
  state: InertiaState,
  isMoving: boolean,
  dirScreenX: number,
  dirScreenY: number,
): void {
  // Detect state transitions
  const justStarted = isMoving && !state.wasMoving;
  const justStopped = !isMoving && state.wasMoving;

  // Apply impulse on transitions
  if (justStarted) {
    // Forward impulse in movement direction
    state.impulseOffsetX = dirScreenX * IMPULSE_OFFSET_PX;
    state.impulseOffsetY = dirScreenY * IMPULSE_OFFSET_PX;
    // Slight rotation based on lateral movement direction
    state.impulseRotation = dirScreenX * IMPULSE_ROTATION_DEG;
  }
  if (justStopped) {
    // Settle-back impulse (opposite to current visual offset)
    state.impulseOffsetX = -state.offsetX * 0.5;
    state.impulseOffsetY = -state.offsetY * 0.5;
    state.impulseRotation = -state.rotation * 0.5;
  }

  // Decay impulse each frame
  state.impulseOffsetX *= IMPULSE_DECAY;
  state.impulseOffsetY *= IMPULSE_DECAY;
  state.impulseRotation *= IMPULSE_DECAY;

  // Clamp very small impulses to zero (avoid floating-point drift)
  if (Math.abs(state.impulseOffsetX) < 0.01) state.impulseOffsetX = 0;
  if (Math.abs(state.impulseOffsetY) < 0.01) state.impulseOffsetY = 0;
  if (Math.abs(state.impulseRotation) < 0.01) state.impulseRotation = 0;

  // Compute target: subtle sustained offset while moving, zero when stopped
  const targetX = isMoving ? dirScreenX * SUSTAINED_OFFSET_PX : 0;
  const targetY = isMoving ? dirScreenY * SUSTAINED_OFFSET_PX : 0;
  const targetRot = isMoving ? dirScreenX * SUSTAINED_ROTATION_DEG : 0;

  // Lerp current toward (target + impulse)
  state.offsetX += (targetX + state.impulseOffsetX - state.offsetX) * LERP_RATE;
  state.offsetY += (targetY + state.impulseOffsetY - state.offsetY) * LERP_RATE;
  state.rotation += (targetRot + state.impulseRotation - state.rotation) * LERP_RATE;

  // Clamp to max amplitudes
  state.offsetX = clamp(state.offsetX, -MAX_OFFSET_PX, MAX_OFFSET_PX);
  state.offsetY = clamp(state.offsetY, -MAX_OFFSET_PX, MAX_OFFSET_PX);
  state.rotation = clamp(state.rotation, -MAX_ROTATION_DEG, MAX_ROTATION_DEG);

  state.wasMoving = isMoving;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
