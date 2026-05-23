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

## Test Requirements — Tiered by PR Risk

Full policy: `agent-ctx/workflow.md` → "E2E Policy — Tiered by PR Risk".

| PR type | type-check / build | Unit tests | Targeted E2E | Full E2E |
|---|---|---|---|---|
| Docs-only | — | — | — | — |
| CSS / text / polish | If practical | — | If interaction changed | — |
| Screen flow / editor | Yes | Yes | Affected specs | Optional |
| Runtime / gameplay / systems | Yes | Yes | Affected specs | Recommended |
| Final ARCH validation | Yes | Yes | Affected specs | Yes |

- [ ] PR risk tier identified correctly
- [ ] Tests match the tier requirements above
- [ ] Targeted E2E used for gameplay/UI changes
- [ ] Full E2E status documented (if tier requires):
  - [ ] Full run passed, OR
  - [ ] Spec-by-spec fallback with results, OR
  - [ ] CI fallback (explain why)
- [ ] No tests were weakened to accept broken gameplay
- [ ] No E2E failure called "flake" without targeted rerun/proof
- [ ] No failed checks hidden in PR body

### Never allowed

- Skipping or weakening tests to make CI green.
- Increasing timeouts as primary fix.
- Calling an E2E failure "flake" without targeted rerun/proof.
- Hiding failed checks in PR body.

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

## Visual QA Smoke Test

For PRs that change rendering, sprites, shadows, unit animation, or visual overlays:

- [ ] Run `?devtools=1` smoke — open dev panel, verify it loads
- [ ] Check **Builder Test** scenario — builder spawns, camera moves to HQ
- [ ] Check **Economy Test** scenario — harvesters spawn, separator builds, camera moves to HQ
- [ ] Verify overlays still toggle (grid, footprint, blocking)
- [ ] For sprite/runtime changes, verify **Sprite Viewer** contract if assets are involved
- [ ] Verify directional shadows render on units/buildings/HQ/resources
- [ ] Verify builder faces movement direction during walk
- [ ] Verify harvester movement facing is stable (no flicker)
