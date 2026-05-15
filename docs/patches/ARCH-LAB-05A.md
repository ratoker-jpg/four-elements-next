# ARCH-LAB-05A — Enemy Intel Contract-Only Module

**Date:** 2026-05-13
**PR:** #82
**Branch:** `glm/arch-lab-05a-enemy-intel-contract`
**Scope:** Contract-only — no main.js changes, no behavior changes

## Summary

Create `src/ai/enemy_intel.js` as a pure data/contract module exposing
`window.FE_ENEMY_INTEL` with constants, factory functions, and structural
validators that mirror existing shapes in main.js.

This PR is **additive only**. Factories are not wired yet — no delegation
from main.js to `FE_ENEMY_INTEL`. Runtime behavior is unchanged.

## What was added

### Constants

| Constant | Keys | Mirrors |
|----------|------|---------|
| `SCOUT_LIFECYCLE_STATES` | OUTBOUND, OBSERVING, SWEEPING, RETURNING, COOLDOWN | `_scout02BState` values in main.js |
| `INTEL_SOURCES` | SCOUT, TANK_VISION, COMBAT_CONTACT, NONE | `intelSource` field values in main.js |
| `SCOUT_RETURN_REASONS` | OBSERVE_DONE, SWEEP_DONE, SWEEP_TIMEOUT, SWEEP_NO_VALID_POINTS, THREAT_DANGER, DAMAGED, RETURN_NO_ROUTE, COOLDOWN_DONE | `_scout02BReason` values at returning transitions in main.js |

### Factory functions

| Function | Mirrors | Notes |
|----------|---------|-------|
| `createEnemyKnowledgeShell()` | `FE_PATCH_10BCreateEnemyKnowledge()` | Field names, defaults, and Object.create(null) usage preserved exactly |
| `createEnemyIntelSnapshot()` | `FE_INTEL01Init()` game.enemyIntel shape | All 20+ fields preserved exactly; no fields invented, omitted, or changed |

### Validators

| Function | Returns | Style |
|----------|---------|-------|
| `isValidEnemyKnowledge(obj)` | `true` or descriptive string error | Same pattern as combat_system validators |
| `isValidEnemyIntelSnapshot(obj)` | `true` or descriptive string error | Checks all fields including nested type breakdowns |

## What was NOT added (explicitly excluded)

- `createScoutLifecycleState` — not a contract concern
- `createScoutingCoordinatorState` — not a contract concern
- `mergeIntelCounts` — behavior helper
- `decayConfidence` — behavior helper
- `scoreKnowledgeEntry` — behavior helper
- `isIntelFresh` — decision helper
- `shouldScoutReturnFromThreat` — decision helper
- `isSweepPointSafeFromTanks` — decision helper
- Any other decision or behavior helpers

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `src/ai/enemy_intel.js` | NEW | Pure data/contract module |
| `index.html` | MOD | Added script tag for enemy_intel.js after tank_decider.js, before command_system.js |
| `src/ai/README.md` | MOD | Documented enemy_intel.js as existing module |
| `docs/patches/ARCH-LAB-05A.md` | NEW | This document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-05A entry |

## Files NOT touched

- `src/main.js` — no changes
- `src/ai/tank_decider.js` — no changes
- `src/systems/combat_system.js` — no changes
- `src/systems/movement_system.js` — no changes
- `src/systems/command_system.js` — no changes
- `src/core/geometry.js` — no changes
- `src/game/game_state.js` — no changes
- `src/config/runtime_flags.js` — no changes
- `tests/` — no changes
- `assets/` — no changes

## No scout/intel/bot runtime functions touched

- `FE_SCOUT01UpdateEnemyScoutBehavior`
- `FE_10C1_trySetScoutMove`
- `FE_10C1_updateEnemyScoutingMvp`
- `FE_SCOUT02BResolveReturnMove`
- `FE_SCOUT02DGenerateSweepCandidates`
- `FE_SCOUT02DAssignNextSweepPoint`
- `FE_SCOUT02EChooseOutboundTarget`
- `FE_INTEL01Init`
- `FE_INTEL01UpdateFromScout`
- `FE_INTEL01UpdateFromTankVision`
- `FE_INTEL01UpdateFromCombatContact`
- `FE_ATTACK12EvaluateAttackDecision`
- `FE_ATTACK11ChooseIntelTarget`
- `FE_PATCH_10B*` functions
- `updateEnemyBot`
- `damageUnit`
- Any pathfinding/findPath/inBounds/adjacentFreeCellsForRect
- Any production/economy functions

## Next steps (05A2)

05A2 may audit/delegate `FE_INTEL01Init` / `FE_PATCH_10BCreateEnemyKnowledge`
if safe. This would involve:
1. Adding delegation in main.js wrappers
2. Verifying factory output matches legacy shapes via validators
3. Fallback to legacy inline code if module unavailable

## Verification

- `node --check src/ai/enemy_intel.js` — pass
- `node --check src/main.js` — pass
- `node --check src/config/runtime_flags.js` — pass
- `npm run test:e2e` — 6/6 pass
