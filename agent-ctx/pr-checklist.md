# PR Checklist

Review before asking user/GPT to merge.

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

**Never weaken tests to accept broken gameplay.**

If E2E fails with infrastructure issue:
1. Rerun targeted spec file only.
2. Document exact failure and rerun result.

## Core Loop Smoke Test

Before merge, verify the normal core loop still works:

- [ ] New game starts
- [ ] Build separator — construction completes
- [ ] Harvester delivers raw
- [ ] No `no-route` on normal generated map

This can be verified via E2E or manual QA at https://ratoker-jpg.github.io/four-elements-next/?devtools=1
