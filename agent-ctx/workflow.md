# Workflow Modes

Choose the right mode before starting any task.
For prompt templates, see `agent-ctx/prompt-templates.md`.

## FAST FIX

Small constants, labels, tests, docs, tiny bugfix.

- **No audit needed.**
- **Targeted tests only** (relevant unit tests, no full E2E unless the fix touches E2E-covered flows).
- Commit, push, open PR immediately.

Examples: clamp a value, fix a label, add a unit test, update docs.

## STAGE PR

Part of an already-approved architecture (e.g. PATHFINDING-ARCH-01 PR5).

- **No full audit needed** — architecture already approved, just the implementation spec.
- **No 9-section audit.** Compact implementation prompt only.
- **Targeted E2E** (relevant spec files only) + **full unit tests**.
- Commit, push, open PR.

If the stage is non-trivial and you want a quick alignment check before coding, use **STAGE PR PREFLIGHT** instead.

## STAGE PR PREFLIGHT

A mini-audit for non-trivial stage PRs where you want alignment
before implementation, but a full 9-section audit is overkill.

- **Max 5 sections:**
  1. **Touch files** — which files will change
  2. **Planned behavior** — what the code will do
  3. **Risks / unknowns** — what might go wrong
  4. **Tests** — unit + E2E plan
  5. **Stop conditions** — when to stop and escalate to FULL AUDIT
- **No implementation yet.** Wait for approval, then implement.
- If risks turn out to be too high, escalate to **FULL AUDIT**.

When to use PREFLIGHT vs STAGE PR:
- **STAGE PR** — the change is mechanical, well-defined, low risk.
- **PREFLIGHT** — the change is non-trivial, touches multiple systems, or has unknowns.
- **FULL AUDIT** — new system, risky architecture, or PREFLIGHT revealed showstoppers.

## FULL AUDIT

New system, GameState lifecycle, save/load, map editor, enemy bot, fog of war, combat, economy rewrite.

- **Full audit required before implementation.**
- Define: what changes, new files, data shape, test plan, risks.
- User/GPT approves audit, then implement.
- Full E2E preferred before PR.
- **This is the only mode that uses a 9-section audit.**

## HOTFIX AFTER REVIEW

Small fix requested after GPT/user review of an open PR.

- **No new audit.**
- Fix the specific issue, add targeted test if applicable.
- Push to existing PR branch.

## Audit Policy Summary

| Mode | Audit? | Format |
|---|---|---|
| FAST FIX | No | — |
| STAGE PR | No | Compact prompt |
| STAGE PR PREFLIGHT | Mini-audit | Max 5 sections |
| FULL AUDIT | Yes | Full audit |
| HOTFIX AFTER REVIEW | No | — |

**Explicit rule: no 9-section audit unless FULL AUDIT.**

## E2E Policy

| Phase | What to run |
|---|---|
| During iteration | `type-check` + `build` + `unit tests` + relevant E2E spec files |
| Before final PR | Full E2E if practical (`npm run test:e2e`) |
| Full E2E times out | Run specs individually with `--workers=1`, or report CI fallback honestly |
| Docs-only | No code tests required |
| Gameplay / UI | Targeted E2E required |
| Never | Weaken tests to accept broken gameplay |

If E2E fails with infrastructure issue (server not starting, browser not found):
1. Rerun targeted spec file only.
2. Document exact failure and rerun result in PR body.

## General Rules

- **Always open PR**, never push directly to `main`.
- PR base must be `main`.
- PR body must match actual diff.
- If changing `src/core/constants.ts` — require explicit approval.
- GPT/user still reviews PRs before merge. Faster workflow does NOT remove PR review.
- For risky systems, GPT/user approval is still required after audit/preflight.

## Relationship to docs/AI_WORKFLOW_CONTRACT.md

That document defines the broader process (roles, two-phase workflow, re-audit triggers, branch discipline, anti-patterns).
This document defines the **mode selection and E2E policy** for GLM sessions.
When they conflict on mode selection or E2E policy, **this document takes priority**.
Prompt templates are in `agent-ctx/prompt-templates.md`, not in the AI_WORKFLOW_CONTRACT.
