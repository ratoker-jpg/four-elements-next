# ARCH-MAP-01 — Актуальная карта src/main.js и систем

**Дата:** 2026-05-12
**Тип:** Architecture audit / systems map
**Статус:** Активный
**Фактический размер main.js:** 15 379 строк (проверено `wc -l`, не из checkpoint)
**Назначение:** Зафиксировать актуальную карту кода: зоны ответственности, patch-chains, внешние модули, риски, кандидаты на вынос.

---

## 1. Executive summary

### Текущее состояние

| Метрика | Значение |
|---|---:|
| `src/main.js` | 15 379 строк |
| Внешних модулей | 14 файлов в 4 директориях (src/core/, src/dev/, src/config/, src/modules/) |
| FE_PATCH_ ссылок | 683 вхождения |
| `_enemy*` свойств | ~18 паттернов |
| `_scout*` свойств | ~30+ паттернов |
| Зон ответственности | 26 зон |

### Главный архитектурный долг

**34% файла — enemy bot AI** (зона Z13, строки 2507–7761, ~5 255 строк). Это самая большая и самая связанная зона. Внутри смешаны видение, разведка, принятие решений, атака, отступление, оборона, экономика, производство — всё в одном IIFE scope с доступом к `game.*` через замыкание.

Вторая по размеру проблема: **зона builder/construction** (Z17, строки 9039–11698, ~2 660 строк), в которой смешаны player builder, enemy builder, enemy economy (separator, factory, power plant, elements_storage), BRAIN-01 decision loop и construction helpers.

### Общий уровень риска

**Высокий.** Файл вырос с 11 358 строк (после рефактор-спринта) до 15 379 строк (+3 021 строка, +27%) только за счёт patch accumulation. Если темп продолжится, к концу следующего спринта main.js превысит 18 000 строк.

---

## 2. Текущие external modules

| File | Загружен из index.html | Browser global / API | Назначение | Строк | Риск |
|------|----------------------|---------------------|-----------|------:|------|
| `src/config/buildings.js` | Да (#1) | `FE_BUILDINGS`, `FE_BUILDING_SIZE` | Статичные определения зданий (стоимость, время, footprint) | 57 | Low — чистые данные |
| `src/config/units.js` | Да (#2) | `FE_UNITS` | Статичные определения юнитов (hp, speed, cost) | 11 | Low — чистые данные |
| `src/config/factions.js` | Да (#3) | `FE_FACTIONS` | Определения фракций (цвет, бонус, скорость) | 25 | Low — чистые данные |
| `src/config/environment.js` | Да (#4) | `FE_MINE_TYPES`, `FE_OBSTACLE_ASSETS` | Определения минералов и препятствий | 21 | Low — чистые данные |
| `src/config/sprite_profiles.js` | Да (#5) | `FE_SPRITE_PROFILES` | Профили спрайтов (размеры, якоря, смещения) | 48 | Low — чистые данные |
| `src/config/runtime_flags.js` | Да (#6) | ~50 `window.FE_*` флагов | Runtime-флаги, tuning-константы, debug-переключатели | 143 | Medium — часть флагов управляет gameplay |
| `src/core/storage_guard.js` | Да (#7) | `__FE_STORAGE_GUARD_INSTALLED__` | Защита localStorage от переполнения debug-логами | 51 | Low — monkey-patch Storage |
| `src/core/asset_loader.js` | Да (#8) | `FE_ASSET_LOADER` | Загрузка спрайтов и анимаций | 108 | Low — делегированный loading |
| `src/core/save_manager.js` | Да (#9) | `FE_SAVE_MANAGER` | Save/load + UI слотов | 105 | Medium — зависит от api из main.js |
| `src/core/unit_controller.js` | Да (#10) | `FE_UNIT_CONTROLLER` | Альтернативный контроллер движения (по умолчанию выключен) | 878 | Medium — дублирует логику main.js |
| `src/core/standalone_constants.js` | Да (#18) | `FE_STANDALONE_CONSTANTS` | Замороженные константы (TILE_W/H, SAVE_KEY, MAP_SIZES) | 28 | Low — чистые данные, `Object.freeze()` |
| `src/dev/combat_debug_overlay.js` | Да (#15) | `FE_COMBAT_DEBUG_OVERLAY` | Debug-оверлей для боевых юнитов (Num9) | 220 | Low — dev-only, read-only |
| `src/dev/enemy_economy_debug_panel.js` | Да (#16) | `FE_ENEMY_ECONOMY_DEBUG_PANEL` | Панель экономики врага (F2) | 335 | Low — dev-only, read-only |
| `src/dev/snapshot_export.js` | Да (#17) | `FE_SNAPSHOT_EXPORT` / `FE_EXPORT_SNAPSHOT` | Экспорт snapshot игры в JSON (F8) | 280 | Low — dev-only, read-only |

Также загружены из `src/modules/` (не аудировались ранее в REF-спринтах):

| File | Browser global | Назначение |
|------|---------------|-----------|
| `src/ui/screen_manager.js` | `FE_SCREEN_MANAGER` | Управление экранами (mainMenu, factionMenu и др.) |
| `src/modules/render/visual_anchor.js` | — | Visual anchor для depth sort |
| `src/modules/render/sprite_alpha.js` | — | Alpha-обработка спрайтов |
| `src/modules/debug/debug_tools.js` | — | Debug-инструменты |
| `src/modules/render/visual_calibrator.js` | — | Калибровка визуальных параметров |

---

## 3. Карта `src/main.js` по зонам ответственности

| Zone | Строки | Размер | Ответственность | Связанность | Целевая система | Риск |
|------|--------|-------:|----------------|-------------|-----------------|------|
| Z1: Bootstrap | 1–200 | 200 | Инициализация game state, settings, UID | Читает FE_STANDALONE_CONSTANTS, FE_BUILDINGS, FE_UNITS | src/core/ (остаётся wiring) | Low |
| Z2: Asset Loading | 201–232 | 32 | Загрузка ассетов по фракции | Делегирует FE_ASSET_LOADER | src/core/asset_loader.js | Low |
| Z3: Geometry/Coords | 25–250 | 120 | tileToWorld, worldToTile, isoSort, clamp, dist | Читает game.camera, TILE_W/H | src/core/coordinates.js | Low |
| Z4: FE_CORE Bridge | 251–280 | 30 | Экспорт game, ctx, assets, tileToScreen для модулей | Внешние потребители зависят от интерфейса | Остаётся в main.js | Medium |
| Z5: Screen Manager | 274–296 | 23 | showToast, showScreen, hideScreens | Делегирует FE_SCREEN_MANAGER, FE_SAVE_MANAGER | src/ui/screen_manager.js | Low |
| Z6: Map Generation | 297–831 | 535 | Генерация карты, минералов, препятствий | Пишет game.terrain, territory, obstacles, minerals | src/systems/mapgen.js | Medium |
| Z7: Game Setup / Combat | 833–1698 | 866 | createUnit, createBuilding, damageUnit, attack buildings | Сильно связана с combat и enemy setup | Разделить: game_setup + combat | Medium |
| Z8: Enemy Base Setup | 1700–1827 | 128 | Размещение базы врага | Вызывает createBuilding, getEnemyDiagonalStart | src/ai/enemy_brain.js | Low |
| Z9: Skirmish Setup | 1829–1935 | 107 | Старт skirmish режима | Вызывает enemy base, harvesters, bot init | src/ai/enemy_brain.js | Medium |
| Z10: Camera/Territory Init | 1937–1953 | 17 | focusCameraOn, seedTerritory | game.camera, game.territory | Остаётся в main.js (wiring) | Low |
| Z11: Economy/Power | 1954–2498 | 545 | Ресурсы, storage, power, separator, production | Глубоко связана с enemy economy, production | src/systems/economy_system.js + power_system.js | High |
| Z12: Pathfinding | 7763–7893 | 140 | isBlocked, passable, findPath, adjacentFreeCells | Вызывается отовсюду — фундаментальная зона | src/systems/movement_system.js | High |
| **Z13: Enemy Bot AI** | **2507–7761** | **5 255** | **Весь enemy bot: vision, scout, attack, retreat, intel, strength** | **Зависит от всех остальных зон** | **src/ai/** (разделить на 6+ модулей) | **Very High** |
| Z14: Movement | 7894–8461 | 568 | updateUnitMovement, recoverUnitPath, clickMarkers | Вызывает passable, findPath | src/systems/movement_system.js | Medium |
| Z15: Command Feedback | 7967–8090 | 124 | Toast при командах, move rejection | Читает selected, selectedUnits | src/ui/hud.js | Low |
| Z16: Harvester | 8462–9037 | 576 | startHarvester, assignNextMine, updateHarvester | Связана с economy для ресурсообмена | src/systems/economy_system.js | Medium |
| Z17: Builder/Construction | 9039–11698 | 2 660 | Player+enemy builder, enemy economy, BRAIN-01, construction | Очень высокая — смешана с enemy factory/power | Разделить на production + construction + brain | Very High |
| Z18: Territory/Fog | 11699–11803 | 105 | claimTerritory, updateFog, isVisible, footprintVisible | game.territory, game.fogVisible/Explored | src/systems/territory_system.js | Medium |
| Z19: Save/Load | 11804–11940 | 137 | saveGame, loadGame, renderSaveMenu | Делегирует FE_SAVE_MANAGER | src/core/save_manager.js | Low |
| Z20: Render | 11940–13205 | 1 266 | drawTile, drawBuilding, drawUnit, drawDust, render, FX | Читает всё game.* | src/render/ | Medium |
| Z21: UI Panels | 13207–13380 | 174 | hideMenus, unitStatus, updateSelectedInfo | DOM manipulation | src/ui/hud.js | Low |
| Z22: Input/Selection | 13382–15010 | 1 629 | Mouse/keyboard, selection, attack-approach, attack-move | Перемешан input с attack-approach state machine | src/input/ + src/systems/command_system.js | High |
| Z23: Main Loop | 15012–15119 | 108 | update(dt), loop(now) | Вызывает все update-функции | Остаётся в main.js (orchestration) | Medium |
| Z24: Debug/Telemetry | 15129–15183 | 55 | FE_DEV_SPAWN_UNIT, V04_DEBUG_SNAPSHOT | game, UNIT_DEFS | src/dev/ | Low |
| Z25: Boot | 15186–15210 | 25 | init(), updateContinueButton() | Вызывает loadAssets, resize, loop | Остаётся в main.js | Low |
| Z26: Post-IIFE | 15212–15379 | 168 | Playwright scenarios, ESC guard, DOM overlay helpers | Читает FE_CORE | src/dev/ | Low |

### Z13: Enemy Bot AI — детальная подкарта

| Подзона | Строки | Размер | Содержимое |
|---------|--------|-------:|-----------|
| Z13a: Bot knobs/state | 2508–2674 | 167 | FE_PATCH_08B_BOT_KNOBS, FE_10I1_knobs(), ensureBotState(), resolveHomeBase() |
| Z13b: Enemy vision (10B) | 2686–2884 | 199 | createEnemyKnowledge, canSeeCell, refreshKnowledge, upsertKnownTarget, pruneKnowledge |
| Z13c: Bot movement helpers | 2886–3033 | 148 | nearestPlayerLightTank, commandTankAttack, silentMoveTo, returnUnitHome, armyScore, threatNearHome |
| Z13d: Attack intelligence (10F1) | 3035–3293 | 259 | selectAttackDecision, canDirectAttackTarget, writeDecisionTelemetry |
| Z13e: Attack-08 invariant repair | 3340–3388 | 49 | FE_ATTACK08RepairEnemyAttackInvariant — симптом-фикс для state/command desync |
| Z13f: Attack-12 intel gate | 3389–4100 | 710 | FE_ATTACK12 evaluateAttackDecision — intel-based attack decision |
| Z13g: Scout lifecycle | 3636–5110 | 1 475 | Полный lifecycle скаута: outbound, observe, sweep, return, cooldown |
| Z13h: Intel system (INTEL-01) | 3678–3960 | 283 | init, updateFromScout, updateFromTankVision, updateFromCombatContact |
| Z13i: Scouting coordinator (10C1) | 5442–5900 | 459 | chooseScoutTargets, trySetScoutMove, updateEnemyScoutingMvp |
| Z13j: Enemy autopilot/guard | 6000–6355 | 356 | Patrol/guard для idle танков |
| Z13k: Strength estimate (10E1) | 6359–6660 | 302 | updateStrengthGate, getGameObject |
| Z13l: updateEnemyBot (main) | 7014–7761 | 748 | Главный AI-тик — фазы, BRAIN-01, attack, retreat, regroup, scout dispatch |

### Z17: Builder/Construction — детальная подкарта

| Подзона | Строки | Размер | Содержимое |
|---------|--------|-------:|-----------|
| Z17a: Debug/telemetry | 9043–9175 | 133 | safeCloneForLog, debugLog, changeResource |
| Z17b: Enemy separator build (09C2) | 9176–9616 | 441 | ensureEnergyReserve, orderBuildSeparator, spendBuildCost |
| Z17c: Enemy separator processing (09C3) | 9618–9738 | 121 | completeSeparators, updateProduction, cycleCheck |
| Z17d: Enemy factory build (09D) | 9740–9965 | 226 | canBuildFactory, orderBuildFactory |
| Z17e: Enemy factory production (09E) | 9967–10258 | 292 | startLightTankProduction, spawnFactoryUnit, updateProduction |
| Z17f: Worker baseline (BASELINE_01) | 10262–10370 | 109 | chooseFactoryUnitType, countWorkers, startProduction |
| Z17g: BRAIN-01 decision loop | 10373–10515 | 143 | choosePriorityAction, executeAction, tryProduceWorker |
| Z17h: Construction helpers | 10517–11437 | 921 | getBuildCost, canAffordBuild, canPlaceBuilding, findBuildPlan, powerPlant helpers |
| Z17i: Update builder | 11437–11698 | 262 | updateBuilder() — player + enemy builder state machine |

---

## 4. Patch-chain / guard-chain inventory

### Крупные patch-группы

| Chain / prefix | Зона | Почему рискованно | Куда мигрировать |
|---------------|------|-------------------|-----------------|
| FE_PATCH_08B (bot knobs/state/movement) | Z13a-c | Управляет всем bot state, home position, movement — 526 строк с глубокими зависимостями | src/ai/enemy_brain.js |
| FE_PATCH_10B (enemy vision) | Z13b | Vision/memory система для бота — 199 строк, но вызывается из множества мест | src/ai/enemy_intel.js |
| FE_PATCH_10F1 (attack intelligence) | Z13d | Decision-logic для attack — 259 строк, отдельная подсистема | src/ai/enemy_targeting.js |
| FE_ATTACK12 (intel-based attack gate) | Z13f | 710 строк attack-decision логики — самая большая одиночная patch-chain | src/ai/enemy_targeting.js |
| FE_SCOUT02B/C/D (scout lifecycle) | Z13g | 1 475 строк — полный lifecycle скаута с ~30 свойствами | src/ai/scout_decider.js |
| FE_INTEL01 (intel system) | Z13h | 283 строк — intel snapshot/update | src/ai/enemy_intel.js |
| FE_10C1 (scouting coordinator) | Z13i | 459 строк — координация скаутов | src/ai/scout_decider.js |
| FE_PATCH_09C2/09C3 (separator) | Z17b-c | 562 строки — enemy separator build + processing | src/systems/economy_system.js |
| FE_PATCH_09D/09E (factory) | Z17d-e | 518 строк — enemy factory build + production | src/systems/production_system.js |
| FE_PATCH_BASELINE_01 (worker baseline) | Z17f | 109 строк — минимальный baseline для workers | src/ai/enemy_economy.js |
| FE_PATCH_BRAIN_01 (decision loop) | Z17g | 143 строки — приоритетный decision loop | src/ai/enemy_brain.js |
| FE_PATCH_06B (attack buildings) | Z7 | 408 строк — player attack-approach к зданиям | src/systems/combat_system.js |
| FE_PATCH_06D (victory/defeat) | Z7 | 210 строк — результат игры, DOM overlay | src/ui/result_screen.js |

### Symptom-fix guard-цепочки

| Паттерн | Строки | Описание | Проблема |
|---------|--------|----------|----------|
| `typeof FE_PATCH_* === 'function'` | ~15 мест | Defensive guard перед вызовом patch-функций | Чувствительность к порядку загрузки — патчи определены внутри IIFE, но вызываются из разных мест |
| `FE_ATTACK08RepairEnemyAttackInvariant()` | 15093 | Пост-фикс state/command desync после каждого bot tick | Бот создаёт рассинхронизацию, которая чинится пост-фиксом — корневая проблема в архитектуре bot state |
| `unit._stuckTimer > .75` → `recoverUnitPath()` | 8453–8455 | Stuck detection + recovery | Pathfinding иногда не находит путь, но это лечится recovery, а не исправлением причины |
| `window.FE_*_ENABLED` kill-switches | ~10 флагов | Runtime-переключатели для фич | Feature flags как механизм контроля, но растёт технический долг неиспользуемых флагов |
| `_enemyPowerPaused` + `_enemySeparatorPaused` | Z11, Z17 | Два разных флага паузы для одного здания | Разные подсистемы управляют одним поведением через разные флаги |

---

## 5. System ownership map

| Поведение | Текущее расположение | Целевой владелец |
|-----------|---------------------|-----------------|
| Enemy tank decision | main.js / updateEnemyBot / FE_PATCH_08B / FE_PATCH_10F1 / ATTACK-12 | src/ai/tank_decider.js |
| Target selection / attack gate | main.js / FE_PATCH_06B / FE_ATTACK12 / FE_PATCH_10F1 | src/ai/enemy_targeting.js |
| Scout lifecycle | main.js / FE_SCOUT02B/C/D / FE_10C1 | src/ai/scout_decider.js |
| Enemy intel / vision | main.js / FE_PATCH_10B / FE_INTEL01 | src/ai/enemy_intel.js |
| Enemy brain (BRAIN-01 + bot tick) | main.js / FE_PATCH_BRAIN_01 / updateEnemyBot | src/ai/enemy_brain.js |
| Enemy economy (separator, factory, power) | main.js / FE_PATCH_09C2/09C3/09D/09E / FE_POWER_01 | src/ai/enemy_economy.js + src/systems/power_system.js |
| Unit movement | main.js / updateUnitMovement / recoverUnitPath | src/systems/movement_system.js |
| Combat damage/cooldown | main.js / damageUnit / updateLightTankCombat / FE_PATCH_06B | src/systems/combat_system.js |
| Attack approach / attack-move | main.js / updateLightTankAttackApproach / setLightTankAttack | src/systems/command_system.js |
| Dust/particles/FX | main.js / drawDustParticles / spawnShotFx / spawnHitFx | src/render/render_fx.js |
| Economy / power | main.js / evaluatePowerState / FE_POWER_01 / updateProduction | src/systems/economy_system.js + src/systems/power_system.js |
| Production | main.js / updateUnitProduction / FE_PATCH_09E | src/systems/production_system.js |
| Construction / placement | main.js / canPlaceBuilding / findBuildPlan / updateBuilder | src/systems/construction_system.js |
| Territory / fog | main.js / updateTerritory / updateFog / isVisible | src/systems/territory_system.js |
| Map generation | main.js / generateMap / spawnResourcePatterns | src/systems/mapgen.js |
| Save/load | main.js + FE_SAVE_MANAGER | src/core/save_manager.js (уже вынесен) |
| Input / mouse / keyboard | main.js / canvas event listeners | src/input/mouse_input.js + keyboard_input.js |
| Selection / drag select | main.js / dragSelect / selected / selectedUnits | src/input/selection_system.js |
| Render loop | main.js / render / drawTile / drawBuilding / drawUnit | src/render/render_world.js + render_units.js |
| UI / HUD / menus | main.js / updateHud / hideMenus | src/ui/hud.js + build_menu.js |
| Victory/defeat | main.js / FE_PATCH_06D | src/ui/result_screen.js |
| Geometry / coordinates | main.js / tileToWorld / worldToTile / isoSort | src/core/coordinates.js |
| Debug / telemetry | main.js / debugLog / FE_DEV_SPAWN_UNIT | src/dev/ (частично вынесено) |

---

## 6. Safe extraction candidates

| # | Кандидат | Целевой файл | Риск | Почему safe/unsafe | Необходимые проверки |
|---|---------|-------------|------|-------------------|---------------------|
| 1 | Geometry/coordinate helpers (tileToWorld, worldToTile, isoSort, clamp, dist, inBounds, tileToScreen, screenToTile) | src/core/coordinates.js | Low | Чистые функции, не зависят от game state (кроме tileToScreen, который читает game.camera — можно передать через параметр или FE_CORE) | Browser smoke: игра загружается, юниты двигаются, камера работает |
| 2 | Victory/defeat + DOM overlay (FE_PATCH_06D) | src/ui/result_screen.js | Low | Относительно изолированная зона, мало связей с gameplay. UI-only логика | Browser: победа/поражение корректно отображается, ESC работает |
| 3 | Territory/fog helpers (claimTerritoryCell, updateTerritory, updateFog, isVisible, footprintVisible) | src/systems/territory_system.js | Low-Medium | 105 строк, умеренная связанность. Читает game.territory, game.fogVisible, game.units, game.buildings | Browser: туман работает, территория обновляется, здания видимы |
| 4 | Enemy vision/intel (FE_PATCH_10B + FE_INTEL01) | src/ai/enemy_intel.js | Medium | 482 строки, но хорошо ограниченная область ответственности. Вызывается из updateEnemyBot и scout lifecycle | Browser: бот видит юниты, скаут обновляет intel |
| 5 | Enemy separator processing (FE_PATCH_09C3) | src/ai/enemy_economy.js (часть) | Medium | 121 строка, чёткая ответственность. Тесно связана с power system через `_enemyPowerPaused` | Browser: separator обрабатывает ресурсы, power pause работает |
| 6 | Enemy factory production (FE_PATCH_09E) | src/ai/enemy_economy.js (часть) | Medium | 292 строки, чёткая ответственность. Зависит от factory queue и build order | Browser: factory производит танки, queue работает |
| 7 | BRAIN-01 decision loop | src/ai/enemy_brain.js | Medium | 143 строки, компактная. Но вызывает множество внешних функций (09C2, 09D, 09E, BASELINE_01) — нужен init(deps) паттерн | Browser: бот принимает решения, строит, производит |
| 8 | Combat FX / particles (spawnShotFx, spawnHitFx, drawCombatFxParticles, updateCombatFxParticles) | src/render/render_fx.js | Low-Medium | Визуальный слой, не влияет на gameplay. 4 функции | Browser: визуальные эффекты при атаке |
| 9 | Dust particles (spawnDust, drawDust, updateDust) | src/render/render_fx.js (часть) | Low | Чисто визуальный эффект. Не влияет на gameplay | Browser: dust при движении |
| 10 | Map generation (generateMap + resource patterns) | src/systems/mapgen.js | Medium-High | 535 строк, но риск: изменение порядка Math.random() = другая карта. Нужен seed-based подход или прямой перенос | Browser: карта генерируется, стартовые позиции корректны, минералы на месте |

---

## 7. High-risk zones

### Z13: Enemy Bot AI (строки 2507–7761, 5 255 строк) — Very High

**Почему нельзя трогать без отдельного design/audit:** Это самая большая зона файла. Внутри смешаны 6+ логических подсистем (vision, scout, attack, retreat, intel, strength), которые все зависят от общего `game._enemyBotState` и `game._enemyKnowledge`. Любое изменение внутри может сломать bot tick. Вынос одной подсистемы за раз — допустимо, но полный rewrite = почти гарантированный крах.

### Z17: Builder/Construction (строки 9039–11698, 2 660 строк) — Very High

**Почему:** Смешаны player builder, enemy builder, enemy economy (separator, factory, power), BRAIN-01 decision loop, construction helpers. Все используют общий IIFE scope для доступа к `game.*`, `passable()`, `findPath()`, `createBuilding()`, `changeResourceForOwner()`. Вынос BRAIN-01 или enemy economy без чёткого init(deps) паттерна сломает runtime-связи.

### Z22: Input/Selection/Attack-Approach (строки 13382–15010, 1 629 строк) — High

**Почему:** Перемешаны input handling (mouse, keyboard) с attack-approach state machine и selection logic. Canvas event listeners привязаны к функциям, которые одновременно обрабатывают клики и назначают attack targets. Разделение input от gameplay logic требует аккуратного refactoring.

### Z12: Pathfinding/Blocking (строки 7763–7893, 140 строк) — High

**Почему:** Фундаментальная зона — `passable()`, `findPath()`, `isBlocked()` вызываются из десятков мест. Любое изменение может сломать movement для всех юнитов. Прямой вынос в модуль возможен, но требует FE_CORE bridge или init(deps) для доступа к game.obstacles, game.buildings, game.units.

### Z11: Economy/Power (строки 1954–2498, 545 строк) — High

**Почему:** Глубоко связана с enemy economy — `evaluatePowerState()` (player) и `FE_POWER_01_EvaluateEnemyPowerState()` (enemy) зависят от одних и тех же building/unit списков. Разделение player и enemy power — нетривиальная задача из-за shared helpers.

### Map Generation (строки 297–831, 535 строк) — Medium-High

**Почему:** `Math.random()` вызывается в определённом порядке. Любое изменение порядка вызовов (даже добавление/удаление одного `Math.random()`) = другая карта. Нужен seed-based подход или гарантия сохранения порядка вызовов при extraction.

---

## 8. Recommended next 3 PRs

### 1. ARCH-CORE-02 — Extract coordinate/geometry helpers

- **Цель:** Вынести чистые функции (tileToWorld, worldToTile, tileToScreen, screenToTile, clamp, dist, inBounds, isoSortAnchorY, isoObjectDepth) в `src/core/coordinates.js`
- **Files expected:** src/core/coordinates.js (new), src/main.js (replaced calls), index.html (new script tag)
- **Risk:** Low — функции чистые или зависят только от TILE_W/H и game.camera (через FE_CORE)
- **Smoke test:** Игра загружается, камера работает, юниты отображаются корректно, клики по карте точные

### 2. ARCH-UI-01 — Extract victory/defeat + result screen

- **Цель:** Вынести FE_PATCH_06D (victory/defeat, DOM overlay, result screen) в `src/ui/result_screen.js`
- **Files expected:** src/ui/result_screen.js (new), src/main.js (replaced calls), index.html (new script tag)
- **Risk:** Low — UI-only логика, минимальная связанность с gameplay
- **Smoke test:** Игра загружается, победа/поражение отображается, ESC возвращает в меню, overlay не блокирует при отсутствии результата

### 3. ARCH-AI-01 — Extract enemy intel/vision (MVP)

- **Цель:** Вынести FE_PATCH_10B (enemy vision memory) + FE_INTEL01 (intel system) в `src/ai/enemy_intel.js` как первый AI-модуль
- **Files expected:** src/ai/enemy_intel.js (new), src/main.js (replaced calls), index.html (new script tag)
- **Risk:** Medium — вызывается из updateEnemyBot и scout lifecycle, нужен init(deps) паттерн
- **Smoke test:** Бот видит юниты/здания, скаут обновляет intel, attack gate использует intel для решений, console без ошибок

---

## 9. Browser smoke checklist for future architecture PRs

Минимальный набор проверок для каждого architecture/refactor PR:

- [ ] Игра загружается (main menu виден)
- [ ] New game начинается (фракция выбрана, карта сгенерирована)
- [ ] Faction selection работает (можно выбрать любую фракцию)
- [ ] Harvester собирает минералы (движется к шахте, возвращается к базе)
- [ ] Builder строит здания (размещение работает, строительство завершается)
- [ ] Separator обрабатывает ресурсы (15 минералов → 10 энергии + 1 элемент)
- [ ] Factory производит юнитов (танки появляются из фабрики)
- [ ] Player light_tank двигается (правый клик → движение)
- [ ] Player light_tank атакует (A-click → attack-approach → attack)
- [ ] Enemy bot стартует (HQ появляется, harvesters начинают работу)
- [ ] Enemy units действуют (танки двигаются, атакуют)
- [ ] Scout не крашит (если скаут существует, он не ломает игру)
- [ ] Save/load не сломан (сохранение + загрузка + continue)
- [ ] Console не содержит красных ошибок (только warnings допустимы)
- [ ] Power indicator корректен (MW отображается, buildings pause при дефиците)
- [ ] Territory обновляется (здания расширяют территорию)

---

## 10. What NOT to do

Зафиксировано:

1. **Не делать full rewrite** — мы не переписываем игру с нуля. Мы мигрируем по одной системе за раз.
2. **Не переносить весь main.js одним PR** — один PR = одна система / один понятный риск.
3. **Не создавать "новый main2.js"** — новые модули создаются как целевые системы, не как копия main.js.
4. **Не переносить хаос из main.js в один большой enemy_ai.js** — enemy bot должен быть разделён на brain, decider, targeting, intel, scout, economy — каждый как отдельный модуль.
5. **Не менять gameplay/balance в architecture-map задаче** — эта задача docs-only.
6. **Не менять код в этой задаче** — только документация.
7. **Не удалять старые patch-prefixed функции до того, как система их заменит** — удаление только после подтверждения.
8. **Не трогать Math.random() порядок в map generation без seed-based стратегии** — иначе карта изменится.
