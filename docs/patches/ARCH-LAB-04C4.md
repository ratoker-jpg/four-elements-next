# ARCH-LAB-04C4: Combat range decision helper

**Task ID**: ARCH-LAB-04C4
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04c4-combat-range-decision`
**PR**: #81
**Roadmap ref**: ARCH-LAB-04 step 7 (combat range decision delegation)

## Summary

Add one pure range decision helper to `combat_system.js`, then delegate one
legacy wrapper function in `main.js` to `FE_COMBAT_SYSTEM` with identical-behavior
fallback.

The delegated function is:
- `FE_PATCH_08BTargetInRange` → `FE_COMBAT_SYSTEM.isTargetInRange`

This is a pure read-only predicate with zero side effects. main.js precomputes
`targetKind` (via `FE_PATCH_07BGetHostileLightTankTargetKind`), `distance`
(via `FE_PATCH_06BDistanceToBuilding` or `unitDistanceCells`), and `range`
(via `getLightTankCombatStats`), then passes them as plain params to the module.

## Motivation

After ARCH-LAB-04C3, `combat_system.js` owns target classification and
attackability helpers, but main.js still owns the range decision logic that
determines whether a target is within attack range. `FE_PATCH_08BTargetInRange`
is called from multiple sites across main.js — every time a light tank needs to
know "is this target close enough to attack?". The function is composite: it
calls `FE_PATCH_07BGetHostileLightTankTargetKind`, `getLightTankCombatStats`,
and either `FE_PATCH_06BDistanceToBuilding` or `unitDistanceCells`. All of these
are already resolved in main.js before delegation, so the module receives only
precomputed data and remains pure.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/combat_system.js` | MOD | Add `isTargetInRange(params)` |
| `src/main.js` | MOD | Delegate `FE_PATCH_08BTargetInRange` to `FE_COMBAT_SYSTEM` with fallback |
| `src/systems/README.md` | MOD | Document 04C4 addition, update module description |
| `docs/patches/ARCH-LAB-04C4.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Add ARCH-LAB-04C4 entry |

## New API

```
FE_COMBAT_SYSTEM.isTargetInRange(params)
  // params: { targetKind, distance, range }
  // Returns: boolean
  // Legacy behavior:
  //   if !params or not object → false
  //   if targetKind is not 'unit' or 'building' → false
  //   if distance is not finite → false
  //   if range is not finite → false
  //   return distance <= range
```

## Behavioural guarantees

1. `isTargetInRange` returns identical values to `FE_PATCH_08BTargetInRange`
   for all inputs including null/undefined params, invalid targetKind,
   non-finite distance/range, and edge case distance === range.
2. Uses `<=` (not `<`) — matching legacy `distance <= range` comparison.
3. Does NOT classify target inside `isTargetInRange` — caller provides targetKind.
4. Does NOT compute distance inside `isTargetInRange` — caller provides distance.
5. Does NOT read game, FE_CORE, UNIT_DEFS, DOM, canvas, or pathfinding.
6. Does NOT call `getLightTankCombatStats` from combat_system.js.
7. Does NOT call `unitDistanceCells` from combat_system.js.
8. main.js precomputes `targetKind`, `distance`, and `range` before delegating.
9. Delegation only occurs if `window.FE_COMBAT_SYSTEM` exists and
   `isTargetInRange` is a function. Otherwise legacy inline body is used.
10. No mutation, no game state access, no DOM/canvas, no pathfinding.

## What was NOT changed

- `updateLightTankCombat` — NOT touched
- `FE_PATCH_06BDamageBuilding` — NOT touched
- `FE_PATCH_06CDestroyBuilding` — NOT touched
- `FE_PATCH_06CClearBuildingRefs` — NOT touched
- `FE_PATCH_06BClearAttackTarget` — NOT touched
- `FE_PATCH_06BClearAttackApproach` — NOT touched
- `FE_PATCH_06BResolveAttackTarget` — NOT touched
- `FE_PATCH_06BResolveApproachTarget` — NOT touched
- `FE_PATCH_07BAssignLightTankAttack` — NOT touched
- `setLightTankAttackGeneric` — NOT touched
- `setLightTankAttackApproachGeneric` — NOT touched
- `tryRetargetAfterKill` — NOT touched
- `updateLightTankAttackApproach` — NOT touched
- `updateLightTankAttackMove` — NOT touched
- `findAttackMoveEnemyInRange` — NOT touched
- `findRetargetEnemyInRange` — NOT touched
- `setGroupLightTankAttackApproach` — NOT touched
- `getLightTankCombatStats` — NOT touched
- `unitDistanceCells` — NOT touched
- All bot/AI functions — NOT touched
- All pathfinding functions — NOT touched
- All render/FX functions — NOT touched
- Inline range-check patterns in execution-context functions — NOT changed
- Attack damage/range/cooldown balance — NOT changed
- Economy/power/production/construction — NOT touched
- Render/input/selection — NOT touched
- Save/load — NOT touched
- Playwright tests — NOT touched
- Runtime flags — NOT touched
- index.html — NOT touched
- command_system.js — NOT touched
- movement_system.js — NOT touched
- geometry.js — NOT touched
- game_state.js — NOT touched

## Checks

- `node --check src/systems/combat_system.js` — PASS
- `node --check src/main.js` — PASS
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — PASS (6/6)
