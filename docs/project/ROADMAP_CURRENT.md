# Four Elements Next — Current Roadmap

Status: living roadmap.
Last updated: 2026-05-23.

This document is the current project roadmap for `ratoker-jpg/four-elements-next`.

It consolidates:

- current repository workflow;
- accepted project decisions;
- map/resource/territory requirements;
- visual asset pipeline direction;
- manual QA observations after WORLD-GEN-ARCH-01 PR #59/#60;
- MAP-EDITOR-ARCH-01 PR1–PR10 (editor, seed flow, mapgen config/presets, saved seeds, custom maps, game launch);
- the order of work before combat and enemy bot development.

## 1. Current project rule

Do not jump directly to enemy AI / bot.

The first playable target is a stable civil sandbox:

- map generation works;
- resources are readable and reachable;
- harvesters work;
- construction works;
- economy does not soft-lock;
- territory spreads slowly and does not block building;
- UI/menu shell is usable;
- dev/test tools exist for fast QA;
- movement/pathfinding has at least an MVP solution.

Combat and enemy bot development starts only after the civil loop is stable enough to test against.

## 2. Workflow rule

Use one Big Audit per coherent architecture area.

Stages A/B/C/D are planning and review boundaries, not mandatory one-PR boundaries.

Implementation PRs are bundled or split adaptively:

- bundle stages if diff is compact, coherent, testable, and easy to review;
- split stages if risk, scope, or rollback cost grows;
- re-audit only if a re-audit trigger fires.

Small tuning/fix tasks can be scoped directly without a new Big Audit.

## 3. Completed baseline

### Project foundation

Done:

- clean TypeScript/Vite project;
- Canvas 2D + HTML overlay UI;
- strict workflow docs;
- asset policy;
- AI tooling policy;
- mapgen spec;
- visual asset pipeline spec.

### Building assets

Done:

- production building PNG block accepted;
- building profiles/offsets tuned;
- building asset block is closed unless a separate scoped decision reopens it.

### Start state

Done:

- player starts with HQ/base only;
- 2 harvesters;
- 1 builder;
- no extra starting buildings;
- harvester can deliver to HQ fallback;
- one-tile construction spacing implemented.

### MAP-EDITOR-ARCH-01

Done:

- PR #93 — Editor shell: separate editor screen, map preview, pan/zoom, info panel, toolbar
- PR #94 — Object palette + placement/removal: Select/Place/Erase tools, palette UI, hover preview
- PR #95 — Validation + placement feedback: `validateEditorMap()`, status line, validation panel, rejection reasons
- PR #96 — Seed selection flow: Seed Screen between Map Size and Faction Select, seed input, "Случайный сид" button
- PR #97 — Mapgen config foundation: `MapgenConfig` (15 fields), `DEFAULT_MAPGEN_CONFIG`, `resolveMapgenConfig()`, `generateMap(..., config?)`
- PR #98 — Mapgen preset selector: `MapgenPresetId`, 4 presets (balanced / Сбалансированная, more-resources / Больше ресурсов, more-mountains / Больше скал и гор, open-map / Открытая карта)
- PR #99 — Docs sync after PR1–PR6
- PR #100 — Saved seeds: `SeedStorageAdapter` pattern, "Сохранить сид" button, saved seed list with load/delete on Seed Screen, key `four-elements-next.seeds.v1`, cap 20
- PR #101 — Custom map localStorage slots: `CustomMapStorageAdapter` pattern, "Сохранить карту" button, collapsible saved maps panel with load/delete, key `four-elements-next.custom-maps.v1`, cap 20 maps, stores MapData only
- PR #102 — Launch game from custom map: "Начать игру" button, `createGameStateFromMap()`, `GameWorld.fromCustomMap()`, `customMapData` in `GameScreenData`, faction from `mapData.hq.faction`, invalid map blocked with status feedback

Current editor palette (no volcano entries):
- Resources: small / medium / large / infinite
- Obstacles: rock-cluster, mountain-small, mountain-medium, mountain-large
- Decor: bush, sand-bump

Current Seed Screen features:
- Seed input pre-filled with random seed
- "Случайный сид" button to regenerate seed
- 4 mapgen preset buttons
- "Сохранить сид" button — saves seed + preset to localStorage
- Saved seeds list — load/delete (collapsible panel)
- Back from Faction Select preserves seed + preset

Current editor features:
- Map preview with pan/zoom
- Select/Place/Erase tools with keyboard shortcuts
- Object palette, valid/invalid hover preview, erase-target highlight
- Validation panel + status line
- Save/load/delete custom maps in localStorage
- "Начать игру" button — launches game from valid editor map
- Invalid map shows error status and does not launch
- Deep-clones MapData before runtime use
- Editor MapData mutations do not affect saved maps or running game

Custom map runtime path:
- Editor MapData → `validateEditorMap(mapData)` → `customMapData` in `GameScreenData` → `GameWorld.fromCustomMap(canvas, mapData, faction)` → `createGameStateFromMap(map, faction)` (deep-clones input) → normal game loop

Storage:
- Saved seeds: key `four-elements-next.seeds.v1`, cap 20, stores seed + preset ID
- Custom maps: key `four-elements-next.custom-maps.v1`, cap 20, stores MapData only (not GameState)

Not yet implemented: export/import, map sharing, undo/redo, map rename/duplicate, sliders, custom preset editor, asset calibration system, full asset variant pipeline, GameState save/load.

Volcanoes deprecated for current visual direction: no volcano UI, no volcano presets, no volcano config fields. Existing volcano code/types not removed.

### WORLD-GEN-ARCH-01

Done:

- PR #59 — Stages A+B+C:
  - map validation foundation;
  - zone-based resources;
  - obstacle/decor split;
  - large map size 64;
  - bounded mapgen retry;
  - decor does not block construction;
  - obstacles block construction footprint placement.
- PR #60 — Stage D:
  - territory system;
  - territory render overlay;
  - HQ footprint owned on start;
  - building footprint fill;
  - territory spreads one tile per step;
  - territory does not block construction;
  - territory does not affect movement/pathfinding.

## 4. New manual QA observations to fix

These items come from manual play/visual comparison with the older prototype.

### 4.1 Resource placement near player start

Current problem:

- starter resources do not feel clustered enough around the player base;
- older prototype had more readable starter resource pockets near the player/HQ;
- resource piles should appear closer to the player's corner/start position, not as sparse scattered objects.

Target:

- push starter resource pockets closer to the player start corner/HQ area;
- make starter economy feel immediately available;
- many easy/small crystals near the start;
- some medium crystals nearby;
- center still has higher-value resources;
- central `mineral_infinite` remains a strategic point.

Important:

- do not block HQ, harvester spawn, builder spawn, or first harvester route;
- do not place resources under obstacles;
- do not rely only on random scatter.

### 4.2 Resource node readability / amounts

Target from old prototype feel:

- resource nodes should communicate size/amount clearly;
- small/medium/large/infinite should feel visually distinct;
- future UI/debug may show resource amount numbers above deposits, at least in dev/debug mode.

Not required immediately:

- production resource-number labels above deposits.

Possible future dev tool:

- optional resource amount overlay in debug/test mode.

### 4.3 Too few mountains/obstacles

Current problem:

- obstacles became too rare after mapgen work;
- mountains visually disappeared or feel underrepresented;
- the map edges feel like empty cutoff instead of natural terrain boundaries.

Target:

- use map edges as terrain boundary zones;
- edges should contain more mountains/rocks, creating a natural border instead of a simple map cutoff;
- use mostly small and medium mountains;
- avoid overfilling the playable start area;
- avoid blocking first economy routes.

Standard map target:

- no large mountain by default, unless explicitly tested and readable;
- use small + medium mountains as edge/border content.

Large map target:

- large mountains may be considered;
- use sparingly;
- keep center and start routes reachable.

Note: volcanoes are deprecated for current visual direction. No volcano UI, no volcano presets, no volcano config fields. Use mountains and rock clusters for obstacles instead.

### 4.4 Edge terrain boundary

Current map edge should not feel like an empty rectangular board.

Target:

- create an edge/border band around the map;
- denser obstacle/decor near outer edges;
- mostly mountain/rock clusters;
- still keep camera/game readability clear.

Possible stage:

- `MAPGEN-EDGE-BIOME-01`.

### 4.5 Environment sprite offsets / grounding

Current problem:

- buildings were tuned, but environment objects are not grounded/centered consistently;
- small rocks, bumps, mountains, and resources can look offset from the tile center;
- many non-building assets appear to use default offset values that do not match their footprint/visual footprint.

Target:

- tune environment/resource sprite profiles, not only buildings;
- each asset type must sit visually on its intended tile/footprint;
- 1x1 objects should be centered and grounded;
- 2x2 objects should sit on their footprint center;
- 3x3 objects should be large enough and correctly anchored.

Initial offset hypothesis to test, not final truth:

- 1x1 objects may need around `groundOffset: 4`;
- 2x2 objects may need around `groundOffset: 8`;
- 3x3 objects may need around `groundOffset: 16`.

These values must be validated visually in game/asset preview. Do not hard-code them as final without QA.

### 4.6 Mineral infinite footprint/size

Target:

- `mineral_infinite` should be a major central object;
- footprint should be treated as 3x3;
- placed near map center;
- visually large enough to read as central strategic deposit;
- correctly anchored/grounded to the 3x3 footprint.

### 4.7 Low visual variation for rocks/decor

Current problem:

- too little variation in rocks/decor/environment details;
- map can look repetitive.

Target:

- more variation in small rocks, sand bumps, mountain/decor choices;
- do not add random clutter that hides gameplay;
- asset additions must go through asset gate if new PNGs are added.

Short-term:

- use existing assets better;
- improve distribution.

Long-term:

- add candidate decor/resource variants through asset pipeline.

### 4.8 Unit movement feels like flying/sliding

Current problem:

- units still feel like they slide/fly across the field;
- movement lacks weight and proper ground contact.

Target:

- units should feel grounded;
- reduce floating/sliding feeling;
- improve movement interpolation/turning only after movement/pathing scope is clear;
- no idle bobbing for stationary units.

This belongs to movement/visual QA, not mapgen.

## 5. Immediate priority order

### Priority 0 — Roadmap/doc consolidation

Status: this document.

Goal:

- keep current plan in one place;
- prevent jumping to unrelated features;
- make next GLM/Codex prompts smaller and safer.

### Priority 1 — TERRITORY-TUNING-01

Type: small tuning/fix PR.

Problem:

- territory still visually spreads too fast;
- territory radius is too large for current gameplay readability.

Target:

- max territory radius: `5`, not `10`;
- footprint fill remains about 15 seconds per footprint tile;
- outward spread delay depends on radius:
  - radius 1: 45 seconds per tile;
  - radius 2: 90 seconds per tile;
  - radius 3: 180 seconds per tile;
  - radius 4: 360 seconds per tile;
  - radius 5: 720 seconds per tile;
- formula: `45 * 2 ** (radius - 1)`;
- one tile per spread event remains mandatory;
- territory still does not block construction;
- territory still does not affect movement/pathfinding.

No new Big Audit needed.

### Priority 2 — MAPGEN-QA-ARCH-01

Type: Big Audit, likely implementation in one or two PRs depending on diff.

Goal:

- make the map look and play closer to target RTS map before bot/combat.

Stages:

#### Stage A — Starter resource pockets

- push starter resource pockets closer to player start/HQ/corner;
- increase small resources near HQ;
- add some medium resources nearby;
- preserve route safety for current straight-line harvester movement;
- keep center/infinite rules.

#### Stage B — Edge obstacle biome

- create edge/border mountain zones;
- use small and medium mountains near edges;
- standard map avoids large mountain by default;
- large map may allow larger landmarks sparingly;
- preserve center/start reachability.

#### Stage C — Environment/resource profile tuning

- tune `groundOffset`, profile size, and footprint assumptions for resources/decor/obstacles;
- validate 1x1, 2x2, 3x3 environment objects;
- make `mineral_infinite` a 3x3 central deposit;
- do not touch accepted building profile block.

#### Stage D — Map visual variation pass

- use existing decor/rocks/sand bumps more effectively;
- reduce repetition;
- avoid visual clutter;
- do not add new assets unless explicitly scoped.

Recommended PR grouping:

- PR 1: Stage A+B if compact;
- PR 2: Stage C+D if visual/profile risk is higher;
- or one PR if GLM confirms diff is compact and tests are clear.

### Priority 3 — ECONOMY-BASELINE-01

Type: Big Audit or targeted audit depending on code inspection.

Goal:

- stabilize the first 5–10 minutes of civil gameplay.

Questions to verify:

- why HUD can show `0/0` in manual QA;
- whether start resources/caps are correct;
- whether first building is affordable/reachable;
- whether Raw/Matter/Element/Power/Control are understandable and stable;
- whether harvester delivery to HQ works consistently;
- whether player can avoid soft-lock.

Expected stages:

- Stage A — audit current economy/HUD/resource caps;
- Stage B — fix starting values/caps/HUD display if needed;
- Stage C — tune first-building costs and separator loop;
- Stage D — tests/manual QA for first 5 minutes.

### Priority 4 — CIVIL-UX-01

Goal:

- make builder/construction loop understandable.

Targets:

- build menu is clear;
- disabled state explains missing resources;
- construction status is clear;
- builder auto-placement works in normal cases;
- `builder cannot reach` / `cannot find place` is not shown for normal player flow;
- construction does not require exact cell selection.

### Priority 5 — DEV-SANDBOX-ARCH-01

Goal:

- create fast test/debug tools before bot/combat.

Current existing pieces:

- test hooks for economy/power/control/construction/harvesters/production/territory;
- asset preview sandbox with `0` key;
- dev panel (DEV-SANDBOX-ARCH-01, DEV-SANDBOX-TOOLS-01, DEV-SANDBOX-TOOLS-02);
- map editor screen with preview, palette, validation, save/load, game launch (MAP-EDITOR-ARCH-01 PR1–PR10).

Missing:

- fast-forward time;
- show map seed/validation report/resource counts;
- toggle territory/grid/obstacles/resource debug.

Stages:

- Stage A — dev overlay panel;
- Stage B — resource/time test actions;
- Stage C — spawn/building test tools;
- Stage D — visual QA toggles.

### Priority 6 — UI-SHELL-ARCH-01

Goal:

- make menu/save/settings shell usable.

Current state:

- main menu exists;
- map size screen exists;
- seed screen exists (seed input, "Случайный сид", 4 mapgen presets);
- faction select exists;
- settings has UI scale buttons;
- editor screen exists (dev-only, preview/palette/validation/save/load/game launch);
- seed screen has saved seeds (load/delete, collapsible panel);
- Continue is disabled;
- no save slot shell;
- no Esc pause menu.

Stages:

- Stage A — update menu text and map-size labels;
- Stage B — Continue opens save list shell;
- Stage C — Esc menu: Continue / Save / Settings / Main menu;
- Stage D — HUD/UI scale/readability pass.

### Priority 7 — PATHFINDING-ARCH-01

Goal:

- stop straight-line movement from undermining obstacles/mapgen.

Stages:

- Stage A — grid/path model;
- Stage B — builder movement to construction approach cell;
- Stage C — harvester movement to resource/dropoff;
- Stage D — RTS click indicator: green accepted / red unavailable.

Important:

- do not start enemy bot before this has at least an MVP.

### Priority 8 — VISUAL-QA-ARCH-01

Goal:

- reduce flying/sliding/ungrounded visual feel.

Stages:

- Stage A — civil unit grounding/profile review;
- Stage B — no idle bobbing for stationary units;
- Stage C — movement visual weight pass;
- Stage D — resource/obstacle readability and profile QA.

### Priority 9 — COMBAT-VISUAL-ARCH-01

Not immediate.

Goal:

- future light tank / combat visual system based on body/turret/effects.

Do only after civil sandbox is stable.

### Priority 10 — ENEMY-BOT-ARCH-01

Not immediate.

Start only after:

- map/resource/territory baseline is playable;
- economy loop works;
- construction loop works;
- dev/test tools exist;
- movement/pathfinding MVP exists.

## 6. Do not do yet

Do not start:

- enemy AI/bot;
- combat systems;
- tank implementation;
- runtime LLM AI;
- big asset imports;
- renderer rewrite;
- Unity migration.

Do not change accepted building assets unless separately approved.

Do not use Codex by default for small fixes.

## 7. Next recommended action

After this roadmap is merged:

1. Run `TERRITORY-TUNING-01` as a small focused PR.
2. Run `MAPGEN-QA-ARCH-01` Big Audit.
3. Use adaptive PR bundling for MAPGEN-QA stages.

Do not combine territory tuning with the larger mapgen QA arch unless the diff is clearly tiny and safe.
