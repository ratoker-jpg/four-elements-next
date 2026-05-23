# Prompt Templates

Copy-ready templates for each workflow mode.
Source of truth for GLM prompt format.

E2E testing requirements are tiered by PR risk. See `agent-ctx/workflow.md` → "E2E Policy — Tiered by PR Risk".

## FAST FIX

```text
Task: <ID> — <one-line title>

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: FAST FIX

What: <what to change, 1-2 sentences>
File: <file and function>
Test: <what to verify, or "none needed for docs">

Do not change: <anything outside scope>
```

No audit. No full E2E. Open PR when done.

---

## STAGE PR

```text
Task: <ID> — <one-line title>

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: STAGE PR

What: <what to implement>
Files: <expected source/test/doc files>
Rules:
- <key constraint 1>
- <key constraint 2>
- Do not change: <forbidden files>

Tests:
- unit: <what to test>
- E2E: <relevant spec files or "none">

PR body must include:
- <required PR body items>
```

No full 9-section audit. Compact prompt only. Open PR when done.

---

## STAGE PR PREFLIGHT

Mini-audit before a stage PR when the change is non-trivial
but does not warrant FULL AUDIT.

```text
Task: <ID> — PREFLIGHT

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: STAGE PR PREFLIGHT

1. Touch files: <list files that will change>
2. Planned behavior: <what the code will do>
3. Risks / unknowns: <what might go wrong>
4. Tests: <unit + E2E plan>
5. Stop conditions: <when to stop and re-audit>

Do not implement yet. Wait for approval.
```

Max 5 sections. No 9-section audit. If risks are too high, escalate to FULL AUDIT.

---

## FULL AUDIT

```text
Task: <ID> — FULL AUDIT

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: audit-only

This is audit only.
Do not edit files.
Do not commit.
Do not open PR.

Audit target: <system or feature area>

Read first:
- agent-ctx/state.md
- agent-ctx/workflow.md

Return:
- current state summary
- proposed changes
- data shape changes
- test plan
- risks
- staged implementation plan
- files that must not be touched

End with: Жду Делай
```

Only for: save/load, map editor, enemy bot, fog of war, combat, economy rewrite, new GameState lifecycle.

---

## HOTFIX AFTER REVIEW

```text
Task: HOTFIX — <one-line fix description>

PR: #<number>
Mode: HOTFIX AFTER REVIEW

Fix: <what to fix, 1-2 sentences>
File: <file and line>
Test: <targeted test to add, or "existing tests sufficient">

Push to existing PR branch.
```

No new audit. No full E2E unless the fix touches E2E-covered flows.

---

## PR REVIEW REQUEST

Format for requesting GPT/user review of an open PR.

```text
PR Review Request: #<number> — <title>

Mode used: <FAST FIX / STAGE PR / PREFLIGHT / FULL AUDIT / HOTFIX>

Changed files:
- <file 1>
- <file 2>

Summary: <1-2 sentence what this PR does>

Tests:
- unit: <count> passed
- E2E: <full / targeted / skipped (docs-only)>
- CI: <all green / specific failure noted>

Scope check:
- [ ] No forbidden files changed
- [ ] No tests weakened
- [ ] PR body matches diff

Ready for review.
```
