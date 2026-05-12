# ARCH-LAB-04C2: Combat target/range decision helpers

**Task ID**: ARCH-LAB-04C2
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04c2-combat-target-range-helpers`
**PR**: #79
**Roadmap ref**: ARCH-LAB-04 step 5 (combat target/range delegation)

## Summary

Add three pure computation helpers and one constant to `combat_system.js`,
then delegate three legacy wrapper functions in `main.js` to
`FE_COMBAT_SYSTEM` with identical-behavior fallback.

This is the first step where main.js actively delegates to `FE_COMBAT_SYSTEM`.
The delegated functions are:
- `FE_PATCH_06BTargetCenter` → `FE_COMBAT_SYSTEM.targetCenter`
- `FE_PATCH_06BDistanceToBuilding` → `FE_COMBAT_SYSTEM.distanceToBuilding`
- `FE_PATCH_06CIsDeadBuilding` → `FE_COMBAT_SYSTEM.isDeadBuilding`

All three are pure read-only computations with zero side effects.

## Motivation

After ARCH-LAB-04C1, `combat_system.js` exists with pure contract constants
but main.js does not reference `FE_COMBAT_SYSTEM`. The contract is dead code.
04C2 makes the first concrete connection by extracting the simplest pure
combat computations from main.js closure into the module.

The three selected functions are mathematically pure:
- `targetCenter` reads entity properties and returns a coordinate pair
- `distanceToBuilding` reads coordinates and returns Manhattan distance
- `isDeadBuilding` reads entity state and returns a boolean

They have zero closure dependencies, zero game state access, zero mutation.
This makes delegation trivial with identical-behavior fallback.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/combat_system.js` | MOD | Add `BUILDING_CENTER_OFFSET`, `targetCenter`, `distanceToBuilding`, `isDeadBuilding` |
| `src/main.js` | MOD | Delegate 3 wrapper functions to `FE_COMBAT_SYSTEM` with fallback |
| `src/systems/README.md` | MOD | Document 04C2 additions, update module description |
| `docs/patches/ARCH-LAB-04C2.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Add ARCH-LAB-04C2 entry |

## New API

```
FE_COMBAT_SYSTEM.BUILDING_CENTER_OFFSET = 0.5

FE_COMBAT_SYSTEM.targetCenter(params)
  // params: { targetKind, x, y, w?, h? }
  // Returns: { x: number, y: number } | null
  // Building: { x: x + (w||1)/2 - 0.5, y: y + (h||1)/2 - 0.5 }
  // Non-building: { x, y }
  // null if params missing

FE_COMBAT_SYSTEM.distanceToBuilding(params)
  // params: { unitX, unitY, buildingX, buildingY, buildingW, buildingH }
  // Returns: number (Manhattan distance to building bounding box)
  // Infinity if data missing

FE_COMBAT_SYSTEM.isDeadBuilding(params)
  // params: { isBuilding, destroyed?, hp? }
  // Returns: boolean
  // true if isBuilding && (destroyed === true || (hp || 0) <= 0)
```

## Behavioural guarantees

1. `targetCenter` returns identical values to `FE_PATCH_06BTargetCenter`
   for all inputs including null, buildings with w/h, and non-building targets.
2. `distanceToBuilding` returns identical values to `FE_PATCH_06BDistanceToBuilding`
   including `Infinity` for missing data, `0` for units inside building box.
3. `isDeadBuilding` returns identical values to `FE_PATCH_06CIsDeadBuilding`
   including `false` for null input, `false` for non-building entities.
4. `(hp || 0) <= 0` pattern preserved exactly: null/undefined/0/negative → dead.
5. `(w || 1)` and `(h || 1)` pattern preserved: 0/null/undefined → defaults to 1.
6. `Math.round()` used on all coordinates before comparison (matches legacy).
7. `BUILDING_CENTER_OFFSET` = 0.5 — must not change.
8. Delegation only occurs if `window.FE_COMBAT_SYSTEM` exists and the specific
   helper function exists. Otherwise legacy inline body is used.
9. No mutation, no game state access, no DOM/canvas, no pathfinding.

## What was NOT changed

- `updateLightTankCombat` — NOT touched
- `damageUnit` / `destroyUnit` — NOT touched
- `FE_PATCH_06BDamageBuilding` — NOT touched
- `FE_PATCH_06CDestroyBuilding` — NOT touched
- `FE_PATCH_06CClearBuildingRefs` — NOT touched
- `FE_PATCH_06BClearAttackTarget` — NOT touched
- `FE_PATCH_06BClearAttackApproach` — NOT touched
- `FE_PATCH_06BResolveAttackTarget` — NOT touched
- `FE_PATCH_06BResolveApproachTarget` — NOT touched
- `FE_PATCH_07BGetHostileLightTankTargetKind` — NOT touched
- `FE_PATCH_06BIsAttackableEnemyBuilding` — NOT touched
- `FE_PATCH_08BTargetInRange` — NOT touched
- `setLightTankAttackGeneric` — NOT touched
- `setLightTankAttackApproachGeneric` — NOT touched
- `tryRetargetAfterKill` — NOT touched
- All bot/AI functions — NOT touched
- Pathfinding/passable/isBlocked — NOT touched
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
- `npm run test:e2e` — PASS (6/6, 33.7s)
