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

### ENV-ASSET-CALIBRATION-01
- PR1 (PR #111): ENV-NO-VOLCANO-01 — removed volcanoes from active generation and editor
- PR2 (PR #112): ENV-ASSET-TUNER-01 — dev-only environment asset calibration panel
- PR3 (PR #113): ENV-ASSET-PROFILE-APPLY-01 — applied approved environment asset calibration values
**Status:** Done.

### CIVIL-BASELINE-01
- PR1 (PR #114): ECONOMY-PACE-01 — first 5-8 minutes economy pacing baseline
- PR2 (PR #115): VALIDATION-BFS-01 — BFS/flood-fill map reachability validation
- PR3 (PR #116): PATH-TELEMETRY-CACHE-01 — pathfinding telemetry and passability grid cache
**Status:** Done.

## In Progress

(None currently.)

## Planned Architecture Sequence

Ordered after CIVIL-BASELINE-01. Each requires Full Audit before implementation.

### Block 1 — MAPGEN-RESOURCE-BALANCE-01
- **Status:** immediate next focus. Not yet started.
- Stage 1: Symmetric starter resource templates
- Stage 2: Center resource cluster cleanup
- Stage 3: Edge obstacle/resource/decor tuning

### Block 2 — SAVE-LOAD-MVP-01
- **Status:** planned. Not yet started.
- Stage 1: GameState serialization contract
- Stage 2: localStorage save/load MVP
- Stage 3: minimal UI/dev integration

### Block 3 — VISUAL-MOTION-FEEDBACK-01
- **Status:** planned. Not yet started.
- Rules: Idle = no body motion; Movement = render-only inertia; Action = specific effect
- Stage 1: render-only unit inertia
- Stage 2: speed/mass-based dust
- Stage 3: active building/construction feedback

### Block 4 — UI-SHELL-ARCH-01
- **Status:** planned. Not yet started.
- Stage 1: Esc menu shell
- Stage 2: Continue/save slot screen
- Stage 3: HUD/UI scale/readability pass

### Block 5 — GAMEWORLD-SPLIT-01
- **Status:** planned. Not yet started.
- Stage 1: TestBridge extraction
- Stage 2: DevController extraction
- Stage 3: InputHandler extraction

### Block 6 — COMBAT-READINESS-01
- **Status:** not immediate. Only after blocks 1–3 are merged and playtested.
- Full Audit when unblocked.

## Likely Next Candidates (lower priority)

| ID | Description | Priority |
|---|---|---|
| MAP-EDITOR-ARCH-01 (future) | Export/import, map sharing, undo/redo, map rename/duplicate, advanced sliders, custom preset editor | Low |

## Rule

After every major ARCH stage PR merges, update the Completed section above and adjust the Next Candidates list.
