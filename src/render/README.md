# src/render/ — Rendering & Visual Systems

**Owner:** ARCH-LAB (architecture migration)
**Status:** Skeleton — partial modules exist in src/modules/render/
**Roadmap step:** ARCH-LAB-04

## Purpose

All rendering, visual effects, and draw-order logic extracted from main.js.
This directory will absorb the existing `src/modules/render/` modules and
add new render subsystems extracted during LAB-04.

## Existing modules (in src/modules/render/ — to be migrated here)

| Module | Lines | Description |
|--------|-------|-------------|
| `visual_anchor.js` | ~80 | Visual anchor for depth sorting |
| `sprite_alpha.js` | ~40 | Sprite alpha/transparency management |
| `visual_calibrator.js` | ~60 | Visual calibration helpers |

## Planned modules (ARCH-LAB-04)

| Module | Source zone | Lines (est.) | Description |
|--------|-----------|-------------|-------------|
| `render_main.js` | Z20 | ~1 000 | Main render loop, camera, draw calls |
| `draw_units.js` | Z20 partial | ~400 | Unit sprite rendering, animations, direction |
| `draw_buildings.js` | Z20 partial | ~300 | Building rendering, construction progress |
| `draw_effects.js` | Z20 partial | ~200 | Particle effects, dust, click markers, explosions |
| `draw_hud.js` | Z20 partial | ~150 | In-game HUD rendering (health bars, selection) |
| `draw_minimap.js` | Z20 partial | ~100 | Minimap rendering |
| `draw_fog.js` | Z18 partial | ~150 | Fog of war rendering |

## Dependencies

- `src/config/sprite_profiles.js` — sprite sheet definitions
- `src/config/runtime_flags.js` — visual debug flags
- `src/core/asset_loader.js` — loaded sprite sheets
- `src/game/*` — game state for entity positions
- `src/systems/*` — territory/fog data

## Contract

All modules in this directory must:
- Register on `window.FE_MODULE_NAME` pattern
- Accept canvas context + game state via `window.FE_CORE` bridge
- Never modify game state — render is read-only from game data
- Group draw calls by layer (terrain → buildings → units → effects → UI)
- Respect runtime flags for debug overlays

## Current contents

None — directory is a skeleton placeholder awaiting ARCH-LAB-04 extraction.
Existing render modules remain in `src/modules/render/` until migration.
