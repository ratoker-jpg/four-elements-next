# Four Elements Next — Remaining Work 2026-05-19

Status: planning backlog after current civil-sandbox/mapgen/economy baseline.

This document translates the current project state into implementation lanes. It does not replace `docs/project/ROADMAP_CURRENT.md`; it complements it with a more direct task backlog.

## 1. Recommended next lanes

### Lane 1 — `NEXT-CHECKPOINT-01`

Goal: confirm that current docs and runtime state match after the latest merged work.

Suggested scope:

- review this checkpoint package;
- confirm `ROADMAP_CURRENT.md` is still accurate after PR #68;
- confirm whether `ECONOMY-BASELINE-01` should continue or be marked partially completed;
- update workflow/status docs if any previous priority is now stale.

Type: docs/audit, not gameplay implementation.

### Lane 2 — `DEV-SANDBOX-ARCH-01`

Goal: add fast QA tools before combat and bot work.

Missing useful tools:

- visible dev overlay panel;
- fast-forward time button;
- add raw/matter/element buttons;
- move camera to HQ/center;
- show map seed and validation report;
- show counts for resources/obstacles/decor;
- toggle territory/grid/resource debug;
- spawn builder/harvester/factory test actions;
- quick construction completion for QA.

Reason: future pathfinding, visual QA, and combat work will be slow without better dev controls.

### Lane 3 — `UI-SHELL-ARCH-01`

Goal: make the outer game shell usable.

Current known missing items:

- Continue save list shell;
- Esc pause menu;
- Save button shell;
- Settings access from pause menu;
- UI scale applied consistently;
- clearer map-size/faction selection copy;
- better in-game status feedback.

### Lane 4 — `PATHFINDING-ARCH-01`

Goal: replace straight-line movement assumptions with an MVP pathing model.

Recommended stages:

1. passability grid contract;
2. pathfinding function and tests;
3. harvester route to resource/dropoff;
4. builder access route to construction site;
5. right-click marker: accepted/unavailable;
6. manual QA and E2E smoke.

Constraints:

- do not rewrite the whole movement model in one broad PR;
- keep mapgen validation compatible;
- do not start enemy bot before at least MVP pathfinding exists.

### Lane 5 — `VISUAL-QA-ARCH-01`

Goal: improve visual grounding and readability before combat.

Targets:

- environment/resource sprite grounding review;
- mineral/resource profile QA;
- builder/harvester grounding;
- no idle bobbing for stationary civil units;
- movement visual weight pass;
- verify building assets remain closed unless separately reopened.

Use the existing asset preview and F3 debug overlay where possible.

### Lane 6 — `ASSET-PIPE-01`

Goal: create repeatable asset metadata/normalization workflow.

Future deliverables:

- candidate asset folders;
- asset manifest format for candidates;
- `index.json` schema for complex assets;
- normalization/validation script plan;
- contact sheet or QA report format;
- rule: no direct candidate-to-production path.

This lane should align with `docs/visual/VISUAL_ASSET_PIPELINE.md`.

### Lane 7 — `COMBAT-VISUAL-ARCH-01`

Goal: design and implement the future combat visual stack.

Only start after civil loop, dev tools, and pathfinding are stable enough.

Future stages:

- combat state model;
- light tank unit config;
- body/turret visual model;
- turret rotation;
- projectile/VFX lifecycle;
- impact/death/wreck states;
- tests and manual QA.

### Lane 8 — `ENEMY-BOT-ARCH-01`

Goal: future enemy behavior.

Do not start yet.

Prerequisites:

- pathfinding MVP;
- civil economy stable;
- production/dev tools usable;
- combat baseline exists;
- debug/test hooks for enemy behavior.

## 2. Already completed or partially completed areas

### Map generation

Current state: mostly implemented for civil sandbox.

Done:

- starter resource pockets;
- center resource field;
- 3x3 infinite deposit;
- resource footprints;
- edge obstacle biome;
- decor/obstacle split;
- bounded retry and validation.

Still open:

- manual visual QA and tuning;
- possible environment/resource profile tuning;
- pathfinding-aware validation after runtime pathfinding exists.

### Territory

Current state: implemented and tuned.

Done:

- territory state;
- HQ footprint ownership;
- building source registration;
- slow spread;
- render overlay;
- non-blocking behavior.

Still open:

- visual polish;
- possible territory PNG overlay later;
- player-facing explanation.

### Economy

Current state: active baseline exists.

Done:

- elementUnits model;
- separator 0.1 displayed element output;
- caps and HUD formatting;
- production costs in elementUnits.

Still open:

- longer first-10-minute balance QA;
- economy soft-lock checks;
- whether old 20 raw formula should be retired or kept only as historical note.

### Building assets

Current state: closed accepted block.

Done:

- faction building PNGs;
- profile tuning;
- alpha-bounds rendering;
- debug overlay;
- asset preview.

Do not change without scoped approval:

- production building PNGs;
- building sprite profiles;
- contain-fit math;
- alpha-bounds logic;
- accepted offsets.

## 3. Current highest-risk gaps

1. Runtime pathfinding is not implemented.
2. Visual unit movement still risks sliding/flying feel.
3. Dev tools are not strong enough for fast visual/gameplay QA.
4. Save/load and pause shell do not exist yet.
5. Combat/bot should not start until the civil loop can be tested quickly.

## 4. Suggested next PR sequence

Recommended conservative sequence:

```text
1. NEXT-CHECKPOINT-01 — docs/status alignment after latest merges
2. DEV-SANDBOX-ARCH-01 — dev QA panel and fast-forward tools
3. UI-SHELL-ARCH-01 — Esc menu / Continue shell / settings access
4. PATHFINDING-ARCH-01 — movement/pathing MVP
5. VISUAL-QA-ARCH-01 — grounding and civil visual polish
6. ASSET-PIPE-01 — candidate/metadata/normalization pipeline
7. COMBAT-VISUAL-ARCH-01 — tank/combat visual architecture
8. ENEMY-BOT-ARCH-01 — bot after combat and pathing
```

Alternative if visual work is blocking motivation:

```text
1. NEXT-CHECKPOINT-01
2. VISUAL-QA-ARCH-01
3. DEV-SANDBOX-ARCH-01
4. PATHFINDING-ARCH-01
```

But do not skip pathfinding before serious enemy/combat gameplay.

## 5. What not to do now

Do not start:

- Unity migration;
- runtime LLM NPCs;
- enemy bot;
- large combat system;
- full renderer rewrite;
- direct import of many candidate assets into production folders;
- changes to accepted building assets without a scoped asset decision.

## 6. Task prompt rule

For future implementation prompts, include:

- repo: `ratoker-jpg/four-elements-next`;
- base: `main`;
- current stack: TypeScript/Vite/Vitest/Playwright;
- exact lane/task ID;
- files expected to change;
- files forbidden to change;
- required checks;
- manual QA notes.

Use `docs/project/NEXT_WORK_REQUEST_TEMPLATE_20260519.md` for a reusable format.
