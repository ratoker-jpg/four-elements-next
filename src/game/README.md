# src/game/ — Game State & Session

**Owner:** ARCH-LAB (architecture migration)
**Status:** Skeleton — no modules extracted yet
**Roadmap step:** ARCH-LAB-02

## Purpose

Game state initialisation, session management, and boot sequence.
Will contain modules extracted from main.js that manage:

- Game state object creation and reset
- Map generation and setup
- Faction assignment and game start
- Win/loss conditions
- Save/load session coordination

## Planned modules (ARCH-LAB-02)

| Module | Source zone | Description |
|--------|-----------|-------------|
| `game_state.js` | Z1–Z7 | Game object init, reset, map setup |
| `boot.js` | Z1–Z3 | Boot sequence, asset loading, screen transitions |

## Dependencies

- `src/config/*` — building/unit/faction definitions (already extracted)
- `src/core/standalone_constants.js` — TILE_W, TILE_H, SAVE_KEY
- `src/core/asset_loader.js` — sprite/animation loading
- `src/ui/screen_manager.js` — menu screens

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept dependencies via `window.FE_CORE` bridge — never import main.js
- Be loadable before main.js in script order
- Not depend on runtime DOM state at module-evaluation time

## Current contents

None — directory is a skeleton placeholder awaiting ARCH-LAB-02 extraction.
