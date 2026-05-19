# Four Elements Next — Status Checkpoint 2026-05-19

Status: docs-only factual checkpoint for `ratoker-jpg/four-elements-next`.

Base branch: `main`  
Snapshot commit: `f0295699e79080f658b6a49fe9bc7031edeabdb6`  
Scope: current implementation status, remaining gaps, and next safe work lanes.

This document is about the current standalone **Four Elements Next** repository. It is not about the old sandbox repository.

## 1. Project identity

Four Elements Next is now a clean TypeScript/Vite browser RTS project.

Current stack:

- TypeScript strict mode;
- Vite;
- Canvas 2D runtime;
- HTML overlay UI;
- Vitest unit tests;
- Playwright E2E tests;
- GitHub Pages deployment from `main`.

Important runtime entry points:

| Area | File |
|---|---|
| App wiring | `src/main.ts` |
| Screen composition | `src/screens/*.ts` |
| Main game owner | `src/game/game-world.ts` |
| Aggregated mutable state | `src/game/game-state.ts` |
| System tick order | `src/systems/system-runner.ts` |
| Rendering orchestrator | `src/render/renderer.ts` |
| Core constants and asset manifests | `src/core/constants.ts` |

`src/main.ts` is wiring only. It creates screens through `ScreenManager` and starts at `main-menu`.

## 2. Current implemented gameplay baseline

The current baseline is a civil RTS sandbox, not combat/bot gameplay.

Implemented:

- main menu, map-size screen, faction-select screen, settings screen, game screen;
- standard and large map sizes;
- faction selection with concrete faction state;
- canvas camera with pan/zoom;
- generated sandy terrain;
- HQ start state;
- 1 builder at start;
- 2 harvesters at start;
- no extra starting buildings beyond HQ;
- raw/matter/element economy;
- element subunit model: 10 internal elementUnits = 1 displayed element;
- separator economy loop;
- power system;
- control system;
- construction auto-placement;
- one-tile building spacing for auto-placed buildings;
- multi-builder construction ownership;
- units factory production for builder/harvester;
- harvesting state machine;
- raw-storage dropoff preference with HQ fallback;
- map resources with footprints;
- obstacles/decor split;
- map validation and bounded generation retry;
- starter resource pocket logic;
- center resource field with 3x3 `mineral_infinite`;
- edge obstacle biome;
- territory state and render overlay;
- slow territory spread tuning;
- building PNG sprites for four factions;
- builder/harvester 8x8 spritesheet loading;
- asset preview sandbox on `0`;
- building debug overlay on `F3`;
- sprite viewer published under `/tools/sprite-viewer/`.

## 3. Current system ownership

### GameWorld

`src/game/game-world.ts` owns:

- canvas and 2D context;
- camera;
- asset loading;
- `GameState` creation;
- input listeners;
- render loop;
- UI callback publishing;
- test hooks;
- construction and production command entry points.

It should remain glue, not absorb system logic.

### GameState

`src/game/game-state.ts` aggregates:

- map;
- economy;
- power;
- control;
- construction status;
- harvesters;
- resource node runtime state;
- production;
- territory.

### System runner

`src/systems/system-runner.ts` currently ticks systems in this order:

1. construction;
2. completion cascade;
3. power;
4. control;
5. production;
6. harvesting;
7. economy;
8. territory.

This order is intentional because completed buildings must be wired into economy, power, production, and territory before later ticks use them.

## 4. Current map generation status

Implemented:

- deterministic `generateMap()` with bounded retry;
- terrain variation;
- HQ placement;
- builder placement near HQ;
- starter resource pocket biased toward start corner;
- transition/far resource placement;
- center resource field;
- 3x3 infinite resource footprint;
- resource footprints in construction/passability validation;
- obstacles as blocking map objects;
- decor as non-blocking map objects;
- edge obstacle biome near borders;
- validation for core reachability assumptions.

Known limitations:

- no runtime pathfinding yet;
- current validation protects straight-line movement assumptions rather than using true path search;
- map visual QA still needed for grounding/scale of environment and resource sprites;
- mapgen parameters may need more manual tuning after gameplay testing.

## 5. Current economy status

Implemented:

- raw, matter, per-faction elements;
- internal elementUnits to avoid floating point drift;
- HQ caps;
- storage cap increases;
- separator cycle: `15 raw -> 10 matter + 1 elementUnit`;
- displayed element value uses one decimal place;
- production costs use elementUnits.

Known design question:

- Earlier design notes used `20 raw -> 10 matter/energy + 1 element` language. The current implementation intentionally uses `15 raw -> 10 matter + 0.1 displayed element`. Keep current implementation unless a new economy balancing task explicitly changes it.

## 6. Current visual/render status

Implemented:

- Canvas 2D render pipeline;
- terrain rendering;
- territory overlay after terrain;
- sorted entity render pass;
- building sprite rendering with feature flag;
- building alpha-bounds metadata;
- contain-fit aspect preservation;
- accepted building sprite profiles and offsets;
- fallback geometry for missing sprites;
- builder/harvester spritesheet rendering with feature flag;
- resource, obstacle, decor rendering;
- asset preview sandbox;
- building debug overlay.

Known limitations:

- no combat vehicle visual system yet;
- no body/turret split implementation;
- no turret rotation;
- no muzzle points/projectiles/impact VFX;
- no generalized asset `index.json` pipeline yet;
- no normalization/atlas tooling in repo yet;
- environment/resource sprite profile tuning remains partially open.

## 7. Not currently implemented

These areas are not current production features:

- enemy bot;
- combat system;
- light tank production/combat;
- attack-move;
- projectile/VFX combat pipeline;
- fog of war;
- save/load slots;
- Esc pause menu;
- Continue save list;
- runtime pathfinding;
- multi-unit selection/control groups;
- full dev sandbox panel;
- asset normalization scripts;
- atlas/index metadata loader for complex unit assets;
- audio pipeline.

## 8. Current strategic rule

Do not jump to enemy bot/combat yet.

The next safe focus remains:

1. civil loop stability;
2. pathfinding/dev tools/UI shell;
3. visual QA;
4. then combat visuals;
5. then enemy bot.

See `docs/project/ROADMAP_CURRENT.md` for the living roadmap.
