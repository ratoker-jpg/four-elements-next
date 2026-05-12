# ARCH-LAB-04C3: Combat target classification / attackability helpers

**Task ID**: ARCH-LAB-04C3
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04c3-combat-target-classification`
**PR**: #80
**Roadmap ref**: ARCH-LAB-04 step 6 (combat target classification delegation)

## Summary

Add two pure target classification/attackability helpers to `combat_system.js`,
then delegate two legacy wrapper functions in `main.js` to `FE_COMBAT_SYSTEM`
with identical-behavior fallback.

The delegated functions are:
- `FE_PATCH_07BGetHostileLightTankTargetKind` → `FE_COMBAT_SYSTEM.classifyHostileTarget`
- `FE_PATCH_06BIsAttackableEnemyBuilding` → `FE_COMBAT_SYSTEM.isAttackableEnemyBuilding`

Both are pure read-only predicates with zero side effects. main.js resolves
closure-bound data (isLightTank, unitOwner, buildingOwner, isEnemyBuilding)
into plain params before delegating.

## Motivation

After ARCH-LAB-04C2, `combat_system.js` owns geometry/state helpers but
main.js still owns the classification logic that decides *what kind of target*
an entity is and *whether it is attackable*. `FE_PATCH_07BGetHostileLightTankTargetKind`
is called from 9 sites across main.js — every time a light tank needs to know
"is this target a hostile unit or building?". `FE_PATCH_06BIsAttackableEnemyBuilding`
is the simpler variant for UI click handling. Both are pure predicates that
can live in the module if main.js passes resolved params.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/combat_system.js` | MOD | Add `classifyHostileTarget(params)`, `isAttackableEnemyBuilding(params)` |
| `src/main.js` | MOD | Delegate 2 wrapper functions to `FE_COMBAT_SYSTEM` with fallback |
| `src/systems/README.md` | MOD | Document 04C3 additions, update module description |
| `docs/patches/ARCH-LAB-04C3.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Add ARCH-LAB-04C3 entry |

## New API

```
FE_COMBAT_SYSTEM.classifyHostileTarget(params)
  // params: { isLightTank, attackerOwner, targetKind, targetOwner, targetHp }
  // Returns: 'unit' | 'building' | null
  // Legacy behavior:
  //   if !isLightTank → null
  //   if (targetHp || 0) <= 0 → null
  //   if (attackerOwner || 'player') === (targetOwner || 'player') → null
  //   if targetKind === 'unit' → 'unit'
  //   if targetKind === 'building' → 'building'
  //   otherwise → null

FE_COMBAT_SYSTEM.isAttackableEnemyBuilding(params)
  // params: { isBuilding, isEnemy, hp }
  // Returns: boolean
  // Legacy behavior:
  //   if !isBuilding → false
  //   if !isEnemy → false
  //   return (hp || 0) > 0
```

## Behavioural guarantees

1. `classifyHostileTarget` returns identical values to
   `FE_PATCH_07BGetHostileLightTankTargetKind` for all inputs including
   non-light-tank attackers, null targets, same-owner targets, and dead targets.
2. `isAttackableEnemyBuilding` returns identical values to
   `FE_PATCH_06BIsAttackableEnemyBuilding` including `false` for null input,
   `false` for non-building entities, `false` for friendly buildings.
3. `(targetHp || 0) <= 0` pattern preserved exactly: null/undefined/0/negative → not a valid target.
4. `(hp || 0) > 0` pattern preserved exactly: null/undefined/0/negative → not attackable.
5. Owner default `'player'` preserved: `(attackerOwner || 'player')`, `(targetOwner || 'player')`.
6. main.js resolves `isLightTank`, `unitOwner`, `buildingOwner`, `isEnemyBuilding`
   from closure before passing to the module — the module never accesses game state.
7. Legacy guard `if (!isLightTank(attacker) || !target) return null` must precede
   delegation in `FE_PATCH_07BGetHostileLightTankTargetKind` — same pattern as 04C2.
8. Legacy guard `if (!target) return false` must precede delegation in
   `FE_PATCH_06BIsAttackableEnemyBuilding` — same pattern as 04C2.
9. Delegation only occurs if `window.FE_COMBAT_SYSTEM` exists and the specific
   helper function exists. Otherwise legacy inline body is used.
10. No mutation, no game state access, no DOM/canvas, no pathfinding.

## What was NOT changed

- `updateLightTankCombat` — NOT touched
- `FE_PATCH_08BTargetInRange` — NOT touched
- `damageUnit` / `destroyUnit` — NOT touched
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
- `isLightTank` — NOT moved (not combat-specific, used 42x)
- `unitOwner` — NOT moved (not combat-specific, used 41x)
- `buildingOwner` — NOT moved (not combat-specific, used 27x)
- `isEnemyBuilding` — NOT moved (not combat-specific)
- `isEnemyUnit` — NOT moved (not combat-specific)
- `isPlayerUnit` — NOT moved (not combat-specific)
- `isPlayerBuilding` — NOT moved (not combat-specific)
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
- `npm run test:e2e` — PASS (6/6)
