# MAIN_REFACTOR_CODEX_HANDOFF_20260510

> Это audit / handoff-документ для Codex.
> Это не патч и не утверждённая архитектура.
> Цель — помочь Codex безопасно разбить src/main.js на модули без изменения поведения игры.

**Дата:** 2026-05-10
**Тип:** Audit / Handoff (Fast lane, report-only)
**Ветка:** sandbox/main
**Основание:** MAIN-REFACTOR-HANDOFF-01

---

## 0. HARD RULES

1. Не менять gameplay
2. Не менять баланс
3. Не менять assets
4. Не добавлять фичи
5. Не удалять код (кроме dead code, с доказательствами)
6. Каждый extraction = отдельный PR
7. `node --check` после каждого изменения
8. Playwright smoke после каждого изменения
9. Behaviour preservation checklist (см. §14) — обязателен
10. Если Codex не уверен — НЕ делать. Оставить комментарий в REFACTOR_REPORT.

---

## 1. EXECUTIVE SUMMARY

**src/main.js** — монолитный IIFE на ~12 128 строк. Вся игровая логика, рендеринг, ввод, бот AI, экономика, производство, строительство, сохранение — в одном файле.

### Почему main.js стал техническим риском

- **12 128 строк в одном файле** — невозможно читать целиком, невозможно ревьюить
- **30+ систем** живут в одном scope, с общим доступом к `game` через замыкание
- **~2 500 строк дублированных bot helpers** (FE_10C1_, FE_10D1_, FE_10E1_, FE_10F1_, FE_10G1_, FE_10H1_, FE_10I1_) — каждый patch-префикс копирует `getGameObject`, `distTiles`, `isEnemyUnit`, `getEnemyHQ` и т.д.
- **~200 строк dead code** — `applyTestBuildingCostsX10()`, unreachable code после `return`, no-op функции
- **3 сломанных backup-файла** в `src/` (`main_broken_04c3.js`, `main_broken_04c5.js`, `main_before_restore_04a.js`)
- **Hardcoded values** вместо config — building HP, separator formula, speeds, fog radii, territory timing

### Какие системы живут в main.js

| Категория | Кол-во систем | Примеры |
|-----------|---------------|---------|
| Game core | 4 | game state, game loop, settings, boot |
| Map/world | 3 | map generation, obstacles, resources |
| Rendering | 8 | tiles, sprites, buildings, units, fog, particles, debug overlay, result overlay |
| Input/UI | 6 | canvas click, keyboard, selection, drag, menus, HUD |
| Units | 4 | movement, harvester, builder, combat |
| Economy | 4 | resources, power, separator, factory production |
| Bot AI | 9 | knowledge, vision, targeting, scouting, guard, strength, retreat, difficulty, economy |
| System | 4 | save/load, debug logging, dev tools, screen manager |

### Какие зоны можно выносить первыми

1. **coordinates.js** — pure functions (tileToWorld, worldToTile, screenToTile, clamp, dist, inBounds) — нулевой риск
2. **constants.js** — все hardcoded values в один файл — нулевой риск
3. **helpers.js** — dedup bot helpers (унификация FE_10C1_/10D1_/10E1_ и т.д.) — low risk
4. **mapgen.js** — ~530 строк standalone кода генерации карты — low risk
5. **debug_tools.js** — debug overlay, logging, enemy economy panel — low risk
6. **particles.js** — dust particles — low risk

### Какие зоны нельзя трогать первыми

1. **render loop** — глубоко связан с game state, canvas, camera, fog
2. **input/selection** — связан с drag, attack-move, context menu
3. **movement/pathfinding** — используется всеми юнитами + ботом
4. **combat** — light_tank attack/approach/attack-move — 3 уровня вложенности
5. **enemy bot main tick** — `updateEnemyBot()` вызывает 8 подсистем
6. **save/load serialization** — любое изменение = сломанные saves
7. **builder state machine** — 5 состояний, сложные переходы

### Главный риск для Codex

**Потеря shared closure scope.** Все функции в main.js разделяют общий scope через IIFE: `game`, `assets`, `canvas`, `ctx`, `selected`, `selectedUnits`, `keys`, `mouse` и т.д. При extraction в отдельные файлы, доступ к этим переменным должен быть реализован через явные параметры или shared state object. Ошибка в передаче game state = сломанная игра.

### Рекомендуемый порядок refactor

```
Phase A: Safe extraction (coordinates, constants, helpers dedup)
  → нулевой/минимальный риск, pure functions

Phase B: Medium extraction (mapgen, particles, debug tools)
  → low risk, standalone modules

Phase C: System extraction (economy, production, territory/fog)
  → medium risk, нужны shared state getters

Phase D: Leave in main.js (render, input, combat, bot, save/load)
  → high risk, оставить на follow-up
```

---

## 2. КАРТА СИСТЕМ В MAIN.JS

| Система | Что делает | Где искать (строки) | Ключевые функции/переменные | Риск выноса |
|---------|-----------|---------------------|----------------------------|-------------|
| Game state | Глобальное состояние игры | 217–283 | `game`, `selected`, `selectedUnits`, `dragSelect`, `attackMoveArmed`, `keys`, `mouse` | 🔴 high — shared mutable |
| Game loop | Главный цикл update/render | 11585–11682 | `update(dt)`, `loop(now)` | 🔴 high — depends on everything |
| Rendering: tiles | Отрисовка тайлов и территории | 8274–8379 | `drawDiamond()`, `drawSandTile()`, `drawTerritoryTile()` | 🟡 medium — needs canvas/game |
| Rendering: sprites | Спрайты юнитов/зданий | 8392–8435 | `drawSprite()`, `usableImage()`, `drawImageCoverTile()` | 🟡 medium — needs assets |
| Rendering: mines/obs | Минералы и препятствия | 8498–8567 | `drawMine()`, `drawObstacle()` | 🟡 medium — needs assets |
| Rendering: buildings | Здания + progress bar | 8682–8730 | `drawBuilding()` | 🟡 medium — needs assets/game |
| Rendering: units | Юниты + анимация + selection ring | 8731–9020 | `drawUnit()`, `unitDir8()`, `unitAngle()`, `unitFlip()` | 🔴 high — complex, needs game |
| Rendering: HP bars | Полоски HP | 8571–8594 | `drawHp()` | 🟢 low — simple |
| Rendering: fog | Туман войны | 9024–9038 | `drawFogTile()` | 🟡 medium — needs fog arrays |
| Rendering: main | Главный render() | 9441–9540 | `render()` | 🔴 high — orchestrates all |
| Camera | Позиция/зум камеры | 2091–2097, 10917+ | `focusCameraOn()`, `clampCamera()` | 🟡 medium — needs game |
| Input: keyboard | Горячие клавиши | 10917–11434 | `keys`, keydown/keyup handlers | 🔴 high — deeply coupled |
| Input: mouse/click | Клик по карте | 10784–10916 | `onCanvasClick()` | 🔴 high — deeply coupled |
| Selection/drag | Выделение юнитов | 9715–9973 | `objectAtTile()`, `beginDragSelect()`, `endDragSelect()` | 🔴 high — needs game/selected |
| Unit movement | Движение юнитов по пути | 5059–5487 | `updateUnitMovement()`, `queueManualMove()`, `recoverUnitPath()` | 🔴 high — used by all units |
| Pathfinding | BFS pathfinding | 4868–4997 | `findPath()`, `passable()`, `isBlocked()` | 🟡 medium — pure but used everywhere |
| Map generation | Генерация карты | 383–915 | `makeArrays()`, `generateMap()`, `generateResourceClusters()` | 🟢 low — standalone, runs once |
| Resources/mines | Минералы на карте | 522–795, 8498+ | `spawnMine()`, `spawnMineNear()`, `mineAt()` | 🟡 medium — depends on game |
| Harvester logic | Сборщик ресурсов | 5488–6063 | `startHarvester()`, `updateHarvester()`, `assignNextMine()` | 🔴 high — state machine |
| Builder/construction | Строительство | 7072–8138 | `orderBuild()`, `updateBuilder()`, `findBuildPlan()`, `canPlaceBuilding()` | 🔴 high — complex state machine |
| Buildings | Создание зданий, ownership | 1799–1952 | `createBuilding()`, `buildingOwner()`, `findBaseBuilding()` | 🟡 medium — widely used |
| Territory | Захват территории | 8139–8242 | `claimTerritoryCell()`, `updateTerritory()`, `seedTerritory()` | 🟡 medium — needs game arrays |
| Fog of war/vision | Видимость карты | 8139–8242 | `reveal()`, `updateFog()`, `drawFogTile()` | 🟡 medium — needs game arrays |
| Economy | Ресурсы и хранилища | 2109–2510 | `addResource()`, `getStorageLimits()`, `canRunSeparatorCycle()` | 🟡 medium — widely used |
| Power | Энергосистема | 2177–2266 | `calculatePowerTotal()`, `evaluatePowerState()`, `powerConfig()` | 🟡 medium — widely used |
| Production | Производство юнитов | 2394–2478 | `queueUnitProduction()`, `updateUnitProduction()`, `productionSpeedForUnit()` | 🟡 medium — needs game |
| Combat: light_tank | Бой танков | 969–1790 | `updateLightTankCombat()`, `setLightTankAttack()`, `damageUnit()` | 🔴 high — complex, 3 sub-states |
| Enemy bot | Главный бот AI | 2520–4866 | `updateEnemyBot()`, ~2500 строк bot helpers | 🔴 high — 9 subsystems |
| Scout integration | Scout юнит | (встроен в combat/bot) | `unitLabel('scout')`, отдельные ветки по type | 🟡 medium — scattered |
| Save/load | Сохранение/загрузка | 8244–8272 | `saveGame()`, `loadGame()` (делегирует FE_SAVE_MANAGER) | 🔴 high — serialization format |
| UI/HUD | Ресурсы, время, статус | 2479–2510 | `updateHud()`, `animateHud()` | 🟡 medium — needs DOM + game |
| Menus | Build menu, factory menu | 9542–9713 | `openBuildMenu()`, `openFactoryMenu()`, `updateSelectedInfo()` | 🟡 medium — needs game |
| Particles/dust | Пыль при строительстве | 9040–9243 | `spawnBuilderDust()`, `updateDustParticles()`, `drawDustParticles()` | 🟢 low — standalone |
| Dev tools | Отладка, калибровка | 11262–11393 | Dev hotkeys (j/i/k/l, 0–9), FE_DEV_SPAWN_UNIT | 🟢 low — dev-only |
| Debug telemetry | Логирование и диагностика | 6069–6165 | `debugLog()`, `safeCloneForLog()`, `exportDebugLog()` | 🟢 low — dev-only |
| Runtime flags | Внешние флаги | (в src/config/runtime_flags.js) | DIR_MAP, HP_BAR_OFFSET, dust params | 🟢 low — already external |
| Asset loading | Загрузка спрайтов | 288–317 | `loadAssets()`, `getFactionRenderAssets()`, `factionAssetsCache` | 🟡 medium — needs game |
| Dead/disabled code | Мёртвый код | 25–78, 1519–1552, 1748–1776, 2056–2084, 8384–8388, 8677–8679, 10333–10339, 10453–10490, 11632–11654 | `applyTestBuildingCostsX10()`, unreachable blocks, no-op functions | 🟢 low — safe to delete |
| Depth sort | Z-сортировка | 110–191 | `isoSortAnchorY()`, `isoObjectDepth()` | 🟡 medium — needs game/camera |
| Click markers | Маркеры кликов | 5001–5057 | `addClickMarker()`, `addUnitClickMarker()` | 🟢 low — simple |
| Combat debug overlay | Отладка боя | 9297–9439 | `FE_LT_04C6DrawCombatDebugOverlay()` | 🟢 low — dev-only |
| Victory/defeat | Экран результата | 1209–1418 | `FE_PATCH_06DSetGameResult()`, DOM overlay | 🟡 medium — DOM manipulation |

---

## 3. FUNCTION INVENTORY

### 3.1. Core helpers (pure / low-dependency)

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `clamp(v,min,max)` | helpers | Ограничение значения | нет | ~50+ вызовов | 🟢 нет |
| `dist(a,b)` | helpers | Manhattan distance | нет | movement, bot, combat | 🟢 нет |
| `inBounds(x,y)` | helpers | Проверка границ карты | `game.mapW/H` | mapgen, pathfinding | 🟢 нет |
| `tileToWorld(x,y)` | coordinates | Tile → world coords | `TILE_W/H` | render, camera | 🟢 нет |
| `worldToTile(wx,wy)` | coordinates | World → tile coords | `TILE_W/H` | input, camera | 🟢 нет |
| `worldToScreen(wx,wy)` | coordinates | World → screen coords | `game.camera` | render | 🟡 min |
| `tileToScreen(x,y)` | coordinates | Tile → screen coords | `tileToWorld`, `worldToScreen` | render, input | 🟡 min |
| `screenToTile(sx,sy)` | coordinates | Screen → tile coords | `game.camera`, `canvas` | input | 🟡 min |
| `choose(arr)` | helpers | Случайный элемент | нет | mapgen | 🟢 нет |
| `safeNum(v)` | helpers | Безопасное число | нет | HUD | 🟢 нет |
| `formatTime(sec)` | helpers | Форматирование времени | нет | HUD | 🟢 нет |
| `uid(prefix)` | helpers | Генератор ID | нет | createUnit, createBuilding, addObstacle, spawnMine | 🟢 нет |

### 3.2. Game setup & state

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `blankGame(sizeKey)` | game state | Создаёт пустое состояние | `MAP_SIZES`, `BASE_STORAGE` | `startNewGame()` | 🟡 |
| `startNewGame(faction)` | game setup | Инициализация новой партии | `generateMap`, `createBuilding/Unit`, `FE_PATCH_07ASetupSkirmishStart` | UI button | 🔴 |
| `createUnit(type,x,y)` | game setup | Создаёт объект юнита | `UNIT_DEFS`, `uid` | spawn functions, factory | 🟡 |
| `createBuilding(type,x,y,complete,owner)` | game setup | Создаёт объект здания | `BUILDING_SIZE`, `BUILDINGS`, `uid` | game setup, enemy | 🟡 |

### 3.3. Map generation

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `makeArrays()` | mapgen | Инициализация terrain/territory/fog | `game.mapW/H` | `generateMap()` | 🟢 |
| `generateMap()` | mapgen | Полная генерация карты | `makeArrays`, `generateResourceClusters`, `addObstacle` | `startNewGame()` | 🟢 |
| `generateResourceClusters()` | mapgen | Расстановка ресурсов | `getPlannedPlayerStarts`, `spawnResourcePatternRelativeToSpawn`, patterns | `generateMap()` | 🟢 |
| `getStart()` | mapgen | Стартовая позиция игрока | `game.mapSize/H` | `startNewGame`, enemy setup | 🟢 |
| `getEnemyDiagonalStart()` | mapgen | Стартовая позиция врага | `game.mapSize/W/H` | `getPlannedPlayerStarts` | 🟢 |
| `addObstacle(asset,x,y,w,h,block)` | mapgen | Добавление препятствия | `reserveFree`, `uid` | `generateMap()` | 🟢 |
| `reserveFree(x,y,w,h,buffer)` | mapgen | Проверка свободного места | `game.obstacles`, `game.minerals`, `getPlannedPlayerStarts` | `addObstacle` | 🟢 |

### 3.4. Economy & production

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `addResource(name,amount)` | economy | Добавить ресурс игроку | `game.resources`, `getStorageLimits`, `animateHud` | separator, harvester | 🟡 |
| `addResourceForOwner(owner,name,amount)` | economy | Добавить ресурс по owner | `addResource`, `ensureEnemyResources` | enemy separator, harvester | 🟡 |
| `canRunSeparatorCycle()` | economy | Проверка возможности переработки | `game.resources`, `factionElementKey` | `evaluatePowerState`, `updateProduction` | 🟡 |
| `updateProduction(dt)` | economy | Сепаратор + фабрики | `evaluatePowerState`, `canRunSeparatorCycle`, enemy functions | `update(dt)` | 🟡 |
| `queueUnitProduction(factory,type)` | production | Поставить юнит в очередь | `UNIT_DEFS`, `factionElementKey`, `addResource` | factory menu | 🟡 |
| `updateUnitProduction(dt)` | production | Обработка очереди фабрики | `productionSpeedForUnit`, `findSpawnCellNearBuilding`, `createUnit` | `updateProduction` | 🟡 |
| `factoryCanAffordAnyUnit()` | production | Проверка доступности юнитов | `UNIT_DEFS`, `factionElementKey` | factory status, UI | 🟢 |

### 3.5. Combat

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `updateLightTankCombat(unit,dt)` | combat | Тик боя танка | `FE_PATCH_06BResolveAttackTarget`, `getLightTankCombatStats`, `damageUnit`, `FE_PATCH_06BDamageBuilding` | `update(dt)` | 🔴 |
| `setLightTankAttack(attacker,target)` | combat | Назначить атаку | `setLightTankAttackGeneric` (делегирует) | player click | 🔴 |
| `setLightTankAttackGeneric(attacker,target,options)` | combat | Реальная реализация атаки | `FE_PATCH_07BGetHostileLightTankTargetKind`, `FE_PATCH_07BAssignLightTankAttack` | `setLightTankAttack`, bot | 🔴 |
| `damageUnit(target,amount)` | combat | Нанести урон юниту | `destroyUnit` | combat, bot | 🔴 |
| `destroyUnit(unit)` | combat | Удалить юнит | `FE_PATCH_06BClearAttackTarget`, `selectedUnits` | `damageUnit` | 🔴 |
| `setLightTankAttackApproachGeneric(unit,target)` | combat | Подойти + атаковать | `findPath`, `FE_PATCH_06BResolveApproachTarget` | bot, group attack | 🔴 |
| `updateLightTankAttackApproach(unit,dt)` | combat | Тик подхода к цели | `FE_PATCH_06BResolveApproachTarget`, `setLightTankAttackGeneric` | `update(dt)` | 🔴 |
| `setLightTankAttackMove(unit,x,y)` | combat | Attack-move приказ | `findPath`, `queueManualMove` | player (A key) | 🔴 |
| `updateLightTankAttackMove(unit,dt)` | combat | Тик attack-move | `findAttackMoveEnemyInRange`, `setLightTankAttackGeneric` | `update(dt)` | 🔴 |

### 3.6. Bot AI (main functions)

| Функция | Система | Что делает | От чего зависит | Кто вызывает | Риск |
|---------|---------|-----------|-----------------|-------------|------|
| `updateEnemyBot(dt)` | bot | Главный тик бота | Все bot subsystems | `update(dt)` | 🔴 |
| `FE_PATCH_08BEnsureBotState()` | bot | Создать/восстановить state | `game._enemyBotState`, `FE_PATCH_06AExistingEnemyBase` | bot tick | 🔴 |
| `FE_PATCH_08BPrepareAttack(enemyUnits,state)` | bot | Подготовка атаки | `FE_10I1_knobs`, `FE_PATCH_08BAttackTarget`, `FE_PATCH_08BCommandEnemyTankAttack` | bot tick | 🔴 |
| `FE_PATCH_08BDefend(enemyUnits,threat,state)` | bot | Защита | `FE_PATCH_08BCommandEnemyTankAttack` | bot tick | 🔴 |
| `FE_PATCH_10BRefreshEnemyKnowledge(now)` | bot-knowledge | Обновление знаний | `enemyCanSeeTarget`, `FE_PATCH_10BUpsertKnownTarget` | bot tick | 🟡 |
| `FE_PATCH_10F1SelectAttackDecision(state,enemyUnits)` | bot-targeting | Выбор цели атаки | `FE_PATCH_10BEnsureEnemyKnowledge`, scoring | `FE_PATCH_08BAttackTarget` | 🟡 |
| `FE_10C1_updateEnemyScoutingMvp()` | bot-scouting | Разведка | `FE_10C1_chooseScoutTargets`, `FE_10C1_trySetScoutMove` | bot tick | 🟡 |
| `FE_10D1_updateEnemyUnitAutopilotGuard()` | bot-guard | Патруль/защита idle танков | `FE_10D1_findLocalPlayerThreat`, `FE_10D1_tryAttack` | bot tick | 🟡 |
| `FE_10E1_updateStrengthGateAfterEnemyBot()` | bot-strength | Оценка сил | `FE_10E1_getEstimateState` | bot tick | 🟡 |
| `FE_10H1_updateEnemyRetreatAndDefenseMvp()` | bot-retreat | Отступление | `FE_10H1_shouldRetreat`, `FE_10H1_startRetreat` | bot tick | 🟡 |
| `FE_10I1_knobs()` | bot-difficulty | Параметры сложности | `game.enemyBotDifficulty`, profiles | all bot functions | 🟢 |

### 3.7. Duplicated bot helpers (унифицировать)

| Функция | Где встречается (префиксы) | Одинаковый код | Объединяемая |
|---------|---------------------------|----------------|-------------|
| `getGameObject()` | FE_10I1_, FE_10C1_, FE_10D1_, FE_10E1_, FE_10F1_, FE_10H1_ | ✅ Да (с fallback chain) | Да → shared `getGame()` |
| `getUnitList()` | FE_10C1_, FE_10D1_, FE_10E1_ | ✅ Да | Да → shared |
| `getBuildingList()` | FE_10C1_, FE_10D1_, FE_10E1_ | ✅ Да | Да → shared |
| `unitTileX/Y(u)` | FE_10C1_, FE_10D1_, FE_10E1_ | ✅ Да | Да → shared |
| `distTiles(a,b)` | FE_10C1_, FE_10D1_, FE_10E1_, FE_10G1_ (использует 10C1) | ✅ Да | Да → shared (или `dist()`) |
| `isEnemyUnit(u)` | FE_10C1_, FE_10D1_, FE_10E1_ | ⚠️ Похоже, но не идентично: 10C1/10D1/10E1 проверяют `owner/side/player`, core `isEnemyUnit()` только `owner` | ⚠️ Осторожно — нужны тесты |
| `isPlayerUnit(u)` | FE_10D1_, FE_10E1_ | ⚠️ Аналогично: bot helpers проверяют `owner/side/player`, core только `owner` | ⚠️ Осторожно |
| `getEnemyHQ()` | FE_10C1_, FE_10D1_, FE_10E1_ | ✅ Да | Да → shared (или `findBaseBuilding('enemy')`) |
| `getObjectId(obj)` | FE_10D1_, FE_10E1_ | ✅ Да | Да → shared |
| `hasActiveAttackOrder(u)` | FE_10D1_, FE_10E1_, FE_10H1_ | ✅ Да | Да → shared |
| `knownEntries(collection)` | FE_10F1_, FE_10G1_ | ✅ Да | Да → shared |

---

## 4. ЧТО МОЖНО ВЫНОСИТЬ ПЕРВЫМ

### Low-risk extraction candidates

| Модуль | Что вынести | Почему безопасно | Какие файлы создать | Проверка |
|--------|-----------|-----------------|---------------------|----------|
| **coordinates.js** | `tileToWorld`, `worldToTile`, `worldToScreen`, `tileToScreen`, `screenToTile`, `clamp`, `dist`, `inBounds` | Pure functions, минимум зависимостей (только `TILE_W/H` и `game.camera` через параметр) | `src/core/coordinates.js` | `node --check` + Playwright smoke |
| **constants.js** | `TILE_W`, `TILE_H`, `SAVE_KEY`, `SETTINGS_KEY`, `MAP_SIZES`, `BASE_STORAGE`, `FACTION_ELEMENT_KEY`, `FE_PATCH_07A3_ENEMY_VISUAL_FACTION`, separator formula (15/10/1/6.0s), building HP values, fog/territory radii, speeds, auto-save interval, factory queue max, click marker life, dust particle max, zoom limits | Только объявление констант, нулевая логика | `src/core/constants.js` | `node --check` + runtime values идентичны |
| **helpers.js** (dedup) | Общий `getGame()`, `getUnitList()`, `getBuildingList()`, `distTiles()`, `unitTileX/Y()`, `getEnemyHQ()`, `getObjectId()`, `hasActiveAttackOrder()`, `knownEntries()` + замена 7× дублированных версий на вызовы shared | Убирает ~500 строк дублей, уменьшает баг-поверхность | `src/core/helpers.js` | `node --check` + bot AI telemetry значения идентичны до и после |
| **mapgen.js** | `makeArrays()`, `generateMap()`, `generateResourceClusters()`, `getStart()`, `getEnemyDiagonalStart()`, `getPlannedPlayerStarts()`, все resource patterns, все obstacle placement helpers, `reserveFree()`, `addObstacle()`, `canSpawnMine()`, `spawnMine()`, `spawnMineNear()` | Standalone блок ~530 строк, запускается один раз при старте | `src/core/mapgen.js` | `node --check` + generate map → идентична baseline |
| **debug_tools.js** | `debugLog()`, `safeCloneForLog()`, `exportDebugLog()`, `clearDebugLog()`, `FE_LT_04C6DrawCombatDebugOverlay()`, `FE_DEBUG_EnemyEconomyRenderPanel()`, `FE_DEBUG_ToggleEnemyEconomyPanel()`, `feMakeSnapshot()` | Dev-only код, не влияет на gameplay | `src/dev/debug_tools.js` | `node --check` + debug panel открывается |
| **particles.js** | `spawnBuilderDust()`, `updateBuilderDust()`, `updateDustParticles()`, `drawDustParticles()` | Изолированная подсистема, 200 строк | `src/systems/particles.js` | `node --check` + пыль видна при строительстве |

### Важно: что НЕ безопасно выносить как может казаться

| Кандидат | Почему НЕ безопасно | Что может сломаться |
|----------|-------------------|-------------------|
| `findPath()` / `passable()` | Используется movement, harvester, builder, bot, attack-move — все через общий IIFE scope | Если параметризовать неправильно — все юниты встанут |
| `saveGame()` / `loadGame()` | Делегирует FE_SAVE_MANAGER, но формат save data привязан к структуре `game` объекта | Любое изменение = сломанные saves |
| `updateFog()` / `reveal()` | Работает с `game.fogVisible/fogExplored` + `game.units/buildings` через прямое обращение к `game` | Fog перестанет обновляться |

---

## 5. ЧТО НЕЛЬЗЯ ТРОГАТЬ ПЕРВЫМ

### High-risk zones

| Зона | Почему рискованно | Что может сломаться | Когда выносить |
|------|-------------------|---------------------|---------------|
| **render()** (9441–9540) | Оркестрирует все rendering subsystems, глубоко связан с canvas, camera, fog, depth sort | Весь визуал игры | Phase D (после всех extraction) |
| **Input/selection** (9715–10916) | Связан с `selected`, `selectedUnits`, `dragSelect`, `attackMoveArmed`, context menu, build menu | Управление юнитами | Phase D |
| **Movement/pathfinding** (4868–5487) | Используется всеми юнитами + ботом, через IIFE scope доступ к `game.obstacles/buildings/units/minerals` | Все юниты перестают двигаться | Phase C (только после shared state) |
| **Combat** (969–1790, 10343–10782) | 3 уровня: attack, attack-approach, attack-move. Сложная state machine с clear/reassign | Вся боевая система | Phase D |
| **Enemy bot main tick** (2520–4866) | `updateEnemyBot()` вызывает 8 подсистем, все через общий scope | Бот перестаёт работать | Phase D |
| **Builder state machine** (7072–8138) | 5 состояний (idle→moving_to_build→building→moving_to_resume→building), сложные отмены | Строительство зданий | Phase D |
| **Harvester state machine** (5488–6063) | idle→moving_to_mine→harvesting→returning→unloading, auto-gather loop | Добыча ресурсов | Phase D |
| **Save/load** (8244–8272) | Формат save привязан к структуре `game` объекта, любые изменения = несовместимость | Сломанные saves | Phase D |
| **Coordinate conversions + UI** (324–335) | `worldToScreen`/`screenToTile` зависят от `game.camera` | Клик мимо цели, камера сломана | Phase A (через параметризацию) |
| **Production queue** (2394–2478) | Связан с power state, faction bonuses, factory UI | Производство юнитов | Phase C |

---

## 6. DUPLICATED HELPERS / ДУБЛИ

### Подробная таблица дублированных bot helpers

| Helper | FE_10C1_ (строка) | FE_10D1_ (строка) | FE_10E1_ (строка) | FE_10F1_ (строка) | FE_10G1_ (строка) | FE_10H1_ (строка) | FE_10I1_ (строка) | Одинаковый? | Объединяем? |
|--------|-------------------|-------------------|-------------------|-------------------|-------------------|-------------------|-------------------|-------------|-------------|
| `getGameObject()` | 3370 | 3786 | 4161 | 3036 | (делегирует 10C1) | 4442 | 2561 | ✅ | ✅ → `getGame()` |
| `getUnitList()` | 3377 | 3794 | 4170 | — | — | — | — | ✅ | ✅ |
| `getBuildingList()` | 3384 | 3802 | 4178 | — | — | — | — | ✅ | ✅ |
| `unitTileX(u)` | 3408 | 3810 | 4186 | 3068 | — | — | — | ✅ | ✅ |
| `unitTileY(u)` | 3412 | 3815 | 4191 | 3072 | — | — | — | ✅ | ✅ |
| `distTiles(a,b)` | 3416 | 3820 | 4196 | 3076 | — | (делегирует 10D1) | — | ✅ | ✅ |
| `isEnemyUnit(u)` | 3424 | 3828 | 4213 | — | — | — | — | ⚠️ | ⚠️ См. ниже |
| `isPlayerUnit(u)` | — | 3832 | 4218 | — | — | — | — | ⚠️ | ⚠️ См. ниже |
| `isEnemyTank(u)` | — | 3836 | 4228 | — | — | — | — | ✅ | ✅ |
| `getObjectId(obj)` | — | 3842 | 4236 | 3064 | — | — | — | ✅ | ✅ |
| `getEnemyHQ()` | 3434 | 3846 | 4240 | — | — | — | — | ✅ | ✅ |
| `hasActiveAttackOrder(u)` | — | 3859 | 4250 | — | — | 4496 | — | ✅ | ✅ |
| `knownEntries(collection)` | — | — | — | 3110 | 3471 | — | — | ✅ | ✅ |
| `IsAlive(obj)` | — | — | — | 3084 | — | — | — | уникальный | — |

### ⚠️ Осторожность с `isEnemyUnit` / `isPlayerUnit`

Core-версии:
```js
function isEnemyUnit(unit) {
  return !!unit && unit.kind === 'unit' && unit.owner === 'enemy';
}
```

Bot-helper версии:
```js
function FE_10C1_isEnemyUnit(u) {
  return !!u && (u.owner === 'enemy' || u.side === 'enemy' || u.player === 'enemy');
}
```

**Разница:** Bot helpers проверяют `owner/side/player`, core — только `owner`. В текущем коде игры `owner` всегда установлен, а `side` и `player` — нет. Поэтому результат одинаковый, но при объединении нужно сохранить более широкий вариант (bot helper) как единый `isEnemyUnit()`, чтобы не сломать будущие расширения.

### Сколько строк можно сэкономить

| Что объединяем | Сколько дублей | Строк сейчас | Строк после | Экономия |
|---------------|----------------|-------------|------------|----------|
| getGameObject | 7 | ~49 | ~7 | ~42 |
| getUnitList | 3 | ~18 | ~6 | ~12 |
| getBuildingList | 3 | ~18 | ~6 | ~12 |
| unitTileX/Y | 3 | ~24 | ~8 | ~16 |
| distTiles | 4 | ~28 | ~7 | ~21 |
| isEnemyUnit (safe merge) | 3 | ~12 | ~4 | ~8 |
| getEnemyHQ | 3 | ~21 | ~7 | ~14 |
| getObjectId | 2 | ~8 | ~4 | ~4 |
| hasActiveAttackOrder | 3 | ~24 | ~8 | ~16 |
| knownEntries | 2 | ~12 | ~6 | ~6 |
| **Итого** | — | **~214** | **~63** | **~151** |

Плюс упрощение delegation chains (каждый 10D1 вызывает 10C1, каждый 10E1 вызывает 10D1 → 10C1) — ещё ~100 строк сохранённых intermediate functions.

---

## 7. DEAD / DISABLED CODE

| Блок/файл | Где находится (строки) | Почему кажется dead/disabled | Можно ли удалить сейчас | Риск |
|-----------|----------------------|-----------------------------|----------------------|------|
| `applyTestBuildingCostsX10()` | 25–78 | Функция определена, но вызов закомментирован на строке 78: `// applyTestBuildingCostsX10();` | ✅ Да — вызов закомментирован, `__testCostsX10Applied` никогда не устанавливается | 🟢 нет |
| Dead code в `setLightTankAttack()` | 1519–1552 | Unreachable code после `return` на строке 1518 — дублирует attack logic | ✅ Да — unreachable | 🟢 нет |
| Dead code в `spawnLightTankForOwner()` | 1748–1776 | Unreachable code после `return` на строке 1747 — legacy spawn code | ✅ Да — unreachable | 🟢 нет |
| Dead code в `FE_PATCH_07ASetupSkirmishStart()` | 2056–2084 | Unreachable code после `return` на строке 2055 — legacy skirmish setup | ✅ Да — unreachable | 🟢 нет |
| Dead code в `setLightTankAttackApproach()` | 10453–10490 | Unreachable code после `return` на строке 10451 — duplicate approach logic | ✅ Да — unreachable | 🟢 нет |
| `drawIsoShadow()` | 8384–8388 | Функция сразу делает `return;` — все тени отключены | ✅ Да — no-op | 🟢 нет |
| `FE_PATCH_06ADrawEnemyBaseMarker(b,profile)` | 8677–8679 | Функция сразу делает `return;` | ✅ Да — no-op | 🟢 нет |
| `drawEnemyUnitMarker(unit,anchorX,anchorY)` | 10333–10335 | Функция сразу делает `return;` | ✅ Да — no-op | 🟢 нет |
| `drawEnemyBuildingMarker(building,profile)` | 10337–10339 | Функция сразу делает `return;` | ✅ Да — no-op | 🟢 нет |
| `src/core/unit_controller.js` | Отдельный файл, 879 строк | `FE_UNIT_CONTROLLER_ENABLED = false` — модуль полностью отключён | ✅ Да — но это Review lane (код в src/) | 🟢 нет |
| `FE_UNIT_CONTROLLER_ENABLED` block в main.js | 11632–11654 | Guarded by `window.FE_UNIT_CONTROLLER_ENABLED === true` — всегда false | ✅ Да — unreachable при false | 🟢 нет |
| `src/main_broken_04c3.js` | Отдельный файл | Backup сломанного main.js | ✅ Да — сломанный backup | 🟢 нет |
| `src/main_broken_04c5.js` | Отдельный файл | Backup сломанного main.js | ✅ Да — сломанный backup | 🟢 нет |
| `src/main_before_restore_04a.js` | Отдельный файл | Backup main.js | ✅ Да — backup | 🟢 нет |

**Итого dead code:** ~200 строк внутри main.js + 879 строк в unit_controller.js + ~500 строк в backup-файлах = ~1579 строк.

**Важно:** Не предлагать удаление без доказательства. Все позиции выше имеют чёткие доказательства: commented call, unreachable after return, immediate return, disabled flag.

---

## 8. CURRENT CONFIG MAP

### Что уже config-driven

| Что меняем | Где сейчас лежит | Файл | Поле/константа | Риск изменения |
|-----------|-----------------|------|----------------|---------------|
| HP юнитов | src/config/units.js | units.js | `FE_UNITS.harvester.hp = 100`, `FE_UNITS.builder.hp = 120`, `FE_UNITS.light_tank.hp = 160`, `FE_UNITS.scout.hp = 80` | 🟢 |
| Speed юнитов | src/config/units.js | units.js | `FE_UNITS.*.speed` | 🟢 |
| View radius (scout) | src/config/units.js | units.js | `FE_UNITS.scout.view = 7` | 🟢 |
| productionTime | src/config/units.js | units.js | `FE_UNITS.*.productionTime` | 🟢 |
| costElement | src/config/units.js | units.js | `FE_UNITS.*.costElement` | 🟢 |
| canAttack | src/config/units.js | units.js | `FE_UNITS.*.canAttack` | 🟢 |
| Sprite size | src/config/sprite_profiles.js | sprite_profiles.js | `FE_SPRITE_PROFILES.*.*.size` | 🟢 |
| Anchor/offset | src/config/sprite_profiles.js | sprite_profiles.js | `FE_SPRITE_PROFILES.*.*.anchorX/Y`, `groundOffset`, `screenOffsetX/Y` | 🟢 |
| Building costs (energy) | src/config/buildings.js | buildings.js | `FE_BUILDINGS.*.costEnergy` | 🟢 |
| Build time | src/config/buildings.js | buildings.js | `FE_BUILDINGS.*.buildTime` | 🟢 |
| Storage limits (bonus) | src/config/buildings.js | buildings.js | `FE_BUILDINGS.*.storageBonus` | 🟢 |
| Building size (footprint) | src/config/buildings.js | buildings.js | `FE_BUILDING_SIZE.*` | 🟢 |
| Faction bonuses | src/config/factions.js | factions.js | `FE_FACTIONS.*.civilianProductionSpeed`, `combatProductionSpeed`, `buildSpeed`, `harvesterSpeed`, `territoryViewBonus` | 🟢 |
| DIR_MAP (4 юнита) | src/config/runtime_flags.js | runtime_flags.js | `FE_HARVESTER_DIR_MAP`, `FE_BUILDER_DIR_MAP`, `FE_LIGHT_TANK_DIR_MAP`, `FE_SCOUT_DIR_MAP` | 🟢 |
| HP_BAR_OFFSET | src/config/runtime_flags.js | runtime_flags.js | `FE_HP_BAR_OFFSET_*` | 🟢 |
| Dust params | src/config/runtime_flags.js | runtime_flags.js | `FE_DUST_PARAMS_HARVESTER/BUILDER/LIGHT_TANK/SCOUT` | 🟢 |
| Power config | src/config/runtime_flags.js | runtime_flags.js | `FE_POWER_HQ_MW`, `FE_POWER_PLANT_MW`, `FE_SEPARATOR_ACTIVE_POWER_MW`, `FE_UNITS_FACTORY_ACTIVE_POWER_MW` | 🟢 |
| Bot difficulty | main.js (2532–2607) | — | `FE_10I1_BOT_BEHAVIOR_PROFILES` | 🟡 в main.js |

### Что ещё hardcoded в main.js

| Что меняем | Где сейчас лежит | Файл | Поле/константа | Риск |
|-----------|-----------------|------|----------------|------|
| TILE_W = 76 / TILE_H = 38 | main.js:9–10 | main.js | `const TILE_W/H` | 🟡 |
| SAVE_KEY | main.js:7 | main.js | `const SAVE_KEY` | 🟢 |
| BASE_STORAGE | main.js:85–92 | main.js | `const BASE_STORAGE = { minerals:200, energy:300, purple:20, ... }` | 🟡 |
| Building HP (в createBuilding) | main.js:1802–1805 | main.js | `if type==='hq_base' hp=1000 else if type==='defense_tower' hp=420 else hp=320` | 🔴 не из BUILDINGS config |
| Separator formula (15/10/1/6.0s) | main.js:2276,2399,2408 | main.js | `minerals>=15`, `addResource('minerals',-15)`, `addResource('energy',10)`, `addResource(elKey,1)`, `_sepTimer>=6.0` | 🔴 не из config |
| Factory queue max = 2 | main.js:2424 | main.js | `if (factory.queue.length >= 2)` | 🟡 |
| Territory building radius = 5 | main.js:8162 | main.js | `territoryBuildingRadius = 5` | 🟡 |
| Territory cell claim interval = 15s | main.js:8208 | main.js | `_territoryTimer < 15` | 🟡 |
| Fog reveal radii (5/4/6) | main.js:8232,8236 | main.js | `harvester:5`, `others:4`, `buildings:6` | 🟡 (bot uses own 10B values) |
| Auto-save interval = 45s | main.js:11666 | main.js | `game._saveTimer >= 45` | 🟢 |
| Unit speeds (base 0.46/0.62) | main.js:5418–5420 | main.js | `0.46` (harvester), `0.62` (others) — **дублирует** `FE_UNITS.*.speed` | 🔴 redundant |
| Click marker life = 0.62s | main.js:5033 | main.js | `0.62` | 🟢 |
| Dust particle max = 80 | main.js:9164 | main.js | `80` | 🟢 |
| Camera zoom limits (0.55–1.95/4.0) | main.js:10955–10958 | main.js | `0.55`, `1.95`, `4.0` | 🟢 |
| Enemy bot opening delay (10s/16s) | main.js:2523,2548 | main.js | `openingDelayMs: 10000/16000` | 🟡 |
| Production speed tier logic | main.js:2440–2444 | main.js | `if (type==='harvester'||type==='builder'||type==='scout') return civilianProductionSpeed` | 🟡 hardcoded type list |
| Factory unit list | main.js:2335,9596 | main.js | `['builder','harvester','light_tank','scout']` | 🟡 hardcoded |
| Selection ring `ringTuneByType` | main.js:~10291 | main.js | inline object | 🟡 |
| Enemy visual faction = 'purple' | main.js:289 | main.js | `FE_PATCH_07A3_ENEMY_VISUAL_FACTION = 'purple'` | 🟢 |

---

## 9. RECOMMENDED MODULE STRUCTURE

### Целевая структура (рекомендация для Codex)

```
src/
  main.js                    ← остаётся точкой входа, уменьшается до ~8000 строк
  core/
    constants.js             ← TILE_W/H, SAVE_KEY, BASE_STORAGE, formula params, thresholds
    coordinates.js           ← tileToWorld, worldToTile, worldToScreen, tileToScreen, screenToTile, clamp, dist, inBounds
    helpers.js               ← shared bot helpers (getGame, distTiles, isEnemyUnit, getEnemyHQ и т.д.)
    game_state.js            ← blankGame, settings, uid, global state vars (NOT in Phase A)
  systems/
    map_generation.js        ← makeArrays, generateMap, generateResourceClusters, patterns, obstacle helpers
    fog_of_war.js            ← reveal, updateFog (NOT in Phase A)
    territory.js             ← claimTerritoryCell, updateTerritory, seedTerritory (NOT in Phase A)
    economy.js               ← addResource, getStorageLimits, canRunSeparatorCycle, power (NOT in Phase A)
    production.js            ← queueUnitProduction, updateUnitProduction, productionSpeedForUnit (NOT in Phase A)
    construction.js          ← orderBuild, findBuildPlan, updateBuilder, cancelBuild (NOT in Phase A)
    movement.js              ← updateUnitMovement, findPath, passable, isBlocked (NOT in Phase A)
    pathfinding.js           ← BFS findPath, passable, adjacentFreeCells (NOT in Phase A)
    combat.js                ← light_tank attack/approach/attack-move (NOT in Phase A)
    enemy_bot.js             ← updateEnemyBot + all 10B/C1/D1/E1/F1/G1/H1/I1 subsystems (NOT in Phase A)
    save_load.js             ← saveGame, loadGame (NOT in Phase A)
    particles.js             ← dust spawn/update/draw
  ui/
    hud.js                   ← updateHud, animateHud (NOT in Phase A)
    menus.js                 ← openBuildMenu, openFactoryMenu, updateSelectedInfo (NOT in Phase A)
    factory_menu.js          ← factory-specific UI (NOT in Phase A)
    selection_panel.js       ← selected info panel (NOT in Phase A)
    debug_overlay.js         ← combat debug, enemy economy panel
  dev/
    dev_spawn.js             ← FE_DEV_SPAWN_UNIT, FE_EXPORT_SNAPSHOT (NOT in Phase A)
    debug_tools.js           ← debugLog, safeCloneForLog, exportDebugLog, feMakeSnapshot
    diagnostics.js           ← calibration hotkeys, footprint debug (NOT in Phase A)
```

### Детали по каждому модулю

| Модуль | Что туда вынести | Сложность | Риск | Делать в REFACTOR-MAIN-01? |
|--------|-----------------|-----------|------|---------------------------|
| `core/constants.js` | TILE_W/H, SAVE_KEY, BASE_STORAGE, separator params, building HP, fog/territory radii, speeds, thresholds | 🟢 low | 🟢 нет | ✅ ДА |
| `core/coordinates.js` | tileToWorld, worldToTile, worldToScreen, tileToScreen, screenToTile, clamp, dist, inBounds | 🟢 low | 🟢 нет | ✅ ДА |
| `core/helpers.js` | Shared bot helpers: getGame, distTiles, unitTileX/Y, isEnemyUnit (wide), isPlayerUnit (wide), getEnemyHQ, getObjectId, hasActiveAttackOrder, knownEntries | 🟢 low | 🟡 low | ✅ ДА |
| `core/map_generation.js` | makeArrays, generateMap, generateResourceClusters, patterns, obstacle helpers, reserveFree, addObstacle, spawnMine | 🟡 medium | 🟢 low | ✅ ДА |
| `dev/debug_tools.js` | debugLog, safeCloneForLog, exportDebugLog, clearDebugLog, FE_LT_04C6DrawCombatDebugOverlay | 🟢 low | 🟢 нет | ✅ ДА |
| `systems/particles.js` | spawnBuilderDust, updateBuilderDust, updateDustParticles, drawDustParticles | 🟢 low | 🟢 нет | ✅ ДА |
| `systems/fog_of_war.js` | reveal, updateFog, drawFogTile | 🟡 medium | 🟡 medium | ❌ Phase C |
| `systems/territory.js` | claimTerritoryCell, updateTerritory, seedTerritory | 🟡 medium | 🟡 medium | ❌ Phase C |
| `systems/economy.js` | addResource, getStorageLimits, canRunSeparatorCycle, powerConfig, evaluatePowerState | 🟡 medium | 🟡 medium | ❌ Phase C |
| `systems/production.js` | queueUnitProduction, updateUnitProduction, productionSpeedForUnit, factoryCanAffordAnyUnit | 🟡 medium | 🟡 medium | ❌ Phase C |
| `systems/movement.js` | updateUnitMovement, queueManualMove, recoverUnitPath, setManualMove | 🔴 high | 🔴 high | ❌ Phase D |
| `systems/pathfinding.js` | findPath (BFS), passable, isBlocked, adjacentFreeCells | 🟡 medium | 🔴 high | ❌ Phase C |
| `systems/combat.js` | Все attack/approach/attack-move функции | 🔴 high | 🔴 high | ❌ Phase D |
| `systems/enemy_bot.js` | updateEnemyBot + все 10B/C1/D1/E1/F1/G1/H1/I1 | 🔴 high | 🔴 high | ❌ Phase D |
| `systems/save_load.js` | saveGame, loadGame | 🔴 high | 🔴 high | ❌ Phase D |
| `ui/hud.js` | updateHud, animateHud | 🟡 medium | 🟡 medium | ❌ Phase C |
| `ui/menus.js` | openBuildMenu, openFactoryMenu, updateSelectedInfo, hideMenus | 🟡 medium | 🟡 medium | ❌ Phase C |
| `core/game_state.js` | blankGame, settings, uid, selected state | 🔴 high | 🔴 high | ❌ Phase D |

---

## 10. REFACTOR PHASE PLAN FOR CODEX

### Phase A — Safe extraction (делать ПЕРВЫМ)

**Цель:** Вынести pure functions и константы. Нулевой/минимальный риск.

#### A1: constants.js

- **Вынести:** `TILE_W`, `TILE_H`, `SAVE_KEY`, `SETTINGS_KEY`, `MAP_SIZES`, `BASE_STORAGE`, `FACTION_ELEMENT_KEY`, `FE_PATCH_07A3_ENEMY_VISUAL_FACTION`, separator params (`SEPARATOR_INPUT=15`, `SEPARATOR_ENERGY_OUTPUT=10`, `SEPARATOR_CYCLE_TIME=6.0`), building HP map, fog/territory radii, speeds, auto-save interval, factory queue max, click marker life, dust max, zoom limits, enemy bot opening delays
- **Файл:** `src/core/constants.js`
- **Как:** Объявить `window.FE_CONSTANTS = { ... }`, в main.js заменить `const TILE_W = 76` → `const TILE_W = window.FE_CONSTANTS.TILE_W` (или `const { TILE_W } = window.FE_CONSTANTS`)
- **Проверка:** `node --check` + runtime: `TILE_W === 76`, `BASE_STORAGE.minerals === 200`, `game.resources.powerTotal` совпадает

#### A2: coordinates.js

- **Вынести:** `tileToWorld`, `worldToTile`, `worldToScreen`, `tileToScreen`, `screenToTile`, `clamp`, `dist`, `inBounds`
- **Файл:** `src/core/coordinates.js`
- **Как:** `window.FE_COORDINATES = { tileToWorld, worldToTile, ... }`, в main.js: `const { tileToWorld, ... } = window.FE_COORDINATES`
- **Проблема:** `worldToScreen` и `screenToTile` зависят от `game.camera` и `canvas`. Решение: передавать `camera` и `canvasWidth/Height` как параметры, либо использовать getter функции
- **Проверка:** `node --check` + клик по карте = правильный тайл, камера перемещается корректно

#### A3: helpers.js (bot helper dedup)

- **Вынести:** Общий набор bot helpers: `getGame()`, `getUnitList()`, `getBuildingList()`, `distTiles()`, `unitTileX/Y()`, `isEnemyUnitWide()` (owner/side/player), `isPlayerUnitWide()`, `getEnemyHQ()`, `getObjectId()`, `hasActiveAttackOrder()`, `knownEntries()`
- **Файл:** `src/core/helpers.js`
- **Как:** Заменить все `FE_10C1_getGameObject()` → `FE_Helpers.getGame()`, `FE_10D1_distTiles()` → `FE_Helpers.distTiles()` и т.д. Удалить 7× дублированные версии
- **Осторожность:** `isEnemyUnit` в bot helpers проверяет `side` и `player` в дополнение к `owner`. Объединённая версия должна сохранять это поведение
- **Проверка:** `node --check` + bot AI telemetry значения идентичны до и после (записать baseline перед рефакторингом)

#### A4: map_generation.js

- **Вынести:** `makeArrays`, `generateMap`, `generateResourceClusters`, `getStart`, `getEnemyDiagonalStart`, `getPlannedPlayerStarts`, все resource patterns (SPAWN_STARTER_RESOURCE_PATTERN, etc.), `reserveFree`, `addObstacle`, `canSpawnMine`, `spawnMine`, `spawnMineNear`, `pushMineDirect`, obstacle environment helpers, map size helpers
- **Файл:** `src/core/map_generation.js`
- **Как:** `window.FE_MAPGEN = { generateMap, ... }`, в main.js заменить inline вызовы на делегирование
- **Проблема:** Все эти функции читают `game.mapW/H/Size` и пишут в `game.terrain/minerals/obstacles/territory/fogVisible/fogExplored`. Решение: передавать `game` как параметр или использовать `window.FE_CORE.game` getter
- **Проверка:** `node --check` + generate map → идентична baseline (сохранить карту до/после, сравнить)

#### A5: debug_tools.js

- **Вынести:** `debugLog`, `safeCloneForLog`, `exportDebugLog`, `clearDebugLog`, `FE_LT_04C6DrawCombatDebugOverlay`, `FE_DEBUG_EnemyEconomyRenderPanel`, `FE_DEBUG_ToggleEnemyEconomyPanel`, `feMakeSnapshot`
- **Файл:** `src/dev/debug_tools.js`
- **Как:** `window.FE_DEBUG_TOOLS = { ... }`, в main.js делегировать вызовы
- **Проверка:** `node --check` + debug panel открывается по F2, combat overlay по 9

#### A6: particles.js

- **Вынести:** `spawnBuilderDust`, `updateBuilderDust`, `updateDustParticles`, `drawDustParticles`
- **Файл:** `src/systems/particles.js`
- **Как:** `window.FE_PARTICLES = { spawnBuilderDust, updateDustParticles, drawDustParticles }`, в main.js делегировать
- **Проверка:** `node --check` + пыль видна при строительстве

#### A7: Delete dead code

- Удалить `applyTestBuildingCostsX10()` (строки 25–78)
- Удалить unreachable code после return в `setLightTankAttack()` (1519–1552)
- Удалить unreachable code после return в `spawnLightTankForOwner()` (1748–1776)
- Удалить unreachable code после return в `FE_PATCH_07ASetupSkirmishStart()` (2056–2084)
- Удалить unreachable code после return в `setLightTankAttackApproach()` (10453–10490)
- Удалить no-op функции: `drawIsoShadow`, `FE_PATCH_06ADrawEnemyBaseMarker`, `drawEnemyUnitMarker`, `drawEnemyBuildingMarker`
- Удалить `FE_UNIT_CONTROLLER_ENABLED` block (11632–11654)
- Удалить backup файлы: `src/main_broken_04c3.js`, `src/main_broken_04c5.js`, `src/main_before_restore_04a.js`
- **НЕ удалять** `src/core/unit_controller.js` в этом PR — вынести в отдельный cleanup PR

**Ожидаемый результат Phase A:**
- main.js уменьшается с ~12 128 строк до ~10 500 строк
- 6 новых файлов в `src/core/`, `src/dev/`, `src/systems/`
- Dead code удалён
- Bot helpers унифицированы
- Константы централизованы
- `node --check` PASS
- Playwright smoke PASS
- Gameplay идентичен

---

### Phase B — Medium-risk extraction (делать ПОСЛЕ Phase A)

**Цель:** Вынести standalone подсистемы, которые зависят от game state через getter.

| Модуль | Что вынести | Требуется |
|--------|-----------|----------|
| `systems/fog_of_war.js` | reveal, updateFog, drawFogTile | `game.fogVisible/Explored` + `game.units/buildings` через getter |
| `systems/territory.js` | claimTerritoryCell, updateTerritory, seedTerritory | `game.territory` + `game.buildings` через getter |
| `systems/economy.js` | addResource, getStorageLimits, canRunSeparatorCycle, powerConfig, evaluatePowerState, changeResource | `game.resources/buildings` через getter |
| `systems/production.js` | queueUnitProduction, updateUnitProduction, productionSpeedForUnit | `game.buildings/resources` через getter + `FACTIONS` config |
| `systems/pathfinding.js` | findPath (BFS), passable, isBlocked, adjacentFreeCells, adjacentFreeCellsForRect | `game.obstacles/buildings/units/minerals` через getter |

**Требование:** Создать `window.FE_CORE` как единый gateway к game state:
```js
window.FE_CORE = {
  get game() { return game; },
  get canvas() { return canvas; },
  get ctx() { return ctx; },
  get assets() { return assets; },
  get selected() { return selected; },
  // ... и т.д.
};
```

---

### Phase C — Leave in main.js for now (НЕ трогать в первом рефакторинге)

Следующие системы остаются в main.js до follow-up PR:

| Система | Почему оставить | Когда выносить |
|---------|----------------|---------------|
| render() (9441–9540) | Оркестрирует все rendering subsystems | После того как все rendering subsystems извлечены |
| Input/selection (9715–10916) | Глубоко связан с game state | После game_state.js extraction |
| Movement (5059–5487) | Используется всеми юнитами | После pathfinding extraction + shared state |
| Combat (969–1790, 10343–10782) | 3 уровня state machine | После movement extraction |
| Enemy bot (2520–4866) | 9 подсистем, все через IIFE scope | После helpers dedup + shared state |
| Builder (7072–8138) | Сложная state machine | После pathfinding extraction |
| Harvester (5488–6063) | State machine + economy | После economy + movement extraction |
| Save/load (8244–8272) | Формат save привязан к game структуре | В самом конце |
| Game state (217–283) | Центральный mutable state | В самом конце |
| UI/menus (9542–9713) | DOM manipulation + game queries | После game_state extraction |

---

## 11. BEHAVIOR PRESERVATION RULES

**Codex НЕ ДОЛЖЕН менять следующее поведение:**

1. **Scout** — visual, movement, menu, ring, direction map — не менять
2. **Factory production** — очередь, скорость, стоимость, spawn cell — не менять
3. **Bot behavior** — все bot-решения, knowledge, targeting, scouting, retreat, difficulty — не менять
4. **Economy balance** — separator formula (15/10/1/6.0s), power values, storage limits — не менять
5. **Map generation** — behaviour (результат generateMap) не менять, если это extraction-only
6. **Combat** — damage, range, cooldown, attack/approach/attack-move logic — не менять
7. **Save/load** — формат save data не менять, обратная совместимость — обязательно
8. **Hotkeys** — не добавлять новые, не менять существующие
9. **New features** — не добавлять никаких новых фич
10. **Assets** — не трогать никакие файлы в assets/
11. **Config values** — не менять числовые значения при extraction (константы переносятся как есть)
12. **Faction bonuses** — не менять
13. **Territory timing** — не менять
14. **Fog radii** — не менять
15. **Dust particles** — визуальный результат не менять

---

## 12. SMOKE CHECKLIST AFTER CODEX

После каждого extraction PR, Codex или проверяющий должен пройти этот чеклист:

- [ ] Игра загружается (index.html открывается без JS ошибок)
- [ ] Новая игра стартует (выбор фракции → карта генерируется)
- [ ] Main menu работает (кнопки кликабельны, переходы между экранами)
- [ ] GitHub Pages / local launch работает
- [ ] Scout спавнится через `FE_DEV_SPAWN_UNIT('scout')` в консоли
- [ ] Scout едет (правый клик → движение)
- [ ] Scout стоит по центру тайла (не между тайлами)
- [ ] Factory производит scout (build menu → factory → scout → очередь → spawn)
- [ ] Harvester добывает (авто-gather после spawn)
- [ ] Builder строит (build menu → click → строительство)
- [ ] Separator перерабатывает (сырьё → энергия + элемент)
- [ ] Light_tank атакует (правый клик на врага → атака)
- [ ] Enemy bot стартует (база строится, юниты спавнятся)
- [ ] Bot строит/атакует (separator, factory, tanks)
- [ ] Save/load работает (сохранить → загрузить → тот же state)
- [ ] Нет console errors (кроме известных warning от asset loader)
- [ ] `node --check src/main.js` PASS
- [ ] `node --check` на ВСЕХ новых файлах PASS
- [ ] Playwright smoke PASS
- [ ] Bot AI telemetry значения идентичны baseline (для helpers dedup)

---

## 13. CODEX PROMPT APPENDIX

### Appendix: Draft prompt for Codex

```
You are performing a controlled refactor of src/main.js in the Four Elements Remake RTS game.

## Context
Read the full handoff document first:
  docs/project/MAIN_REFACTOR_CODEX_HANDOFF_20260510.md

## Goal
Break the 12,128-line monolithic IIFE in src/main.js into separate module files WITHOUT changing any gameplay behavior.

## Rules
1. NEVER change gameplay, balance, or visual behavior
2. NEVER add new features
3. NEVER modify assets/
4. NEVER modify config values during extraction — constants move as-is
5. Each extraction = one PR, one module file
6. After every change: run `node --check src/main.js` and all new files
7. After every change: verify Playwright smoke tests pass
8. Use the behavior preservation checklist from the handoff document (§12)
9. If unsure about any extraction: STOP and leave a comment in REFACTOR_REPORT.md

## Execution Order (Phase A only)
Follow this exact order:

### Step 1: Create src/core/constants.js
- Move all hardcoded constants from main.js (see §8 config map for full list)
- Expose as `window.FE_CONSTANTS`
- In main.js: destructure from `window.FE_CONSTANTS` at top of IIFE
- Run `node --check`
- Verify: game starts, values identical

### Step 2: Create src/core/coordinates.js
- Move pure coordinate functions: tileToWorld, worldToTile, clamp, dist, inBounds
- For worldToScreen/screenToTile that need game.camera: accept camera/viewport as parameters
- Expose as `window.FE_COORDINATES`
- In main.js: destructure from `window.FE_COORDINATES`
- Run `node --check`
- Verify: click on map = correct tile, camera moves correctly

### Step 3: Create src/core/helpers.js (bot helper dedup)
- Create unified versions: getGame, distTiles, unitTileX, unitTileY, isEnemyUnitWide, isPlayerUnitWide, getEnemyHQ, getObjectId, hasActiveAttackOrder, knownEntries
- Replace ALL FE_10C1_, FE_10D1_, FE_10E1_, FE_10F1_, FE_10G1_, FE_10H1_, FE_10I1_ prefixed duplicates
- Expose as `window.FE_HELPERS`
- Run `node --check`
- Verify: bot AI telemetry values identical before/after

### Step 4: Create src/core/map_generation.js
- Move mapgen functions: makeArrays, generateMap, generateResourceClusters, patterns, obstacle helpers
- Functions that access `game` should use `window.FE_CORE.game` getter or accept game as parameter
- Expose as `window.FE_MAPGEN`
- In main.js: replace inline calls with delegation
- Run `node --check`
- Verify: generate map produces identical result (save map before/after, compare)

### Step 5: Create src/dev/debug_tools.js
- Move debug functions: debugLog, safeCloneForLog, exportDebugLog, combat debug overlay, enemy economy panel
- Expose as `window.FE_DEBUG_TOOLS`
- Run `node --check`
- Verify: F2 opens debug panel, 9 toggles combat overlay

### Step 6: Create src/systems/particles.js
- Move dust particle functions: spawnBuilderDust, updateBuilderDust, updateDustParticles, drawDustParticles
- Expose as `window.FE_PARTICLES`
- Run `node --check`
- Verify: dust visible during construction

### Step 7: Delete dead code
- Remove all dead code identified in §7 of the handoff document
- Do NOT delete src/core/unit_controller.js (separate cleanup PR)
- Run `node --check`
- Verify: game runs without errors

## Module Loading
New modules are loaded via <script> tags in index.html, BEFORE main.js.
Example order in index.html:
  <script src="src/core/constants.js"></script>
  <script src="src/core/coordinates.js"></script>
  <script src="src/core/helpers.js"></script>
  <script src="src/core/map_generation.js"></script>
  <script src="src/dev/debug_tools.js"></script>
  <script src="src/systems/particles.js"></script>
  <script src="src/main.js"></script>

## Output
After completing all steps, create REFACTOR_REPORT.md with:
1. Files created
2. Files modified
3. Lines removed from main.js (before → after)
4. All node --check results
5. All Playwright test results
6. Any issues encountered
7. Any decisions where you were unsure

## DO NOT
- Do not proceed to Phase B/C/D — only Phase A
- Do not extract render, input, combat, bot, save/load, builder, harvester, movement
- Do not change any gameplay behavior
- Do not modify the IIFE structure itself (it stays as-is, just smaller)
```

---

## 14. КЛЮЧЕВЫЕ ВЫВОДЫ ДЛЯ CODEX

1. **Shared closure scope — главный враг.** Все функции в main.js делят один IIFE scope с `game`, `canvas`, `ctx`, `selected`, `keys`. При extraction каждый модуль должен получить доступ к этим переменным через `window.FE_CORE` getter или явные параметры. Без этого — сломанная игра.

2. **Bot helpers дублированы 7 раз.** FE_10C1_, FE_10D1_, FE_10E1_, FE_10F1_, FE_10G1_, FE_10H1_, FE_10I1_ — каждый префикс несёт свою копию `getGameObject`, `distTiles`, `isEnemyUnit`, `getEnemyHQ`. Унификация через `src/core/helpers.js` экономит ~500 строк и уменьшает баг-поверхность. Но: `isEnemyUnit` в bot helpers проверяет `owner/side/player`, а core-версия только `owner` — объединять с широкой версией.

3. **Dead code — ~200 строк в main.js + ~1579 строк в других файлах.** Всё имеет доказательства: commented calls, unreachable after return, immediate return, disabled flags. Безопасно удалять.

4. **Не трогать render, input, combat, bot, save/load в первом рефакторинге.** Это high-risk зоны, которые требуют продуманного shared state management. Phase A = только pure functions, constants, dedup, mapgen, debug tools, particles.

5. **Separator formula (15/10/1/6.0s) hardcoded в 4 местах.** Это критический gameplay параметр, который нужно вынести в constants.js как можно раньше. То же самое для building HP — они hardcoded в `createBuilding()`, хотя есть `BUILDINGS` config.
