# ARCH-LAB-05B3 - Remove enemy targeting fallbacks

Date: 2026-05-13
PR: TBD

## Summary

Removes the legacy inline fallback bodies from the two enemy targeting runtime
wrappers in `src/main.js` now that `FE_ENEMY_TARGETING` is the approved runtime
path on `sandbox/main`.

Affected wrappers only:

- `FE_ATTACK11ChooseIntelTarget()`
- `FE_ATTACK12EvaluateAttackDecision(enemyTanks, now)`

## Main.js changes

### FE_ATTACK11ChooseIntelTarget

Reduced to a thin wrapper that returns:

```js
window.FE_ENEMY_TARGETING.chooseIntelTarget(
  game && game.enemyIntel,
  game ? (game.time || 0) : 0
)
```

### FE_ATTACK12EvaluateAttackDecision

Keeps the adapter layer in `main.js` and removes the legacy inline decision
fallback.

The wrapper still builds `tankStatuses` with the exact approved fields:

- `isAlive`
- `isIntelRally`
- `isWaveLocked`
- `hasAttackTargetId`
- `hasAttackApproachTargetId`

It still passes the exact approved options:

- `attack11DispatchSource`
- `maxIntelAgeSec`
- `minAttackTanks`
- `forceAdvantage`

Then returns:

```js
window.FE_ENEMY_TARGETING.evaluateAttackDecision(
  game && game.enemyIntel,
  tankStatuses,
  now,
  options
)
```

## Non-goals

- no changes to `FE_PATCH_08BPrepareAttack`
- no changes to rally dispatch
- no changes to `FE_PATCH_08BSilentMoveTo`
- no changes to `FE_PATCH_08BCommandEnemyTankAttack`
- no changes to `FE_PATCH_08BReturnUnitHome`
- no changes to `FE_ATTACK10` wave logic
- no changes to hq_push logic
- no changes to pathfinding
- no changes to telemetry
- no changes to tank_decider
- no changes to scout lifecycle

## Validation

- `node --check src/main.js`
- `node --check src/ai/enemy_targeting.js`
- `node --check src/config/runtime_flags.js`
- `npm run test:e2e`
