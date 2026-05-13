# ARCH-LAB-05B2 - Wire enemy targeting decisions

Date: 2026-05-13
PR: TBD

## Summary

Wires the already-approved pure enemy targeting helpers from `src/ai/enemy_targeting.js`
into the two legacy main-loop decision points:

- `FE_ATTACK11ChooseIntelTarget()`
- `FE_ATTACK12EvaluateAttackDecision(enemyTanks, now)`

Scope is intentionally narrow:

- add delegation guards to `window.FE_ENEMY_TARGETING`
- preserve legacy bodies as exact fallbacks
- keep runtime behavior, strings, and result shapes unchanged
- avoid touching attack preparation, rally/wave logic, scouting, pathfinding, or tank decider code

## Main.js wiring

### FE_ATTACK11ChooseIntelTarget

Adds a guard:

```js
if (window.FE_ENEMY_TARGETING && typeof window.FE_ENEMY_TARGETING.chooseIntelTarget === 'function') {
  return window.FE_ENEMY_TARGETING.chooseIntelTarget(game && game.enemyIntel, game ? (game.time || 0) : 0);
}
```

If helper is unavailable, the legacy inline logic remains in place unchanged.

### FE_ATTACK12EvaluateAttackDecision

Adds a guard to `window.FE_ENEMY_TARGETING.evaluateAttackDecision`.

Before delegating, `main.js` constructs `tankStatuses` with the exact approved fields:

- `isAlive`
- `isIntelRally`
- `isWaveLocked`
- `hasAttackTargetId`
- `hasAttackApproachTargetId`

It also passes the exact approved options:

- `attack11DispatchSource`
- `maxIntelAgeSec`
- `minAttackTanks`
- `forceAdvantage`

If helper is unavailable, the legacy inline ATTACK-12 decision body remains in place unchanged.

## Non-goals

- no changes to `FE_PATCH_08BPrepareAttack`
- no changes to rally/wave/HQ-push logic
- no changes to scout behavior
- no changes to tank decider wiring
- no changes to pathfinding or unrelated systems

## Validation

Static and smoke validation for this patch:

- `node --check src/main.js`
- `node --check src/ai/enemy_targeting.js`
- `node --check src/config/runtime_flags.js`
- `npm run test:e2e`
