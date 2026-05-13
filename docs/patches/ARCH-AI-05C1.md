# ARCH-AI-05C1 — Tank Decider Contract / Rule Update

**Date:** 2026-05-14
**PR:** #90
**Branch:** glm/arch-lab-05c1-v2-tank-decider-contract
**Scope:** tank_decider.js contract/rule update — no main.js changes, no runtime behavior change
**Depends on:** ARCH-AI-05C-DESIGN (merged PR #89)
**Next step:** ARCH-AI-05C2 — Context builder / wiring improvements

## Summary

This patch updates the `src/ai/tank_decider.js` module contract and rules without changing runtime behavior. The module is still disabled (`FE_TANK_DECIDER_ENABLED = false`). Changes are additive-only: new enums, a new rule, a factory function, and validators. No existing rule logic is removed.

---

## 1. Changes

### 1.1 TANK_DECIDER_ACTIONS enum

Frozen object mapping action names to string values. Replaces inline string literals in rule return objects. No new action value — `stand_and_fight` reuses `KEEP_ATTACKING` and is distinguished by `ruleName`.

| Key | Value |
|-----|-------|
| DEFEND_HQ | `'defend_hq'` |
| KEEP_ATTACKING | `'keep_attacking'` |
| RETREAT | `'retreat'` |
| IDLE | `'idle'` |

### 1.2 TANK_DECIDER_RULE_NAMES enum

Frozen object mapping rule names to string values. Replaces inline string literals in rule return objects and RULES array.

| Key | Value |
|-----|-------|
| DEFEND_HQ_IF_BASE_THREATENED | `'defend_hq_if_base_threatened'` |
| STAND_AND_FIGHT_NEAR_HOME | `'stand_and_fight_near_home'` |
| RETREAT_IF_LOSING_OR_OVEREXTENDED | `'retreat_if_losing_or_overextended'` |
| KEEP_ATTACKING_VALID_CURRENT_TARGET | `'keep_attacking_valid_current_target'` |
| IDLE_FALLBACK | `'idle_fallback'` |

### 1.3 TANK_DECIDER_CONSTANTS enum

Frozen object with numeric thresholds. Replaces magic numbers in rule implementations. Mirrors `FE_DEFENSE_RETREAT_01_*` constants from main.js.

| Key | Value | Mirrors |
|-----|-------|---------|
| NEAR_HOME_RADIUS | 6 | `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS` |
| NEAR_RANGE_MARGIN | 2 | `FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN` |
| DEFEND_HQ_NEAR_HOME | 15 | defend_hq `distToHome <= 15` guard |
| RETREAT_HP_CRITICAL | 0.25 | retreat "very low HP" threshold |
| RETREAT_HP_OUTNUMBERED | 0.6 | retreat "outnumbered + low HP" threshold |
| RETREAT_HP_OVEREXTENDED | 0.55 | retreat "overextended + low HP" threshold |
| OUTNUMBERED_RADIUS | 8 | retreat outnumbered scan radius |
| OUTNUMBERED_THRESHOLD | 2 | player tanks needed for outnumbered |
| OVEREXTENDED_DISTANCE | 20 | retreat overextended distance threshold |
| NEARBY_THREATS_RADIUS | 12 | main.js context builder scan radius |

### 1.4 stand_and_fight_near_home rule (priority 95)

New rule inserted between defend_hq (100) and retreat (90) in the priority stack.

**Conditions:**
1. Tank has `attackApproachTargetId` or `attackTargetId`
2. Target is alive (via `helpers.isAlive`)
3. Tank is near home (≤ `NEAR_HOME_RADIUS` tiles from homeBase)
4. Target is in or near range (≤ `stats.range + NEAR_RANGE_MARGIN`)

**Result:**
- `action: 'keep_attacking'` (NOT a new action value — reuses KEEP_ATTACKING)
- `ruleName: 'stand_and_fight_near_home'` (distinguishes this case in telemetry)
- `suppressLegacyOrders: true` (prevents legacy 10H1 from overwriting)

**Design rationale:** Per ARCH-AI-05C-DESIGN Section 6.1, stand_and_fight_near_home is a separate rule at priority 95 that produces an explicit result (instead of retreat returning null). This improves telemetry visibility and correctly models the tactical priority: defend HQ first, then keep fighting if near home, then retreat if losing. The rule uses `KEEP_ATTACKING` action because execution in main.js is identical to keep_attacking (mark as managed, suppress legacy). The `ruleName` field provides the distinction for telemetry and debugging.

**Safety note:** The existing stand-and-fight early-return guard in `evaluateRetreat` (pre-05C1 lines ~114-126) is **retained** as a safety fallback. It provides defense-in-depth against any future priority ordering changes. Removal is deferred to 05C2/05C3.

### 1.5 createDecisionResult factory

Standardized factory function for decision result objects. All rules now use this factory instead of inline object literals. Ensures consistent shape and safe defaults.

### 1.6 Validators

- `isValidDecisionResult(result)` — validates result shape and known action value
- `isValidContext(context)` — validates minimum required context shape

### 1.7 Updated exports

`window.FE_TANK_DECIDER` now exposes:
- `evaluateTankDecision` (existing)
- `createDecisionResult` (new)
- `isValidDecisionResult` (new)
- `isValidContext` (new)
- `TANK_DECIDER_ACTIONS` (new)
- `TANK_DECIDER_RULE_NAMES` (new)
- `TANK_DECIDER_CONSTANTS` (new)

---

## 2. Updated Priority Stack

| Priority | Rule Name | Action | Condition Summary |
|----------|-----------|--------|-------------------|
| 100 | defend_hq_if_base_threatened | DEFEND_HQ | Player threats near enemy HQ; tank near home or idle; not wave-locked; not on hq_push |
| 95 | stand_and_fight_near_home | KEEP_ATTACKING | Tank near home with valid target in/near range; should keep fighting |
| 90 | retreat_if_losing_or_overextended | RETREAT | HP critically low, or outnumbered and weakened, or overextended and weakened |
| 80 | keep_attacking_valid_current_target | KEEP_ATTACKING | Tank has valid attack/approach target, target alive, in attack state |
| 10 | idle_fallback | IDLE | No rule matched; let legacy handle |

---

## 3. Updated Context Shape

No changes to the context shape in this patch. Context is built in main.js wiring and remains unchanged. Future 05C2 may extend the context with additional fields (playerThreatEstimate, enemyTankCount, etc.).

---

## 4. Updated Result Shape

```javascript
{
  action:              string,  // TANK_DECIDER_ACTIONS value
  priority:            number,  // rule priority (100, 95, 90, 80, 10)
  reason:              string,  // human-readable reason
  targetId:            any,     // target unit ID or null
  targetX:             number,  // target X or null
  targetY:             number,  // target Y or null
  ruleName:            string,  // TANK_DECIDER_RULE_NAMES value
  suppressLegacyOrders: boolean, // whether to suppress legacy 10H1 overwrite
  telemetry:           object   // { evaluatedRules: number }
}
```

The shape is identical to pre-05C1. The `action` field values are the same four strings; `stand_and_fight_near_home` produces `action: 'keep_attacking'`.

---

## 5. Gap List Status After 05C1

| Gap (from 05C-DESIGN) | Status After 05C1 |
|------------------------|-------------------|
| Gap 1: Regroup state management | Unchanged — deferred to 05C2/05C3 |
| Gap 2: state.phase ownership | Unchanged — deferred to 05C2/05C3 |
| Gap 3: retreatCooldownUntil ownership | Unchanged — deferred to 05C2/05C3 |
| Gap 4: hq_push graduated logic | Unchanged — deferred to 05C2/05C3 |
| Gap 5: DEFENSE_RETREAT01 overlap | **Partially addressed** — stand_and_fight_near_home rule now explicitly produces a decision result at priority 95, matching the legacy guard's conditions. Legacy guard in evaluateRetreat retained as safety fallback. Full migration (unitDistanceCells vs distTiles) deferred to 05C2. |
| Gap 6: Bulk-vs-per-tank divergence | Unchanged — deferred to 05C3+ |
| Gap 7: Telemetry compatibility | Unchanged — deferred to 05C2 |
| Gap 8: Threat collection dependency | Unchanged — deferred to 05C4 |

---

## 6. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/ai/tank_decider.js` | MOD | Added TANK_DECIDER_ACTIONS, TANK_DECIDER_RULE_NAMES, TANK_DECIDER_CONSTANTS enums; added stand_and_fight_near_home rule at priority 95; added createDecisionResult factory; added isValidDecisionResult/isValidContext validators; replaced magic numbers with constant references; replaced string literals with enum references; updated window.FE_TANK_DECIDER exports |
| `docs/patches/ARCH-AI-05C1.md` | NEW | This patch document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-AI-05C1 entry |

## Files NOT Touched

- `src/main.js` — no changes
- `src/config/runtime_flags.js` — no changes (FE_TANK_DECIDER_ENABLED stays false)
- `src/ai/enemy_targeting.js` — no changes
- `src/ai/enemy_intel.js` — no changes
- `index.html` — no changes
- `tests/` — no changes
- `assets/` — no changes
- `package.json` / `package-lock.json` / `bun.lock` — no changes

---

## No Behavior Changes

- FE_TANK_DECIDER_ENABLED remains false — no runtime behavior change
- All rule logic produces identical results when enabled (same actions, same conditions)
- The evaluateRetreat stand-and-fight guard is retained (safety fallback)
- No main.js changes
- No runtime_flags.js changes

---

## Verification

```bash
node --check src/ai/tank_decider.js
node --check src/main.js
node --check src/config/runtime_flags.js
npm run test:e2e
```

- `git diff --name-only origin/sandbox/main...HEAD` should show only the 3 allowed files
- `git diff origin/sandbox/main...HEAD -- src/main.js` should be empty
