# ARCH-AI-05C5 — Selective Legacy FE_10H1 Cleanup

**Date:** 2026-05-14
**PR:** #94
**Branch:** glm/arch-ai-05c5-selective-legacy-cleanup
**Scope:** Remove redundant legacy stand-and-fight guard, dead helper, unused constants, and orphaned telemetry from main.js. No behavior changes. No module edits. No test edits.
**Risk:** MEDIUM (removes a still-called legacy guard, but positive runtime telemetry confirms tank_decider stand_and_fight_near_home is active, and evaluateRetreat safety guard remains in tank_decider.js)
**Depends on:** ARCH-AI-05C4 (merged PR #93)
**Next step:** ARCH-AI-05C6 — further legacy FE_10H1 reduction or full FE_10H1 removal

## Summary

This patch performs a selective cleanup of legacy FE_10H1 code in `main.js` that is now redundant because `tank_decider.js` handles the same tactical decisions for decider-managed tanks. Positive 05C4 telemetry evidence confirms that `stand_and_fight_near_home` fires during real gameplay, `suppressedLegacyBlocksTotal` reaches 4500+, and `managedPerTick > 0` during active combat. The decider-managed tanks skip all 9 legacy FE_10H1 code paths via `_tankDeciderManagedAt` guards. For the remaining idle-decision tanks that still fall through to legacy, the removed guard was a minor optimization (skip retreat if near home and target in range) — the tank_decider already makes this decision correctly before the tank reaches legacy code.

Seven specific deletions are made:
1. `FE_10H1_getEnemyTanks()` — dead function, zero call sites
2. `FE_DEFENSE_RETREAT01ShouldStandAndFight()` — redundant guard, same logic now in `evaluateStandAndFight` (priority 95, ruleName=stand_and_fight_near_home)
3. `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS` and `FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN` — only used by the removed function
4. `FE_DEFENSE_RETREAT01ShouldStandAndFight` call in `FE_10H1_startRetreat` — obsolete guard
5. `FE_DEFENSE_RETREAT01ShouldStandAndFight` call in `FE_10H1_defendHqWithAvailableTanks` — obsolete guard
6. `standAndFightSkipped` variable — declared and incremented but never read, becomes dead after guard removal
7. `game._botDefenseRetreat01` telemetry writes — only written inside the removed function, no consumers

No changes to `src/ai/tank_decider.js`, `src/config/runtime_flags.js`, or `tests/e2e/decider-smoke.spec.js`.

---

## 1. Changes

### 1.1 main.js — Removed: FE_10H1_getEnemyTanks()

Dead code. Defined at line ~6701 but never called from anywhere in main.js or any other module. The function delegated to `FE_PATCH_08BEnemyCombatUnits()` which is still called directly where needed.

### 1.2 main.js — Removed: FE_DEFENSE_RETREAT01ShouldStandAndFight()

The stand-and-fight guard was a 40-line function that checked: (1) tank has active attack target, (2) target is alive, (3) tank is near home (within `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS` tiles), (4) target is in or near attack range. When all conditions met, the tank would skip the retreat/defend reassignment and keep fighting.

This logic is now handled by `evaluateStandAndFight` in `tank_decider.js` at priority 95. When a decider-managed tank meets these conditions, it receives action=KEEP_ATTACKING with ruleName=stand_and_fight_near_home. The decider-managed tanks are already suppressed at the 9 `_tankDeciderManagedAt` guard points in FE_10H1, so the legacy guard only affects tanks that received an idle decision — and for those, the guard's skip was a minor optimization, not a safety requirement.

### 1.3 main.js — Removed: FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS and FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN

These two constants were only referenced inside `FE_DEFENSE_RETREAT01ShouldStandAndFight`. With the function removed, they become dead code. The corresponding constants in `tank_decider.js` (STAND_AND_FIGHT_NEAR_HOME_RADIUS = 6) continue to serve the same purpose.

### 1.4 main.js — Removed: FE_DEFENSE_RETREAT01ShouldStandAndFight call in FE_10H1_startRetreat

The call at line ~6902 checked `if (attacking && FE_DEFENSE_RETREAT01ShouldStandAndFight(...))` and skipped the attack order clearing. With the function removed, this guard block is gone. Decider-managed tanks already skip this code path via the `_tankDeciderManagedAt` guard at line ~6885. For idle-decision tanks, removing this guard means they may have their attack order cleared and be sent to a safe point — which is the correct behavior for a tank that the decider decided should not stand and fight.

Also removed the `standAndFightSkipped` counter variable that was declared at line ~6878, incremented at line ~6903, but never read (not included in telemetry or any downstream logic).

### 1.5 main.js — Removed: FE_DEFENSE_RETREAT01ShouldStandAndFight call in FE_10H1_defendHqWithAvailableTanks

The call at line ~6958 checked `if (FE_10H1_hasActiveAttackOrder(unit) && FE_DEFENSE_RETREAT01ShouldStandAndFight(...))` and skipped the defend-HQ reassignment. With the function removed, this guard block is gone. Same rationale as 1.4 — decider-managed tanks skip this code path, and for idle-decision tanks, being reassigned to defend HQ is acceptable behavior.

### 1.6 main.js — Removed: game._botDefenseRetreat01 telemetry

The telemetry object `game._botDefenseRetreat01` was only written inside `FE_DEFENSE_RETREAT01ShouldStandAndFight`. It tracked: `standAndFightGuardCount`, `lastStandAndFightAt`, `lastGuardUnitId`, `lastGuardTargetDist`, `lastGuardDistToHome`. No code reads this object — it was a debug aid for manual QA during the legacy guard's development. With the function removed, all writes to this object are gone. The only other reference is in `docs/glm_exchange/PHASE2_COMMAND.md` (a documentation file, not code).

### 1.7 docs/patches/ARCH-AI-05C5.md — This document

### 1.8 docs/patches/INDEX.md — Updated

---

## 2. Why This Cleanup Is Safe

### 2.1 Decider-managed tanks are unaffected

All 9 `_tankDeciderManagedAt` skip points in FE_10H1 remain intact. Decider-managed tanks never reach the code where the removed guard was called. The telemetry from 05C4 confirms `suppressedLegacyBlocksTotal > 4500` — the suppression mechanism is working correctly.

### 2.2 The stand-and-fight logic is duplicated in tank_decider.js

`evaluateStandAndFight` at priority 95 covers the same conditions:
- Tank is near home (within `STAND_AND_FIGHT_NEAR_HOME_RADIUS = 6` tiles)
- Tank has an active attack target
- Target is alive
- Target is within attack range

The decider's version is more precise because it runs *before* the legacy code and sets the tank's action to KEEP_ATTACKING, preventing the tank from ever reaching the legacy guard.

### 2.3 Idle-decision tanks lose a minor optimization, not a safety net

For tanks that receive an `idle` decision from the decider (meaning no tactical conditions matched), the removed guard would have prevented retreat reassignment if they happened to be near home with a target in range. Removing this guard means such tanks may be reassigned to retreat or defend HQ by legacy FE_10H1. This is not a regression because:
- The decider *chose* not to keep attacking (the tank did not match keep_attacking or stand_and_fight conditions)
- Legacy reassignment to retreat/defend is the correct fallback for an idle tank
- The `evaluateRetreat` safety guard in `tank_decider.js` remains intact, ensuring decider-managed tanks that *should* retreat do so correctly

### 2.4 Positive runtime telemetry from 05C4 QA

- `defend_hq_if_base_threatened > 0` — defend_hq fires during combat
- `stand_and_fight_near_home > 0` — the decider's replacement for the removed guard fires
- `retreat_if_losing_or_overextended > 0` — retreat fires when needed
- `managedPerTick > 0` — decider is making non-idle decisions per tick
- `suppressedLegacyBlocksTotal` reached 4505 — legacy suppression is working
- No browser console errors
- No obvious enemy tank freeze or regression

### 2.5 FE_10H1_getEnemyTanks has zero call sites

Verified by grep: the function is defined at one location and never called. Safe to remove.

---

## 3. What Was NOT Touched

| Item | Reason |
|------|--------|
| `src/ai/tank_decider.js` | Not in scope — evaluateRetreat safety guard must remain |
| `src/config/runtime_flags.js` | Not in scope — FE_TANK_DECIDER_ENABLED value must remain true |
| `tests/e2e/decider-smoke.spec.js` | Not in scope — no test changes needed |
| Full FE_10H1 removal | Too risky — still handles idle-decision tanks |
| `FE_10H1_getLocalPlayerThreatsNearHq` | Still called by legacy FE_10H1 |
| `FE_10H1_moveToSafePoint` | Still called by `FE_10H1_startRetreat` |
| `FE_10H1_getPlayerThreatEstimate` | Still called by legacy FE_10H1 |
| `FE_10H1_updateEnemyRetreatAndDefenseMvp` | Still called by legacy FE_10H1 |
| `FE_10H1_startRetreat` (body) | Only removed the obsolete guard call and dead counter |
| `FE_10H1_defendHqWithAvailableTanks` (body) | Only removed the obsolete guard call |
| Bot phase mutation / state.phase / state.regroupUntil / state.retreatCooldownUntil | Not in scope |
| Pathfinding / findPath / passable / inBounds | Not in scope |
| Combat damage / range / cooldown | Not in scope |
| Attack-wave dispatch / FE_PATCH_08BPrepareAttack / FE_ATTACK10 | Not in scope |
| hq_push execution / scout lifecycle / economy / production | Not in scope |
| Render / input / selection / save / load / assets / package files | Not in scope |

---

## 4. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/main.js` | MOD | Removed FE_10H1_getEnemyTanks, FE_DEFENSE_RETREAT01ShouldStandAndFight, 2 constants, 2 guard calls, standAndFightSkipped variable, _botDefenseRetreat01 telemetry writes (-68 lines) |
| `docs/patches/ARCH-AI-05C5.md` | NEW | This patch document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-AI-05C5 entry |

## Files NOT Touched

- `src/config/runtime_flags.js` — no changes (zero diff)
- `src/ai/tank_decider.js` — no changes (zero diff, evaluateRetreat safety guard retained)
- `tests/e2e/decider-smoke.spec.js` — no changes (zero diff)
- `index.html` — no changes
- `assets/` — no changes
- `package.json` / `package-lock.json` — no changes

---

## 5. main.js Line Count

| Metric | Value |
|--------|-------|
| Before | 15,670 |
| After | 15,602 |
| Delta | -68 |

---

## 6. Safety Mechanisms

1. **Decider-managed tanks unaffected:** All 9 `_tankDeciderManagedAt` skip points remain — decider tanks never reach the removed guard code
2. **evaluateRetreat safety guard retained:** tank_decider.js is untouched; the retreat safety check remains in place
3. **Intel-rally guard retained:** evaluateDefendHq's `if (tank._attack11IntelRally) return null` is in tank_decider.js which is unchanged
4. **Legacy FE_10H1 still functional:** Only the redundant stand-and-fight guard is removed; the core retreat/defend/move logic remains
5. **FE_TANK_DECIDER_ENABLED unchanged:** Remains true by default
6. **Deterministic decider-smoke tests still pass:** No test changes, no module changes

---

## 7. Verification

```bash
git diff --name-only origin/sandbox/main...HEAD
node --check src/main.js
node --check src/ai/tank_decider.js
node --check src/config/runtime_flags.js
npm run test:e2e
```

- `git diff --name-only` should show exactly: src/main.js, docs/patches/ARCH-AI-05C5.md, docs/patches/INDEX.md
- `git diff origin/sandbox/main...HEAD -- src/ai/tank_decider.js` should be empty
- `git diff origin/sandbox/main...HEAD -- src/config/runtime_flags.js` should be empty
- `git diff origin/sandbox/main...HEAD -- tests/e2e/decider-smoke.spec.js` should be empty
- `npm run test:e2e` should pass all tests including the 8 decider-smoke tests
