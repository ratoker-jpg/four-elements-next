# ARCH-LAB-03: Extract pure geometry/math helpers into geometry.js

**Task ID**: ARCH-LAB-03
**Date**: 2026-05-13
**Branch**: `glm/arch-lab-03-geometry-extraction`
**PR**: #74
**Roadmap ref**: ARCH-LAB-00 step 1 (safe extractions)

## Summary

Extract 6 pure math helpers from `src/main.js` into a dedicated
`src/core/geometry.js` module. Each helper body is replaced with a thin
delegation call to `window.FE_GEOMETRY.*`, preserving the original function
signatures so all existing call sites continue to work unchanged.

## Motivation

- `clamp`, `dist`, `rectsOverlap`, `safeNum`, `formatTime`, `normalizeVec`
  are pure functions with zero closure dependencies.
- They are used across render, input, AI, economy, and map generation —
  extracting them creates a reusable core API.
- This is the second concrete code extraction from main.js after ARCH-LAB-02.

## Changes

| File | Action | Description |
|------|--------|-------------|
| `src/core/geometry.js` | NEW | `window.FE_GEOMETRY` — clamp, dist, rectsOverlap, safeNum, formatTime, normalizeVec |
| `src/main.js` | MOD | 6 helper bodies replaced with delegation wrappers + FE_GEOMETRY missing-guard |
| `index.html` | MOD | Added `<script src="src/core/geometry.js">` after standalone_constants.js |
| `src/core/README.md` | MOD | Added geometry.js to production modules table |
| `docs/patches/ARCH-LAB-03.md` | NEW | This file |
| `docs/patches/INDEX.md` | MOD | Added ARCH-LAB-03 entry |

## Line counts

| File | Before | After | Delta |
|------|--------|-------|-------|
| `src/main.js` | 15 584 | 15 586 | +2 (guard + comment lines offset shortened bodies) |
| `src/core/geometry.js` | — | 91 | +91 (new) |

## Behavioural guarantees

1. Each `window.FE_GEOMETRY.*` function returns output identical to the previous
   inline helper — pure math, no state, no closure deps.
2. If `window.FE_GEOMETRY` is missing at boot, main.js throws immediately
   with a clear error message.
3. `window.FE_CORE` — unchanged (none of these helpers were exposed on FE_CORE).
4. All call sites continue to call the same local function names — no call site changes.

## What was NOT changed

- tileToWorld, worldToTile, worldToScreen, tileToScreen, screenToTile
- inBounds (depends on game.mapW/mapH closure)
- choose (low value, 2 uses)
- pathfinding / passable / movement
- render behavior
- input/selection
- combat
- enemy bot / tank_decider / scout
- economy/power/production/construction
- save/load
- src/game/game_state.js
- Playwright tests
- runtime flags
- Any coordinate math or isometric projection

## Checks

- `node --check src/core/geometry.js` — PASS
- `node --check src/main.js` — PASS
- `node --check src/config/runtime_flags.js` — PASS
- `npm run test:e2e` — UNVERIFIED (no browser in CI environment)
