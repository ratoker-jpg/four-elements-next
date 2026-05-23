# Current Architecture Progress

Update this file after every major ARCH stage PR.

## Completed

### CIVIL-UX-01
- PR1: Construction cancellation feedback, toast near build toggle, WAIT/active construction labels, `cancelledSitesCount` hook.
**Status:** Done.

### DEV-SANDBOX-ARCH-01
Dev panel, `?devtools=1` guard, grid/footprint/blocking overlays, Sprite Debug overlay.
**Status:** Done.

### DEV-SANDBOX-TOOLS-01
- PR1: Max All / Zero All, +Builder, +Harvester, +Obstacle, +Resource, Clear Sites. Restored dev-panel regression E2E, added `dev-panel-tools.spec.ts`.
**Status:** Done.

### DEV-SANDBOX-TOOLS-02
- PR1: Builder Test and Economy Test scenario buttons.
**Status:** Done.

### PATHFINDING-ARCH-01
- PR1: Passability grid + BFS pathfinder
- PR2: Harvester pathfinding
- FIX: Harvester facing direction
- PR3: Construction reachability / no-route
- PR4: Builder movement to construction site / pending site lifecycle
**Status:** Done.

### VISUAL-QA-ARCH-01
- PR1: Sprite Debug overlay
- PR2: Civil unit scale tuning
- PR3: Canvas-only shadow pass for units/buildings/HQ/resources/obstacles/construction sites
**Status:** Done for current visual pass (possible future tuning).

### VISUAL-QA-FIX-01
- Tuned shadows smaller/directional, fixed builder movement facing, fixed/stabilized harvester runtime animation/flicker via waypoint-derived facing and guarded animation windows.
**Status:** Done.

### MAP-EDITOR-ARCH-01
- PR1: Editor shell — separate editor screen, map preview, pan/zoom, info panel, toolbar
- PR2: Object palette + placement/removal — Select/Place/Erase tools, palette UI, hover preview, placement helpers
- PR3: Validation + placement feedback — `validateEditorMap()`, status line, validation panel, rejection reasons, HQ/economy overlays
- PR4: Seed selection flow — Seed Screen between Map Size and Faction Select, seed input, "Случайный сид" button, Back preserves seed/preset
- PR5: Mapgen config foundation — `MapgenConfig` (15 fields), `DEFAULT_MAPGEN_CONFIG`, `resolveMapgenConfig()`, `generateMap(..., config?)`
- PR6: Mapgen preset selector — `MapgenPresetId`, 4 presets (balanced, more-resources, more-mountains, open-map), preset buttons on Seed Screen, threading to `createGameState`
- PR7: Docs sync — updated agent-ctx, workflow docs, and roadmap after PR1–PR6
- PR8: Saved seeds — `SeedStorageAdapter` pattern, "Сохранить сид" button, saved seed list with load/delete on Seed Screen, key `four-elements-next.seeds.v1`, cap 20
- PR9: Custom map localStorage slots — `CustomMapStorageAdapter` pattern, "Сохранить карту" button, collapsible saved maps panel with load/delete, key `four-elements-next.custom-maps.v1`, cap 20 maps, stores MapData only
- PR10: Launch game from custom map — "Начать игру" button, `createGameStateFromMap()`, `GameWorld.fromCustomMap()`, `customMapData` in `GameScreenData`, faction from `mapData.hq.faction`, invalid map blocked
**Status:** Done (PR1–PR10).

### WORKFLOW-SPEED-01
Agent context files: state.md, workflow.md, current-arch.md, pr-checklist.md.
**Status:** Done.

### WORKFLOW-SPEED-02
Consolidation of workflow docs, prompt templates, conflict resolution with docs/AI_WORKFLOW_CONTRACT.md.
**Status:** Done.

## Likely Next Candidates

| ID | Description | Priority |
|---|---|---|
| MAP-EDITOR-ARCH-01 (future) | Export/import, map sharing, undo/redo, map rename/duplicate, advanced sliders, custom preset editor | Low |
| UI-SHELL-01 | Esc menu / save / continue shell | Medium |
| SAVE-LOAD-01 | Save/load system (GameState persistence) | Medium |
| HARVESTER-VIDEO-MOVE-01 | Harvester movement video/visual polish | Medium |
| HARVESTER-ANIMATION-PIPELINE-01 | Harvester animation pipeline improvements | Medium |
| COMBAT-ARCH-01 | Combat system architecture | Low |

## Rule

After every major ARCH stage PR merges, update the Completed section above and adjust the Next Candidates list.
