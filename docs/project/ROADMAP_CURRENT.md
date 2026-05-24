# Four Elements Next — Current Roadmap

Status: living roadmap.
Last updated: 2026-05-24.

This document is the current project roadmap for `ratoker-jpg/four-elements-next`.

It consolidates:

- current repository workflow;
- accepted project decisions;
- map/resource/territory requirements;
- visual asset pipeline direction;
- manual QA observations after WORLD-GEN-ARCH-01 PR #59/#60;
- MAP-EDITOR-ARCH-01 PR1–PR10 (editor, seed flow, mapgen config/presets, saved seeds, custom maps, game launch);
- ENV-ASSET-CALIBRATION-01 PR #111–#113 (volcano removal, asset tuner, asset profile calibration);
- CIVIL-BASELINE-01 PR #114–#116 (economy pacing, BFS map validation, pathfinding telemetry/cache);
- PHASER-SPIKE-01 PR #119–#121 (isolated Phaser 3 research spike — not migration approval);
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

### ENV-ASSET-CALIBRATION-01

Done:

- PR #111 — ENV-NO-VOLCANO-01: removed volcanoes from active generation and editor; no volcano UI, no volcano presets, no volcano config fields.
- PR #112 — ENV-ASSET-TUNER-01: dev-only environment asset calibration panel for visual tuning of groundOffset, scale, and profile values.
- PR #113 — ENV-ASSET-PROFILE-APPLY-01: applied approved environment asset calibration values to resources, obstacles, and decor.

### CIVIL-BASELINE-01

Done:

- PR #114 — ECONOMY-PACE-01: first 5–8 minutes economy pacing baseline. START_RAW=30, START_MATTER=120, SEP_RAW_COST=12, SEP_CYCLE_SECONDS=5, SEP_ELEMENT_YIELD=2; separator costMatter=60/buildTimeSeconds=20; power-plant costMatter=100; units-factory costMatter=120; builder matter=40/duration=15; harvester matter=50/duration=20.
- PR #115 — VALIDATION-BFS-01: replaced/supplemented straight-line map reachability with BFS/flood-fill validation using `buildPassabilityGrid()`. `isStraightLineClearOfObstacles()` kept but deprecated.
- PR #116 — PATH-TELEMETRY-CACHE-01: lightweight pathfinding/passability telemetry counters and safe passability grid cache. Cache reuses grid when blockers unchanged; invalidates on construction events, resource depletion, map replacement, editor changes. Telemetry: pathCalls, gridBuilds, cacheHits, cacheMisses, passabilityVersion. Exposed via `window.__pathfindingTelemetry`.

### PHASER-SPIKE-01 (research track)

Done:

- PR #119 — Stage 1: Phaser bootstrap, 48×48 isometric map rendering, pan/zoom, static assets.
- PR #120 — Stage 2: Harvester movement, 8-direction spritesheet animation, dynamic depth sorting.
- PR #121 — Stage 3: Render-only motion inertia, speed-based dust particles, gathering/unloading/HQ pulse feedback.

Result: Phaser is useful for render/camera/animation/particles/VFX experiments. **This is not migration approval.** The production game still uses TypeScript strict + Vite + Canvas 2D + HTML overlay UI. No production renderer migration has started. Full result document: `docs/project/PHASER_SPIKE_RESULT_20260524.md`.

Migration gate: no migration without PHASER-MIGRATION-AUDIT-01. The audit must compare three options: (1) keep Canvas 2D and port visual ideas, (2) replace only the render layer with Phaser, (3) full Phaser runtime migration.

## 4. Current strategy

Civil loop before combat.

The project rule remains: do not start combat, enemy AI, faction bonuses, or military systems until the civil baseline is playtested further.

Current focus is mapgen and resource balance refinement — the civil economy works, pathfinding exists, map validation uses BFS, and telemetry tracks passability performance. The next step is ensuring map generation produces well-balanced resource distributions for the first 10+ minutes of gameplay.

Next planned block: **MAPGEN-RESOURCE-BALANCE-01**.

## 5. New manual QA observations to fix

These items come from manual play/visual comparison with the older prototype.

### 5.1 Resource placement near player start

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

### 5.2 Resource node readability / amounts

Target from old prototype feel:

- resource nodes should communicate size/amount clearly;
- small/medium/large/infinite should feel visually distinct;
- future UI/debug may show resource amount numbers above deposits, at least in dev/debug mode.

Not required immediately:

- production resource-number labels above deposits.

Possible future dev tool:

- optional resource amount overlay in debug/test mode.

### 5.3 Too few mountains/obstacles

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

### 5.4 Edge terrain boundary

Current map edge should not feel like an empty rectangular board.

Target:

- create an edge/border band around the map;
- denser obstacle/decor near outer edges;
- mostly mountain/rock clusters;
- still keep camera/game readability clear.

Possible stage:

- `MAPGEN-EDGE-BIOME-01`.

### 5.5 Environment sprite offsets / grounding

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

### 5.6 Mineral infinite footprint/size

Target:

- `mineral_infinite` should be a major central object;
- footprint should be treated as 3x3;
- placed near map center;
- visually large enough to read as central strategic deposit;
- correctly anchored/grounded to the 3x3 footprint.

### 5.7 Low visual variation for rocks/decor

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

### 5.8 Unit movement feels like flying/sliding

Current problem:

- units still feel like they slide/fly across the field;
- movement lacks weight and proper ground contact.

Target:

- units should feel grounded;
- reduce floating/sliding feeling;
- improve movement interpolation/turning only after movement/pathing scope is clear;
- no idle bobbing for stationary units.

This belongs to movement/visual QA, not mapgen.

## 6. Ordered architecture sequence after CIVIL-BASELINE-01

The following blocks are planned in this order. Each requires a Full Audit before implementation unless already completed. Implementation is split into up to 3 stage PRs per block.

### Block 1 — MAPGEN-RESOURCE-BALANCE-01

Status: **immediate next focus.** Not yet started.

Type: Full Audit, then 3 stage PRs.

Goal:

- refine map resource distribution and balance for the first 10+ minutes of civil gameplay;
- ensure starter resource pockets are adequate, well-positioned, and symmetric;
- verify finite/infinite resource ratios support sustainable economy;
- address manual QA observations in sections 5.1–5.3;
- clean up center resource cluster;
- tune edge obstacle/resource/decor distribution.

Stages:

- **Stage 1 — Symmetric starter resource templates**: define and implement symmetric starter resource placement templates so both players get equivalent starting economies; push starter pockets closer to HQ; increase small/medium resources near start.
- **Stage 2 — Center resource cluster cleanup**: clean up center resource cluster logic; ensure `mineral_infinite` placement and surrounding finite resources are consistent, reachable, and strategically meaningful.
- **Stage 3 — Edge obstacle/resource/decor tuning**: tune edge/border mountain zones, obstacle density, decor distribution; create natural terrain boundaries instead of empty map cutoffs; use small and medium mountains near edges.

### Block 2 — SAVE-LOAD-MVP-01

Status: planned. Not yet started.

Type: Full Audit, then 3 stage PRs.

Goal:

- add minimal GameState persistence so players can save and resume a game session.

Stages:

- **Stage 1 — GameState serialization contract**: define the serialization schema for `GameState`; version the format; handle backward compatibility; ensure deep-clone round-trip works.
- **Stage 2 — localStorage save/load MVP**: implement save/load to localStorage using the serialization contract; slot-based saves; basic error handling.
- **Stage 3 — minimal UI/dev integration**: wire save/load into the game shell; Continue button on main menu; save on Esc menu; dev panel save/load hooks for testing.

### Block 3 — VISUAL-MOTION-FEEDBACK-01

Status: planned. Not yet started.

Type: Full Audit, then 3 stage PRs.

Goal:

- improve unit and building visual feedback so the game feels grounded instead of floaty/sliding.

Rules:

- Idle = no body motion. Stationary units do not bob or sway.
- Movement = render-only inertia based on speed/acceleration. No gameplay state change; visual interpolation only.
- Action = specific effect. Harvesting, building, etc. get distinct visual feedback.

Stages:

- **Stage 1 — render-only unit inertia**: implement render-layer inertia/easing for unit movement; units accelerate and decelerate visually without changing gameplay speed; no idle animation for stationary units.
- **Stage 2 — speed/mass-based dust**: add dust/particle feedback scaled to unit speed and mass; heavier units produce more visible ground interaction; stationary units produce nothing.
- **Stage 3 — active building/construction feedback**: add visual feedback for active construction progress, harvester delivery, and separator processing; distinguish active buildings from idle ones.

### Block 4 — UI-SHELL-ARCH-01

Status: planned. Not yet started.

Type: Full Audit, then 3 stage PRs.

Goal:

- make the outer game shell usable: Esc menu, save slots, HUD readability.

Stages:

- **Stage 1 — Esc menu shell**: implement in-game Esc menu with Continue / Save / Settings / Main Menu options; pause game while menu is open.
- **Stage 2 — Continue/save slot screen**: wire Continue button on main menu to save slot list; load selected save; display save metadata (map size, faction, tick count).
- **Stage 3 — HUD/UI scale/readability pass**: tune HUD layout, resource display, build menu labels, and UI scale for readability across common screen sizes.

### Block 5 — GAMEWORLD-SPLIT-01

Status: planned. Not yet started.

Type: Full Audit, then 3 stage PRs.

Goal:

- split `GameWorld` into focused modules to reduce coupling and improve testability.

Stages:

- **Stage 1 — TestBridge extraction**: extract test hook bridge from GameWorld into a dedicated `TestBridge` module; game-world no longer contains test-only logic inline.
- **Stage 2 — DevController extraction**: extract dev panel controller logic from GameWorld into a dedicated `DevController` module; game-world delegates dev actions instead of owning them.
- **Stage 3 — InputHandler extraction**: extract input handling from GameWorld into a dedicated `InputHandler` module; game-world receives processed commands instead of raw events.

### Block 6 — COMBAT-READINESS-01

Status: **not immediate.** Only after mapgen, save/load, and motion feedback checkpoints are acceptable.

Type: Full Audit when unblocked.

Goal:

- prepare the architecture foundation for combat: unit roles, health, damage, faction opposition.

Do not start until:

- MAPGEN-RESOURCE-BALANCE-01 is merged and playtested;
- SAVE-LOAD-MVP-01 is merged;
- VISUAL-MOTION-FEEDBACK-01 is merged;
- civil loop playtesting is satisfactory.

### Previously completed blocks

These are listed for reference; they are done and should not be restarted without a scoped decision.

| Block | PRs | Description |
|---|---|---|
| TERRITORY-TUNING-01 | earlier | Territory spreads slowly, does not block construction/pathfinding |
| ECONOMY-BASELINE-01 | PR #114 | Economy pacing for first 5–8 minutes (CIVIL-BASELINE-01 Stage 1) |
| CIVIL-UX-01 | earlier | Builder/construction loop UX feedback |
| DEV-SANDBOX-ARCH-01 | earlier | Dev panel, overlays, spawn tools |
| PATHFINDING-ARCH-01 | earlier | Passability grid, BFS pathfinder, harvester/builder movement |
| VISUAL-QA-ARCH-01 | earlier | Civil unit scale, shadows, sprite debug |
| PHASER-SPIKE-01 | PR #119–#121 | Isolated Phaser 3 research spike (not migration approval) |

## 7. Do not do yet

Do not start:

- enemy AI/bot;
- combat systems;
- tank implementation;
- faction bonuses;
- runtime LLM AI;
- big asset imports;
- renderer rewrite;
- Unity migration;
- Phaser production migration (requires PHASER-MIGRATION-AUDIT-01 first);
- pathfinding rewrite / A*;
- re-enable procedural sand;
- save/load schema changes;
- delete assets without approval.

Do not change accepted building assets unless separately approved.

Do not use Codex by default for small fixes.

## 8. Next recommended action

1. Run **MAPGEN-RESOURCE-BALANCE-01** Full Audit.
2. Implement in 3 stage PRs following the audit plan.
3. After MAPGEN-RESOURCE-BALANCE-01 is merged, proceed to **SAVE-LOAD-MVP-01** Full Audit.
4. Continue through the ordered sequence: VISUAL-MOTION-FEEDBACK-01 → UI-SHELL-ARCH-01 → GAMEWORLD-SPLIT-01.
5. COMBAT-READINESS-01 remains blocked until blocks 1–3 are merged and playtested.
6. Reassess sequence if priorities change, but do not skip ahead to combat.
