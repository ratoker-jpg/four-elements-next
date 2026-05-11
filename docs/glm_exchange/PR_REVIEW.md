# PR_REVIEW

Task: BOT-ECONOMY-01A — enemy builds elements_storage when element storage near full
PR: #61
Verdict: APPROVED_TO_MERGE
Manual QA: UNVERIFIED / BATCH QA

## Reason

REQUEST_CHANGES was addressed. BRAIN-01 now checks that `build_elements_storage` is actually executable before selecting that action, so it should not starve lower-priority builder/harvester/combat actions when storage construction cannot currently start.

## What is OK

- Review lane PR against `sandbox/main`.
- Changed gameplay file: `src/main.js`.
- Scope remains focused on `elements_storage` only.
- Adds `build_elements_storage` BRAIN-01 action when enemy faction element storage is near full.
- Adds existing/queued `elements_storage` check.
- Adds free enemy builder check.
- Adds energy affordability preflight before choosing the action.
- Existing order function still keeps safety checks.
- Does not add emergency builder, factory queue depth changes, power/upkeep, second factory/separator, target chaining, or broader economy scaling.
- Does not touch combat, pathfinding, scout lifecycle, BOT-ATTACK-11/12, player economy, save/load, render/fog/mapgen.
- `node --check src/main.js` reported as passed.
- PR is mergeable.

## Concerns

- Manual behavior is not verified yet.
- Codex noted that only one `elements_storage` can be built. This is acceptable for BOT-ECONOMY-01A reduced scope; multi-storage scaling should be a later economy patch, not added here.

## Next action

Merge PR #61.
After merge, keep Manual QA as `UNVERIFIED / BATCH QA`.
