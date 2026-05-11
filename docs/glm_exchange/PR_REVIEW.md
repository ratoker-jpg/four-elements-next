# PR_REVIEW

Task: POWER-SYSTEM-01A — shared unit upkeep + enemy power_plant response
PR: #62
Verdict: REQUEST_CHANGES
Manual QA: UNVERIFIED / BATCH QA

## Reason

PR still needs changes before merge.

There are two blockers:

1. PR is currently reported as not mergeable against `sandbox/main`.
2. Codex review found a valid P1 issue: enemy separator power is reserved for every completed separator even when the separator cannot actually run because minerals are missing or storage is full. This inflates enemy power usage, can trigger premature `build_power_plant`, and can incorrectly power-pause factories.

## What is OK

- Review lane PR.
- Scope matches approved reduced POWER-SYSTEM-01A direction.
- Implements shared unit upkeep for player and enemy.
- Adds `FE_POWER_UNIT_MW = 1` and raises HQ baseline to 15 MW.
- Adds enemy power evaluation with enemy HQ + power_plant capacity.
- BRAIN-01 can choose `build_power_plant` with preflight checks.
- Does not add UI warnings/toasts, emergency builder, factory queue depth changes, target chaining, combat/pathfinding/scout/economy formula changes.
- `node --check src/main.js` and `node --check src/config/runtime_flags.js` reported as passed.

## Concerns

- Enemy separator power should mirror intended active-consumption logic. A separator should reserve power only if it can actually process, not when it is idle due to missing minerals or full storage.
- Otherwise enemy can overbuild power plants and stall factory production incorrectly.
- PR remains balance-sensitive and manual behavior is still unverified.

## Required changes

Patch only the enemy separator power reservation logic.

Required fix:

1. In `FE_POWER_01_EvaluateEnemyPowerState()`, reserve `cfg.separatorMw` only for enemy separators that can actually process.
2. Use the existing enemy separator cycle check or equivalent existing resource-space checks:
   - enemy minerals are enough for a cycle;
   - enemy energy storage has space;
   - enemy faction element storage has space.
3. If separator cannot process, do not reserve separator power and do not mark it `_enemyPowerPaused` solely because of power.
4. Keep existing enemy separator resource-stall marking intact in `FE_PATCH_09C3UpdateEnemySeparatorProduction()`.
5. Do not change separator formula or production rate.
6. After patch, update branch from current `sandbox/main` if still not mergeable.

Do NOT add:
- UI/toast warnings;
- save/load changes;
- combat/pathfinding/scout/BOT-ATTACK changes;
- emergency builder;
- factory queue depth changes;
- target chaining;
- extra economy expansion beyond power_plant response.

Rerun:

```bash
node --check src/main.js
node --check src/config/runtime_flags.js
```

If SHA changes, update `docs/glm_exchange/CODE_SUMMARY.md`.

## Next action

Ask GLM to patch PR #62 with the enemy separator active-power reservation fix, ensure the branch is mergeable, and return CODE_SUMMARY again.
