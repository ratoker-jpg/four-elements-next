# ARCH-LAB-02: Extract blankGame data factory into game_state.js

**Task ID**: ARCH-LAB-02
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-02-game-state-extraction`
**PR**: #73
**Roadmap ref**: ARCH-LAB-00 step 1 (safe extractions, ~400 lines)

## Summary

Extract the `blankGame()` data factory from `src/main.js` into a dedicated
`src/game/game_state.js` module.  The function body is replaced with a
delegation call to `window.FE_GAME_STATE.createBlankGame(sizeKey)`, preserving
the `blankGame` wrapper so that existing consumers (save_manager) continue to
work without changes.

## Motivation

- `blankGame()` is a pure data factory with zero dependency on main.js closure
  state — it only reads `MAP_SIZES` from `window.FE_STANDALONE_CONSTANTS`.
- Extracting it reduces main.js line count and makes the initial game-state
  contract explicit and independently testable.
- First concrete code extraction from main.js per the ARCH-LAB-00 roadmap.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/game/game_state.js` | NEW | `window.FE_GAME_STATE.createBlankGame(sizeKey)` — returns identical game-state object. Throws if `FE_STANDALONE_CONSTANTS` is missing. |
| `src/main.js` | MOD | `blankGame()` body replaced with delegation to `window.FE_GAME_STATE.createBlankGame(sizeKey)`. Throws if `FE_GAME_STATE` is missing. |
| `index.html` | MOD | Added `<script src="src/game/game_state.js">` after `standalone_constants.js` and before `main.js`. |
| `src/game/README.md` | MOD | Updated from skeleton to active ownership contract. |
| `docs/patches/ARCH-LAB-02.md` | NEW | This file. |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-02 entry. |

## Line counts

| File | Before | After | Delta |
|------|--------|-------|-------|
| `src/main.js` | 15 611 | 15 584 | −27 |
| `src/game/game_state.js` | — | 67 | +67 (new) |

Net main.js reduction: **27 lines** (the inline object literal was replaced
with a thin delegation wrapper).

## Behavioural guarantees

1. `createBlankGame(sizeKey)` returns an object identical to the previous
   `blankGame(sizeKey)` output for every valid sizeKey.
2. If `window.FE_GAME_STATE` is missing at runtime, `blankGame()` throws
   immediately rather than silently producing a wrong state.
3. If `window.FE_STANDALONE_CONSTANTS` is missing at module load time,
   `game_state.js` throws immediately.
4. `window.FE_CORE.game` getter continues to return the `game` variable —
   no change to the bridge contract.
5. `save_manager.load()` continues to call `blankGame` via its API parameter
   — the wrapper delegates correctly.

## What was NOT changed

- startNewGame logic (only uses `blankGame` as before)
- update/render/init loop
- movement/pathfinding
- combat
- enemy bot / tank_decider / scout
- economy/power/production/construction
- input/selection
- save/load (blankGame is still passed as callback)
- Playwright tests
- runtime flags

## Checks

- `node --check src/game/game_state.js` — PASS
- `node --check src/main.js` — PASS
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — UNVERIFIED (no browser in CI environment)
