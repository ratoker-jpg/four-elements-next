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

### WORKFLOW-SPEED-01
Agent context files: state.md, workflow.md, current-arch.md, pr-checklist.md.
**Status:** Done.

### WORKFLOW-SPEED-02
Consolidation of workflow docs, prompt templates, conflict resolution with docs/AI_WORKFLOW_CONTRACT.md.
**Status:** In progress.

## Likely Next Candidates

| ID | Description | Priority |
|---|---|---|
| DOCS-SYNC-20260521 | Agent context sync after PRs 83–87 (done/current) | Done |
| HARVESTER-VIDEO-MOVE-01 | Harvester movement video/visual polish | Medium |
| HARVESTER-ANIMATION-PIPELINE-01 | Harvester animation pipeline improvements | Medium |
| UI-SHELL-01 | Esc menu / save / continue shell | Medium |
| SAVE-LOAD-01 | Save/load system | Medium |
| COMBAT-ARCH-01 | Combat system architecture | Low |
| MAP-EDITOR-ARCH-01 | Map editor (later) | Low |

## Rule

After every major ARCH stage PR merges, update the Completed section above and adjust the Next Candidates list.
