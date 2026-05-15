# ARCH-AI-05C-DESIGN — Enemy Tank Decision / Priority Stack Migration Design

**Date:** 2026-05-13  
**Scope:** docs-only design checkpoint  
**Runtime behavior:** unchanged  
**Main.js delta:** 0  

---

## 1. Why this design is needed

Enemy tank tactical decision logic currently has two overlapping systems:

1. **Legacy `FE_10H1` retreat/defense logic** in `src/main.js`.
2. **`src/ai/tank_decider.js` Priority Stack** exposed as `window.FE_TANK_DECIDER.evaluateTankDecision(context)`.

`FE_TANK_DECIDER_ENABLED` is currently `false` and must remain false until the migration gaps below are closed.

Important correction:

> `tank_decider` partially overlaps with `10H1`, but it is not yet a safe replacement.

The goal of this document is to define the migration boundary before any runtime behavior is changed.

---

## 2. Current systems map

### Legacy `FE_10H1` family

Current legacy logic handles enemy retreat/defense as a bulk system:

- detects player threats near enemy HQ;
- decides whether enemy tanks should defend HQ;
- decides whether enemy tanks should retreat/regroup;
- clears attack orders;
- sends tanks home;
- mutates bot phase/regroup cooldown fields;
- writes retreat/defense telemetry.

This system is coupled to `game`, bot state, existing attack helpers, movement/pathfinding helpers, and telemetry.

### `FE_DEFENSE_RETREAT01ShouldStandAndFight`

This function overlaps with decider retreat logic. It prevents bad retreats when a tank is already in a useful fight near home. Its logic is not fully migrated into `tank_decider.js` yet.

### `src/ai/tank_decider.js`

The module is pure decision logic:

- no game access;
- no DOM/canvas access;
- no pathfinding;
- no direct attack/move command execution;
- no mutation of units or game state;
- returns one decision object per tank.

Runtime execution still happens in `main.js` wiring.

### Attack wave dispatch

Attack-wave dispatch is not a per-tank decider responsibility.

It remains owned by:

- `FE_PATCH_08BPrepareAttack`;
- `FE_ATTACK10*` wave state;
- `FE_ATTACK11/12` strategic targeting/gating;
- `FE_PATCH_08BCommandEnemyTankAttack`.

---

## 3. Current `tank_decider.js` API

Public API:

```js
window.FE_TANK_DECIDER.evaluateTankDecision(context)
```

Current rules:

| Priority | Rule | Action |
|---:|---|---|
| 100 | `defend_hq_if_base_threatened` | `defend_hq` |
| 90 | `retreat_if_losing_or_overextended` | `retreat` |
| 80 | `keep_attacking_valid_current_target` | `keep_attacking` |
| 10 | `idle_fallback` | `idle` |

Current result shape:

```js
{
  action,
  priority,
  reason,
  targetId,
  targetX,
  targetY,
  ruleName,
  suppressLegacyOrders,
  telemetry
}
```

The context is built in `main.js` because only `main.js` has access to current game state, helper functions, attack targets, and threat collections.

---

## 4. Gaps before enabling `FE_TANK_DECIDER_ENABLED = true`

Do not enable the decider by default until these gaps are resolved:

1. **Regroup state management is missing**  
   `10H1` mutates `state.phase`, `state.regroupUntil`, and `state.retreatCooldownUntil`. The decider returns per-tank actions and does not own global bot phase.

2. **`state.phase` ownership is unclear**  
   A separate phase manager is needed, or `main.js` must keep phase ownership while decider stays pure.

3. **`state.regroupUntil` / `state.retreatCooldownUntil` ownership is unclear**  
   These are currently legacy 10H1 side effects.

4. **`hq_push` army score logic is not fully represented**  
   The decider checks hq-push state broadly, but legacy logic has additional attack-wave and army-score guards.

5. **Stand-and-fight logic is only partially migrated**  
   `FE_DEFENSE_RETREAT01ShouldStandAndFight` overlaps with `evaluateRetreat`, but the behavior is not yet a field-by-field migration.

6. **Bulk vs per-tank decision divergence**  
   `10H1` makes bulk decisions for the group. The decider makes individual tank decisions. Mixed decisions may be correct long-term, but they must be intentionally designed.

7. **Telemetry compatibility issue**  
   Existing debug panels may rely on `game.enemyRetreatMvp`; decider uses `game._tankDecider01` telemetry.

8. **Threat collection helper dependency**  
   Current threat collection depends on helper functions living in the legacy `10H1` / `10E1` / `10D1` zone. Before removing legacy, threat collection needs a stable owner.

---

## 5. Target Priority Stack

Target stack to design toward:

| Priority | Rule | Action | Notes |
|---:|---|---|---|
| 100 | `defend_hq_if_base_threatened` | `defend_hq` | Defend enemy HQ when visible player threats are near home. |
| 95 | `stand_and_fight_near_home` | `keep_attacking` | Prevent bad retreats when a tank is already fighting usefully near home. |
| 90 | `retreat_if_losing_or_overextended` | `retreat` | Low HP, outnumbered, or overextended. |
| 80 | `keep_attacking_valid_current_target` | `keep_attacking` | Preserve valid active attack/approach target. |
| 10 | `idle_fallback` | `idle` | No tactical rule matched. |

Attack-wave dispatch is explicitly excluded from the per-tank decider. It remains wave-level logic in `FE_PATCH_08BPrepareAttack`.

---

## 6. Recommended staged migration

### 05C1 — decider contract/rule update

- Update `tank_decider.js` rules and result/telemetry contracts.
- Add or refine `stand_and_fight_near_home`.
- Add missing hq-push / retreat context fields.
- No `main.js` behavior change unless strictly needed for context data.
- `FE_TANK_DECIDER_ENABLED` remains false.

### 05C2 — context wiring hardening

- Improve context builder in `main.js` while the feature remains gated.
- Ensure all required data is passed to the decider explicitly.
- Keep execution in `main.js`.
- Do not touch attack-wave dispatch.

### 05C3 — enable flag after QA criteria are met

- Flip `FE_TANK_DECIDER_ENABLED` only after manual and automated QA.
- Verify defend, retreat, keep-attacking, hq-push guard, and intel-rally guard.

### 05C4 — remove legacy `10H1` fallback

- Remove or shrink legacy `FE_10H1` code only after the decider is proven safe.
- Expected future `main.js` reduction opportunity: roughly 200–350 lines.

---

## 7. What stays in `main.js`

Until a separate extraction is approved, these responsibilities stay in `main.js`:

- command execution;
- movement/pathfinding calls;
- `FE_PATCH_08BCommandEnemyTankAttack`;
- `FE_PATCH_08BReturnUnitHome`;
- `FE_ATTACK10` wave state;
- `FE_PATCH_08BPrepareAttack`;
- telemetry writes;
- global bot phase manager.

The decider remains pure. It decides. It does not execute.

---

## 8. Hard limits for future implementation

Do not touch without explicit future approval:

- pathfinding / `findPath` / `passable` / `inBounds`;
- combat damage / range / cooldown;
- scout lifecycle;
- production / economy / caps;
- enemy targeting wrappers;
- `FE_PATCH_08BPrepareAttack` execution;
- save/load;
- render/input/selection;
- runtime flags;
- tests;
- assets.

---

## 9. QA criteria before enabling the decider by default

Before `FE_TANK_DECIDER_ENABLED` can become true by default:

- E2E suite passes 6/6;
- manual skirmish with decider enabled passes;
- enemy defends HQ when attacked;
- enemy retreats when losing;
- enemy keeps attacking when valid target exists;
- hq-push tanks are not recalled incorrectly;
- intel-rally tanks are not overwritten;
- telemetry remains readable.

---

## 10. Architecture KPI

| Metric | Value |
|---|---:|
| `src/main.js` touched | no |
| `src/**` touched | no |
| Runtime behavior changed | no |
| `FE_TANK_DECIDER_ENABLED` changed | no |
| `main.js` delta | 0 |

This PR is design-only. The future reduction opportunity comes from replacing/removing legacy `10H1` fallback logic after safe migration.
