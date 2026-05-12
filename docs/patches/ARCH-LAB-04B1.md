# ARCH-LAB-04B1: Movement boundary — pure data API

**Task ID**: ARCH-LAB-04B1
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04b1-movement-boundary`
**PR**: TBD
**Roadmap ref**: ARCH-LAB-04 step 2 (movement boundary — contracts only)

## Summary

Create `src/systems/movement_system.js` with `window.FE_MOVEMENT_SYSTEM` —
a pure data API for movement states, results, reasons, recovery requests,
factory functions, and predicates. This is the second step of the
command/movement/combat boundary separation (ARCH-LAB-04), establishing
the movement data contract that future 04B2 (movement delegation) and
04C (combat) steps will build upon.

**No changes to main.js. No gameplay behavior changes. No feature flags.**

## Motivation

The Phase 1 audit revealed that movement code in main.js uses a variety
of `unit.state` string literals scattered across ~15,000+ lines:
- 15 distinct state values (idle, manual_move, moving, attack_approach, etc.)
- Movement results are implicit boolean returns from `updateUnitMovement`
- Recovery reasons are scattered across `recoverUnitPath`, ATTACK-06 blocks
- No single source of truth for valid state transitions

Extracting the full movement system is blocked by ATTACK-06 coupling
(movement→command cross-call). The safest first step is to define
the movement data contract as pure constants and factories — zero game
mutation, zero closure dependencies. This creates the API that 04B2/04C
will consume without touching any existing code.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/movement_system.js` | NEW | `window.FE_MOVEMENT_SYSTEM` — MOVEMENT_STATES, MOVEMENT_RESULTS, MOVEMENT_REASONS, MOVEMENT_RECOVERY_REQUESTS, 2 factory functions, 3 predicates |
| `index.html` | MOD | Added `<script src="src/systems/movement_system.js">` after command_system.js, before visual_calibrator.js |
| `src/systems/README.md` | MOD | Updated status to 2 production modules, added movement_system.js |
| `docs/patches/ARCH-LAB-04B1.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-04B1 entry |

## API

```
window.FE_MOVEMENT_SYSTEM = {
  MOVEMENT_STATES:             Object.freeze({ IDLE, MANUAL_MOVE, MOVING, MOVING_TO_ATTACK, ATTACK_APPROACH, ATTACK_MOVE, ATTACKING, MOVING_TO_BUILD, BUILDING, MOVING_TO_MINE, HARVESTING, RETURNING, STORAGE_FULL, WAITING_FOR_BASE, UNLOADING }),
  MOVEMENT_RESULTS:            Object.freeze({ WAYPOINT_REACHED, IN_PROGRESS, BLOCKED, STUCK, NO_PATH, RE_PATHED, ARRIVED }),
  MOVEMENT_REASONS:            Object.freeze({ PLAYER_COMMAND, GROUP_COMMAND, ATTACK_APPROACH_ORDER, ATTACK_MOVE_ORDER, HARVEST_ASSIGNMENT, RETURN_TO_BASE, BUILD_ORDER, ENEMY_BOT_ORDER, RECOVERY_REPATH, CANCEL_RIGHT_CLICK, CANCEL_BUILDER, CANCEL_STOP_COMMAND, CANCEL_NEW_ORDER, CANCEL_TARGET_LOST, CANCEL_CELL_BLOCKED, CANCEL_NO_PATH, BLOCKED_BY_UNIT, BLOCKED_BY_BUILDING, BLOCKED_BY_MINERAL, BLOCKED_BY_OBSTACLE, BLOCKED_BY_UNKNOWN, REPATH_SUCCESS, REPATH_FAILED, REPATH_THROTTLED, RECOVERY_HARVESTER, RECOVERY_BUILDER, RECOVERY_FALLBACK }),
  MOVEMENT_RECOVERY_REQUESTS:  Object.freeze({ ATTACK_APPROACH_REPATH, HARVESTER_REASSIGN, BUILDER_REPATH, GENERIC_CLEAR }),
  createMovementResult(result, details),
  createRecoveryRequest(requestType, details),
  isMovementResult(value),
  isRecoveryRequest(value),
  isValidMovementResult(mr)
};
```

## Behavioural guarantees

1. All factory functions return plain serializable objects — no classes, no prototypes.
2. All constant objects are frozen — cannot be modified at runtime.
3. Zero game mutation — no reads or writes to `game`, `FE_CORE`, `selected`, etc.
4. Zero DOM/canvas access — no side effects.
5. Zero pathfinding — `createMovementResult` does not call `findPath`.
6. Zero command execution — `createMovementResult` does not issue commands.
7. Zero combat execution — no damage, no attack logic.
8. MOVEMENT_STATES values match actual `unit.state` strings in main.js.
9. `isValidMovementResult` validates structure defensively, returns `true` or error string.
10. No dependency on `FE_CORE`, `game`, or any main.js closure variable.

## What was NOT changed

- src/main.js — **not touched**
- pathfinding / passable / updateUnitMovement / recoverUnitPath
- setManualMove / queueManualMove / applyQueuedManualMove
- cancel movement logic / cancelBuilderManualMove / cancelManualMoveAfterCurrentCell
- ATTACK-06 behavior
- attack-approach / attack-move combat logic
- enemy bot / tank_decider / scout
- economy / power / production / construction
- render / input / selection
- save / load
- Playwright tests
- runtime_flags.js — no feature flags added
- src/game/game_state.js
- src/core/geometry.js
- src/systems/command_system.js

## Checks

- `node --check src/systems/movement_system.js` — PASS
- `node --check src/main.js` — PASS (unchanged)
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — UNVERIFIED (no browser in CI environment)
