# ARCH-AI-05C2B — Tank Decider Gated Telemetry / Rule-Name Wiring

**Date:** 2026-05-14
**PR:** #91
**Branch:** glm/arch-ai-05c2b-tank-decider-telemetry
**Scope:** src/main.js telemetry hardening — gated behind FE_TANK_DECIDER_ENABLED (remains false)
**Risk:** MEDIUM (src/main.js is touched)
**Depends on:** ARCH-AI-05C1 (merged PR #90)
**Next step:** ARCH-AI-05C3 — enable flag after QA criteria are met

## Summary

This patch adds per-rule-name telemetry and tank-level rule-name tracking to the existing `FE_TANK_DECIDER_ENABLED=true` gated block in `src/main.js`. It does NOT change runtime behavior — the feature flag remains false by default. The existing `perRuleCounts` action-based counters are preserved unchanged for backward compatibility.

The key insight: both `stand_and_fight_near_home` and `keep_attacking_valid_current_target` produce `action: 'keep_attacking'`. Without `perRuleNameCounts`, these two distinct tactical situations are indistinguishable in telemetry. This patch resolves that by tracking decisions by rule name in addition to action.

---

## 1. Changes

### 1.1 perRuleNameCounts telemetry object

Added alongside `perRuleCounts` in both the enabled and disabled telemetry init paths. Keys match `TANK_DECIDER_RULE_NAMES` values from `tank_decider.js`:

| Key | Initial Value |
|-----|---------------|
| `defend_hq_if_base_threatened` | 0 |
| `stand_and_fight_near_home` | 0 |
| `retreat_if_losing_or_overextended` | 0 |
| `keep_attacking_valid_current_target` | 0 |
| `idle_fallback` | 0 |

The disabled-branch telemetry init also includes the same `perRuleNameCounts` shape for consistent debug inspection even when the decider is off.

### 1.2 perRuleNameCounts increment

After each per-tank decision evaluation (after all execution branches and perRuleCounts updates), the code increments the appropriate rule-name key:

```javascript
if (_tdResult.ruleName && _tdTelm.perRuleNameCounts) {
  _tdTelm.perRuleNameCounts[_tdResult.ruleName] = (_tdTelm.perRuleNameCounts[_tdResult.ruleName] || 0) + 1;
}
```

This runs for all decisions including idle. The guard `if (_tdResult.ruleName && _tdTelm.perRuleNameCounts)` ensures graceful degradation if either field is missing.

### 1.3 _tankDeciderLastRuleName on managed tanks

Added `_tankDeciderLastRuleName` alongside `_tankDeciderLastAction` on each tank that receives `_tankDeciderManagedAt`. Set in the three managed execution branches:

- `defend_hq` branch: `_tdTank._tankDeciderLastRuleName = _tdResult.ruleName || '';`
- `retreat` branch: `_tdTank._tankDeciderLastRuleName = _tdResult.ruleName || '';`
- `keep_attacking` branch: `_tdTank._tankDeciderLastRuleName = _tdResult.ruleName || '';`

Idle tanks are NOT managed (no `_tankDeciderManagedAt`), so they do NOT receive `_tankDeciderLastRuleName`.

### 1.4 Existing perRuleCounts preserved

The existing `perRuleCounts` object and all its increment sites are completely unchanged. Both counters coexist:
- `perRuleCounts` — action-based (defend_hq, retreat, keep_attacking, idle)
- `perRuleNameCounts` — rule-name-based (5 rule names)

---

## 2. Execution Behavior

No execution path changes. The `keep_attacking` action branch remains the single execution path for both `stand_and_fight_near_home` and `keep_attacking_valid_current_target`. No separate `stand_and_fight` action or execution branch is added.

---

## 3. Manual QA Path

When `FE_TANK_DECIDER_ENABLED` is false (default), none of these changes execute at runtime. To verify:

```javascript
// 1. Enable the decider in browser console
window.FE_TANK_DECIDER_ENABLED = true;

// 2. Play a skirmish — let enemy tanks encounter player forces near their HQ

// 3. Inspect telemetry
game._tankDecider01.enabled          // should be true
game._tankDecider01.perRuleCounts    // action-based counts (existing)
game._tankDecider01.perRuleNameCounts // rule-name-based counts (new)
game._tankDecider01.lastDecision.ruleName  // last decision's rule name

// 4. Inspect a managed tank
// Find any enemy light_tank with _tankDeciderManagedAt
var tank = game.units.find(function(u) { return u._tankDeciderManagedAt; });
tank._tankDeciderLastAction   // 'defend_hq' | 'retreat' | 'keep_attacking'
tank._tankDeciderLastRuleName // 'defend_hq_if_base_threatened' | 'stand_and_fight_near_home' | etc.

// 5. Verify stand_and_fight_near_home is distinguishable
// When a tank is fighting near home with a valid target,
// perRuleNameCounts.stand_and_fight_near_home should increment
// while perRuleCounts.keep_attacking also increments
```

---

## 4. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/main.js` | MOD | Added perRuleNameCounts to telemetry init (enabled+disabled branches); added perRuleNameCounts increment after execution branches; added _tankDeciderLastRuleName on managed tanks in defend_hq/retreat/keep_attacking branches |
| `docs/patches/ARCH-AI-05C2B.md` | NEW | This patch document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-AI-05C2B entry |

## Files NOT Touched

- `src/ai/tank_decider.js` — no changes
- `src/config/runtime_flags.js` — no changes (FE_TANK_DECIDER_ENABLED stays false)
- `src/ai/enemy_targeting.js` — no changes
- `src/ai/enemy_intel.js` — no changes
- `index.html` — no changes
- `tests/` — no changes
- `assets/` — no changes
- `package.json` / `package-lock.json` / `bun.lock` — no changes

---

## 5. What Was NOT Implemented (explicitly out of scope)

- FE_TANK_DECIDER_ENABLED default change
- runtime_flags.js changes
- Context builder expansion (unitDistanceCells, playerThreatEstimate, enemyTankCount)
- suppressedLegacyBlocks wiring
- game.enemyRetreatMvp telemetry bridge
- evaluateRetreat safety guard removal
- FE_10H1 legacy removal
- Any pathfinding / attack-wave / hq_push / scout / economy / render / input / save-load changes
- Separate stand_and_fight action or execution branch

---

## 6. main.js Line Count

| Metric | Value |
|--------|-------|
| Before | 15,639 |
| After | 15,650 |
| Delta | +11 |

---

## 7. No Behavior Changes

- FE_TANK_DECIDER_ENABLED remains false — no runtime behavior change
- When enabled via console, telemetry is richer but execution is identical
- Existing perRuleCounts are preserved unchanged
- The KEEP_ATTACKING execution branch handles both stand_and_fight_near_home and keep_attacking_valid_current_target
- No legacy 10H1 code is touched
- No context builder expansion

---

## 8. Verification

```bash
git diff --name-only origin/sandbox/main...HEAD
node --check src/main.js
node --check src/ai/tank_decider.js
node --check src/config/runtime_flags.js
npm run test:e2e
```

- `git diff --name-only` should show only the 3 allowed files
- `git diff origin/sandbox/main...HEAD -- src/config/runtime_flags.js` should be empty
- `git diff origin/sandbox/main...HEAD -- src/ai/tank_decider.js` should be empty
