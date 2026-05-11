# PR_REVIEW

Task: BOT-ECONOMY-01A — enemy builds elements_storage when element storage near full
PR: #61
Verdict: REQUEST_CHANGES
Manual QA: UNVERIFIED / BATCH QA

## Reason

The patch implements the approved direction, but the BRAIN-01 decision can now return `build_elements_storage` before verifying that the action is actually currently executable.

If element storage is near full, but there is no available builder, not enough energy, or no build plan, BRAIN-01 may repeatedly choose `build_elements_storage`, the execute step returns false, and lower-priority actions like worker/combat production can be starved.

## What is OK

- Review lane PR.
- Changed gameplay file: `src/main.js`.
- Scope is focused on `elements_storage` only.
- Does not add emergency builder, queue depth change, power/upkeep, second factory/separator, or target chaining.
- Uses existing build order pattern and build cost reservation pattern.
- Checks existing/queued `elements_storage` to avoid repeated storage spam.
- Adds minimal telemetry for order placement.
- `node --check src/main.js` reported as passed.
- PR is mergeable.

## Concerns

Current decision condition in `FE_PATCH_BRAIN_01_ChoosePriorityAction()` checks only:

- no elements_storage exists/queued;
- element count >= 80% of limit.

It does not check before returning the action that:

- a free enemy builder exists;
- enemy can afford `elements_storage` cost;
- the bot is not in a state where this action will repeatedly fail and block later actions.

The order function has some checks, but by that point BRAIN-01 has already selected the action and will not fall through to other useful actions on that tick.

## Required changes

Keep scope narrow and patch only the decision safety.

Required fix:

1. Add a small preflight helper or inline checks before returning `build_elements_storage` from `FE_PATCH_BRAIN_01_ChoosePriorityAction()`.
2. Return `build_elements_storage` only if:
   - no elements_storage exists or is queued;
   - current faction element storage >= threshold;
   - a free enemy builder is available;
   - enemy has enough energy to pay `elements_storage` build cost.
3. If these checks fail, do not return `build_elements_storage`; allow BRAIN-01 to continue to builder/harvester/combat/wait logic.
4. Keep the existing order function checks as safety net.

Do NOT add:
- emergency builder;
- factory queue depth changes;
- power/upkeep;
- second factory/separator;
- broader economy scaling.

Rerun:

```bash
node --check src/main.js
```

Update `docs/glm_exchange/CODE_SUMMARY.md` if SHA changes.

## Next action

Ask GLM to patch PR #61 with the preflight checks and return CODE_SUMMARY again.
