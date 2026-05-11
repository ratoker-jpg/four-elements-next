# PR_REVIEW

Task: VISUAL-COMBAT-FX-01 — procedural light_tank shot and hit effects
PR: #59
Verdict: REQUEST_CHANGES
Manual QA: UNVERIFIED / BATCH QA

## Reason

PR scope and implementation direction look acceptable, but the PR is currently not mergeable against `sandbox/main`.

## What is OK

- Review lane PR.
- Main gameplay/render file: `src/main.js`.
- Visual-only procedural combat FX added.
- No assets introduced.
- FX spawn after light_tank damage tick.
- Particle cap exists.
- Existing combat damage/range/cooldown are not changed.
- PR description includes root cause, changed systems, not-touched systems, telemetry, checks and smoke plan.
- `node --check src/main.js` reported as passed.

## Concerns

- PR is not mergeable right now. It likely needs update/rebase from current `sandbox/main` after recent merges.
- Keep scope exactly the same when updating the branch.
- Do not add more visual complexity during the rebase/update.

## Required changes

Update PR branch from current `sandbox/main`, resolve conflicts if any, rerun:

```bash
node --check src/main.js
```

Constraints:
- keep VISUAL-COMBAT-FX-01 changes only;
- do not touch combat damage/range/cooldown;
- do not touch bot AI, pathfinding, economy, scout, save/load;
- update `docs/glm_exchange/CODE_SUMMARY.md` if the SHA changes.

## Next action

Ask GLM to update the PR branch from current `sandbox/main` and return CODE_SUMMARY again.
