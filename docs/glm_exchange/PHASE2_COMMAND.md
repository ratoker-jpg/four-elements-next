# PHASE2_COMMAND

Task: BOT-DEFENSE-RETREAT-01 — fix enemy retreat/defense oscillation near base

Proceed with the approved Phase 1 plan only.

Lane: Review.
Base branch: sandbox/main.
Create a feature branch and PR.

## Approved scope

Implement a minimal stand-and-fight guard to reduce enemy tank attack/retreat oscillation near enemy base.

Allowed file:
- `src/main.js`

Allowed behavior change:
- When 10H1 retreat/defense is about to clear or overwrite an enemy tank's active attack order, allow the tank to keep fighting if:
  1. the tank is near enemy home/base;
  2. player pressure is near enemy base;
  3. the tank already has a valid current attack/approach target;
  4. that target is alive and in range or almost in range;
  5. retreat would be useless because the tank is already near home.

## Implementation constraints

1. Do not rewrite retreat system.
2. Do not create a new state machine.
3. Do not change combat damage/range/cooldown.
4. Do not change pathfinding/findPath/passable.
5. Do not change enemy production/economy.
6. Do not change scout lifecycle.
7. Do not change BOT-ATTACK-11/12 attack gate.
8. Do not change BOT-COMBAT-AWARENESS-01.
9. Do not add omniscient hidden targeting.
10. Keep diff minimal and reversible.

## Preferred implementation

1. Add constants near related bot/combat constants:
   - `FE_DEFENSE_RETREAT_01_NEAR_HOME_RADIUS = 6`
   - `FE_DEFENSE_RETREAT_01_NEAR_RANGE_MARGIN = 2`

2. Add a small helper, suggested name:
   - `FE_DEFENSE_RETREAT01ShouldStandAndFight(unit, state, threats, now)`

3. Helper should:
   - resolve current attack/approach target using existing helpers;
   - verify target is still valid/alive;
   - verify unit is near `state.homeX/homeY`;
   - verify there are player threats near base;
   - verify current target is in or near attack range;
   - update minimal telemetry only if returning true.

4. Use the helper in:
   - `FE_10H1_startRetreat()` before `FE_10H1_clearAttackOrder(unit)`;
   - `FE_10H1_defendHqWithAvailableTanks()` before reassigning a tank away from an already valid nearby target.

5. If adding parameters to `FE_10H1_startRetreat()`, do it only if necessary and update its only call site.

## Telemetry

Add minimal telemetry only when guard fires:

```js
game._botDefenseRetreat01 = {
  standAndFightGuardCount: 0,
  lastStandAndFightAt: 0,
  lastGuardUnitId: null,
  lastGuardTargetDist: -1,
  lastGuardDistToHome: -1
}
```

No noisy per-frame telemetry.

## What must NOT be touched

- `damageUnit`
- `FE_PATCH_06BDamageBuilding`
- combat balance values
- pathfinding / `findPath` / `passable`
- enemy production / economy
- scout lifecycle / scout AI
- BOT-ATTACK-11 / 11C / 12 / 12A
- BOT-COMBAT-AWARENESS-01
- 10B knowledge refresh
- save/load
- render/fog
- mapgen

## Checks

Run:

```bash
node --check src/main.js
```

## PR description must include

- Root cause
- What changed
- What was NOT touched
- Telemetry
- Checks
- Targeted smoke test plan
- Known risks

## Manual QA status

Do not require full-match QA.
Use targeted smoke plan.
If targeted manual smoke is skipped, mark later as:

```text
Manual QA: UNVERIFIED / BATCH QA
```

## Expected output

After implementation:

1. Create branch + PR.
2. Fully overwrite:

```text
docs/glm_exchange/CODE_SUMMARY.md
```

3. Return in chat only:

```text
CODE_SUMMARY_WRITTEN
File: docs/glm_exchange/CODE_SUMMARY.md
PR: #<number>
Status: waiting for GPT PR review
```
