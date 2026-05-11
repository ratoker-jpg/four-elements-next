# PR_REVIEW

Task: BOT-PROGRESSION-01 — disable tank cap + fix worker priority ordering
PR: #58
Verdict: APPROVED_TO_MERGE
Manual QA: UNVERIFIED / BATCH QA

## Reason

PR fixes the main audited progression blocker: the experimental enemy light_tank cap of 3. It also prevents future cap logic from blocking worker/scout replacement before worker checks run.

## What is OK

- Review lane PR against sandbox/main.
- Changed gameplay file: `src/main.js`.
- Disables `window.FE_ENEMY_LIGHT_TANK_CAP` by setting it to `0`.
- Keeps natural limits: one factory, queue depth 1, element cost, build time, ATTACK-12 gate.
- Reorders `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` so worker/scout checks happen before any tank cap block.
- Does not touch combat, pathfinding, scout lifecycle, BOT-ATTACK-11/12, economy expansion, factory queue depth, save/load, render/fog, mapgen.
- No new telemetry added; existing telemetry is enough.
- `node --check src/main.js` passed.
- PR is mergeable.

## Concerns

- Manual behavior is not verified yet.
- Disabling the cap may let enemy tanks accumulate over longer games if natural economy limits are not enough, but this is acceptable for Playable Bot MVP and can be tuned later.
- This does not add new economy expansion buildings; it only removes the hard production stall.

## Next action

Merge PR #58.
After merge, keep Manual QA as `UNVERIFIED / BATCH QA` and continue sprint.
