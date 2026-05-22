# AI Workflow Contract

This document is the persistent workflow contract for ChatGPT / GLM / Codex-style work on `ratoker-jpg/four-elements-next`.

Read this file before starting a new AI-assisted task. Treat it as the single source of truth for process rules unless a newer document explicitly replaces it.

## Repository

- Repo: `ratoker-jpg/four-elements-next`
- Main branch: `main`
- Current project mode: early TypeScript/Vite browser RTS project, not the old sandbox monolith
- Old `glm-game-sandbox` / legacy sandbox knowledge may be useful as historical context only, but must not be assumed as current code structure
- `src/main.ts` is wiring only; do not use old `src/main.js` assumptions

## Core rule

Do not immediately send every task to GLM/Codex.

First classify the task:

1. Small visual/doc/config change — can often be handled directly or by a small focused PR.
2. Stage implementation from an approved architecture audit — use implementation prompt, not a new full audit.
3. New or risky architecture area — run Phase 1 audit first.
4. Unclear or changed assumptions — stop and re-audit.
5. Asset/tooling experiment — keep output as candidate-stage until it passes the asset gates in `docs/ASSET_POLICY.md`.

**Workflow modes and E2E policy are defined in `agent-ctx/workflow.md`.**
When this document conflicts with `agent-ctx/workflow.md` on mode selection or E2E policy, `agent-ctx/workflow.md` takes priority.

## Roles

### ChatGPT

- Maintains process discipline.
- Reviews audits, PRs, diffs, branch cleanliness, CI, and scope.
- Pushes back if GLM/Codex would waste limits or broaden scope.
- Writes tightened prompts.
- Can create docs-only PRs directly when safe.

### GLM

- Primary executor for larger code changes, architecture stages, and implementation PRs.
- Must follow the requested phase exactly.
- Must not improvise outside scope.
- Must open PRs against `main` unless told otherwise.

### Codex

- Use sparingly.
- Prefer for read-only QA, local reproduction, asset-only operations, or small approved fixes when permissions/tooling make it faster.
- Do not use Codex as the default path for every task.
- Do not use Codex just to run external asset experiments when a local/doc process is enough.

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
2. Split the implementation into named stages.
3. Treat stages as planning/review boundaries, not mandatory one-PR boundaries.
4. Bundle or split implementation PRs based on risk, diff size, coupling, and testability.
5. Stop after each implementation PR for review.
6. Re-audit only when a trigger occurs.

Preferred pattern:

```text
Big Audit
→ Stage A / B / C / D plan
→ implementation PR 1 containing one or more approved stages
→ review / CI / manual QA / merge
→ implementation PR 2 only if the remaining stages are too risky or too large to bundle
→ review / CI / manual QA / merge
```

Do not run a fresh full audit before every stage if the stage is already defined in the approved Big Audit.

### Adaptive PR bundling rule

The default strategy is adaptive, not mechanical.

Use one Big Audit for one coherent architecture area. Then choose PR grouping situationally:

- Bundle adjacent stages in one PR when the project area is small, the diff is reviewable, the stages share the same files/systems, and tests can cover the combined behavior.
- Split stages into separate PRs when the diff becomes too large, the work touches unrelated systems, risk increases, CI/debugging would become unclear, or rollback would be painful.
- It is allowed to implement internal helpers/systems first and connect them later in the same PR or a later PR, if that reduces risk and keeps behavior reviewable.
- It is allowed to merge one safe PR covering multiple stages and then continue to the next approved stage without a new audit.
- A new audit is required only when a re-audit trigger fires.

For the current small TypeScript/Vite codebase, prefer faster bundled PRs when safe. Do not over-split work just because stages are named separately.

### Stage implementation prompt rule

For stages derived from an approved Big Audit, prompts should say:

```text
Do not perform a new Phase 1 audit.
Use the approved <ARCH_NAME> Big Audit as the source of truth.
Before coding, verify current main still matches the stage assumptions.
If current code no longer matches the audit assumptions, stop and report instead of implementing.
Implement only the approved stage(s): <Stage X / Y / Z>.
If adjacent approved stages can be safely bundled, explain why in the PR body and keep the diff reviewable.
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

## Current project status — 2026-05-23

### Closed / accepted

- PR #51 — `ASSET-BUILDINGS-01`: replaced production building PNGs for all 4 factions.
- PR #52 — `ASSET-BUILDINGS-01`: tuned building render profiles and placement offsets.
- PR #54 — `BUILDING-PLACEMENT-01`: added one-tile gap for auto-placed buildings.
- PR #55 — `START-STATE-01`: simplified initial base state.
- PR #93 — `MAP-EDITOR-ARCH-01 PR1`: editor shell, map preview, pan/zoom, info panel, toolbar.
- PR #94 — `MAP-EDITOR-ARCH-01 PR2`: object palette + placement/removal, Select/Place/Erase tools.
- PR #95 — `MAP-EDITOR-ARCH-01 PR3`: validation + placement feedback, status line, validation panel.
- PR #96 — `MAP-EDITOR-ARCH-01 PR4`: seed selection flow, Seed Screen between Map Size and Faction Select.
- PR #97 — `MAP-EDITOR-ARCH-01 PR5`: mapgen config foundation, `MapgenConfig`, `resolveMapgenConfig()`.
- PR #98 — `MAP-EDITOR-ARCH-01 PR6`: mapgen preset selector, 4 presets on Seed Screen.

### Current gameplay baseline

- New Game flow: Main Menu → Map Size → Seed Screen → Faction Select → Game Screen
- Seed Screen: seed input, "Случайный сид" button, 4 mapgen presets (balanced, more-resources, more-mountains, open-map)
- Back from Faction Select to Seed Screen preserves seed + preset
- Map editor: dev-only screen with preview, pan/zoom, palette placement/removal, validation
- Start state: HQ/base only as the starting building.
- Starting units: 2 harvesters + 1 builder.
- No extra starting buildings: no separator, no raw-storage, no power-plant, no command-relay.
- Harvester raw delivery falls back to HQ when no raw-storage exists.
- If a raw-storage is later built, harvester delivery should prefer it where appropriate.
- Buildings and construction sites occupy their full footprint in occupied-tile checks.
- New construction auto-placement enforces one-tile gap between buildings/sites.
- Volcanoes deprecated for current visual direction: no volcano UI, no volcano presets, no volcano config fields.

### Current starting values

- Buildings: 0 extra buildings beyond HQ/base.
- Builders: 1.
- Harvesters: 2.
- Raw: `0/200`.
- Matter: `100/200`.
- Active faction element: `3/10`.
- Power: HQ supply only, net `+2`.
- Control: `3/10`.

### Closed building asset block

The building asset block is accepted and should not be reopened without a separate scoped decision.

Do not change these without explicit approval:

- production building PNGs;
- building sprite profiles;
- `containFit` math;
- alpha-bounds logic;
- building render math;
- accepted offsets from `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`.

Future candidate assets should go through asset preview and the asset gates in `docs/ASSET_POLICY.md`.

## Current architecture rules

Read before advising or implementing project work:

1. `docs/AI_WORKFLOW_CONTRACT.md`
2. `docs/ARCHITECTURE_RULES.md`
3. `docs/architecture/NEXT_ARCHITECTURE_OVERVIEW.md`
4. `docs/ASSET_POLICY.md`
5. `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`

Core rules:

- Systems do not import render/screens.
- Render does not mutate gameplay state.
- `GameWorld` is thin glue.
- `GameState` is the mutable aggregate.
- `main.ts` is wiring only.
- Do not propose ECS/event bus/DI rewrite unless explicitly approved.

## AI output gates

AI can assist with docs, tests, audits, scoped patches, asset candidates, VFX candidates, and QA summaries.

AI output must not bypass project gates:

- Code changes require diff review and relevant tests.
- Asset output stays candidate-stage until cleanup, normalization, manifest/index metadata when applicable, preview, and manual approval.
- External AI/tool outputs must not be copied directly into production runtime paths.
- License and source status must be recorded for external assets, audio, workflows, and generated candidates.

For details, see:

- `docs/ASSET_POLICY.md`
- `docs/ai/AI_TOOLING_AND_SKILLS_POLICY.md`

## PR strategy

Default for this repo: one Big Audit per coherent architecture area, then adaptive implementation PR grouping.

Why:

- Fewer repeated audits.
- Faster movement while the codebase is small.
- Related phases can be reviewed together when they share files and behavior.
- `main` still receives working checkpoints when risk increases.
- Rollback remains manageable because high-risk or oversized stages can still be split out.

Preferred implementation choices:

1. One PR for multiple approved stages if the combined diff remains compact, coherent, and testable.
2. Separate PRs when the combined work becomes risky, broad, difficult to review, or hard to roll back.
3. No new audit between approved stages unless a re-audit trigger occurs.
4. PR body must explain which stages are included and why they were bundled or split.

Avoid both extremes:

- Do not create a new audit/PR for every tiny phase when one approved Big Audit covers the area.
- Do not force one massive implementation PR if the work becomes hard to review, debug, or roll back.

## Branch discipline

Every implementation PR must start from latest `origin/main`.

Before opening or updating a PR, GLM must ensure:

- Branch base is current `main`.
- Diff does not include already-merged changes from previous stages.
- PR is not accidentally based on old sandbox or wrong remote.
- No `dist/`, build output, package lock, or unrelated files are committed unless explicitly requested.
- PR body names the stage(s), exact scope, and bundling/splitting rationale.

If a PR diff includes already-merged previous-stage changes, do not merge it. Rebase or recreate the branch from latest `main` and re-apply only the current approved scope.

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
11. If multiple stages are bundled, PR body explains why bundling is safe.
12. If stages are split, PR body explains what remains and whether a new audit is needed.

## Prompt templates

Prompt templates have moved to `agent-ctx/prompt-templates.md`.

The following legacy templates are kept for reference only.
For current templates, use `agent-ctx/prompt-templates.md`.

### New risky architecture area (legacy)

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

Implement only the approved stage(s): <Stage X / Y / Z>.
If multiple stages are bundled, explain why the combined diff is safe and reviewable.
Do not implement unapproved later stages.
Open PR into main.
Run required checks.
```

### Dirty PR cleanup

```text
Stop. Do not change feature logic.
The PR branch includes unrelated or already-merged changes.
Rebase or recreate the branch from latest origin/main and re-apply only the current approved scope.
Run checks again and update the PR.
```

## Anti-patterns

Do not:

- run a new full audit before every stage when a Big Audit already exists;
- split every named phase into a separate PR when bundling is clearly safe;
- force one giant PR when diff size/risk makes review weak;
- merge dirty/diverged branches;
- mix visual polish into architecture stages;
- mix combat/AI into civil sandbox work without a scoped decision;
- change package files unless explicitly required;
- commit `dist/` or generated build output;
- silently change balance values during structural stages;
- use old sandbox file paths like `src/main.js` as if they existed in `four-elements-next`;
- copy AI-generated assets directly into production asset paths;
- treat external skills/plugins/services as authoritative project workflow.

## Living document rule

Update this file whenever the workflow changes.

If a new chat starts, paste or reference this file first so the assistant can follow the current process instead of reconstructing it from memory.
