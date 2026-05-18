# AI Workflow Contract

This document is the persistent workflow contract for ChatGPT / GLM / Codex-style work on `ratoker-jpg/four-elements-next`.

Read this file before starting a new AI-assisted task. Treat it as the single source of truth for process rules unless a newer document explicitly replaces it.

## Repository

- Repo: `ratoker-jpg/four-elements-next`
- Main branch: `main`
- Current project mode: early TypeScript/Vite RTS project, not the old sandbox monolith
- Old `glm-game-sandbox` / legacy sandbox knowledge may be useful as historical context only, but must not be assumed as current code structure

## Core rule

Do not immediately send every task to GLM/Codex.

First classify the task:

1. Small visual/doc/config change — can often be handled directly or by a small focused PR.
2. Stage implementation from an approved architecture audit — use implementation prompt, not a new full audit.
3. New or risky architecture area — run Phase 1 audit first.
4. Unclear or changed assumptions — stop and re-audit.

## Roles

### ChatGPT

- Maintains process discipline.
- Reviews audits, PRs, diffs, branch cleanliness, CI, and scope.
- Pushes back if GLM/Codex would waste limits or broaden scope.
- Writes tightened prompts.
- Can create docs-only PRs directly when safe.

### GLM

- Used for larger code changes, architecture stages, and implementation PRs.
- Must follow the requested phase exactly.
- Must not improvise outside scope.
- Must open PRs against `main` unless told otherwise.

### Codex

- Use sparingly.
- Prefer for read-only QA, local reproduction, asset-only operations, or small approved fixes when permissions/tooling make it faster.
- Do not use Codex as the default path for every task.

## Standard two-phase workflow

Use this for new risky areas:

1. Phase 1 Audit Only
   - No file edits.
   - No commit.
   - No PR.
   - Must end with exactly: `Жду Делай`.
2. ChatGPT reviews the audit.
3. User approves with `Делай`.
4. GLM implements the agreed scope.
5. GLM opens PR.
6. ChatGPT reviews PR before merge.

## Big architecture workflow

For broad architecture work, do not create many repeated audits.

Use this model:

1. One large architecture audit.
2. Split the implementation into stages.
3. Implement one stage at a time.
4. Stop after each stage for review.
5. Re-audit only when a trigger occurs.

Preferred pattern:

```text
Big Audit
→ Stage A implementation PR
→ review / CI / manual QA / merge
→ Stage B implementation PR
→ review / CI / manual QA / merge
→ Stage C implementation PR
→ review / CI / manual QA / merge
```

Do not run a fresh full audit before every stage if the stage is already defined in the approved Big Audit.

### Stage implementation prompt rule

For stages derived from an approved Big Audit, prompts should say:

```text
Do not perform a new Phase 1 audit.
Use the approved <ARCH_NAME> Big Audit as the source of truth.
Before coding, verify current main still matches the stage assumptions.
If current code no longer matches the audit assumptions, stop and report instead of implementing.
Implement only <Stage X>.
```

## Re-audit triggers

Run a second audit only if one of these happens:

- Current code no longer matches the Big Audit assumptions.
- A stage unexpectedly needs broad changes outside its listed scope.
- More than the expected core files need non-mechanical changes.
- TypeScript errors reveal the target contract is wrong.
- CI failures are architectural, not local fixes.
- Manual QA shows the design itself is wrong.
- GLM starts using old sandbox architecture or wrong repository structure.
- Branch/PR history becomes dirty enough that the diff is no longer trustworthy.

## PR strategy

Default for this repo: one Big Audit, separate stage PRs.

Why:

- `main` receives working checkpoints.
- Each PR is reviewable.
- Rollback is easier.
- CI failures are easier to locate.

Avoid one massive implementation PR unless explicitly chosen for a very small contained epic.

## Branch discipline

Every implementation PR must start from latest `origin/main`.

Before opening or updating a PR, GLM must ensure:

- Branch base is current `main`.
- Diff does not include already-merged changes from previous stages.
- PR is not accidentally based on old sandbox or wrong remote.
- No `dist/`, build output, package lock, or unrelated files are committed unless explicitly requested.
- PR body names the stage and exact scope.

If a PR diff includes already-merged previous-stage changes, do not merge it. Rebase or recreate the branch from latest `main` and re-apply only the current stage.

## Required checks for code PRs

Run all unless the task is docs-only or assets-only:

```bash
npm run type-check
npm run build
npm run test
npm run test:e2e
GITHUB_PAGES=true npm run build
```

If E2E is flaky:

- Re-run the specific failing test.
- If it passes on retry and no related code changed, note it as flaky.
- Do not hide real failures as flake.

## PR review checklist for ChatGPT

Before recommending merge:

1. PR targets `main`.
2. PR is mergeable.
3. Changed files match declared scope.
4. No package/build artifacts unless requested.
5. No old sandbox files or wrong repo artifacts.
6. No unrelated visual/gameplay changes.
7. CI is green or failure is clearly unrelated and explained.
8. PR body includes changed files, behavior changes, tests, manual QA notes.
9. Diff does not include already-merged previous-stage changes.
10. If branch is diverged or dirty, request clean rebase/recreate before merge.

## Current architecture epic: CIVIL-SANDBOX-ARCH-01

Goal: reach the Civil Sandbox Checkpoint.

Player should be able to:

- start game;
- see map;
- gather Raw;
- process Raw into Matter and Element;
- build civil base;
- expand Power and Control;
- produce Builder and Harvester;
- play a stable non-combat base loop.

Out of scope:

- combat;
- enemy AI;
- HQ tier upgrades;
- tech tree;
- save/load;
- major visual polish;
- renderer rewrite.

### Stage A — STORAGE-SPLIT-01

Status: implemented and merged as PR #36.

Purpose:

- Replace generic `storage` with:
  - `raw-storage`
  - `matter-storage`
- `raw-storage` increases Raw cap only.
- `matter-storage` increases Matter cap and Element cap.

### Stage B — HARVESTER-DROPOFF-01

Status: implemented and merged as PR #37.

Purpose:

- Rename `moving-to-hq` to `moving-to-dropoff`.
- Harvester delivers Raw to nearest completed `raw-storage`, fallback HQ.
- Add `waiting-full-storage`.
- Preserve carry and prevent Raw loss when Raw cap is full.

Important PR hygiene issue encountered and resolved:

- PR #37 was initially based on a dirty/diverged branch and included already-merged Stage A changes.
- It was recreated from latest `main` and merged only after the diff was clean.

### Stage C — MULTI-BUILDER + HQ POWER

Planned next.

Purpose:

- Let any available builder construct, not only the first builder.
- Make produced builders useful.
- Add small HQ base power if still desired by the approved CIVIL-SANDBOX-ARCH-01 audit.

No new full audit needed if assumptions still hold. Use approved Big Audit stage implementation prompt.

### Stage D — RELAY FOOTPRINT / BALANCE / HUD POLISH

Planned, only after Stage C.

Possible scope:

- Command Relay footprint 2x2 → 1x1 if still desired.
- Balance tuning.
- Raw full / cap warning in HUD.

Run audit only if footprint/occupancy changes look risky.

## Prompt templates

### New risky architecture area

```text
Task: <NAME> — Phase 1 Audit Only.

This is audit only.
Do not edit files.
Do not commit.
Do not open PR.
End with exactly:
Жду Делай
```

### Approved Big Audit stage implementation

```text
Task: <STAGE_NAME> — implementation from approved <ARCH_NAME> Big Audit.

Do not perform a new Phase 1 audit.
Use the approved <ARCH_NAME> Big Audit as the source of truth.
Before coding, verify current main still matches the stage assumptions.
If current code no longer matches the audit assumptions, stop and report instead of implementing.

Implement only <Stage X>.
Do not implement later stages.
Open PR into main.
Run required checks.
```

### Dirty PR cleanup

```text
Stop. Do not change feature logic.
The PR branch includes unrelated or already-merged changes.
Rebase or recreate the branch from latest origin/main and re-apply only the current stage.
Run checks again and update the PR.
```

## Anti-patterns

Do not:

- run a new full audit before every stage when a Big Audit already exists;
- merge dirty/diverged branches;
- mix visual polish into civil architecture stages;
- mix combat/AI into civil sandbox work;
- change package files unless explicitly required;
- commit `dist/` or generated build output;
- silently change balance values during structural stages;
- use old sandbox file paths like `src/main.js` as if they existed in `four-elements-next`.

## Living document rule

Update this file whenever the workflow changes.

If a new chat starts, paste or reference this file first so the assistant can follow the current process instead of reconstructing it from memory.
