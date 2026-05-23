# MAP-EDITOR-ARCH-01 — Manual QA Checklist

Last updated: 2026-05-23.

Manual QA checklist for the completed MAP-EDITOR-ARCH-01 feature set (PR1–PR10).

## Setup

Open the app with devtools enabled:
`https://ratoker-jpg.github.io/four-elements-next/?devtools=1`

Or run locally: `npm run dev` and open `http://localhost:5173/?devtools=1`

## Editor Basic Operations

- [ ] **Open editor** — click "Редактор карты" on main menu; editor screen loads with canvas visible
- [ ] **Map preview renders** — isometric map with terrain, resources, obstacles, decor, HQ visible
- [ ] **Pan camera** — arrow keys or right-click drag moves the viewport
- [ ] **Zoom camera** — scroll wheel zooms in/out

## Placement and Removal

- [ ] **Place resource** — select "Размещение" tool, pick a resource type (e.g. "Малый ресурс"), click empty tile → resource appears, resource count in info panel increases
- [ ] **Place obstacle** — select "Размещение" tool, pick obstacle type (e.g. "Скалы"), click empty tile → obstacle appears, obstacle count increases
- [ ] **Place decor** — select "Размещение" tool, pick decor type (e.g. "Куст"), click empty tile → decor appears, decor count increases
- [ ] **Erase object** — select "Удаление" tool, click existing object → object removed, count decreases
- [ ] **Overlap prevention** — placing on an occupied tile shows red footprint preview and is rejected

## Validation

- [ ] **Validate map** — click "Проверить карту" → validation panel shows OK (green) for a freshly generated map
- [ ] **Invalid map detected** — remove all resources, then validate → validation panel shows error (red) with "Нет ресурсов на карте"

## Custom Map Save/Load/Delete

- [ ] **Save custom map** — click "Сохранить карту" → status shows success
- [ ] **Saved map appears** — expand saved maps panel (click "Сохранённые карты ▾") → entry visible with name "Карта 1", size, and counts
- [ ] **Load saved map** — click on a saved map entry name → editor loads that map, info panel updates to match saved counts
- [ ] **Delete saved map** — click delete button on a saved map entry → entry removed, empty state shown if no maps remain
- [ ] **Saved maps persist** — save a map, navigate to main menu, re-open editor, expand saved maps panel → entry still present

## Launch Game from Custom Map

- [ ] **Launch valid map** — on a valid editor map, click "Начать игру" → game screen loads with canvas visible
- [ ] **Game runs with correct faction** — after launch, the game runs with the faction from `mapData.hq.faction` (cyan by default)
- [ ] **Invalid map does not launch** — make the map invalid (e.g. remove all resources), click "Начать игру" → stays on editor screen, status shows error
- [ ] **Saved map not mutated** — save a map, launch game from editor, return to main menu, re-open editor, expand saved maps → saved map data unchanged

## Normal New Game Flow (Regression)

- [ ] **Normal New Game still works** — from main menu, click "Новая игра" → Map Size → Seed Screen → Faction Select → Game Screen → game runs normally
- [ ] **Seed Screen features** — seed input visible, "Случайный сид" button works, 4 preset buttons visible
- [ ] **Saved seeds** — "Сохранить сид" button visible on Seed Screen, saved seeds list works

## No Unimplemented Features

- [ ] **No export/import UI** — no "Export" / "Import" / "Экспорт" / "Импорт" buttons visible in editor
- [ ] **No volcano entries** — no volcano palette items, no volcano presets, no volcano config

## E2E Coverage

The following E2E spec files cover MAP-EDITOR-ARCH-01 functionality:

- `tests/e2e/editor-placement.spec.ts` — placement/removal tools
- `tests/e2e/editor-validation.spec.ts` — validation panel and feedback
- `tests/e2e/editor-custom-maps.spec.ts` — save/load/delete custom maps
- `tests/e2e/editor-launch-custom-map.spec.ts` — game launch from custom map

All E2E tests pass with `npx vite build --mode test && npx playwright test`.
