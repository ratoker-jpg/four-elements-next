# Project State — Quick Reference

Read this file first in any new session.

## Project

**Four Elements Next** — browser isometric RTS.
TypeScript strict + Vite + Canvas 2D + HTML overlay UI + Vitest + Playwright.

## Repo

- **Main branch:** `main`
- **QA URL:** https://ratoker-jpg.github.io/four-elements-next/?devtools=1
- **CI (5 checks):** type-check, build, test, test:e2e, GITHUB_PAGES=true build
- **E2E runner:** `./node_modules/.bin/playwright test --workers=1` from repo root after `npx vite build --mode test`
- **Devtools guard:** `import.meta.env.DEV` OR `MODE=test` OR `?devtools=1`

## Core Folders

| Folder | Purpose |
|---|---|
| `src/game` | Map data, game state, game world, mapgen, mapgen-config, mapgen-presets, editor-state, editor-validation |
| `src/systems` | economy, construction, production, harvesting, power, control, territory, passability, pathfinding |
| `src/render` | Terrain, buildings, resources, units, dev overlays, editor-preview |
| `src/dev` | Dev panel, Sprite Debug, test hooks |
| `src/core` | Constants (FORBIDDEN to change without explicit approval) |
| `src/config` | Building definitions, footprints |
| `tests/unit` | Vitest unit tests |
| `tests/e2e` | Playwright E2E tests |

## Completed Architecture

### CIVIL-UX-01
- **PR1:** Construction cancellation feedback, toast near build toggle, WAIT/active construction labels, `cancelledSitesCount` hook

### DEV-SANDBOX-ARCH-01
Dev panel, `?devtools=1` guard, grid/footprint/blocking overlays, Sprite Debug overlay.

### DEV-SANDBOX-TOOLS-01
- **PR1:** Max All / Zero All, +Builder, +Harvester, +Obstacle, +Resource, Clear Sites

### DEV-SANDBOX-TOOLS-02
- **PR1:** Builder Test and Economy Test scenario buttons

### PATHFINDING-ARCH-01
- **PR1:** Passability grid + BFS pathfinder (`src/systems/passability.ts`, `src/systems/pathfinding.ts`)
- **PR2:** Harvester pathfinding to adjacent resource/dropoff tile
- **FIX:** Harvester facing direction on arrival
- **PR3:** Construction reachability check, `no-route` failure reason, no matter deduction on no-route
- **PR4:** Builder movement to construction site, pending site lifecycle, `ftx/fty` smooth movement, repath/cancel with matter refund clamped to `matterCap`

### VISUAL-QA-ARCH-01
- **PR1:** Sprite Debug overlay (dev-only, visual QA tool)
- **PR2:** Civil unit scale tuning
- **PR3:** Canvas-only shadow pass for units/buildings/HQ/resources/obstacles/construction sites

### VISUAL-QA-FIX-01
- Shadow tuning (smaller/directional), builder movement facing fix, harvester runtime animation/flicker fix via waypoint-derived facing and guarded animation windows

### MAP-EDITOR-ARCH-01
- **PR1:** Editor shell — separate editor screen, map preview, pan/zoom, camera, info panel, toolbar skeleton (`src/screens/editor-screen.ts`, `src/render/editor-preview.ts`)
- **PR2:** Object palette + placement/removal — Select/Place/Erase tools, palette UI (resources, obstacles, decor), hover tile tracking, valid/invalid footprint preview, `editor-state.ts` placement helpers (`src/game/editor-state.ts`)
- **PR3:** Validation + placement feedback — `validateEditorMap()`, status line, validation panel, "Проверить карту" button, placement rejection reasons, HQ/start marker overlay, economy radius circle (`src/game/editor-validation.ts`)
- **PR4:** Seed selection flow — Seed Screen inserted between Map Size and Faction Select, seed input pre-filled with random seed, "Случайный сид" button, `SeedScreenData` with optional `seed` and `mapgenPresetId`, Back preserves seed + preset (`src/screens/seed-screen.ts`, `src/types/screens.ts`)
- **PR5:** Mapgen config foundation — `MapgenConfig` interface (15 fields), `DEFAULT_MAPGEN_CONFIG`, `resolveMapgenConfig()`, `generateMap(..., config?)` (`src/game/mapgen-config.ts`, `src/game/mapgen.ts`)
- **PR6:** Mapgen preset selector on Seed Screen — `MapgenPresetId` type, `MAPGEN_PRESETS` record (4 presets), `resolveMapgenPresetConfig()`, preset buttons on Seed Screen, preset threading through all screens to `createGameState` (`src/game/mapgen-presets.ts`)

## New Game Flow

Main Menu → Map Size → Seed Screen → Faction Select → Game Screen

Each screen passes data forward. Back navigation preserves user choices:
- Back from Seed Screen to Map Size: no special state
- Back from Faction Select to Seed Screen: preserves `seed` + `mapgenPresetId`

## Seed Screen

- Seed input field pre-filled with random seed
- "Случайный сид" button to regenerate seed
- Mapgen preset selector (4 buttons):
  - `balanced` / Сбалансированная (default)
  - `more-resources` / Больше ресурсов
  - `more-mountains` / Больше скал и гор
  - `open-map` / Открытая карта
- Back from Faction Select preserves seed and selected preset

## Mapgen Config & Presets

- `MapgenConfig` — 15 tunable fields (resource counts, obstacle counts, decor counts)
- `DEFAULT_MAPGEN_CONFIG` — matches pre-PR5 hardcoded values
- `resolveMapgenConfig(config?: Partial<MapgenConfig>)` — merges partial overrides with defaults
- `resolveMapgenPresetConfig(id: MapgenPresetId)` — resolves a preset ID to full `MapgenConfig`
- `generateMap(width, height, faction, seed, config?: Partial<MapgenConfig>)` — config param added in PR5
- Presets are defined in `src/game/mapgen-presets.ts`, resolved only in `createGameState`
- No volcano presets or volcano-specific config fields

## Map Editor

- Separate editor screen (dev-only: `DEV` / `test` / `?devtools=1`)
- Map preview with camera pan (arrow keys / right-click drag) and zoom (scroll wheel)
- Tools: Select, Place, Erase (keyboard shortcuts Q/W/E)
- Object palette (visible in Place mode):
  - **Resources:** small / medium / large / infinite
  - **Obstacles:** rock-cluster, mountain-small, mountain-medium, mountain-large
  - **Decor:** bush, sand-bump
  - No volcano UI/palette entries
- Valid/invalid footprint preview (green/red) on hover in Place mode
- Erase-target highlight on hover in Erase mode
- Status line showing current tile, active tool, selection, and rejection reasons
- Validation panel with "Проверить карту" button, `validateEditorMap()` runs on edit and on demand
- Editor mutates editor `MapData` only — not live `GameState`

## Not Implemented Yet

- Saved seeds / seed history
- localStorage for custom maps
- Launch game from custom/edited map
- Sliders / advanced numeric controls for mapgen parameters
- Custom preset editor
- Undo/redo in editor
- Map export/import/share

## Important Gameplay Facts

- **Blocking:** resources, buildings, HQ, obstacles block movement and construction
- **Non-blocking in MVP:** decor (bush, sand-bump), territory, units
- **Harvester:** uses pathfinding to adjacent resource/dropoff tile, returns raw to HQ
- **Builder:** moves to adjacent construction tile before progress starts; site can be `pending`
- **Construction site:** `pending=true` means elapsed/progress do NOT advance until builder arrives
- **Matter refund:** on repath-failure cancel, `economy.resources.matter = Math.min(matter + costMatter, matterCap)`
- **Building spacing:** one-tile gap required between buildings/HQ/construction-sites
- **E2E timing:** `__constructionState` hook updates per animation frame; use `expect.poll()` for state changes after UI clicks
- **Volcanoes:** deprecated for current visual direction; no volcano UI, no volcano presets, no volcano config fields; existing volcano code/types are not removed

## Dev Panel Capabilities

- **Access:** `?devtools=1` with overlays, Sprite Debug, spawn tools, and scenario buttons
- **Spawn tools:** +Builder, +Harvester, +Obstacle, +Resource, Max All, Zero All, Clear Sites
- **Scenario buttons:**
  - **Builder Test:** spawns a builder near HQ and positions camera
  - **Economy Test:** maxes resources, spawns 3 harvesters, starts separator construction, fast-forwards 35 ticks, camera to HQ
- **Overlays:** grid, footprint, blocking (all toggle from dev panel)

## Construction UX

- **Toast/status feedback:** visual feedback near build toggle on construction events
- **WAIT/active site labels:** construction sites show WAIT (pending) or active progress label
- **cancelledSitesCount hook:** tracks cancelled site count for UI feedback

## Visual QA

- **Canvas-only directional shadows:** rendered for units, buildings, HQ, resources, obstacles, construction sites
- **Builder faces movement direction:** uses isometric row correction (tile-space vector to screen-space row with +1 offset)
- **Harvester movement facing:** uses active waypoint to determine direction, avoiding runtime flicker
- **Civil sprite direction correction:** tile-space vector to screen-space row uses +1 offset for correct isometric facing
- **Guarded animation windows:** harvester animation windows are bounded to prevent flicker

## Workflow Docs

- **Workflow modes + E2E policy:** `agent-ctx/workflow.md` (canonical)
- **Prompt templates:** `agent-ctx/prompt-templates.md`
- **PR checklist:** `agent-ctx/pr-checklist.md`
- **Architecture tracker:** `agent-ctx/current-arch.md`
- **Broader process:** `docs/AI_WORKFLOW_CONTRACT.md` (roles, re-audit triggers, branch discipline)
- On conflict between `agent-ctx/workflow.md` and `docs/AI_WORKFLOW_CONTRACT.md` on mode selection or E2E policy, **agent-ctx takes priority**.

## Key Constants (DO NOT CHANGE)

- `src/core/constants.ts` — forbidden without explicit approval
- Builder sprite: `builder_base: { size: [57, 57], groundOffset: 15 }`
- `BUILDER_SPEED = 2.0` (in `src/systems/construction.ts`)
