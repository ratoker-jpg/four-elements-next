# PR Checklist

Review before asking user/GPT to merge.
For workflow modes, see `agent-ctx/workflow.md`.

## Prompt Mode Check

- [ ] Prompt mode was appropriate:
  - FAST FIX — small constants, labels, tests, docs, tiny bugfix
  - STAGE PR — part of approved architecture, compact prompt
  - STAGE PR PREFLIGHT — non-trivial stage, mini-audit (max 5 sections)
  - FULL AUDIT — new/risky system, full audit
  - HOTFIX AFTER REVIEW — small fix after review, no new audit

## Scope Check

- [ ] PR base branch = `main`
- [ ] Changed files match scope — no unrelated changes
- [ ] No forbidden files changed unless task explicitly requires:
  - `package.json` / `package-lock.json` — only if dependency change is part of the task
  - `src/core/constants.ts` — only if explicitly approved
  - Asset files (PNG, spritesheets) — only if asset task
  - Unrelated `src/systems/` files — only if change is directly required

## PR Body Check

- [ ] PR body matches actual diff (no claims about unchanged files that actually changed)
- [ ] Tests listed honestly (real count, real pass/fail)
- [ ] Manual QA section reflects reality

## Test Requirements

| Task type | Required |
|---|---|
| Gameplay / UI change | Targeted E2E required |
| Risky system change | Full E2E preferred, or honest timeout/spec-by-spec report |
| Docs-only | No code tests needed |

- [ ] Targeted E2E used for gameplay/UI changes
- [ ] Full E2E status documented:
  - [ ] Full run passed, OR
  - [ ] Spec-by-spec fallback with results, OR
  - [ ] CI fallback (explain why)
- [ ] No tests were weakened to accept broken gameplay

**Never weaken tests to accept broken gameplay.**

If E2E fails with infrastructure issue:
1. Rerun targeted spec file only.
2. Document exact failure and rerun result.

## Architecture Tracker Check

- [ ] `agent-ctx/current-arch.md` updated if a major ARCH stage was merged in this PR

## Core Loop Smoke Test

Before merge, verify the normal core loop still works:

- [ ] New game starts
- [ ] Build separator — construction completes
- [ ] Harvester delivers raw
- [ ] No `no-route` on normal generated map

This can be verified via E2E or manual QA at https://ratoker-jpg.github.io/four-elements-next/?devtools=1
