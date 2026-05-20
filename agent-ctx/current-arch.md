# Current Architecture Progress

Update this file after every major ARCH stage PR.

## Completed

### DEV-SANDBOX-ARCH-01
Dev panel, `?devtools=1` guard, grid/footprint/blocking overlays, Sprite Debug overlay.
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
**Status:** In progress (more PRs expected).

## Likely Next Candidates

| ID | Description | Priority |
|---|---|---|
| CIVIL-UX-01 | Statuses, indicators, clearer construction/harvester feedback | High |
| VISUAL-QA-ARCH-01 next | Shadows/grounding pass | Medium |
| DEV-SANDBOX next | Spawn/test tools for dev panel | Medium |
| UI-SHELL-01 | Esc menu / save / continue shell | Medium |
| MAP-EDITOR-ARCH-01 | Map editor (later) | Low |

## Rule

After every major ARCH stage PR merges, update the Completed section above and adjust the Next Candidates list.
