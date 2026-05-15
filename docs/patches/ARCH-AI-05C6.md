# ARCH-AI-05C6 — AI Block Boundary Checkpoint

**Date:** 2026-05-14
**PR:** #95
**Branch:** gpt/arch-ai-05c6-boundary-checkpoint
**Scope:** Docs-only boundary checkpoint. No code changes.
**Risk:** NONE
**Depends on:** ARCH-AI-05C5 (merged PR #94)
**Next block:** ARCH-LAB-06 — Economy / production / construction architecture

## Summary

This checkpoint closes the current AI / tank_decider migration block at a safe boundary.

After PRs #89–#94, the tank decider is now the default enemy light_tank tactical decision path, while the remaining legacy FE_10H1 code stays in place for idle/unmanaged tanks and bot phase ownership. Further FE_10H1 reduction is intentionally deferred because it requires phase ownership migration, not simple cleanup.

This document records the stop point so the next architecture work can move to the economy / production / construction block without losing the AI migration context.

---

## 1. Merged AI / tank_decider work

| PR | Task | Result |
|---:|---|---|
| #89 | ARCH-AI-05C-DESIGN | Design for enemy tank Priority Stack migration |
| #90 | ARCH-AI-05C1 | tank_decider contract/rules: enums, factory, validators, stand_and_fight_near_home |
| #91 | ARCH-AI-05C2B | Gated telemetry: perRuleNameCounts and _tankDeciderLastRuleName |
| #92 | ARCH-AI-05C3 | FE_TANK_DECIDER_ENABLED=true by default + intel-rally guard |
| #93 | ARCH-AI-05C4 | Telemetry instrumentation + deterministic decider-smoke tests |
| #94 | ARCH-AI-05C5 | Selective legacy cleanup: removed redundant stand-and-fight guard and dead helper |

---

## 2. Current state after #94

- `FE_TANK_DECIDER_ENABLED` is `true` by default.
- `src/ai/tank_decider.js` owns enemy `light_tank` per-tank tactical decisions.
- Decider rules currently cover:
  - `defend_hq_if_base_threatened`
  - `stand_and_fight_near_home`
  - `retreat_if_losing_or_overextended`
  - `keep_attacking_valid_current_target`
  - `idle_fallback`
- Deterministic Playwright smoke tests cover the decider rules and result shape.
- `game._tankDecider01` telemetry includes:
  - `perRuleCounts`
  - `perRuleNameCounts`
  - `suppressedLegacyBlocks`
  - `suppressedLegacyBlocksTotal`
  - `managedPerTick`
  - `legacyPerTick`
- Positive QA evidence confirmed non-idle decider rules during live staged gameplay:
  - `defend_hq_if_base_threatened > 0`
  - `stand_and_fight_near_home > 0`
  - `retreat_if_losing_or_overextended > 0`
  - `suppressedLegacyBlocksTotal > 4500`
  - `managedPerTick > 0`
- `src/main.js` line count after #94: `15,602`.

---

## 3. What was cleaned up in #94

#94 removed the safe/redundant parts of legacy AI after telemetry proved the decider path was active:

- `FE_10H1_getEnemyTanks()` — dead helper with zero call sites.
- `FE_DEFENSE_RETREAT01ShouldStandAndFight()` — legacy stand-and-fight guard now covered by `tank_decider.js`.
- `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS` and `FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN` — only used by the removed guard.
- The two legacy guard call sites in:
  - `FE_10H1_startRetreat`
  - `FE_10H1_defendHqWithAvailableTanks`
- `game._botDefenseRetreat01` write-only telemetry.

Net result: `src/main.js` reduced by `-68` lines in #94.

---

## 4. Remaining FE_10H1 boundary

The remaining FE_10H1 code is **not dead code**. It still owns important responsibilities:

| Area | Why it remains |
|---|---|
| Idle/unmanaged tank fallback | Decider returns `idle` with `suppressLegacyOrders=false`, so legacy still handles those tanks. |
| Bot phase ownership | FE_10H1 still mutates `state.phase`, `state.regroupUntil`, `state.retreatCooldownUntil`, and related phase/cooldown fields. |
| Group-level retreat / defend logic | Decider is per-tank; FE_10H1 still handles group-level state decisions. |
| Retreat execution dependency | Decider retreat execution still uses `FE_10H1_moveToSafePoint`. |
| Threat context dependency | Decider context still uses `FE_10H1_getLocalPlayerThreatsNearHq`. |
| hq_push threat estimate dependency | ATTACK-04/hq_push logic still uses `FE_10H1_getPlayerThreatEstimate`. |
| Legacy telemetry | `game.enemyRetreatMvp` is still read by existing e2e tests/debug flows. |

Because of this, full FE_10H1 removal is deferred.

---

## 5. Why the AI block stops here

Further reduction now requires a different migration, not another small cleanup.

The next meaningful AI reduction would require a new owner for:

- `state.phase`
- `state.regroupUntil`
- `state.retreatCooldownUntil`
- group-level retreat/defend decisions
- threat scanning currently provided by FE_10H1 helpers
- retreat movement execution currently delegated to FE_10H1 helpers
- `game.enemyRetreatMvp` compatibility or replacement

That is effectively a **bot phase manager migration**, not part of the current 05C scope.

Recommendation: stop the AI block here and move to the next architecture block.

---

## 6. Deferred AI work

Future AI work can resume as a separate design block when needed:

- `ARCH-AI-06-DESIGN` — bot phase manager / FE_10H1 ownership migration.
- Move or replace `FE_10H1_getLocalPlayerThreatsNearHq` as a shared threat utility.
- Replace decider retreat execution dependency on `FE_10H1_moveToSafePoint`.
- Bridge or replace `game.enemyRetreatMvp` telemetry.
- Revisit `evaluateRetreat` safety guard in `tank_decider.js`.
- Investigate why `keep_attacking_valid_current_target` did not fire in the staged QA run.

None of this is approved in the current block.

---

## 7. Next architecture block

Next recommended block:

**ARCH-LAB-06 — Economy / production / construction architecture**

Reason:

- Economy / production / construction is a larger unmodularized area than the remaining FE_10H1 cleanup opportunity.
- Boundaries are clearer: resources, power, production queues, construction lifecycle, storage/caps.
- This should produce more useful architecture progress than chasing the remaining FE_10H1 phase ownership now.

Suggested next audit:

`ARCH-LAB-06-DESIGN — economy / production / construction boundary audit / Phase 1 Audit Only`

---

## 8. Verification

Docs-only checkpoint.

Expected changed files:

```text
docs/patches/ARCH-AI-05C6.md
docs/patches/INDEX.md
```

No runtime checks are required for this document-only change, but the standard review checks may still be run:

```bash
node --check src/main.js
node --check src/ai/tank_decider.js
node --check src/config/runtime_flags.js
npm run test:e2e
```
