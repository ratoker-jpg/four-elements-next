# src/systems/ — Gameplay Systems

**Owner:** ARCH-LAB (architecture migration)
**Status:** Active — 3 production modules
**Roadmap step:** ARCH-LAB-03, ARCH-LAB-04 (04A, 04B1, 04B2, 04C1 complete)

## Purpose

Core gameplay systems extracted from main.js. Each module encapsulates
a self-contained game subsystem with a clear API surface.

## Planned modules

### ARCH-LAB-03 extraction targets

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `pathfinding.js` | Z12 | ~700 | A* pathfinding, grid traversal, obstacle avoidance |
| `territory_system.js` | Z18 | ~400 | Territory spread, building radius, fog of war |
| `shared_helpers.js` | mixed | ~300 | Coordinate transforms, math utilities, shared predicates |

### ARCH-LAB-04 extraction targets

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `movement_system.js` | Z14 | ~570 | Unit movement, path following, arrival detection |
| `combat_system.js` | Z7 combat | ~500 | Attack, damage, death, target selection |
| `command_system.js` | Z22 partial | ~400 | Move/attack/stop orders, attack-approach state machine |
| `economy_system.js` | Z11 | ~550 | Resource gathering, production, power grid |
| `construction_system.js` | Z17 partial | ~800 | Building placement, builder AI, construction progress |
| `production_system.js` | Z17 partial | ~400 | Unit production queues, factory logic |

## Dependencies

- `src/core/*` — constants, storage, asset loading
- `src/config/*` — building/unit/faction definitions
- `src/game/*` — game state (ARCH-LAB-02)
- `src/ai/*` — AI deciders (for combat/production integration)

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept game state + dependencies via `window.FE_CORE` bridge
- Expose a clear public API (no direct state mutation from outside)
- Never call back into main.js functions directly — use FE_CORE bridge
- Be testable in isolation with a mock game object

## Production modules

| Module | Lines | PR | Risk | Description |
|--------|-------|-----|------|------------|
| `command_system.js` | 196 | #75 | Low | Command type constants, factory functions, predicates — pure data, zero game mutation |
| `movement_system.js` | ~410 | #76+04B2 | Medium | Movement state/result/reason/recovery constants, factory functions, predicates, ATTACK-06 decision helpers |
| `combat_system.js` | ~190 | 04C1 | Low | Combat result/target kind/damage reason/attack state constants, factory functions, predicates — pure data, zero game mutation |

## ATTACK-06 decision delegation (ARCH-LAB-04B2)

The ATTACK-06 coupling between movement code and command/combat execution
has been broken by extracting pure decision logic into `movement_system.js`:

- **`shouldRequestAttackApproachRecovery(params)`** — pure predicate: should a unit
  be considered for ATTACK-06 recovery? Replaces the outer guard condition
  (`isLightTank(unit) && unit.attackApproachTargetId && _blockedTimer > 0.5`).

- **`classifyBlocker(params)`** — pure function: classify what's blocking a cell
  into one of `'unit'|'building'|'mineral'|'obstacle'|'unknown'`. Preserves
  exact legacy blockerKind values and priority order.

- **`createAttackApproachRecoveryDecision(params)`** — pure function: make the
  ATTACK-06 recovery decision based on blockerKind, throttle, and timing.
  Returns `{ shouldAttemptRepath, reason, updateLastRepathAt }`.

Execution (`setLightTankAttackApproachGeneric`, telemetry writes) stays in main.js.
If `FE_MOVEMENT_SYSTEM` helpers are unavailable, main.js falls back to legacy
inline logic with identical behavior.

## Combat contract (ARCH-LAB-04C1)

The first step of combat system separation — a pure data contract module
with zero game mutation. `combat_system.js` provides constants and factory
functions for combat results, target kinds, damage reasons, and attack states.

- **`COMBAT_RESULTS`** — 7 combat outcome types: DAMAGED, KILLED, TARGET_INVALID,
  TARGET_DEAD, OUT_OF_RANGE, COOLDOWN_NOT_READY, ALREADY_DEAD.
- **`TARGET_KINDS`** — 2 target classifications: UNIT, BUILDING.
- **`DAMAGE_REASONS`** — 3 damage origin types: COMBAT_DAMAGE, ALREADY_DEAD, SCRIPTED.
- **`ATTACK_STATES`** — 4 attack lifecycle phases: ATTACKING, ATTACK_APPROACH,
  ATTACK_MOVE, MOVING_TO_ATTACK.
- **`createCombatResult(type, details)`** — factory for combat result objects.
- **`createDamageResult(type, details)`** — convenience factory (alias).
- **`createKillResult(type, details)`** — convenience factory (alias).
- **`isCombatResult(value)`** — type guard predicate.
- **`isValidCombatResult(cr)`** — structural validation (returns true or error string).

**Not yet in 04C1** (deferred to 04C2 when main.js delegates to them):
classifyAttackTarget, isAttackableTarget, isInRange, targetCenter,
distanceToBuilding, isDeadBuilding, shouldClearAttackTarget,
shouldClearAttackApproach, createAttackDecision.

## Current contents

- `command_system.js` — pure data command API (ARCH-LAB-04A)
- `movement_system.js` — pure data movement API + ATTACK-06 decision helpers (ARCH-LAB-04B1 + 04B2)
- `combat_system.js` — pure data combat contract API (ARCH-LAB-04C1)
