# ARCH-LAB-04C1: Combat boundary — pure data contract

**Task ID**: ARCH-LAB-04C1
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-04c1-combat-contract`
**PR**: #78
**Roadmap ref**: ARCH-LAB-04 step 4 (combat contract module)

## Summary

Create a minimal pure combat contract module as the first step of combat
system separation. `combat_system.js` exposes `window.FE_COMBAT_SYSTEM`
with combat result, target kind, damage reason, and attack state constants,
plus factory functions and predicates. Zero game mutation, zero execution.

This is a **pure data contract** — no behavioral helpers, no delegation
from main.js, no gameplay changes. The module sits alongside command_system
and movement_system as a self-documenting contract that future 04C2+ patches
will use when main.js delegates attack/damage logic.

## Motivation

The combat boundary is the next extraction target after command and movement.
Before any combat logic can be extracted from main.js, we need a contract
module that defines:

1. What outcomes a combat action can produce (COMBAT_RESULTS).
2. What kinds of targets exist (TARGET_KINDS).
3. Why damage is applied or skipped (DAMAGE_REASONS).
4. What attack lifecycle phases a unit goes through (ATTACK_STATES).

These constants and factories will be referenced by main.js in future 04C2+
patches when `damageUnit`, `destroyUnit`, and attack-approach logic is
delegated to `FE_COMBAT_SYSTEM` helpers.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/systems/combat_system.js` | NEW | Pure data combat contract: COMBAT_RESULTS, TARGET_KINDS, DAMAGE_REASONS, ATTACK_STATES, factory functions, predicates |
| `index.html` | MOD | Add `<script src="src/systems/combat_system.js">` after movement_system.js, before visual_calibrator.js |
| `src/systems/README.md` | MOD | Document combat_system, update module count, add 04C1 section |
| `docs/patches/ARCH-LAB-04C1.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Add ARCH-LAB-04C1 entry |

## New API

```
FE_COMBAT_SYSTEM.COMBAT_RESULTS = Object.freeze({
  DAMAGED: 'damaged',
  KILLED: 'killed',
  TARGET_INVALID: 'target_invalid',
  TARGET_DEAD: 'target_dead',
  OUT_OF_RANGE: 'out_of_range',
  COOLDOWN_NOT_READY: 'cooldown_not_ready',
  ALREADY_DEAD: 'already_dead'
});

FE_COMBAT_SYSTEM.TARGET_KINDS = Object.freeze({
  UNIT: 'unit',
  BUILDING: 'building'
});

FE_COMBAT_SYSTEM.DAMAGE_REASONS = Object.freeze({
  COMBAT_DAMAGE: 'combat_damage',
  ALREADY_DEAD: 'already_dead',
  SCRIPTED: 'scripted'
});

FE_COMBAT_SYSTEM.ATTACK_STATES = Object.freeze({
  ATTACKING: 'attacking',
  ATTACK_APPROACH: 'attack_approach',
  ATTACK_MOVE: 'attack_move',
  MOVING_TO_ATTACK: 'moving_to_attack'
});

FE_COMBAT_SYSTEM.createCombatResult(type, details)
  // type: one of COMBAT_RESULTS values
  // details: { attackerId?, targetId?, targetKind?, damage?, hpRemaining?, reason? }
  // Returns: plain combat result object

FE_COMBAT_SYSTEM.createDamageResult(type, details)
  // Alias for createCombatResult (convenience)

FE_COMBAT_SYSTEM.createKillResult(type, details)
  // Alias for createCombatResult (convenience)

FE_COMBAT_SYSTEM.isCombatResult(value)
  // Type guard: returns boolean

FE_COMBAT_SYSTEM.isValidCombatResult(cr)
  // Structural validation: returns true or error string
```

## Not included in 04C1 (deferred to 04C2)

These behavioral helpers duplicate legacy logic and should be added only
when main.js delegates to them:

- `classifyAttackTarget`
- `isAttackableTarget`
- `isInRange`
- `targetCenter`
- `distanceToBuilding`
- `isDeadBuilding`
- `shouldClearAttackTarget`
- `shouldClearAttackApproach`
- `createAttackDecision`

## Behavioural guarantees

1. `FE_COMBAT_SYSTEM` does NOT call pathfinding, combat execution, command
   execution, `FE_CORE`, `game`, DOM, or canvas.
2. `FE_COMBAT_SYSTEM` has zero dependency on `movement_system.js`.
3. All constants are `Object.freeze` — immutable at runtime.
4. All factory functions return plain serializable objects.
5. `isCombatResult` checks only for a valid `type` field — no deep validation.
6. `isValidCombatResult` checks required field types — returns `true` or error string.
7. Adding this module does NOT change any gameplay behavior.
8. main.js does NOT reference `FE_COMBAT_SYSTEM` yet — that is 04C2+ scope.

## What was NOT changed

- `src/main.js` — NOT touched
- `src/systems/command_system.js` — NOT touched
- `src/systems/movement_system.js` — NOT touched
- `src/core/geometry.js` — NOT touched
- `src/game/game_state.js` — NOT touched
- `src/config/runtime_flags.js` — NOT touched
- Combat balance / damage / range / cooldown — unchanged
- Pathfinding — unchanged
- Enemy bot / tank_decider — unchanged
- Selection / input / render — unchanged
- Save/load — unchanged
- Playwright tests — unchanged
- Runtime flags — unchanged

## Checks

- `node --check src/systems/combat_system.js` — PASS
- `node --check src/main.js` — PASS
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — PASS (6/6, 34.1s)
