# FEN-01 — FE Next Scaffold + Map/Camera/HQ/HUD/Unit Movement

**Date:** 2026-05-15
**PR:** (pending)
**Branch:** glm/fen-01-fe-next-scaffold
**Scope:** New isolated `fe-next/` directory with minimal playable scaffold
**Risk:** LOW — zero changes to root game
**Depends on:** ARCH-LAB-06B (merged PR #98)
**Next block:** FEN-02 — Economy/production/construction integration

## Summary

This PR implements the first FE Next scaffold — a standalone browser game page that boots independently from the root Four Elements game. It provides the minimal playable interaction loop: isometric map, camera controls, player HQ, HUD resources, one test unit, left-click selection, and right-click movement.

The `fe-next/` directory is completely isolated. The root `index.html`, `src/main.js`, `src/config/runtime_flags.js`, and all existing gameplay modules remain untouched.

---

## 1. Motivation

The ARCH-COST-COMPARISON audit (Path C — Hybrid) recommended building FE Next in parallel with the existing game, keeping sandbox/main as fallback. FEN-01 is the first concrete implementation step: a minimal but functional scaffold that proves the zero-build script-tag architecture works and provides a foundation for incremental feature additions.

---

## 2. Files created

| File | Purpose | Lines (approx) |
|------|---------|----------------|
| `fe-next/index.html` | Standalone page with canvas + HUD | ~95 |
| `fe-next/src/core/constants.js` | Game constants (map size, tile dims, colors, speeds) | ~65 |
| `fe-next/src/core/coordinates.js` | Isometric coordinate transforms (pure functions) | ~120 |
| `fe-next/src/game/state.js` | Game state factory + unit movement logic | ~170 |
| `fe-next/src/render/renderer.js` | Geometric isometric renderer (terrain, buildings, units) | ~210 |
| `fe-next/src/input/input.js` | Camera pan/zoom + selection/move input handlers | ~155 |
| `fe-next/src/ui/hud.js` | DOM-based HUD updater | ~55 |
| `fe-next/src/main.js` | Composition root — init + game loop | ~110 |
| `tests/e2e/fe-next-smoke.spec.js` | Playwright E2E smoke test | ~180 |
| `docs/patches/FEN-01.md` | This document | — |
| `docs/patches/INDEX.md` | Updated patch index | — |

Total FE Next code: ~980 lines across 7 JS files.

---

## 3. Architecture

### Module communication

All modules use the `window.FE_NEXT_*` global pattern, matching the existing `window.FE_*` convention in the root game:

| Global | Module | Role |
|--------|--------|------|
| `FE_NEXT_CONSTANTS` | constants.js | Read-only game constants |
| `FE_NEXT_COORDS` | coordinates.js | Pure coordinate transforms |
| `FE_NEXT_STATE` | state.js | State factory + logic |
| `FE_NEXT_RENDERER` | renderer.js | Canvas rendering |
| `FE_NEXT_INPUT` | input.js | Input event handlers |
| `FE_NEXT_HUD` | hud.js | DOM HUD updates |
| `FE_NEXT_DEBUG` | main.js | Debug/test access |
| `FE_NEXT_GAME` | main.js | Stable game reference for tests |

### Rendering approach

Geometric fallback rendering: terrain tiles are colored isometric diamonds, buildings are raised isometric boxes, units are circles with selection rings. No sprites required in FEN-01.

### Movement approach

Direct linear interpolation from origin to target tile. No pathfinding — units move in a straight line. This is intentional for FEN-01 scope.

---

## 4. Features

- [x] 24x24 isometric map with terrain grid (grass, sand, dirt)
- [x] Camera pan (WASD / middle-mouse drag)
- [x] Camera zoom (mouse wheel)
- [x] Player HQ visible (raised isometric box at tile 4,4)
- [x] HUD showing minerals, energy, game time
- [x] One test unit (light_tank) near HQ
- [x] Left-click selects unit
- [x] Right-click moves selected unit
- [x] Move markers (visual feedback on right-click)
- [x] Selection info panel
- [x] Help text overlay

---

## 5. Out of scope

- Economy / separator / resource gathering
- Construction
- Production / unit training
- Combat
- Enemy bot / AI
- Fog of war
- Territory
- Save / load
- Full menu flow
- Sprite-based rendering
- Pathfinding beyond direct movement
- Copying src/main.js or FE_PATCH chains
- Copying FE_10H1

---

## 6. Verification

```bash
node --check fe-next/src/main.js
node --check fe-next/src/core/constants.js
node --check fe-next/src/core/coordinates.js
node --check fe-next/src/game/state.js
node --check fe-next/src/render/renderer.js
node --check fe-next/src/input/input.js
node --check fe-next/src/ui/hud.js
node --check src/main.js
node --check src/config/runtime_flags.js
git diff --name-only origin/sandbox/main...HEAD
npm run test:e2e
```

Expected changed files:
```
docs/patches/FEN-01.md
docs/patches/INDEX.md
fe-next/index.html
fe-next/src/core/constants.js
fe-next/src/core/coordinates.js
fe-next/src/game/state.js
fe-next/src/input/input.js
fe-next/src/main.js
fe-next/src/render/renderer.js
fe-next/src/ui/hud.js
tests/e2e/fe-next-smoke.spec.js
```

---

## 7. Recommended FEN-02

FEN-02 should add economy/production/construction integration to the FE Next scaffold:
- Resource gathering (harvester unit)
- Separator building
- Production queue (units_factory)
- Construction system (builder unit)
- Reuse existing pure contract modules (economy_system.js, production_system.js, construction_system.js)
