# ARCH-AI-05C3 — Tank Decider Enable by Default with Intel-Rally Safety Guard

**Date:** 2026-05-14
**PR:** #92
**Branch:** glm/arch-ai-05c3-tank-decider-enable
**Scope:** Enable FE_TANK_DECIDER_ENABLED by default + intel-rally safety guard in tank_decider.js
**Risk:** HIGH-CONTROLLED (default behavior change, but legacy fallback remains and no execution/pathfinding/attack-wave changes)
**Depends on:** ARCH-AI-05C2B (merged PR #91)
**Next step:** ARCH-AI-05C4 — remove legacy FE_10H1 code (after sustained QA with decider enabled)

## Summary

This patch enables the tank_decider Priority Stack by default for enemy light_tank decisions. It flips `FE_TANK_DECIDER_ENABLED` from `false` to `true` in `runtime_flags.js` and adds a minimal safety guard in `evaluateDefendHq` to prevent intel-rally tanks from being recalled for base defense.

The legacy FE_10H1 code in `main.js` is completely untouched. Tanks that receive an `idle` decision from the decider (with `suppressLegacyOrders=false`) still fall through to legacy behavior. Rollback is a one-line flag revert.

No changes to `src/main.js`, attack-wave dispatch, hq_push execution, pathfinding, combat, scout, economy, render, input, or save/load.

---

## 1. Changes

### 1.1 runtime_flags.js — FE_TANK_DECIDER_ENABLED = true

Changed the default from `false` to `true`:

```javascript
// Before (05C2B):
window.FE_TANK_DECIDER_ENABLED = false;

// After (05C3):
window.FE_TANK_DECIDER_ENABLED = true;
```

Comments updated to document the new default, explain that legacy fallback remains active for unmanaged tanks, and note that rollback is a one-line flag revert.

### 1.2 tank_decider.js — Intel-rally safety guard in evaluateDefendHq

Added an early return in `evaluateDefendHq` after tank extraction, before wave-locked check:

```javascript
// Intel-rally tanks are gathering for an attack wave — do not recall for base defense.
// This prevents defend_hq from pulling tanks that are committed to an intel-based rally.
if (tank._attack11IntelRally) return null;
```

**Rationale:** When the decider becomes default-enabled, `evaluateDefendHq` (priority 100) would be the first rule evaluated. Without this guard, intel-rally tanks (which have `_attack11IntelRally` set by ATTACK-11 dispatch) could be recalled to defend HQ instead of staying at the rally point. This is the clearest known blocker for safe enable.

The context builder in main.js already passes `tank._attack11IntelRally` (line 7532), so no main.js changes are needed.

### 1.3 tank_decider.js — Updated header and JSDoc

- Header comment updated with 05C3 changes section
- `evaluateDefendHq` JSDoc updated to document intel-rally guard

---

## 2. Execution Behavior

With `FE_TANK_DECIDER_ENABLED = true`, enemy light_tank decisions now go through the Priority Stack by default:

1. **defend_hq_if_base_threatened** (priority 100) — recalled for HQ defense, EXCEPT intel-rally / wave-locked / hq_push / already-fighting-near-home tanks
2. **stand_and_fight_near_home** (priority 95) — keep fighting if near home with valid target in range
3. **retreat_if_losing_or_overextended** (priority 90) — retreat low-HP / outnumbered / overextended tanks
4. **keep_attacking_valid_current_target** (priority 80) — continue current attack if target valid and path exists
5. **idle_fallback** (priority 10) — no decider match; `suppressLegacyOrders=false` so legacy FE_10H1 handles it

Legacy FE_10H1 code still runs for tanks not managed by the decider (idle result). Tanks with `suppressLegacyOrders=true` have legacy overwrite suppressed.

---

## 3. Manual QA

Boot the game with default settings (flag is now true by default):

```javascript
// 1. Verify flag is enabled
window.FE_TANK_DECIDER_ENABLED  // should be true

// 2. Verify game starts and plays normally
// - Enemy produces tanks
// - Enemy attacks player base
// - Enemy defends HQ when threatened
// - Enemy retreats low-HP tanks

// 3. Verify decider telemetry is active
game._tankDecider01.enabled           // should be true
game._tankDecider01.perRuleCounts     // should show counts after enemy actions
game._tankDecider01.perRuleNameCounts // should show rule-name counts

// 4. Verify stand_and_fight_near_home appears
// When a tank is fighting near its own HQ with a valid target:
game._tankDecider01.perRuleNameCounts.stand_and_fight_near_home  // should be > 0

// 5. Verify intel-rally tanks are NOT recalled by defend_hq
// During an active attack wave with intel-rally tanks:
var rallyTank = game.units.find(function(u) { return u._attack11IntelRally; });
if (rallyTank) {
  rallyTank._tankDeciderLastAction   // should NOT be 'defend_hq'
  rallyTank._tankDeciderLastRuleName // should NOT be 'defend_hq_if_base_threatened'
}

// 6. Verify hq_push tanks are NOT recalled incorrectly
// During hq_push:
var hqPushActive = game._botAttack11 && game._botAttack11._attack02HqPush;
// hq_push tanks should keep attacking, not get recalled

// 7. Verify no console errors
// Open browser console — no uncaught exceptions from tank_decider.js

// 8. Rollback test (if needed)
window.FE_TANK_DECIDER_ENABLED = false;  // instant rollback to legacy behavior
```

---

## 4. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/config/runtime_flags.js` | MOD | Changed FE_TANK_DECIDER_ENABLED from false to true; updated comments |
| `src/ai/tank_decider.js` | MOD | Added intel-rally safety guard in evaluateDefendHq; updated header and JSDoc |
| `docs/patches/ARCH-AI-05C3.md` | NEW | This patch document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-AI-05C3 entry |

## Files NOT Touched

- `src/main.js` — no changes (line count unchanged: 15,650)
- `src/ai/enemy_targeting.js` — no changes
- `src/ai/enemy_intel.js` — no changes
- `index.html` — no changes
- `tests/` — no changes
- `assets/` — no changes
- `package.json` / `package-lock.json` — no changes

---

## 5. What Was NOT Implemented (explicitly out of scope)

- suppressedLegacyBlocks wiring
- game.enemyRetreatMvp telemetry bridge
- evaluateRetreat safety guard removal
- FE_10H1 legacy code removal
- New stand_and_fight action
- Context builder expansion
- playerThreatEstimate / enemyTankCount
- unitDistanceCells helper
- Any pathfinding / attack-wave / hq_push / scout / economy / render / input / save-load changes

---

## 6. main.js Line Count

| Metric | Value |
|--------|-------|
| Before | 15,650 |
| After | 15,650 |
| Delta | 0 |

No changes to main.js.

---

## 7. Safety Mechanisms

1. **Legacy fallback preserved:** Tanks with `idle` result have `suppressLegacyOrders=false`, so legacy FE_10H1 still handles them
2. **Intel-rally guard:** `_attack11IntelRally` tanks cannot be recalled by defend_hq
3. **Wave-locked guard:** `_attack10WaveLocked` tanks cannot be recalled or retreated
4. **hq_push guard:** `_attack02HqPush` state prevents defend_hq recall
5. **Stand-and-fight safety fallback:** evaluateRetreat retains its stand-and-fight guard
6. **One-line rollback:** `window.FE_TANK_DECIDER_ENABLED = false` restores legacy behavior

---

## 8. Verification

```bash
git diff --name-only origin/sandbox/main...HEAD
node --check src/config/runtime_flags.js
node --check src/ai/tank_decider.js
node --check src/main.js
npm run test:e2e
```

- `git diff --name-only` should show only the 4 allowed files
- `git diff origin/sandbox/main...HEAD -- src/main.js` should be empty
- `git diff origin/sandbox/main...HEAD -- src/config/runtime_flags.js` should show FE_TANK_DECIDER_ENABLED = true
- `git diff origin/sandbox/main...HEAD -- src/ai/tank_decider.js` should show intel-rally guard addition
