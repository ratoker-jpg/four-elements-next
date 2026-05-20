# Four Elements Next — AI Work Request Template 2026-05-19

Use this template when asking another AI assistant to continue work on `ratoker-jpg/four-elements-next`.

This exists to prevent confusion with the old sandbox repository.

## 1. Required project context

```text
Repository: ratoker-jpg/four-elements-next
Base branch: main
Stack: TypeScript strict mode, Vite, Canvas 2D, HTML overlay UI, Vitest, Playwright
Current mode: clean architecture browser RTS, not the old sandbox monolith
```

Do not use assumptions from `ratoker-jpg/glm-game-sandbox` unless explicitly provided as historical reference.

## 2. Files to read first

```text
agent-ctx/state.md
agent-ctx/workflow.md
agent-ctx/prompt-templates.md
README.md
docs/AI_WORKFLOW_CONTRACT.md
```

For workflow mode selection and E2E policy, `agent-ctx/workflow.md` is the source of truth.
For prompt templates, `agent-ctx/prompt-templates.md` is the source of truth.

For runtime implementation, inspect relevant source files under:

```text
src/
tests/
```

## 3. Request format

```text
Task: <TASK_ID> — <short title>

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: <audit-only | docs-only | implementation>

Read first:
- agent-ctx/state.md
- agent-ctx/workflow.md
- agent-ctx/prompt-templates.md
- any task-specific docs listed below

Goal:
<what should be achieved>

Scope:
<exact files/areas expected to change>

Out of scope:
<what must not be changed>

Required checks:
<type-check/build/test/e2e/docs-only checks>

Expected PR body:
<what the PR description must include>
```

## 4. Audit-only task template

```text
Task: <TASK_ID> — Phase 1 Audit Only

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: audit-only

This is audit only.
Do not edit files.
Do not commit.
Do not open PR.

Read first:
- agent-ctx/state.md
- agent-ctx/workflow.md
- agent-ctx/prompt-templates.md

Audit target:
<system or feature area>

Return:
1. current implementation summary;
2. relevant files/functions;
3. what is missing;
4. risks;
5. proposed staged plan;
6. tests needed;
7. files that must not be touched;
8. end with: Жду Делай
```

## 5. Docs-only task template

```text
Task: <TASK_ID> — docs-only update

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: docs-only

Goal:
<documentation goal>

Allowed changes:
- docs/**/*.md
- optionally README.md if explicitly requested

Forbidden changes:
- src/**
- public/assets/**
- package.json
- package-lock.json
- dist/**
- tests/** unless explicitly requested

Validation:
- git diff --name-only
- confirm only Markdown files changed

PR body must include:
- added/changed files;
- purpose of each file;
- runtime impact: none;
- checks performed;
- next recommended task.
```

## 6. Implementation task template

```text
Task: <TASK_ID> — implementation

Repo: ratoker-jpg/four-elements-next
Base branch: main
Mode: implementation

Use latest origin/main.
Do not use old sandbox assumptions.

Goal:
<implementation goal>

Expected files:
<expected source/test/doc files>

Forbidden files:
<files or folders that must not be changed>

Rules:
- keep src/main.ts wiring-only;
- keep GameWorld as glue where possible;
- systems own simulation logic;
- render does not mutate gameplay state;
- no broad renderer rewrite unless task explicitly says so;
- no production asset changes unless task explicitly says asset work;
- no combat/bot scope unless task explicitly says combat/bot.

Required checks:
- npm run type-check
- npm run build
- npm run test
- npm run test:e2e
- GITHUB_PAGES=true npm run build

PR body must include:
- summary;
- changed files;
- behavior changes;
- explicit unchanged systems;
- tests run with results;
- manual QA notes;
- known limitations.
```

## 7. Common forbidden assumptions

Do not assume:

- there is a `fe-next/` folder in this repo;
- the runtime uses `window.FE_NEXT_*` globals;
- the project is plain JS script-tag architecture;
- the base branch is `sandbox/main`;
- the old sandbox `src/main.js` exists here;
- old bot/combat systems are current production code.

Correct assumptions:

- current project is standalone `four-elements-next`;
- base branch is `main`;
- runtime is TypeScript/Vite;
- `src/main.ts` is screen wiring;
- `GameWorld` owns runtime glue;
- `GameState` owns simulation aggregate;
- `runSystems()` controls simulation tick order.

## 8. Good next prompts

### Dev sandbox

```text
Task: DEV-SANDBOX-ARCH-01 — Phase 1 Audit Only

Audit current debug/test hooks and propose a staged dev QA panel for time/resource/map/territory testing.
End with Жду Делай.
```

### Pathfinding

```text
Task: PATHFINDING-ARCH-01 — Phase 1 Audit Only

Audit current movement assumptions, map validation, harvesting movement, construction access, and propose MVP pathfinding stages.
End with Жду Делай.
```

### Visual QA

```text
Task: VISUAL-QA-ARCH-01 — Phase 1 Audit Only

Audit current builder/harvester/resource/environment rendering and propose grounding/profile QA stages. Do not reopen accepted building assets unless unavoidable.
End with Жду Делай.
```

### Asset pipeline

```text
Task: ASSET-PIPE-01 — Phase 1 Audit Only

Audit current asset loading, manifests, sprite profiles, asset preview, and VISUAL_ASSET_PIPELINE.md. Propose candidate/normalization/index.json workflow.
End with Жду Делай.
```
