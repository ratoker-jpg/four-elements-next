# src/core/ — Core Infrastructure

**Owner:** ARCH-LAB (architecture migration)
**Status:** Active — 4 production modules + 1 archived module
**Roadmap step:** Ongoing (LAB-01 through LAB-07)

## Purpose

Foundational infrastructure modules that have no gameplay dependencies
and are loaded early in the script order. Core modules provide:
- Constants and configuration
- Asset loading
- Persistence (save/load)
- Storage protection
- Shared utility functions

## Production modules

| Module | Lines | PR | Risk | Description |
|--------|-------|-----|------|-------------|
| `standalone_constants.js` | 28 | #61 | Low | Frozen constants: TILE_W, TILE_H, SAVE_KEY, MAP_SIZES |
| `storage_guard.js` | 51 | — | Low | localStorage overflow protection |
| `asset_loader.js` | 108 | — | Low | Sprite sheet and animation loading |
| `save_manager.js` | 105 | — | Medium | Save/load game state + UI slot management |

## Archived modules

| Module | Lines | PR | Status | Description |
|--------|-------|-----|--------|-------------|
| `_archived/unit_controller.js` | 878 | ARCH-LAB-01 | **DEPRECATED** | Alternative unit movement controller — never activated, permanently disabled by `FE_UNIT_CONTROLLER_ENABLED=false` |

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Be loadable before main.js — no dependency on game state
- Never import or call functions from main.js
- Keep `window.FE_CORE` as the only bridge for runtime dependencies
- Be pure or side-effect-free at module evaluation time
  (runtime init may happen in an `init()` function called by main.js)

## Archive policy

Modules moved to `_archived/`:
- Keep their original code intact (read-only historical record)
- Receive a WARNING header explaining deprecation reason and date
- Remain loadable from index.html (path change only)
- Must not be deleted — they document design decisions and past approaches

## Script load order

```
src/config/*        → data definitions (no dependencies)
src/core/*          → infrastructure (depends on config only)
src/core/_archived/* → deprecated modules (after core, before main)
src/ai/*            → AI modules (depends on core)
src/ui/*            → UI modules (depends on core)
src/modules/*       → legacy extracted modules (depends on core)
src/main.js         → game logic + wiring (depends on all above)
```
