# REF-MAIN-GLM-01 — Micro-refactor candidates for src/main.js

**Дата:** 2026-05-10
**Тип:** Audit / Report-only (Fast lane)
**Ветка:** sandbox/main
**Основание:** REF-MAIN-GLM-01
**Source of truth:** Текущий sandbox/main на GitHub

---

## 1. Summary

**src/main.js** — монолитный IIFE на **12 128 строк**. Вся игровая логика, рендеринг, ввод, бот AI, экономика, производство, строительство, сохранение — в одном файле.

### Крупные зоны в main.js

| Категория | Строк (примерно) | Ключевые системы |
|-----------|-------------------|------------------|
| Constants / state setup | 1–400 | TILE_W/H, game state, assets, helpers, map gen |
| Map generation | 383–915 | generateMap, resources, obstacles, patterns |
| Combat (light_tank) | 969–1790 | attack/approach/attack-move, damage, destroy |
| Game setup / buildings | 1799–2097 | createBuilding, createUnit, skirmish start |
| Economy / power | 2109–2510 | addResource, separator, factory, production, HUD |
| Enemy bot AI | 2520–4866 | updateEnemyBot, 9 subsystems, ~2500 строк bot helpers |
| Pathfinding | 4868–4997 | BFS findPath, passable, isBlocked |
| Click markers | 5001–5057 | addClickMarker, addUnitClickMarker |
| Unit movement | 5059–5487 | updateUnitMovement, queueManualMove |
| Harvester | 5488–6063 | state machine: idle→mine→return→unload |
| Debug logging | 6069–6165 | debugLog, safeCloneForLog, export/clear |
| Builder | 7072–8138 | state machine: idle→move→build→resume (5 состояний) |
| Territory / fog | 8139–8242 | claimTerritoryCell, updateFog, reveal |
| Save/load | 8244–8272 | saveGame, loadGame |
| Rendering | 8274–9540 | tiles, sprites, mines, buildings, units, fog, dust, HP bars, debug overlay |
| Selection / input | 9542–10916 | menus, drag select, canvas click, keyboard |
| Game loop | 10917–11682 | update(dt), loop(now), keydown/keyup, camera |
| Dev tools / snapshot | 11262–11931 | dev hotkeys, FE_DEV_SPAWN_UNIT, FE_EXPORT_SNAPSHOT |
| Result overlay / misc | 11932–12128 | pause menu, result state |

### Почему нужен micro-refactor, а не большой rewrite

Codex ранее пробовал REFACTOR-MAIN-01/02 — широкий extraction в отдельном ZIP snapshot. **Результат: игра сломалась на старте после выбора фракции.** Причины провала:

1. **Слишком широкий scope** — Codex выносил несколько модулей одновременно
2. **map_generation.js** — extraction изменил порядок вызовов Math.random(), карта стала другой
3. **Потеря shared closure scope** — функции потеряли доступ к `game`, `canvas`, `ctx` через IIFE замыкание
4. **Не было browser-тестирования** — `node --check` прошёл, но игра не загрузилась
5. **Один большой PR** — невозможно откатить одну сломанную часть, не откатывая всё

**Урок:** каждый extraction должен быть крошечным, один PR = один кандидат, и каждый PR проверяется в браузере.

### Какие зоны точно не трогать сейчас

- render() / drawUnit
- input / selection / drag
- movement / pathfinding
- combat
- enemy bot main tick
- builder state machine
- harvester state machine
- save/load
- map generation (пока не будет browser-safe strategy)
- debugLog (вызывается из ~58 production call sites с eager evaluation)

---

## 2. High-risk zones — do not touch first

| Зона | Строки | Почему рискованно | Что может сломаться | Когда трогать |
|------|--------|-------------------|---------------------|---------------|
| **render()** | 9441–9540 | Оркестрирует все rendering subsystems, связан с canvas, camera, fog, depth sort | Весь визуал игры | После extraction всех rendering subsystems |
| **drawUnit** | 8731–9020 | Сложная логика: 8-направления, анимация, selection ring, HP, type-specific ветки | Все юниты невидимы или рендерятся криво | Phase D |
| **Input / selection** | 9715–10916 | Глубоко связан с `selected`, `selectedUnits`, `dragSelect`, `attackMoveArmed`, context menu | Управление юнитами не работает | Phase D |
| **Movement / pathfinding** | 4868–5487 | Используется всеми юнитами + ботом, доступ к `game.obstacles/buildings/units/minerals` через IIFE scope | Все юниты стоят | Phase C (только после shared state) |
| **Combat** | 969–1790, 10343–10782 | 3 уровня: attack, attack-approach, attack-move. Сложная state machine | Вся боевая система | Phase D |
| **Enemy bot main tick** | 2520–4866 | `updateEnemyBot()` вызывает 8 подсистем, все через общий IIFE scope | Бот перестаёт работать | Phase D |
| **Builder state machine** | 7072–8138 | 5 состояний (idle→moving→building→moving_to_resume→building), сложные отмены | Строительство зданий сломано | Phase D |
| **Harvester state machine** | 5488–6063 | idle→moving→harvesting→returning→unloading, auto-gather loop | Добыча ресурсов сломана | Phase D |
| **Save/load** | 8244–8272 | Формат save привязан к структуре `game` объекта | Сломанные saves | Phase D |
| **Map generation** | 383–915 | Зависит от `game` через прямое обращение, использует `Math.random()` — изменение порядка = другая карта | Баланс карты, стартовые позиции | Только после browser-safe strategy + seed-based testing |
| **debugLog** | 6069–6164 | Вызывается из ~58 production call sites. Payload args eager evaluation — `safeCloneForLog()` выполняется даже когда debug отключён | Если extract без lazy-eval refactor — debug payload будет считаться от старой функции, или вызов упадёт | Только после lazy-eval refactor всех call sites |

---

## 3. Low-risk / medium-low candidates

| # | Candidate | Что вынести/почистить | Почему безопасно | Expected files | Risk | Checks |
|---|-----------|----------------------|------------------|----------------|------|--------|
| 1 | **Dead code cleanup** | Удалить unreachable code после `return`, no-op функции, disabled блок, commented-out вызов | Все блоки имеют чёткие доказательства dead: unreachable after return, immediate return, commented call, disabled flag | src/main.js (уменьшение) | 🟢 low | `node --check`, browser: игра загружается |
| 2 | **Combat debug overlay** | Вынести `FE_LT_04C6*` (6 функций, ~140 строк) в отдельный модуль | Вызывается только из render() с runtime guard. Self-contained блок | src/dev/combat_debug_overlay.js (new), src/main.js (уменьшение), index.html (1 script tag) | 🟢 low | `node --check`, browser: toggle overlay Num9 |
| 3 | **Enemy economy debug panel** | Вынести `FE_DEBUG_EnemyEconomy*` (11 функций + setInterval, ~230 строк) в отдельный модуль | Вызывается только из F2 handler + setInterval. Полностью self-contained | src/dev/enemy_economy_panel.js (new), src/main.js (уменьшение), index.html (1 script tag) | 🟢 low | `node --check`, browser: F2 открывает панель |
| 4 | **Snapshot / export system** | Вынести `feMakeSnapshot`, `feSnapshotSafe`, `feSnapshotDiagnoseCell`, `FE_EXPORT_SNAPSHOT`, F8 handler (~170 строк) | Вызывается только из F8 / browser console. Self-contained | src/dev/snapshot.js (new), src/main.js (уменьшение), index.html (1 script tag) | 🟢 low | `node --check`, browser: F8 экспортирует JSON |
| 5 | **Standalone pure constants** | Вынести `SAVE_KEY`, `SETTINGS_KEY`, `TILE_W`, `TILE_H`, `MAP_SIZES`, `BASE_STORAGE`, `FACTION_ELEMENT_KEY` (6 standalone констант) | Только объявления, нулевая логика, нет window.* зависимостей | src/core/constants.js (new), src/main.js (уменьшение ~12 строк), index.html (1 script tag) | 🟢 low | `node --check`, runtime values идентичны |

---

## 4. Candidate details

### Candidate 1 — Dead code cleanup ✅ DONE

**Выполнено:** REF-MAIN-GLM-02 (2026-05-10), ветка glm/ref-main-02-dead-code-cleanup
**Результат:** Удалено 209 строк (9 блоков). main.js: 12 128 → 11 919 строк (-1.7%)

**Что сделать:**
Удалить из src/main.js весь доказанно dead/disabled код. Не создавать новых файлов. Только удаление.

**Блоки для удаления:**

| Блок | Строки | Доказательство dead |
|------|--------|---------------------|
| `applyTestBuildingCostsX10()` definition + commented call | 25–78 | Единственный вызов закомментирован на строке 78: `// applyTestBuildingCostsX10();`. Кроме того, в теле баг: строка 38 делает `def.cost = Math.max(1, (def.cost))` — не делит на 10 |
| Dead tail в `setLightTankAttack()` | 1519–1552 | Unreachable после `return setLightTankAttackGeneric(...)` на строке 1517 |
| Dead tail в `spawnLightTankForOwner()` | 1748–1776 | Unreachable после `return spawned;` на строке 1746 |
| Dead tail в `FE_PATCH_07ASetupSkirmishStart()` | 2056–2084 | Unreachable после `return { ... };` на строках 2045–2054 |
| Dead tail в `setLightTankAttackApproach()` | 10453–10490 | Unreachable после `return setLightTankAttackApproachGeneric(...)` на строке 10451 |
| `drawIsoShadow()` no-op | 8384–8388 | Тело: `return;`. Никогда не вызывается — 0 call sites |
| `FE_PATCH_06ADrawEnemyBaseMarker()` no-op | 8677–8679 | Тело: `return;`. Никогда не вызывается — 0 call sites |
| `drawEnemyUnitMarker()` no-op | 10333–10335 | Тело: `return;`. Никогда не вызывается — 0 call sites |
| `drawEnemyBuildingMarker()` no-op | 10337–10339 | Тело: `return;`. Никогда не вызывается — 0 call sites |

**Итого строк к удалению:** ~170 строк

**НЕ трогать:**
- `FE_UNIT_CONTROLLER_ENABLED` block (11632–11654) — это feature flag, не dead code
- `src/core/unit_controller.js` — отдельный файл, требует Review lane
- `src/main_broken_04c3.js`, `src/main_broken_04c5.js`, `src/main_before_restore_04a.js` — backup файлы, удаление требует Review lane

**Почему это безопасно:**
Все блоки имеют железные доказательства dead: unreachable after unconditional `return`, no-op body + zero call sites, commented-out call. Удаление не может изменить runtime поведение, потому что этот код никогда не выполняется.

**Expected changed files:**
- `src/main.js` (уменьшение на ~170 строк)

**Checks:**
- `node --check src/main.js` — PASS
- Browser: игра загружается, новая игра стартует, scout спавнится через `FE_DEV_SPAWN_UNIT('scout')`, factory производит scout

**Manual smoke:**
1. Открыть игру → новый game → выбрать фракцию → карта сгенерировалась ✓
2. `FE_DEV_SPAWN_UNIT('scout')` → scout появился ✓
3. Factory → scout → производство работает ✓
4. Нет console errors ✓

**Rollback:**
`git revert` — все удалённые строки можно восстановить из git history.

**PROMPT FOR FUTURE GLM PATCH:**

```
Task: DEAD-CLEANUP-01 — remove proven dead code from src/main.js
Lane: Review
Branch: glm/dead-cleanup-01

Goal:
Remove ONLY proven dead/unreachable/no-op code from src/main.js.
This is a cleanup patch, NOT a refactor.

Blocks to delete (with evidence):
1. Lines 25-78: applyTestBuildingCostsX10() — sole call is commented out on line 78
2. Lines 1519-1552: unreachable code after unconditional return on line 1517 in setLightTankAttack()
3. Lines 1748-1776: unreachable code after unconditional return on line 1746 in spawnLightTankForOwner()
4. Lines 2056-2084: unreachable code after unconditional return on lines 2045-2054 in FE_PATCH_07ASetupSkirmishStart()
5. Lines 10453-10490: unreachable code after unconditional return on line 10451 in setLightTankAttackApproach()
6. Lines 8384-8388: drawIsoShadow() — body is just `return;`, zero call sites
7. Lines 8677-8679: FE_PATCH_06ADrawEnemyBaseMarker() — body is just `return;`, zero call sites
8. Lines 10333-10335: drawEnemyUnitMarker() — body is just `return;`, zero call sites
9. Lines 10337-10339: drawEnemyBuildingMarker() — body is just `return;`, zero call sites

HARD RULES:
1. Do NOT touch any code that might be reachable
2. Do NOT delete FE_UNIT_CONTROLLER_ENABLED block (lines 11632-11654) — it's a feature flag
3. Do NOT delete src/core/unit_controller.js or backup files — separate cleanup
4. Do NOT change any gameplay behavior
5. Do NOT add new features
6. Run node --check src/main.js after every deletion
7. Test in browser: game loads, new game starts, scout spawns, factory produces

After: report main.js line count before/after.
```

---

### Candidate 2 — Combat debug overlay extraction ✅ DONE

**Выполнено:** REF-MAIN-GLM-03 (2026-05-10), ветка glm/ref-main-03-combat-debug-overlay-extract
**Результат:** 6 функций FE_LT_04C6* вынесены в src/dev/combat_debug_overlay.js (218 строк). main.js: 11 919 → 11 783 строк (-136)

**Что сделать:**
Вынести 6 функций `FE_LT_04C6*` (строки 9297–9439) в `src/dev/combat_debug_overlay.js`.

**Функции для выноса:**
| Функция | Строки | Зависимости |
|---------|--------|-------------|
| `FE_LT_04C6SelectedPlayerLightTanks` | 9298–9302 | `selectedPlayerLightTanks`, `selected`, `isLightTank`, `isPlayerUnit` |
| `FE_LT_04C6DrawRangeDiamond` | 9304–9324 | `ctx`, `tileToScreen` |
| `FE_LT_04C6DrawAttackMoveMarker` | 9326–9346 | `ctx`, `tileToScreen` |
| `FE_LT_04C6DrawTargetLine` | 9348–9371 | `ctx`, `tileToScreen`, `FE_PATCH_06BTargetCenter` |
| `FE_LT_04C6DrawPanel` | 9373–9409 | `ctx`, `attackMoveArmed`, `FE_PATCH_06BResolveAttackTarget` |
| `FE_LT_04C6DrawCombatDebugOverlay` | 9411–9438 | `window.FE_LT_04C6_COMBAT_DEBUG_OVERLAY_ENABLED`, все 5 выше |

**Почему это безопасно:**
- Все 6 функций self-contained — только `FE_LT_04C6DrawCombatDebugOverlay` вызывается извне (из render(), строка 9537)
- Runtime guard: `window.FE_LT_04C6_COMBAT_DEBUG_OVERLAY_ENABLED` по умолчанию `false`
- Вынос не влияет на gameplay — overlay отключён по умолчанию
- Для доступа к `game`, `ctx`, `tileToScreen` и т.д. — использовать существующий `window.FE_CORE` bridge (строки 337–345)

**Что НЕ трогать:**
- Функцию `render()` — только заменить вызов `FE_LT_04C6DrawCombatDebugOverlay()` на `window.FE_COMBAT_DEBUG.drawOverlay()`
- Переменную `window.FE_LT_04C6_COMBAT_DEBUG_OVERLAY_ENABLED` — перенести в новый модуль
- Остальные rendering функции

**Expected changed files:**
- `src/dev/combat_debug_overlay.js` (new, ~150 строк)
- `src/main.js` (уменьшение на ~140 строк)
- `index.html` (+1 script tag перед main.js)

**Checks:**
- `node --check` на всех файлах
- Browser: Num9 toggles combat debug overlay
- Browser: без Num9 — игра работает идентично

**Manual smoke:**
1. Игра загружается ✓
2. Новый game ✓
3. Spawn scout через `FE_DEV_SPAWN_UNIT('scout')` ✓
4. Num9 — overlay появляется/исчезает ✓
5. Без Num9 — gameplay идентичен ✓

**Rollback:**
Вернуть функции из combat_debug_overlay.js в main.js, удалить script tag.

**PROMPT FOR FUTURE GLM PATCH:**

```
Task: EXTRACT-COMBAT-DEBUG-01 — extract combat debug overlay to separate module
Lane: Review
Branch: glm/extract-combat-debug-01

Goal:
Move the 6 FE_LT_04C6* combat debug overlay functions from src/main.js into a new src/dev/combat_debug_overlay.js module.

Steps:
1. Create src/dev/combat_debug_overlay.js that:
   - Exposes window.FE_COMBAT_DEBUG = { drawOverlay }
   - Uses window.FE_CORE for game/ctx/tileToScreen access
   - Contains all 6 FE_LT_04C6* functions
   - Moves FE_LT_04C6_COMBAT_DEBUG_OVERLAY_ENABLED flag
2. In src/main.js:
   - Remove the 6 FE_LT_04C6* function definitions (lines ~9297-9439)
   - Remove the FE_LT_04C6_COMBAT_DEBUG_OVERLAY_ENABLED declaration
   - In render(), replace FE_LT_04C6DrawCombatDebugOverlay() call with window.FE_COMBAT_DEBUG?.drawOverlay()
3. In index.html:
   - Add <script src="src/dev/combat_debug_overlay.js?v=extract_combat_debug_01"></script> before src/main.js

HARD RULES:
1. Do NOT change gameplay behavior
2. Do NOT modify render() logic beyond replacing the overlay call
3. Do NOT change the overlay appearance or data
4. Use window.FE_CORE for shared state access (already exists)
5. Run node --check after every change
6. Test in browser: overlay works with Num9, game works without it

After: report main.js line count before/after.
```

---

### Candidate 3 — Enemy economy debug panel extraction ✅ DONE

**Выполнено:** REF-MAIN-GLM-04 (2026-05-10), ветка glm/ref-main-04-enemy-economy-debug-panel-extract
**Результат:** 10 функций FE_DEBUG_EnemyEconomy* + toggle + interval вынесены в src/dev/enemy_economy_debug_panel.js (266 строк). main.js: 11 783 → 11 567 строк (-216)

**Что сделать:**
Вынести 11 функций `FE_DEBUG_EnemyEconomy*` + F2 handler + setInterval (строки 11021–11251) в `src/dev/enemy_economy_panel.js`.

**Почему это безопасно:**
- Вызывается только из F2 keydown handler и `setInterval` — оба debug-only
- Полностью self-contained блок: все 11 функций вызываются только друг из друга
- Никакой production код не зависит от этих функций
- Для доступа к `game`, `getStorageLimitsForOwner`, `findBaseBuilding` — использовать `window.FE_CORE`

**Что НЕ трогать:**
- Остальные keydown handlers
- Production rendering
- Bot AI

**Expected changed files:**
- `src/dev/enemy_economy_panel.js` (new, ~230 строк)
- `src/main.js` (уменьшение на ~230 строк)
- `index.html` (+1 script tag)

**Checks:**
- `node --check` на всех файлах
- Browser: F2 toggles enemy economy panel
- Browser: без F2 — игра идентична

**Manual smoke:**
1. Игра загружается ✓
2. F2 — панель экономики врага появляется ✓
3. F2 ещё раз — исчезает ✓
4. Без F2 — gameplay идентичен ✓

**Rollback:**
Вернуть функции в main.js, удалить script tag.

**PROMPT FOR FUTURE GLM PATCH:**

```
Task: EXTRACT-ENEMY-ECON-PANEL-01 — extract enemy economy debug panel
Lane: Review
Branch: glm/extract-enemy-econ-panel-01

Goal:
Move all FE_DEBUG_EnemyEconomy* functions + F2 handler + setInterval from src/main.js into src/dev/enemy_economy_panel.js.

Steps:
1. Create src/dev/enemy_economy_panel.js that:
   - Exposes window.FE_ENEMY_ECON_PANEL = { toggle, render }
   - Contains all 11 FE_DEBUG_EnemyEconomy* functions
   - Moves F2 keydown handler registration + setInterval
   - Uses window.FE_CORE for game/buildingOwner/getStorageLimits access
2. In src/main.js:
   - Remove the 11 functions + F2 handler + setInterval (lines ~11021-11251)
   - Keep all other keydown handlers untouched
3. In index.html:
   - Add script tag before src/main.js

HARD RULES:
1. Do NOT change gameplay
2. Do NOT change panel content or behavior
3. Use window.FE_CORE for shared state
4. node --check after every change
5. Test in browser: F2 works, game works without F2

After: report main.js line count before/after.
```

---

### Candidate 4 — Snapshot / export system extraction ✅ DONE

**Выполнено:** REF-MAIN-GLM-05 (2026-05-10), ветка glm/ref-main-05-snapshot-export-extract
**Результат:** 5 функций fe* + FE_EXPORT_SNAPSHOT + F8 handler вынесены в src/dev/snapshot_export.js (254 строки). main.js: 11 567 → 11 382 строк (-185)

**Что сделать:**
Вынести `feMakeSnapshot`, `feSnapshotSafe`, `feSnapshotDiagnoseCell`, `feSnapshotAroundUnit`, `feSnapshotBuildInfo`, `FE_EXPORT_SNAPSHOT`, F8 handler (строки 11692–11927) в `src/dev/snapshot.js`.

**Почему это безопасно:**
- Вызывается только из F8 / browser console — dev-only
- `window.FE_EXPORT_SNAPSHOT` — единственный external interface
- Все внутренние функции (`feSnapshotSafe`, `feSnapshotDiagnoseCell` и т.д.) вызываются только из `feMakeSnapshot`
- Для доступа к `game`, `BUILDING_SIZE`, `canPlaceBuilding`, `findPath` — использовать `window.FE_CORE`
- `feSnapshotSafe` — near-duplicate `safeCloneForLog`, можно заменить на вызов `safeCloneForLog` или оставить как есть

**Что НЕ трогать:**
- `safeCloneForLog` в main.js — она вызывается из production кода (debugLog)
- `FE_DEV_SPAWN_UNIT` — это отдельный dev tool
- F9/F10 handlers (debugLog export/clear)

**Expected changed files:**
- `src/dev/snapshot.js` (new, ~170 строк)
- `src/main.js` (уменьшение на ~170 строк)
- `index.html` (+1 script tag)

**Checks:**
- `node --check` на всех файлах
- Browser: F8 экспортирует snapshot JSON
- Browser: без F8 — игра идентична

**Manual smoke:**
1. Игра загружается ✓
2. F8 — скачивается JSON файл ✓
3. `FE_EXPORT_SNAPSHOT()` в консоли — работает ✓
4. Без F8 — gameplay идентичен ✓

**Rollback:**
Вернуть функции в main.js, удалить script tag.

**PROMPT FOR FUTURE GLM PATCH:**

```
Task: EXTRACT-SNAPSHOT-01 — extract snapshot/export system to separate module
Lane: Review
Branch: glm/extract-snapshot-01

Goal:
Move feMakeSnapshot, feSnapshotSafe, feSnapshotDiagnoseCell, feSnapshotAroundUnit, feSnapshotBuildInfo, window.FE_EXPORT_SNAPSHOT, and F8 handler from src/main.js into src/dev/snapshot.js.

Steps:
1. Create src/dev/snapshot.js that:
   - Exposes window.FE_EXPORT_SNAPSHOT
   - Contains all fe* functions
   - Uses window.FE_CORE for game/BUILDING_SIZE/canPlaceBuilding/findPath access
   - Registers F8 keydown handler
2. In src/main.js:
   - Remove fe* function definitions + FE_EXPORT_SNAPSHOT + F8 handler (lines ~11692-11927)
3. In index.html:
   - Add script tag before src/main.js

HARD RULES:
1. Do NOT change gameplay
2. Do NOT change snapshot format or content
3. Use window.FE_CORE for shared state
4. node --check after every change
5. Test in browser: F8 exports JSON, game works normally

After: report main.js line count before/after.
```

---

### Candidate 5 — Standalone pure constants extraction

**Что сделать:**
Вынести 6 standalone констант (без window.* зависимостей) в `src/core/constants.js`.

**Константы для выноса:**

| Константа | Строка | Значение | Зависимости |
|-----------|--------|----------|-------------|
| `SAVE_KEY` | 7 | `'four_elements_core_base_v04_save'` | Нет |
| `SETTINGS_KEY` | 8 | `'four_elements_core_base_v04_settings'` | Нет |
| `TILE_W` | 9 | `76` | Нет |
| `TILE_H` | 10 | `38` | Нет |
| `MAP_SIZES` | 11–14 | `{ standard: {...}, large: {...} }` | Нет |
| `BASE_STORAGE` | 85–92 | `{ minerals:200, energy:300, ... }` | Нет |
| `FACTION_ELEMENT_KEY` | 94–99 | `{ purple:'purple', green:'greenEl', ... }` | Нет |

**НЕ выносить в этом PR:**
- `BUILDING_SIZE` (строка 15) — зависит от `window.FE_BUILDING_SIZE`
- `BUILDINGS` (строка 18) — зависит от `window.FE_BUILDINGS`
- `UNIT_DEFS` (строка 83) — зависит от `window.FE_UNITS`
- `FACTIONS`, `MINE_TYPES`, `OBSTACLE_ASSETS`, `SPRITE_PROFILES` — все зависят от window.*
- `FE_PATCH_07A3_ENEMY_VISUAL_FACTION` (строка 289) — зависит от констант, но не от window.* → можно вынести, но лучше оставить для простоты

**Почему это безопасно:**
- Только объявления, нулевая логика
- Нет window.* зависимостей
- Константы неизменяемы — runtime значения идентичны до и после
- `src/core/constants.js` загрузится до main.js через script tag

**Expected changed files:**
- `src/core/constants.js` (new, ~25 строк)
- `src/main.js` (уменьшение на ~18 строк, замена `const X = value` → `const X = window.FE_CONSTANTS.X`)
- `index.html` (+1 script tag после существующих config scripts, перед main.js)

**Checks:**
- `node --check` на всех файлах
- Browser: `window.FE_CONSTANTS.TILE_W === 76` ✓
- Browser: игра загружается, карта генерируется ✓

**Manual smoke:**
1. Игра загружается ✓
2. Новый game → карта генерируется ✓
3. `window.FE_CONSTANTS.TILE_W` === 76 в консоли ✓
4. `window.FE_CONSTANTS.BASE_STORAGE.minerals` === 200 ✓

**Rollback:**
Вернуть `const` объявления в main.js, удалить script tag и constants.js.

**PROMPT FOR FUTURE GLM PATCH:**

```
Task: EXTRACT-CONSTANTS-01 — extract standalone pure constants
Lane: Review
Branch: glm/extract-constants-01

Goal:
Move 7 standalone constants (no window.* dependencies) from src/main.js into src/core/constants.js.

Constants to move:
- SAVE_KEY = 'four_elements_core_base_v04_save'
- SETTINGS_KEY = 'four_elements_core_base_v04_settings'
- TILE_W = 76
- TILE_H = 38
- MAP_SIZES = { standard: {...}, large: {...} }
- BASE_STORAGE = { minerals:200, energy:300, purple:20, greenEl:20, cyanEl:20, yellowEl:20 }
- FACTION_ELEMENT_KEY = { purple:'purple', green:'greenEl', cyan:'cyanEl', yellow:'yellowEl' }

Steps:
1. Create src/core/constants.js:
   window.FE_CONSTANTS = Object.freeze({
     SAVE_KEY: 'four_elements_core_base_v04_save',
     SETTINGS_KEY: 'four_elements_core_base_v04_settings',
     TILE_W: 76,
     TILE_H: 38,
     MAP_SIZES: { ... },
     BASE_STORAGE: { ... },
     FACTION_ELEMENT_KEY: { ... }
   });
2. In src/main.js:
   - Replace `const SAVE_KEY = 'four_elements_core_base_v04_save';` with nothing
   - Add at top of IIFE: const { SAVE_KEY, SETTINGS_KEY, TILE_W, TILE_H, MAP_SIZES, BASE_STORAGE, FACTION_ELEMENT_KEY } = window.FE_CONSTANTS;
   - Remove all 7 original const declarations
3. In index.html:
   - Add <script src="src/core/constants.js?v=extract_constants_01"></script> before src/main.js

Do NOT move:
- BUILDING_SIZE, BUILDINGS, UNIT_DEFS, FACTIONS, MINE_TYPES, OBSTACLE_ASSETS, SPRITE_PROFILES — all depend on window.*

HARD RULES:
1. Do NOT change any constant values
2. Do NOT change gameplay behavior
3. Verify: window.FE_CONSTANTS.TILE_W === 76 after loading
4. node --check after every change
5. Test in browser: game loads, map generates

After: report main.js line count before/after.
```

---

## 5. Recommended first micro-refactor

### 🏆 Candidate 1 — Dead code cleanup

**Почему именно он первый:**

1. **Минимальный diff** — только удаление строк, никакой новый код
2. **Нулевой риск** — все блоки имеют железные доказательства dead (unreachable, no-op, commented call)
3. **Не ломает gameplay** — удалённый код никогда не выполнялся
4. **Легко проверить** — `node --check` + browser smoke
5. **Даёт реальную пользу** — уменьшает main.js на ~170 строк, упрощает навигацию
6. **Не требует новых файлов** — нет риска ошибки в script tag, загрузке модуля, window.* bridge
7. **Не требует изменений в index.html** — нет новых script tags
8. **Обратим** — `git revert` восстанавливает всё

**Критерий «один PR = один кандидат» выполнен:** да, это одно логическое изменение (dead code removal).

**Почему не constants.js первым:**
Хотя constants extraction технически прост, он требует:
- Создание нового файла
- Добавление script tag в index.html
- Изменение способа объявления констант в main.js
- Проверку, что script tag загружается до main.js

Dead code cleanup не требует ничего из этого — чистое удаление. Если что-то пойдёт не так, откат тривиален.

---

## 6. What not to do

1. **НЕ делать большой refactor** — один PR = один маленький кандидат
2. **НЕ выносить map_generation без browser-safe strategy** — Math.random() порядок изменится, карта станет другой, баланс сломается. Нужен seed-based testing перед extraction
3. **НЕ трогать combat/bot/render/input/save-load** — эти зоны глубоко связаны с shared IIFE scope, extraction требует shared state gateway
4. **НЕ повторять Codex-style broad extraction** — Codex выносил несколько модулей за один PR и сломал игру. Каждый extraction — отдельный PR с browser проверкой
5. **НЕ менять gameplay под видом refactor** — refactor не меняет поведение, только структуру
6. **НЕ выносить debugLog** — он вызывается из ~58 production call sites с eager evaluation. Extraction без lazy-eval refactor сломает debug payload или вызовет runtime error
7. **НЕ удалять backup файлы и unit_controller.js без Review lane** — это отдельные cleanup задачи
8. **НЕ добавлять ES modules** — проект использует browser globals через script tags, не нужно менять модульную систему
9. **НЕ забывать cache busting** — если добавляешь script tag в index.html, используй `?v=<patch_id>`, иначе браузер закэширует старую версию
10. **НЕ забывать window.FE_CORE** — существующий bridge (строки 337–345) нужно расширять, а не создавать параллельный
