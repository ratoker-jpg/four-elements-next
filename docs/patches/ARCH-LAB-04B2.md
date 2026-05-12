# ARCH-LAB-04B2: Movement ATTACK-06 decision delegation

**Task ID**: ARCH-LAB-04B2
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04b2-movement-attack06-delegation`
**PR**: TBD
**Roadmap ref**: ARCH-LAB-04 step 3 (ATTACK-06 callback contract)

## Summary

Break the ATTACK-06 cross-system coupling by extracting pure decision logic
from `updateUnitMovement` and `recoverUnitPath` into `FE_MOVEMENT_SYSTEM`.
Three new pure functions replace inline if/else chains:
- `shouldRequestAttackApproachRecovery` — outer guard predicate
- `classifyBlocker` — blocker classification (unit/building/mineral/obstacle/unknown)
- `createAttackApproachRecoveryDecision` — throttle + blockerKind decision

**Execution stays in main.js**: `setLightTankAttackApproachGeneric`,
`FE_PATCH_06BResolveApproachTarget`, and telemetry are NOT moved.
If `FE_MOVEMENT_SYSTEM` helpers are unavailable, legacy inline logic is used
with identical behavior.

**This is the first ARCH-LAB step that modifies main.js.** Risk is MEDIUM.

## Motivation

The ATTACK-06 coupling is the critical cross-system dependency blocking
further movement system extraction. Movement code directly calls
`setLightTankAttackApproachGeneric` (command/combat function) in two places:

1. `updateUnitMovement` (lines ~8513–8563): when a light_tank with active
   attack-approach is blocked by another unit, it re-paths to the attack target.
2. `recoverUnitPath` (lines ~8447–8464): same recovery logic when the unit
   is stuck and needs path recovery.

By extracting only the **decision** (should we attempt recovery?) into the pure
data module, while keeping **execution** (actually re-pathing) in main.js,
we break the coupling without moving complex behavior.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/movement_system.js` | MOD | Added `BLOCKER_KINDS`, `ATTACK06_THROTTLE_MS`, `ATTACK06_BLOCKED_TIMER_THRESHOLD`, `shouldRequestAttackApproachRecovery`, `classifyBlocker`, `createAttackApproachRecoveryDecision` |
| `src/main.js` | MOD | Updated 2 ATTACK-06 blocks: `updateUnitMovement` and `recoverUnitPath` now delegate decisions to `FE_MOVEMENT_SYSTEM` helpers with legacy fallback |
| `src/systems/README.md` | MOD | Updated status, added 04B2 section documenting ATTACK-06 decision delegation |
| `docs/patches/ARCH-LAB-04B2.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-04B2 entry |

## New API

```
FE_MOVEMENT_SYSTEM.BLOCKER_KINDS = Object.freeze({
  UNIT: 'unit', BUILDING: 'building', MINERAL: 'mineral',
  OBSTACLE: 'obstacle', UNKNOWN: 'unknown'
});

FE_MOVEMENT_SYSTEM.ATTACK06_THROTTLE_MS = 800;
FE_MOVEMENT_SYSTEM.ATTACK06_BLOCKED_TIMER_THRESHOLD = 0.5;

FE_MOVEMENT_SYSTEM.shouldRequestAttackApproachRecovery(params)
  // params: { unitType, hasAttackApproachTarget, blockedTimer? }
  // Returns: boolean

FE_MOVEMENT_SYSTEM.classifyBlocker(params)
  // params: { hasUnit, hasBuilding, hasMineral, isObstacle }
  // Returns: 'unit'|'building'|'mineral'|'obstacle'|'unknown'

FE_MOVEMENT_SYSTEM.createAttackApproachRecoveryDecision(params)
  // params: { blockerKind?, now, lastRepathAt, throttleMs? }
  // Returns: { shouldAttemptRepath: boolean, reason: string, updateLastRepathAt: boolean }
```

## Behavioural guarantees

1. `shouldRequestAttackApproachRecovery` returns `true` **iff** legacy conditions
   would have entered the ATTACK-06 block.
2. `classifyBlocker` returns the exact same values as the legacy inline ternary:
   `'unit'`, `'building'`, `'mineral'`, `'obstacle'`, `'unknown'` — same priority order.
3. `createAttackApproachRecoveryDecision` returns `shouldAttemptRepath: true`
   **iff** legacy code would have called `setLightTankAttackApproachGeneric`.
4. `_attack06LastRepathAt` update timing is identical to legacy behavior
   (updated before execution call, only when throttle passes).
5. Throttle value remains 800ms. blockedTimer threshold remains 0.5.
6. `FE_MOVEMENT_SYSTEM` does NOT call pathfinding, combat, command execution,
   `FE_CORE`, `game`, DOM, or canvas.
7. If `FE_MOVEMENT_SYSTEM` helpers are unavailable, legacy inline logic is used
   with identical behavior — no movement behavior change.
8. `setLightTankAttackApproachGeneric` stays in main.js.
9. `FE_PATCH_06BResolveApproachTarget` stays in main.js.
10. Telemetry stays in main.js — identical fields, identical counters.

## What was NOT changed

- `updateUnitMovement` — NOT moved, still in main.js
- `recoverUnitPath` — NOT moved, still in main.js
- `findPath` / `passable` / `isBlocked` — NOT moved
- Path following math, movement speed — unchanged
- Stuck/block thresholds — unchanged (`_stuckTimer > 0.75`, `_blockedTimer > 0.35`)
- ATTACK-06 throttle value: 800ms — unchanged
- blockedTimer threshold: 0.5 — unchanged
- Attack damage/range/cooldown — unchanged
- Enemy bot / tank_decider / scout — untouched
- Harvester/builder lifecycle — untouched
- Economy/power/production/construction — untouched
- Render/input/selection — untouched
- Save/load — untouched
- Playwright tests — untouched
- Runtime flags — untouched
- index.html — NOT changed (movement_system.js already loaded from 04B1)

## Checks

- `node --check src/systems/movement_system.js` — PASS
- `node --check src/main.js` — PASS
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — UNVERIFIED (no browser in CI environment)
