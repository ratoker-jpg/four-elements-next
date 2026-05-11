# PR_REVIEW

Task: POWER-SYSTEM-01A — shared unit upkeep + enemy power_plant response
PR: #62
Verdict: APPROVED_TO_MERGE
Manual QA: UNVERIFIED / BATCH QA

## Reason

REQUEST_CHANGES was addressed. PR is now mergeable and the P1 issue from Codex review was fixed: enemy separators reserve power only when they can actually process resources.

## What is OK

- Review lane PR against `sandbox/main`.
- PR is mergeable.
- Scope matches approved reduced POWER-SYSTEM-01A direction.
- Implements shared unit upkeep for player and enemy.
- Adds `FE_POWER_UNIT_MW = 1` and raises HQ baseline to 15 MW.
- Extends player power usage with unit upkeep.
- Adds enemy power evaluation with enemy HQ + power_plant capacity.
- Enemy separator reserves power only when `FE_PATCH_09C3EnemySeparatorCycleCheck().ok` is true.
- Resource-stalled separators do not reserve power and are not marked `_enemyPowerPaused` solely because of power.
- Enemy factory reserves power only when queue has items.
- Enemy separator/factory respect enemy power pressure.
- BRAIN-01 can choose `build_power_plant` with preflight checks.
- Does not add UI warnings/toasts, emergency builder, factory queue depth changes, target chaining, combat/pathfinding/scout/economy formula changes.
- `node --check src/main.js` and `node --check src/config/runtime_flags.js` reported as passed.

## Concerns

- Manual behavior is not verified yet.
- Balance risk remains: 15 MW HQ and 1 MW/unit may need tuning after batch QA.
- PR description wording still says "separator pauses first, then factory"; actual reservation order is units → separator → factory, so factory is the first building to lose power when separators consume capacity. This is acceptable but should be watched in QA.

## Next action

Merge PR #62.
After merge, keep Manual QA as `UNVERIFIED / BATCH QA`.
