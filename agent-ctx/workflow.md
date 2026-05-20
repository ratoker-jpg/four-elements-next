# Workflow Modes

Choose the right mode before starting any task.

## FAST FIX

Small constants, labels, tests, docs, tiny bugfix.

- **No audit needed.**
- **Targeted tests only** (relevant unit tests, no full E2E unless the fix touches E2E-covered flows).
- Commit, push, open PR immediately.

Examples: clamp a value, fix a label, add a unit test, update docs.

## STAGE PR

Part of an already-approved architecture (e.g. PATHFINDING-ARCH-01 PR5).

- **No full audit needed** — architecture already approved, just the implementation spec.
- Compact implementation prompt: what, where, rules, tests.
- **Targeted E2E** (relevant spec files only) + **full unit tests**.
- Commit, push, open PR.

## FULL AUDIT

New system, GameState lifecycle, save/load, map editor, enemy bot, fog of war, combat, economy rewrite.

- **Audit required before implementation.**
- Define: what changes, new files, data shape, test plan, risks.
- User/GPT approves audit, then implement.
- Full E2E preferred before PR.

## HOTFIX AFTER REVIEW

Small fix requested after GPT/user review of an open PR.

- **No new audit.**
- Fix the specific issue, add targeted test if applicable.
- Push to existing PR branch.

## E2E Policy

| Phase | What to run |
|---|---|
| During iteration | `type-check` + `build` + `unit tests` + relevant E2E spec files |
| Before final PR | Full E2E if practical (`npm run test:e2e`) |
| Full E2E times out | Run specs individually with `--workers=1`, or report CI fallback honestly |

**Never weaken tests to accept broken gameplay.**

If E2E fails with infrastructure issue (server not starting, browser not found):
1. Rerun targeted spec file only.
2. Document exact failure and rerun result in PR body.

## General Rules

- **Always open PR**, never push directly to `main`.
- PR base must be `main`.
- PR body must match actual diff.
- If changing `src/core/constants.ts` — require explicit approval.
