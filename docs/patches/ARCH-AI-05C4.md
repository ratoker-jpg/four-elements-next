# ARCH-AI-05C4 — Tank Decider Telemetry Instrumentation & QA

**Date:** 2026-05-14
**PR:** #93
**Branch:** glm/arch-ai-05c4-telemetry-instrumentation
**Scope:** Telemetry-only instrumentation + deterministic decider smoke test + docs. No behavior changes. No legacy deletion.
**Risk:** LOW (telemetry/test/docs only)
**Depends on:** ARCH-AI-05C3 (merged PR #92)
**Next step:** ARCH-AI-05C5 — legacy FE_10H1 cleanup (requires positive decider combat evidence from 05C4 telemetry)

## Summary

This patch adds instrumentation telemetry to the tank decider wiring in `main.js` and a deterministic Playwright smoke test for `tank_decider.js`. No behavior logic is changed. No legacy FE_10H1 code is deleted. The telemetry counters provide the evidence base needed before any legacy cleanup in 05C5.

The decider smoke test calls `window.FE_TANK_DECIDER.evaluateTankDecision()` directly through `page.evaluate` with crafted context objects — no game state, no bot progression, no timing dependency. All 5 decider rules (defend_hq, stand_and_fight_near_home, retreat, keep_attacking, idle) are exercised, plus the intel-rally guard and result shape validation.

---

## 1. Changes

### 1.1 main.js — Telemetry fields added to `game._tankDecider01`

Three new telemetry fields:

| Field | Type | Reset | Purpose |
|-------|------|-------|---------|
| `suppressedLegacyBlocksTotal` | number | never (cumulative) | Lifetime count of legacy suppressions by `_tankDeciderManagedAt` guards. Unlike `suppressedLegacyBlocks` (which was per-tick but never reset), this provides a monotonically-increasing counter for QA observation. |
| `managedPerTick` | number | each decider tick | Count of enemy light_tank tanks that received a non-idle decider decision (defend_hq, retreat, keep_attacking) in the current tick. |
| `legacyPerTick` | number | each decider tick | Count of enemy light_tank tanks that received an `idle` decision and fall through to legacy FE_10H1 handling. |

Added to both enabled and disabled telemetry init blocks.

Added `managedPerTick++` / `legacyPerTick++` increments in the decider execution block:
- `managedPerTick++` after defend_hq, retreat, keep_attacking execution
- `legacyPerTick++` after idle decision

Added `suppressedLegacyBlocksTotal++` at all 9 `_tankDeciderManagedAt` skip points:
1. Invariant repair loop (line ~3398) — also added `suppressedLegacyBlocks++` (was missing)
2. FE_PATCH_08BDefend — defend override skip
3. FE_10D1_tryAttack — attack reassignment skip
4. FE_10D1_tryMove — movement redirect skip
5. FE_10E1_clearAttackOrder — attack order clear skip
6. FE_10E1_returnToHq — HQ return skip
7. FE_10E1 mass suppress loop — attack suppress skip
8. FE_10H1 legacy retreat — retreat overwrite skip
9. FE_10H1 legacy defend — defend overwrite skip

Also added `managedPerTick`/`legacyPerTick` reset in the disabled branch (else clause).

### 1.2 main.js — No behavior changes

All changes are telemetry-only counter increments. No conditions, returns, continues, or legacy FE_10H1 logic were altered. The first skip point (invariant repair) previously had no `suppressedLegacyBlocks++` — this was a telemetry gap, not a behavior change (the `continue` was already there).

### 1.3 tests/e2e/decider-smoke.spec.js — New deterministic smoke test

8 test cases using `page.evaluate` → `window.FE_TANK_DECIDER.evaluateTankDecision()`:

| Test | What it verifies |
|------|-----------------|
| Module API availability | All 6 exports exist after page load |
| defend_hq fires | Threats near HQ + idle tank → action=defend_hq |
| retreat fires | HP < 25% + far from home → action=retreat |
| keep_attacking fires | Active attack target + attacking state → action=keep_attacking |
| stand_and_fight_near_home fires | Near home + target in range → action=keep_attacking, ruleName=stand_and_fight_near_home |
| idle fallback | No conditions match → action=idle |
| Intel-rally guard | _attack11IntelRally=true → NOT defend_hq |
| Result shape validation | isValidDecisionResult + isValidContext contracts |

### 1.4 docs/patches/ARCH-AI-05C4.md — This document

### 1.5 docs/patches/INDEX.md — Updated

---

## 2. Why Positive Decider Combat Evidence Is Required Before 05C5 Cleanup

The 05C3 A/B QA showed that PR #92 was "not worse than sandbox/main" in a 120-second scenario, but **did not positively exercise attack/defend/retreat/stand_and_fight paths**. The decider's perRuleNameCounts telemetry was not inspected during that QA session. This means we have:

- **Evidence that the decider does not crash or break the game** when enabled
- **No evidence that defend_hq, retreat, stand_and_fight, or keep_attacking actually fire** during real gameplay
- **No evidence that legacy FE_10H1 suppressions are happening correctly** (suppressedLegacyBlocks was never observed)

Before deleting any FE_10H1 code in 05C5, we need:

1. **PerRuleNameCounts showing non-zero counts** for at least defend_hq, retreat, and keep_attacking during a real skirmish (not just the unit test)
2. **suppressedLegacyBlocksTotal > 0** — confirming that the decider-managed tanks are correctly suppressing legacy paths
3. **managedPerTick > 0** during active combat — confirming decider is making non-idle decisions
4. **legacyPerTick** should decrease as more tanks become managed — confirming migration is working
5. **No behavior regression** in manual QA comparing decider-on vs decider-off during active combat

The 05C4 telemetry counters provide the dashboard for this evidence. The decider-smoke test provides the structural guarantee that each rule can fire given the right conditions. But the **in-game positive evidence** still requires a manual QA session with the telemetry dashboard visible.

---

## 3. FE_10H1 Responsibility Map (Current State)

| Section | Function | Purpose | Decider-managed? | Can delete in 05C5? |
|---------|----------|---------|-------------------|---------------------|
| ~3390 | Invariant repair | Fix attack_approach state invariant | Skipped (suppressed) | Only if decider never creates invariant violations |
| ~5172 | FE_PATCH_08BDefend | Pressure-target defend override | Skipped (suppressed) | Only if decider defend_hq covers this case |
| ~6095 | FE_10D1_tryAttack | Autopilot attack reassignment | Skipped (suppressed) | Only if decider keep_attacking/defend_hq covers this |
| ~6140 | FE_10D1_tryMove | Autopilot movement redirect | Skipped (suppressed) | Only if decider covers movement decisions |
| ~6526 | FE_10E1_clearAttackOrder | Clear stale attack orders | Skipped (suppressed) | Only if decider never creates stale orders |
| ~6552 | FE_10E1_returnToHq | Return idle/lost tanks to HQ | Skipped (suppressed, except retreat) | Only if decider retreat covers this |
| ~6620 | Mass suppress loop | Suppress attack orders during retreat phase | Skipped (suppressed) | Only if decider retreat covers mass recall |
| ~6874 | FE_10H1 legacy retreat | Per-tank retreat evaluation | Skipped (suppressed) | Only if decider retreat covers all these cases |
| ~6934 | FE_10H1 legacy defend | Per-tank defend evaluation | Skipped (suppressed) | Only if decider defend_hq covers all these cases |

**Key insight:** All 9 FE_10H1 sections are already suppressed for decider-managed tanks. Legacy FE_10H1 only runs for tanks that receive an `idle` decision (suppressLegacyOrders=false). Deleting FE_10H1 code in 05C5 would affect those idle tanks unless the decider is modified to never return idle for managed tanks.

---

## 4. Manual QA

Boot the game and verify the new telemetry fields:

```javascript
// 1. Verify new telemetry fields exist
game._tankDecider01.suppressedLegacyBlocksTotal  // should be a number (0 initially)
game._tankDecider01.managedPerTick                // should be a number
game._tankDecider01.legacyPerTick                 // should be a number

// 2. Play a skirmish — let enemy produce tanks and engage in combat
// Wait for active combat phase (~60-90 seconds)

// 3. Verify perRuleNameCounts have non-zero values for at least 3 rules
game._tankDecider01.perRuleNameCounts
// Expected: defend_hq_if_base_threatened > 0 OR keep_attacking_valid_current_target > 0
// Expected: idle_fallback > 0 (always, since some tanks are unmanaged)

// 4. Verify suppressedLegacyBlocksTotal is increasing
game._tankDecider01.suppressedLegacyBlocksTotal  // should be > 0 during active combat

// 5. Verify managedPerTick / legacyPerTick during combat
game._tankDecider01.managedPerTick   // should be > 0 if decider is managing tanks
game._tankDecider01.legacyPerTick    // should be > 0 if some tanks fall through to legacy

// 6. Run the decider-smoke test
// npx playwright test tests/e2e/decider-smoke.spec.js
// All 8 tests should pass
```

---

## 5. Files Changed

| File | Action | Description |
|------|--------|-------------|
| `src/main.js` | MOD | Added 3 telemetry fields (suppressedLegacyBlocksTotal, managedPerTick, legacyPerTick); added suppressedLegacyBlocksTotal++ at 9 skip points; added managedPerTick++/legacyPerTick++ in decider execution; added suppressedLegacyBlocks++ at invariant-repair skip point (was missing); added per-tick reset in disabled branch |
| `tests/e2e/decider-smoke.spec.js` | NEW | 8 deterministic Playwright tests for tank_decider rules via page.evaluate |
| `docs/patches/ARCH-AI-05C4.md` | NEW | This patch document |
| `docs/patches/INDEX.md` | MOD | Added ARCH-AI-05C4 entry |

## Files NOT Touched

- `src/config/runtime_flags.js` — no changes
- `src/ai/tank_decider.js` — no changes
- `src/ai/enemy_targeting.js` — no changes
- `src/ai/enemy_intel.js` — no changes
- `index.html` — no changes
- `assets/` — no changes
- `package.json` / `package-lock.json` — no changes

---

## 6. main.js Line Count

| Metric | Value |
|--------|-------|
| Before | 15,650 |
| After | 15,670 |
| Delta | +20 |

---

## 7. Safety Mechanisms

1. **Telemetry-only changes:** No conditions, returns, continues, or logic altered
2. **Counter increments are additive:** Cannot change behavior — only observe it
3. **managedPerTick/legacyPerTick are derived:** Counted from existing decider flow, not new decisions
4. **suppressedLegacyBlocksTotal is cumulative:** Mirrors existing suppressedLegacyBlocks but never resets
5. **Deterministic test:** No timing dependency, no bot progression, no RNG
6. **Intel-rally guard tested:** Smoke test confirms _attack11IntelRally tanks are not recalled by defend_hq

---

## 8. Verification

```bash
git diff --name-only origin/sandbox/main...HEAD
node --check src/main.js
node --check src/ai/tank_decider.js
node --check src/config/runtime_flags.js
npm run test:e2e
```

- `git diff --name-only` should show only the 4 allowed files
- `git diff origin/sandbox/main...HEAD -- src/config/runtime_flags.js` should be empty
- `git diff origin/sandbox/main...HEAD -- src/ai/tank_decider.js` should be empty
- `npm run test:e2e` should pass all tests including the 8 new decider-smoke tests
