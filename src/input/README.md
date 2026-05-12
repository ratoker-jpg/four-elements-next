# src/input/ — Input & Interaction Systems

**Owner:** ARCH-LAB (architecture migration)
**Status:** Skeleton — no modules extracted yet
**Roadmap step:** ARCH-LAB-04

## Purpose

All player input handling, selection, and command dispatch logic extracted
from main.js. This directory separates the "what did the player click"
layer from the "what should the game do about it" layer (systems/).

## Planned modules (ARCH-LAB-04)

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `mouse_input.js` | Z22 partial | ~500 | Mouse click/move handlers, context menu triggers |
| `keyboard_input.js` | Z22 partial | ~200 | Keyboard shortcuts, hotkeys, camera WASD |
| `selection_system.js` | Z22 partial | ~400 | Unit selection, drag-select, multi-select, group control |
| `command_dispatch.js` | Z22 partial | ~300 | Convert player input to game commands (move/attack/build) |

## Dependencies

- `src/config/runtime_flags.js` — FE_DEV_HOTKEYS_ENABLED, debug keys
- `src/game/*` — game state for selection queries
- `src/systems/command_system.js` — command execution (ARCH-LAB-04)
- `src/ui/screen_manager.js` — menu interactions

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept game state via `window.FE_CORE` bridge
- Never directly modify unit/building state — dispatch commands through systems
- Handle raw DOM events and translate to game-space coordinates
- Clean up event listeners on game exit/reset

## Design principle

Input modules translate player intent into commands.
Systems modules execute commands and update game state.
This separation ensures input handling can change (touch, gamepad)
without touching gameplay logic.

## Current contents

None — directory is a skeleton placeholder awaiting ARCH-LAB-04 extraction.
