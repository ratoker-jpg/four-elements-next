# Project State — Quick Reference

Read this file first in any new session.

## Project

**Four Elements Next** — browser isometric RTS.
TypeScript strict + Vite + Canvas 2D + HTML overlay UI + Vitest + Playwright.

## Repo

- **Main branch:** `main`
- **QA URL:** https://ratoker-jpg.github.io/four-elements-next/?devtools=1
- **CI (5 checks):** type-check, build, test, test:e2e, GITHUB_PAGES=true build
- **E2E runner:** `./node_modules/.bin/playwright test --workers=1` from repo root after `npx vite build --mode test`
- **Devtools guard:** `import.meta.env.DEV` OR `MODE=test` OR `?devtools=1`

## Core Folders

| Folder | Purpose |
|---|---|
| `src/game` | Map data, game state, game world, mapgen |
| `src/systems` | economy, construction, production, harvesting, power, control, territory, passability, pathfinding |
| `src/render` | Terrain, buildings, resources, units, dev overlays |
| `src/dev` | Dev panel, Sprite Debug, test hooks |
| `src/core` | Constants (FORBIDDEN to change without explicit approval) |
| `src/config` | Building definitions, footprints |
| `tests/unit` | Vitest unit tests |
| `tests/e2e` | Playwright E2E tests |

## Completed Architecture

### DEV-SANDBOX-ARCH-01
Dev panel, `?devtools=1` guard, grid/footprint/blocking overlays, Sprite Debug overlay.

### PATHFINDING-ARCH-01
- **PR1:** Passability grid + BFS pathfinder (`src/systems/passability.ts`, `src/systems/pathfinding.ts`)
- **PR2:** Harvester pathfinding to adjacent resource/dropoff tile
- **FIX:** Harvester facing direction on arrival
- **PR3:** Construction reachability check, `no-route` failure reason, no matter deduction on no-route
- **PR4:** Builder movement to construction site, pending site lifecycle, `ftx/fty` smooth movement, repath/cancel with matter refund clamped to `matterCap`

### VISUAL-QA-ARCH-01
- **PR1:** Sprite Debug overlay (dev-only, visual QA tool)
- **PR2:** Civil unit scale tuning

## Important Gameplay Facts

- **Blocking:** resources, buildings, HQ, obstacles block movement and construction
- **Non-blocking in MVP:** decor (bush, sand-bump), territory, units
- **Harvester:** uses pathfinding to adjacent resource/dropoff tile, returns raw to HQ
- **Builder:** moves to adjacent construction tile before progress starts; site can be `pending`
- **Construction site:** `pending=true` means elapsed/progress do NOT advance until builder arrives
- **Matter refund:** on repath-failure cancel, `economy.resources.matter = Math.min(matter + costMatter, matterCap)`
- **Building spacing:** one-tile gap required between buildings/HQ/construction-sites
- **E2E timing:** `__constructionState` hook updates per animation frame; use `expect.poll()` for state changes after UI clicks

## Key Constants (DO NOT CHANGE)

- `src/core/constants.ts` — forbidden without explicit approval
- Builder sprite: `builder_base: { size: [57, 57], groundOffset: 15 }`
- `BUILDER_SPEED = 2.0` (in `src/systems/construction.ts`)
