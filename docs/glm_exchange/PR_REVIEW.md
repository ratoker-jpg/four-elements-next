# PR_REVIEW

Task: BOT-DEFENSE-RETREAT-01 — stand-and-fight guard near enemy base
PR: #55
Verdict: APPROVED_TO_MERGE
Manual QA: UNVERIFIED / BATCH QA

## Reason

PR implements the approved narrow guard for enemy tanks near home/base. It does not rewrite retreat, combat, pathfinding, economy, scout lifecycle, or BOT-ATTACK-11/12.

## What is OK

- Review lane PR against sandbox/main.
- Changed gameplay file: src/main.js.
- Added stand-and-fight constants.
- Added helper `FE_DEFENSE_RETREAT01ShouldStandAndFight()`.
- Guard added before `FE_10H1_clearAttackOrder()` in retreat path.
- Guard added before defend target reassignment in HQ defense path.
- `FE_10H1_startRetreat()` call updated with threats param.
- Minimal telemetry added only when guard fires.
- `node --check src/main.js` passed.
- PR is mergeable.

## Concerns

- Manual behavior is not verified yet.
- Helper uses current attack/approach target and near-home/near-range checks; if values are slightly off, guard may fire too rarely or too often.
- This is acceptable for sprint mode and will be covered by batch QA.

## Next action

Merge PR #55.
After merge, mark Manual QA as `UNVERIFIED / BATCH QA` and continue sprint.
