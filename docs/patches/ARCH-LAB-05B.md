# ARCH-LAB-05B — Enemy Targeting Contract + Pure Decision Functions

**Date:** 2026-05-13
**PR:** #86
**Branch:** `glm/arch-lab-05b-enemy-targeting-contract`
**Scope:** Contract-only + pure decision functions — no main.js changes, no runtime behavior changes

## Summary

Create `src/ai/enemy_targeting.js` as a pure module exposing `window.FE_ENEMY_TARGETING` with
constants, factory functions, validators, and two pure decision functions that mirror the
current ATTACK-11 and ATTACK-12 logic in main.js.

This PR is **additive only**. The module is runtime-unwired — no delegation from main.js
to `FE_ENEMY_TARGETING`. Runtime behavior is unchanged. 05B2 may audit and wire delegation later.

## What was added

### Constants

| Constant | Keys | Mirrors |
|----------|------|---------|
| `ATTACK_TARGET_SOURCES` | CONFIRMED_HQ, ESTIMATED_HQ | `targetSource` field values in `FE_ATTACK11ChooseIntelTarget` |
| `ATTACK_DECISION_RESULTS` | ALLOW, DELAY | `decision` field values in `FE_ATTACK12EvaluateAttackDecision` |
| `ATTACK_DELAY_REASONS` | NO_INTEL, STALE_INTEL, TOO_FEW_TANKS, ENEMY_OUTNUMBERED, FAVORABLE_INTEL | `reason` field values in `FE_ATTACK12EvaluateAttackDecision` |
| `ATTACK12_DEFAULTS` | MAX_INTEL_AGE_SEC: 180, MIN_ATTACK_TANKS: 2, FORCE_ADVANTAGE: 1 | `FE_ATTACK12_*` vars at main.js lines 2551–2553 |

### Factory functions

| Function | Mirrors | Notes |
|----------|---------|-------|
| `createAttackTargetResult(props)` | ATTACK-11 return shape | 7 fields: targetX, targetY, targetSource, targetReason, intelFreshnessSec, playerHqSeen, playerHqEstimateAvailable |
| `createAttackDecisionResult(props)` | ATTACK-12 return shape | full ATTACK-12 result shape matching `FE_ATTACK12EvaluateAttackDecision` return exactly |

### Pure decision functions

| Function | Mirrors | Params | Notes |
|----------|---------|--------|-------|
| `chooseIntelTarget(intel, now)` | `FE_ATTACK11ChooseIntelTarget()` | `intel` (game.enemyIntel), `now` (game.time) | Returns same 7-field object or null. Confirmed HQ has priority over estimate. All strings and calculations preserved exactly. |
| `evaluateAttackDecision(intel, tankStatuses, now, options)` | `FE_ATTACK12EvaluateAttackDecision(enemyTanks, now)` | `intel`, `tankStatuses` (pre-computed array), `now`, `options` | Returns the full ATTACK-12 result shape. `tankStatuses` entries: `{isAlive, isIntelRally, isWaveLocked, hasAttackTargetId, hasAttackApproachTargetId}`. `options`: `{attack11DispatchSource, maxIntelAgeSec, minAttackTanks, forceAdvantage}`. |

### Validators

| Function | Returns | Style |
|----------|---------|-------|
| `isValidAttackTargetResult(obj)` | `true` or descriptive string error | Same pattern as combat_system/enemy_intel validators |
| `isValidAttackDecisionResult(obj)` | `true` or descriptive string error | Checks the full ATTACK-12 result shape including type checks |

## What was NOT added (explicitly excluded)

- Attack execution helpers (rally dispatch, order issuance)
- Wave helpers (ATTACK-10 CreateWave, ReleaseWave, IsWaveLocked)
- hq_push helpers (IsHqPushValid, hq_push state marking)
- Pathfinding helpers
- Scout lifecycle helpers
- Tank decider changes
- Runtime wiring / delegation from main.js
- Feature flags
- Any runtime behavior changes

## Files changed

| File | Action | Description |
|------|--------|-------------|
| `src/ai/enemy_targeting.js` | NEW | Pure constants, factories, validators, and pure decision functions |
| `index.html` | MOD | Added script tag for enemy_targeting.js after enemy_intel.js, before command_system.js |
| `src/ai/README.md` | MOD | Documented enemy_targeting.js as existing module |
| `docs/patches/ARCH-LAB-05B.md` | NEW | This document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-05B entry |

## Files NOT touched

- `src/main.js` — **no changes**
- `src/ai/enemy_intel.js` — no changes
- `src/ai/tank_decider.js` — no changes
- `src/systems/**` — no changes
- `src/core/**` — no changes
- `src/game/**` — no changes
- `src/config/runtime_flags.js` — no changes
- `tests/` — no changes
- `assets/` — no changes

## No attack/intel/bot runtime functions touched

- `FE_ATTACK11ChooseIntelTarget` — untouched
- `FE_ATTACK12EvaluateAttackDecision` — untouched
- `FE_PATCH_08BPrepareAttack` — untouched
- `FE_ATTACK10*` family — untouched
- `FE_PATCH_08BSilentMoveTo` — untouched
- `FE_PATCH_08BCommandEnemyTankAttack` — untouched
- `FE_PATCH_08BReturnUnitHome` — untouched
- `FE_INTEL01Init` — untouched
- `FE_INTEL01UpdateFromScout` — untouched
- `FE_INTEL01UpdateFromTankVision` — untouched
- `FE_INTEL01UpdateFromCombatContact` — untouched
- `FE_SCOUT01UpdateEnemyScoutBehavior` — untouched
- `FE_10C1_trySetScoutMove` — untouched
- `FE_10C1_updateEnemyScoutingMvp` — untouched
- `updateEnemyBot` — untouched
- `FE_TANK_DECIDER` / `FE_TANK_DECIDER_ENABLED` — untouched
- Any pathfinding / production / economy / combat / render / input / save/load — untouched

## Architecture KPI

| Metric | Value |
|--------|-------|
| main.js lines before | 15,730 |
| main.js lines after | 15,730 |
| net delta | 0 |
| functions changed in main.js | 0 |
| functions removed from main.js | 0 |
| whether this step reduces main.js | No — preparatory |
| future reduction path | 05B2 wiring + LAB-07/08 fallback cleanup |

## Field-by-field verification

### ATTACK-11 result shape (chooseIntelTarget)

| Field | Module default | Legacy (main.js) | Match? |
|-------|---------------|-------------------|--------|
| `targetX` | null | intel.playerHqCenterX or intel.playerHqEstimateCenterX | Yes |
| `targetY` | null | intel.playerHqCenterY or intel.playerHqEstimateCenterY | Yes |
| `targetSource` | '' | 'confirmed_hq' or 'estimated_hq' | Yes |
| `targetReason` | '' | 'scout_confirmed_player_hq' or 'scout_estimate_player_hq' | Yes |
| `intelFreshnessSec` | -1 | calculated from intel timestamps | Yes |
| `playerHqSeen` | false | boolean | Yes |
| `playerHqEstimateAvailable` | false | boolean | Yes |

### ATTACK-12 result shape (evaluateAttackDecision)

The full ATTACK-12 result shape matches FE_ATTACK12EvaluateAttackDecision return exactly:
attackAllowed, decision, reason, readyEnemyTanks, assignableEnemyTanks,
skippedAssignedAttackTargetCount, skippedAttackApproachCount,
knownPlayerLightTanks, knownPlayerHarvesters, playerHqSeen,
playerHqEstimateAvailable, hqIntelAvailable, forceIntelKnown,
forceIntelFresh, forceIntelAgeSec, intelFreshnessSec,
lastUsefulIntelAt, lastScoutSweepDoneAt, requiredTanks,
forceAdvantageRequired, attack11DispatchSource, gateApplied,
skippedBecauseActiveAttack.

### Decision logic match

- Priority 1: confirmed HQ (playerHqSeen + finite centerX/Y) → 'confirmed_hq'
- Priority 2: estimated HQ (estimateCenterX/Y != null) → 'estimated_hq'
- No usable intel → null
- Attack gate: no intel → delay_no_intel; stale intel → delay_stale_intel;
  too few tanks → delay_too_few_tanks; outnumbered → delay_enemy_outnumbered;
  all clear → allow + allow_favorable_intel

All strings and logic preserved exactly.

## Next steps (05B2)

05B2 may audit and wire delegation from main.js to FE_ENEMY_TARGETING:
1. Add delegation guards in `FE_ATTACK11ChooseIntelTarget()` and `FE_ATTACK12EvaluateAttackDecision()`
2. Caller pre-computes `tankStatuses` array from `enemyTanks`
3. Caller passes `options` with constants and dispatch source
4. Legacy fallback preserved for when module is missing
5. Estimated main.js delta: +20 to +30 lines (adapter code)

## Verification

- `node --check src/ai/enemy_targeting.js` — pass
- `node --check src/main.js` — pass (unchanged)
- `node --check src/config/runtime_flags.js` — pass
- `npm run test:e2e` — 6/6 pass
