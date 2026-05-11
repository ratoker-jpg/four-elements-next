# PR_REVIEW

Task: POWER-SYSTEM-01A — shared unit upkeep + enemy power_plant response
PR: #62
Verdict: REQUEST_CHANGES
Manual QA: UNVERIFIED / BATCH QA

## Reason

The implementation direction matches the approved reduced scope, but the PR is currently not mergeable against `sandbox/main`.

Do not merge until the branch is updated from current `sandbox/main`, conflicts are resolved if any, and checks are rerun.

## What is OK

- Review lane PR.
- Implements shared unit upkeep for player and enemy.
- Adds `FE_POWER_UNIT_MW = 1` and raises HQ power baseline to 15 MW.
- Extends player power usage with unit upkeep.
- Adds enemy power evaluation with enemy HQ + power_plant capacity.
- Enemy separator/factory now respect enemy power pressure.
- BRAIN-01 can choose `build_power_plant` when enemy power usage is near capacity.
- Has preflight checks for enemy power_plant order: no duplicate build in progress, free builder, can afford.
- Allows multiple power_plants over time but prevents duplicate simultaneous build orders.
- Does not add UI warnings/toasts, emergency builder, factory queue depth changes, target chaining, combat/pathfinding/scout/economy formula changes.
- `node --check src/main.js` and `node --check src/config/runtime_flags.js` reported as passed.

## Concerns

- PR is not mergeable right now.
- This is a balance-sensitive patch. Manual behavior is not verified yet.
- PR description says "separator pauses first, then factory", but the code appears to reserve power in order: units → separator → factory, which means factory is the first building to lose power after units/separator consume capacity. This matches the older separator-priority behavior, but the wording should not mislead later QA.
- `src/config/runtime_flags.js` change is acceptable only because power constants are already defined there; do not add wider config churn.

## Required changes

Update PR branch from current `sandbox/main`, resolve conflicts if any, and rerun:

```bash
node --check src/main.js
node --check src/config/runtime_flags.js
```

Keep scope exactly the same:
- no new UI/toast work;
- no save/load changes unless a conflict forces a tiny derived-state fix;
- no combat/pathfinding/scout/BOT-ATTACK changes;
- no emergency builder;
- no factory queue depth changes;
- no target chaining;
- no extra economy expansion beyond power_plant response.

If the SHA changes, update `docs/glm_exchange/CODE_SUMMARY.md`.

## Next action

Ask GLM to update PR #62 branch from current `sandbox/main` and return CODE_SUMMARY again.
