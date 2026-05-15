# ARCH-LAB-04A: Command boundary — pure data API

**Task ID**: ARCH-LAB-04A
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04a-command-boundary`
**PR**: #75
**Roadmap ref**: ARCH-LAB-04 step 1 (command boundary only)

## Summary

Create `src/systems/command_system.js` with `window.FE_COMMAND_SYSTEM` —
a pure data API for command types, factory functions, and predicates.
This is the first step of the command/movement/combat boundary separation
(ARCH-LAB-04), establishing the command object contract that future
04B (movement) and 04C (combat) steps will build upon.

**No changes to main.js. No gameplay behavior changes. No feature flags.**

## Motivation

The Phase 1 audit revealed that command, movement, and combat systems
are deeply interleaved in main.js:
- `updateUnitMovement` (movement) directly calls `setLightTankAttackApproachGeneric` (command)
- `destroyUnit` (combat) modifies `selected`/`selectedUnits` (input state)
- `onCanvasClick` is a god-function spanning all three systems

Extracting all three simultaneously is too risky. The safest first step
is to define the command object contract as pure data — zero game mutation,
zero closure dependencies. This creates the API that 04B/04C will consume
without touching any existing code.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/command_system.js` | NEW | `window.FE_COMMAND_SYSTEM` — COMMAND_TYPES, 5 factory functions, 3 predicates |
| `index.html` | MOD | Added `<script src="src/systems/command_system.js">` before main.js |
| `src/systems/README.md` | MOD | Updated status, added command_system.js to production modules |
| `docs/patches/ARCH-LAB-04A.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-04A entry |

## API

```
window.FE_COMMAND_SYSTEM = {
  COMMAND_TYPES:              Object.freeze({ MOVE, ATTACK, ATTACK_APPROACH, ATTACK_MOVE, STOP, HARVEST }),
  createMoveCommand(unitIds, targetX, targetY, options),
  createAttackCommand(unitIds, targetId, targetKind, options),
  createAttackApproachCommand(unitIds, targetId, targetKind, options),
  createAttackMoveCommand(unitIds, targetX, targetY, options),
  createStopCommand(unitIds, options),
  isCommand(value),
  commandType(cmd),
  isValidCommand(cmd)
};
```

## Behavioural guarantees

1. All factory functions return plain serializable objects — no classes, no prototypes.
2. `COMMAND_TYPES` is frozen — cannot be modified at runtime.
3. Zero game mutation — no reads or writes to `game`, `FE_CORE`, `selected`, etc.
4. Zero DOM/canvas access — no side effects.
5. Zero pathfinding — `createMoveCommand` does not call `findPath`.
6. Zero damage — `createAttackCommand` does not apply damage.
7. `isValidCommand` validates structure defensively, returns `true` or error string.
8. `_coerceUnitIds` ensures `unitIds` is always a flat array of strings.

## What was NOT changed

- src/main.js — **not touched**
- pathfinding / passable / updateUnitMovement
- setManualMove / queueManualMove / applyQueuedManualMove
- onCanvasClick / attack-approach / attack-move
- combat / damage / cooldown / range
- enemy bot / tank_decider / scout
- economy / power / production / construction
- render / input / selection behavior
- save / load
- Playwright tests
- runtime_flags.js — no feature flags added
- src/config/runtime_flags.js
- src/game/game_state.js
- src/core/geometry.js

## Checks

- `node --check src/systems/command_system.js` — PASS
- `node --check src/main.js` — PASS (unchanged)
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — UNVERIFIED (no browser in CI environment)
