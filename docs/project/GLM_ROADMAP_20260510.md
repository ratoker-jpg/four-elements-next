# GLM Roadmap — Four Elements Remake

> Патчевый роадмап на основе стратегического обзора `GLM_FUTURE_VISION_HYPOTHESES_20260510.md`.
> Это рекомендованный план развития, а не утверждённое ТЗ.
> Каждый патч — атомарная единица работы с конкретным скоупом и проверяемым результатом.

**Дата:** 2026-05-10
**Тип:** Рекомендованный патчевый роадмап (report-only)
**Ветка:** sandbox/main (Fast lane)
**Основание:** GLM-FUTURE-VISION-01 → GLM_ROADMAP_01

---

## Философия роадмапа

```
PvE bot-first → stabilize → polish → expand
```

1. Сначала довести 1×1 skirmish до «каждая партия интересна»
2. Потом добавить глубину (heavy_tank, defense tower, tech tree)
3. Потом расширять (scout для бота, map events, faction asymmetry)
4. Только потом думать про multiplayer / engine migration

**Жёсткие правила:**
- Один патч = одна цель = одна система
- Difficulty = поведение, не ресурсы
- Нет omniscient AI как финальное поведение
- Нет artificial gameplay shortcuts (спавн из воздуха, бесплатные ресурсы)
- `node --check` + Playwright smoke после каждого патча
- Docs checkpoint после каждых двух принятых патчей

---

## Обзор фаз

| Фаза | Период | Кол-во патчей | Главная цель |
|------|--------|---------------|-------------|
| Phase 0: Quick Wins | 1 неделя | 7 | Бот играбелен, бой виден, код чище |
| Phase 1: Stabilization | 2 недели | 7 | Scout для бота, hotkeys, refactor Phase 1 |
| Phase 2: Expansion | 1 месяц | 10 | Второй юнит, оборона, minimap, tech tree |
| Phase 3: Deepening | 2 месяца | 10 | Фракции, карта, tutorial, bot personalities |
| Phase 4: Long-term | 3+ месяца | — | Multiplayer, engine, campaign |

---

## Phase 0: Quick Wins (1 неделя)

> Цель: Бот становится играбельным, бой становится видимым, код становится чище.
> Все патчи — low risk, low complexity, огромный impact.

### PATCH-GLM-Q1 — Try/catch в game loop

| Параметр | Значение |
|----------|----------|
| **Что делает** | Оборачивает `update(dt)` в try/catch — при ошибке игра не крашится, а логирует и продолжает |
| **Что улучшает** | Stability — одна ошибка больше не убивает игру полностью |
| **Сложность** | low (3 строки кода) |
| **Риск** | нет |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (функция `update`) |
| **Проверка** | `node --check` + намеренный throw → игра не крашится |
| **Секция FUTURE_VISION** | §1 «5 самых полезных quick wins» п.1 |

### PATCH-GLM-Q2 — Bot tuning: пустой knowledge не блокирует атаку (10F1B)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Если knowledge пустой, бот использует fallback-цель (center/opposite corner) вместо того чтобы вообще не атаковать |
| **Что улучшает** | Бот перестаёт быть полностью пассивным когда knowledge пуст — самая частая причина «бот ничего не делает» |
| **Сложность** | low |
| **Риск** | low — добавляет fallback, не убирает существующую логику |
| **Зависимости** | PATCH-10F1 (vision-driven targeting) уже установлен |
| **Файлы** | `src/main.js` (FE_10F1_* functions) |
| **Проверка** | Запуск партии → бот атакует даже с пустым knowledge |
| **Секция FUTURE_VISION** | §9.5 «Bot scouting», §16 рек. #1 |

### PATCH-GLM-Q3 — Bot tuning: чрезмерный retreat (10H1B)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Поднимает порог retreat — бот не отступает при потере 1 юнита из 3. Retreat только при потере > 50% attack force |
| **Что улучшает** | Бот не убегает от одного убитого танка, атака становится настойчивой |
| **Сложность** | low |
| **Риск** | low — пороговое значение, легко откатить |
| **Зависимости** | PATCH-10H1 (retreat/defense) уже установлен |
| **Файлы** | `src/main.js` (FE_10H1_* functions) |
| **Проверка** | Бот продолжает атаку после потери 1 танка из 3 |
| **Секция FUTURE_VISION** | §9.7 «Bot combat», §9.8 retreat threshold |

### PATCH-GLM-Q4 — Bot tuning: Easy слишком пассивный (10I1B)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Снижает opening delay для Easy (16 сек → 10 сек), повышает attack threshold modestly, уменьшает scouting interval |
| **Что улучшает** | Easy бот атакует раньше и чаще — игра не скучная с первых минут |
| **Сложность** | low |
| **Риск** | low — config knobs |
| **Зависимости** | PATCH-10I1 (difficulty profile) уже установлен |
| **Файлы** | `src/main.js` (FE_10I1_* functions) |
| **Проверка** | Easy бот атакует в течение 3 минут |
| **Секция FUTURE_VISION** | §9.8 «Bot difficulty levels» |

### PATCH-GLM-Q5 — Muzzle flash overlay при атаке

| Параметр | Значение |
|----------|----------|
| **Что делает** | Белый/жёлтый overlay sprite на ~100ms при выстреле light_tank. Один спрайт, отрисовывается поверх attacker в направлении target |
| **Что улучшает** | Игрок ВИДИТ, что танк стреляет — самый большой UX-impact за минимальные усилия. Combat перестаёт быть «невидимым» |
| **Сложность** | low (1 спрайт + 20 строк кода) |
| **Риск** | low — чисто визуальный overlay |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (render section), новый `assets/effects/muzzle_flash.png` |
| **Проверка** | Танк стреляет → видна вспышка на 100ms |
| **Секция FUTURE_VISION** | §5.4 «Combat animation» MVP-вариант |

### PATCH-GLM-Q6 — Damage flash на целевом юните

| Параметр | Значение |
|----------|----------|
| **Что делает** | Красная вспышка (tint overlay) на целевом юните на ~150ms при получении урона |
| **Что улучшает** | Игрок ВИДИТ, что урон наносится — combat становится readable |
| **Сложность** | low (15 строк кода, canvas globalAlpha tint) |
| **Риск** | low |
| **Зависимости** | Нет (можно делать параллельно с Q5) |
| **Файлы** | `src/main.js` (render section, drawUnit) |
| **Проверка** | Юнит получает урон → красная вспышка |
| **Секция FUTURE_VISION** | §5.4 «Combat animation» MVP-вариант |

### PATCH-GLM-Q7 — Dedup 7× скопированных helpers

| Параметр | Значение |
|----------|----------|
| **Что делает** | Заменяет 7× дублированные `getGameObject`, `isEnemyUnit`, `distTiles`, `getEnemyHQ` (каждая скопирована 4-7 раз с префиксами `FE_10C1_`, `FE_10D1_` и т.д.) на один shared набор |
| **Что улучшает** | −500 строк мусорного кода, баг-поверхность уменьшается, будущие патчи безопаснее |
| **Сложность** | low (механическая замена) |
| **Риск** | low — `node --check` + telemetry unchanged |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (bot AI section) |
| **Проверка** | `node --check` + bot AI telemetry значения не изменились |
| **Секция FUTURE_VISION** | §2 «Временное / патчевое», §12.3 Phase 1 helpers.js |

---

## Phase 1: Stabilization (2 недели)

> Цель: Scout работает для бота, игрок получает hotkeys и UI улучшения, начинается modular refactor.
> Патчи medium complexity, medium risk, но каждый — проверяемый и откатываемый.

### PATCH-GLM-S1 — Bot использует scout вместо light_tank для разведки (PATCH-SCOUT-04)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Если у бота есть scout unit, scouting task назначается scout'у, а не light_tank. Light_tank остаётся для defense/attack |
| **Что улучшает** | Scout получает gameplay-роль, танк не тратится на разведку, бот разведывает эффективнее (scout быстрее + view 7) |
| **Сложность** | medium |
| **Риск** | medium — затрагивает bot AI scouting logic |
| **Зависимости** | PATCH-SCOUT-01/02 (player-side scout), PATCH-10C1/10G1 (scouting system) |
| **Файлы** | `src/main.js` (FE_10G1_* scouting functions) |
| **Проверка** | Bot scout существует → scout отправляется на разведку, танк остаётся defend |
| **Секция FUTURE_VISION** | §4.3 «Scout — как бот должен использовать», §9.5 «Bot scouting» |

### PATCH-GLM-S2 — Bot производит 1-2 scout'а (PATCH-SCOUT-05)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Bot добавляет scout в production queue (1-2 scout, soft cap). Scout production не блокирует tank production |
| **Что улучшает** | Бот получает разведку из собственных ресурсов, а не из спавна. Экономический loop замыкается для scout |
| **Сложность** | medium |
| **Риск** | medium — затрагивает production manager |
| **Зависимости** | PATCH-GLM-S1 (bot использует scout) |
| **Файлы** | `src/main.js` (enemy production logic) |
| **Проверка** | Bot производит scout → scout разведывает → бот не перестаёт производить танки |
| **Секция FUTURE_VISION** | §9.6 «Bot economy — когда строить scout» |

### PATCH-GLM-S3 — Bot intel loop (PATCH-SCOUT-06)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Bot использует scout-gathered information для решения: атаковать / защищаться / продолжать разведку. Если player слабый → attack. Если неизвестно / сильный → scout/defend |
| **Что улучшает** | Бот «думает» через информацию — core loop RTS: разведка → решение → действие |
| **Сложность** | medium |
| **Риск** | medium — decision logic |
| **Зависимости** | PATCH-GLM-S2 (bot производит scout) |
| **Файлы** | `src/main.js` (bot decision logic) |
| **Проверка** | Scout видит слабую player базу → бот атакует. Scout видит сильную → бот защищается |
| **Секция FUTURE_VISION** | §4.3 «Scout — как бот должен использовать», §9.4 «Bot prediction» |

### PATCH-GLM-S4 — Extract coordinates.js (Refactor Phase 1)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Выносит 7 pure functions (tileToWorld, worldToTile, screenToTile, clamp, dist, inBounds) в отдельный `src/coordinates.js` |
| **Что улучшает** | Первый шаг modular refactor. Pure functions, zero state — нулевой риск. Упрощает тестирование |
| **Сложность** | low |
| **Риск** | нет — pure functions, no side effects |
| **Зависимости** | Нет |
| **Файлы** | Новый `src/coordinates.js`, `src/main.js` (import), `index.html` (script tag) |
| **Проверка** | `node --check` + Playwright smoke → всё работает как раньше |
| **Секция FUTURE_VISION** | §12.3 «Phase 1: Нулевой риск — coordinates.js» |

### PATCH-GLM-S5 — Extract constants.js (Refactor Phase 1)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Выносит все hardcoded values (TILE_W, TILE_H, MAP_SIZES, BASE_STORAGE, separator formula, economy constants, cycle time, territory spread, auto-save interval, HQ HP) в `src/constants.js` |
| **Что улучшает** | Tuning без code changes. Каждый balance tweak = изменение config, не кода |
| **Сложность** | low |
| **Риск** | нет — только объявление констант |
| **Зависимости** | Нет (можно делать параллельно с S4) |
| **Файлы** | Новый `src/constants.js`, `src/main.js` (replace hardcoded → constants) |
| **Проверка** | `node --check` + runtime values идентичны до и после |
| **Секция FUTURE_VISION** | §12.3 «Phase 1: Нулевой риск — constants.js» |

### PATCH-GLM-S6 — Hotkey system (S=stop, B=build, F=attack-move)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Добавляет горячие клавиши: S=stop current action, B=open build menu (when builder selected), F=attack-move, Ctrl+1-9=control groups |
| **Что улучшает** | APM ceiling повышается, стандарт RTS control scheme |
| **Сложность** | medium |
| **Риск** | low — добавление, не изменение |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (input handling section) |
| **Проверка** | Нажатие S → юнит останавливается, B → build menu, F → attack-move cursor |
| **Секция FUTURE_VISION** | §11.3 «Unit command panel», §11.5 «Selection UX» |

### PATCH-GLM-S7 — Production queue UI display

| Параметр | Значение |
|----------|----------|
| **Что делает** | Показывает текущую очередь производства в factory panel: что производится, progress bar, что в очереди, сколько осталось |
| **Что улучшает** | Игрок ВИДИТ, что производится — больше не нужно угадывать |
| **Сложность** | low |
| **Риск** | low — UI-only |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (factory UI section) |
| **Проверка** | Factory производит → queue display обновляется в реальном времени |
| **Секция FUTURE_VISION** | §11.2 «Production UI», §6.8 «Production» |

---

## Phase 2: Expansion (1 месяц)

> Цель: Второй боевой юнит, оборона, стратегический обзор, late-game progression.
> Патчи medium complexity, medium risk, требуют тщательного тестирования.

### PATCH-GLM-E1 — Heavy_tank combat implementation

| Параметр | Значение |
|----------|----------|
| **Что делает** | Реализует attack logic для heavy_tank: damage 25/shot, range 6, cooldown 2.0s. Attack approach → attacking → damage cycle. Спрайты: пока placeholder 56×56 или reuse light_tank с масштабированием |
| **Что улучшает** | Второй боевой юнит с отличной ролью: siege, anti-building, медленный но мощный. Стратегический выбор: 2 light_tank (4 elem) vs 1 heavy_tank (4 elem) |
| **Сложность** | medium |
| **Риск** | medium — новая combat логика |
| **Зависимости** | Light_tank combat работает |
| **Файлы** | `src/main.js`, `src/config/units.js` |
| **Проверка** | Heavy_tank атакует building → наносит 25 damage, cooldown 2s |
| **Секция FUTURE_VISION** | §4.5 «Heavy Tank — предложение по реализации» |

### PATCH-GLM-E2 — Defense tower implementation

| Параметр | Значение |
|----------|----------|
| **Что делает** | Добавляет defense_tower: HP 420, auto-targets nearest enemy, 8 damage/1.2s, range 7. Power: 8 MW. Cost: 180 energy + 2 elements. Builder может строить через build menu |
| **Что улучшает** | Базовая оборона — игрок может защищаться без армии. Counter для early rush. Тактический выбор: tower vs. танк |
| **Сложность** | medium |
| **Риск** | medium — новый тип здания с combat logic |
| **Зависимости** | Builder state machine (стабильна) |
| **Файлы** | `src/main.js`, `src/config/`, assets |
| **Проверка** | Enemy подходит в range 7 → tower атакует автоматически |
| **Секция FUTURE_VISION** | §8.6 «Buildings combat — Defense tower» |

### PATCH-GLM-E3 — Minimap

| Параметр | Значение |
|----------|----------|
| **Что делает** | Отдельный canvas element в углу экрана. Масштабированная версия карты: terrain, territory, units (dots), fog. Click для перемещения камеры |
| **Что улучшает** | Стратегический обзор — RTS без minimap = слепая игра. Игрок видит всю карту, территорию, вражеские юниты в visible zone |
| **Сложность** | medium |
| **Риск** | low — отдельный canvas, не влияет на основной рендер |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (новый render section), `index.html` (canvas element) |
| **Проверка** | Minimap отображает карту, клик перемещает камеру |
| **Секция FUTURE_VISION** | §11.4 «Minimap» |

### PATCH-GLM-E4 — Tech tree v1 (5 базовых upgrades)

| Параметр | Значение |
|----------|----------|
| **Что делает** | 5 плоских (не ветвящихся) улучшений: (1) Tank damage +10%, (2) Tank HP +10%, (3) Harvester cargo +5, (4) Separator speed +15%, (5) Vision +1. Каждое стоит 2-3 elements. Исследуются в HQ |
| **Что улучшает** | Late-game progression — ресурсы (elements) больше не копятся бесцельно. Economy sink. Каждый game разный через разные upgrade приоритеты |
| **Сложность** | medium |
| **Риск** | medium — новая система, баланс |
| **Зависимости** | HQ panel работает |
| **Файлы** | `src/main.js`, `src/config/` |
| **Проверка** | Купить upgrade → юниты получают бонус → resources потрачены |
| **Секция FUTURE_VISION** | §6.9 «Upgrades», §10.3 «Tech tree» |

### PATCH-GLM-E5 — Explosion / destroy animation

| Параметр | Значение |
|----------|----------|
| **Что делает** | Оранжевый burst sprite при destroy unit/building. Wreck sprite остаётся на месте на 10 сек. Building damage stages: sprite меняется при HP < 50% / < 25% |
| **Что улучшает** | Визуальный фидбек разрушения — игрок видит результат боя, а не просто «юнит исчез» |
| **Сложность** | low |
| **Риск** | low — overlay-эффекты |
| **Зависимости** | PATCH-GLM-Q5/Q6 (muzzle flash + damage flash) — желательно но не обязательно |
| **Файлы** | `src/main.js` (render section), `assets/effects/` |
| **Проверка** | Юнит/здание разрушается → виден взрыв → wreck на 10 сек |
| **Секция FUTURE_VISION** | §5.4 «Combat animation — полноценная версия» |

### PATCH-GLM-E6 — Save slots (3+)

| Параметр | Значение |
|----------|----------|
| **Что делает** | 3 save slots вместо 1. Save/load menu. Auto-save в активный слот. Versioning для save data |
| **Что улучшает** | Игрок может экспериментировать без страха потерять прогресс. Versioning спасает от сломанных saves |
| **Сложность** | low |
| **Риск** | low |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (FE_SAVE_MANAGER) |
| **Проверка** | 3 слота, save → load → same state |
| **Секция FUTURE_VISION** | §11.7 «Menus — Save slots» |

### PATCH-GLM-E7 — Extract mapgen.js (Refactor Phase 2)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Выносит всю генерацию карты (makeArrays, generateResourceClusters, generateMap, obstacle helpers) в `src/mapgen.js` |
| **Что улучшает** | Самый большой standalone блок (~530 строк) покидает main.js. Легче добавлять новые map patterns. Запускается один раз — легко тестировать |
| **Сложность** | low |
| **Риск** | low — standalone, runs once |
| **Зависимости** | PATCH-GLM-S4/S5 (coordinates.js + constants.js) — желательно |
| **Файлы** | Новый `src/mapgen.js`, `src/main.js` (import) |
| **Проверка** | `node --check` + generate map → идентична baseline |
| **Секция FUTURE_VISION** | §12.3 «Phase 2: Низкий риск — mapgen.js» |

### PATCH-GLM-E8 — Delete unit_controller.js dead code

| Параметр | Значение |
|----------|----------|
| **Что делает** | Удаляет `src/unit_controller.js` (879 строк мёртвого кода, FE_UNIT_CONTROLLER_ENABLED = false) и `applyTestBuildingCostsX10()` (disabled) |
| **Что улучшает** | Убирает 879 строк мусора, устраняет confusion при чтении кода |
| **Сложность** | low |
| **Риск** | нет — код не используется |
| **Зависимости** | Нет |
| **Файлы** | Удалить `src/unit_controller.js`, `src/main.js` (remove applyTestBuildingCostsX10) |
| **Проверка** | `node --check` + игра работает как раньше |
| **Секция FUTURE_VISION** | §2 «Временное / патчевое» |

### PATCH-GLM-E9 — Idle worker notification

| Параметр | Значение |
|----------|----------|
| **Что делает** | Подсветка idle harvester/builder: иконка в HUD, клик выделяет idle юнита. Notification «Idle workers!» если > 0 idle > 5 сек |
| **Что улучшает** | Игрок не забывает про idle юнитов — экономика не простаивает |
| **Сложность** | low |
| **Риск** | low |
| **Зависимости** | Нет |
| **Файлы** | `src/main.js` (UI section) |
| **Проверка** | Harvester idle > 5 сек → notification |
| **Секция FUTURE_VISION** | §10.8 «UX helpers — Idle worker notification» |

### PATCH-GLM-E10 — Hard difficulty bot profile

| Параметр | Значение |
|----------|----------|
| **Что делает** | Hard difficulty: reaction 0.5s, attack every 2-3 min, strategic scouting, memory 120s, good target selection, retreat at 75% losses |
| **Что улучшает** | Challenge для опытных игроков. Три уровня: Easy/Normal/Hard — каждый по-своему интересен |
| **Сложность** | medium |
| **Риск** | medium — баланс difficulty |
| **Зависимости** | PATCH-10I1 (difficulty profile), PATCH-GLM-Q4 (Easy tuning) |
| **Файлы** | `src/main.js` (FE_10I1_* functions) |
| **Проверка** | Hard бот атакует часто и стратегически |
| **Секция FUTURE_VISION** | §9.8 «Bot difficulty levels» |

---

## Phase 3: Deepening (2 месяца)

> Цель: Фракции становятся разными, карта становится интереснее, bot становится умнее, new players не теряются.
> Патчи medium/high complexity, medium/high risk.

### PATCH-GLM-D1 — Faction asymmetry v1 (+20% бонусы)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Усиливает бонусы фракций с 1.10 → 1.20: Cyan civilianProductionSpeed 1.20, Green buildSpeed 1.25, Yellow combatProductionSpeed 1.20, Purple territoryViewBonus +2 |
| **Что улучшает** | Выбор фракции становится meaningful — каждый играет по-разному. Пока без уникальных юнитов/зданий — только числовые бонусы |
| **Сложность** | low |
| **Риск** | low — config changes |
| **Зависимости** | Нет |
| **Файлы** | `src/config/factions.js` или аналогичный |
| **Проверка** | Cyan производит civilian на 20% быстрее, Green строит на 25% быстрее и т.д. |
| **Секция FUTURE_VISION** | §7 «Фракции и асимметрия» — усиление бонусов |

### PATCH-GLM-D2 — Map: стартовые карманы (choke points)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Добавляет гарантированный «карман» — 2-3 горы, формирующие узкий проход к старту. 2-3 choke points (1-2 клетки) через горные хребты между стартами. Path validation после generateMap() |
| **Что улучшает** | Естественные defensive positions, tactical variety (flanking, ambush), карта перестаёт быть «открытым полем» |
| **Сложность** | medium |
| **Риск** | medium — pathfinding validation обязателен |
| **Зависимости** | PATCH-GLM-E7 (mapgen.js extracted) — желательно |
| **Файлы** | `src/mapgen.js` |
| **Проверка** | Старт в «кармане» → путь от старта к старту существует |
| **Секция FUTURE_VISION** | §3.1 «Стартовая зона — Quick win», §3.4 «Препятствия» |

### PATCH-GLM-D3 — Map: центр карты с кольцом гор

| Параметр | Значение |
|----------|----------|
| **Что делает** | Окружает central infinite mine кольцом гор с 1-2 проходами. Центр = high risk / high reward зона |
| **Что улучшает** | Захват центра = экономическое преимущество, но удержание требует investment в defense. Late-game objective |
| **Сложность** | medium |
| **Риск** | low — добавление obstacles |
| **Зависимости** | PATCH-GLM-D2 (choke points) — желательно |
| **Файлы** | `src/mapgen.js` |
| **Проверка** | Центр окружён горами, 1-2 прохода, infinite mine доступна |
| **Секция FUTURE_VISION** | §3.2 «Центр карты — Quick win» |

### PATCH-GLM-D4 — Map: expansion-кластеры ресурсов

| Параметр | Значение |
|----------|----------|
| **Что делает** | 2-3 группы medium+small минералов на полпути между стартом и центром, с достаточным пространством для застройки |
| **Что улучшает** | Стратегический выбор: сидеть на базе или расширяться. Expansion = core RTS mechanic |
| **Сложность** | medium |
| **Риск** | low — добавление ресурсов |
| **Зависимости** | PATCH-GLM-D2/D3 (map improvements) |
| **Файлы** | `src/mapgen.js` |
| **Проверка** | Expansion-кластеры видны, место для застройки есть |
| **Секция FUTURE_VISION** | §3.3 «Ресурсы — Medium idea: Expansion-кластеры» |

### PATCH-GLM-D5 — Map: seeded PRNG

| Параметр | Значение |
|----------|----------|
| **Что делает** | Заменяет `Math.random()` в `generateMap()` на seeded generator. mapSeed в startNewGame() и save data |
| **Что улучшает** | Воспроизводимые карты, «карта дня», sharing интересных карт |
| **Сложность** | medium |
| **Риск** | low |
| **Зависимости** | PATCH-GLM-E7 (mapgen.js extracted) — желательно |
| **Файлы** | `src/mapgen.js`, `src/main.js` (startNewGame) |
| **Проверка** | Тот же seed → та же карта |
| **Секция FUTURE_VISION** | §3.6 «Replayability — Quick win: Seeded PRNG» |

### PATCH-GLM-D6 — Bot: full state machine (OPENING → SCOUTING → ECONOMY → DECISION → ...)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Заменяет текущий phase bot на полноценную state machine из 8 состояний: OPENING → SCOUTING → ECONOMY → DECISION → DEFENDING / PREPARING_ATTACK / ATTACKING / RECOVERING (+ EXPANDING, FINAL_PUSH) |
| **Что улучшает** | Бот «думает» в терминах фаз игры, а не простых порогов. Каждая фаза = чёткий набор правил. Читаемость, тестируемость, настраиваемость |
| **Сложность** | high |
| **Риск** | medium — замена bot logic, но incremental |
| **Зависимости** | PATCH-GLM-S3 (bot intel loop), PATCH-GLM-Q2/Q3/Q4 (bot tuning) |
| **Файлы** | `src/main.js` (enemy bot section) |
| **Проверка** | Бот проходит через фазы: opening → scouting → economy → decision |
| **Секция FUTURE_VISION** | §9.10 «Bot state machine» |

### PATCH-GLM-D7 — Bot: memory system (decay, confidence, danger zones)

| Параметр | Значение |
|----------|----------|
| **Что делает** | Bot memory с decay (30/60/120s по difficulty), confidence rating, danger zones (где потерял юнитов). lastSeenPosition, lastSeenTime для каждого player объекта |
| **Что улучшает** | Бот «забывает» старую информацию — как реальный игрок. Устаревшая разведка = менее уверенные решения |
| **Сложность** | medium |
| **Риск** | medium — memory integration |
| **Зависимости** | PATCH-GLM-D6 (state machine) — желательно |
| **Файлы** | `src/main.js` (bot memory section) |
| **Проверка** | Bot помнит lastSeenPosition 60s → decay → confidence падает |
| **Секция FUTURE_VISION** | §9.3 «Bot memory» |

### PATCH-GLM-D8 — Fog of war ghost positions

| Параметр | Значение |
|----------|----------|
| **Что делает** | Показывает ghost-иконку юнита, который был виден, но ушёл в fog. Через 15 сек ghost исчезает |
| **Что улучшает** | Игрок получает информацию о последней видимой позиции врага без omniscience. Стандартная RTS-механика |
| **Сложность** | medium |
| **Риск** | low — визуальный overlay |
| **Зависимости** | Fog of War system (стабильна) |
| **Файлы** | `src/main.js` (fog/render sections) |
| **Проверка** | Вражеский юнит уходит в fog → ghost на 15 сек → исчезает |
| **Секция FUTURE_VISION** | §3.7 «Fog of war — Quick win: Призраки» |

### PATCH-GLM-D9 — Tutorial / onboarding

| Параметр | Значение |
|----------|----------|
| **Что делает** | Пошаговый tutorial: выбор фракции → стартовые юниты → отправить harvester → построить separator → построить factory → произвести scout → найти врага → атаковать |
| **Что улучшает** | New players не бросают игру через 2 минуты — понимают, что делать |
| **Сложность** | medium |
| **Риск** | low — отдельный режим |
| **Зависимости** | Стабильный core loop |
| **Файлы** | `src/main.js`, `index.html` |
| **Проверка** | New player проходит tutorial → понимает основные механики |
| **Секция FUTURE_VISION** | §11.8 «Tutorial / onboarding» |

### PATCH-GLM-D10 — Bot: personality profiles (Aggressive / Economic / Defensive / Scout-heavy)

| Параметр | Значение |
|----------|----------|
| **Что делает** | 4 personality: Aggressive (ранний rush), Economic (фокус economy, поздняя армия), Defensive (оборона, counter-attacks), Scout-heavy (постоянная разведка, surgical strikes). Yellow = aggressive default, Green = defensive, Cyan = economic, Purple = scout-heavy |
| **Что улучшает** | Каждая партия уникальна — бот играет по-разному в зависимости от фракции/настроения. Replayability |
| **Сложность** | medium |
| **Риск** | medium — баланс personalites |
| **Зависимости** | PATCH-GLM-D6 (state machine) |
| **Файлы** | `src/main.js` (bot personality section) |
| **Проверка** | Aggressive бот атакует рано, Defensive бот обороняется |
| **Секция FUTURE_VISION** | §9.9 «Bot personality» |

---

## Phase 4: Long-term (3+ месяца)

> Цель: Проект выходит за рамки basic skirmish — multiplayer, engine, campaign.
> Высокая сложность, высокий риск. Требует отдельного planning перед стартом.

### Кандидаты (не патчи — направления)

| Направление | Сложность | Когда | Почему |
|-------------|-----------|-------|--------|
| Bomber implementation | medium | После defense tower | Воздушный юнит, anti-building, нужен AA counter |
| Faction unique units (Assault Buggy, Economic Drone) | medium | После faction asymmetry v1 | Каждая фракция = уникальный юнит |
| Faction unique buildings (Sensor Tower, Fortification Wall) | medium | После faction asymmetry v1 | Каждая фракция = уникальное здание |
| Observation towers (neutral objectives) | medium | После map improvements | Xel'Naga Tower аналог |
| Bot expansion logic | high | После state machine | Бот строит 2-ю базу |
| Extract economy.js (Refactor Phase 3) | medium | После Phase 1-2 refactor | Core gameplay extraction |
| Extract combat.js (Refactor Phase 3) | medium | После heavy_tank defense tower | Combat system extraction |
| Extract enemy_bot.js (Refactor Phase 4) | high | После bot state machine | Самый сложный модуль |
| Map events (sandstorm, mineral surge) | medium | После stable core | Dynamic gameplay |
| Attack animation projectile | medium | После muzzle flash | Полноценный projectile |
| PvE leaderboard (Firebase) | medium | Когда нужен backend | Score system |
| Engine migration (PixiJS) | high | Если FPS проблемы | GPU rendering |
| Real-time multiplayer | very high | 6+ месяцев | Полная перестройка |
| Campaign scenarios | high | 6+ месяцев | Content + scripting |
| Godot migration | very high | Если проект «серьёзный» | Complete rewrite |

---

## Зависимости между патчами

```
Phase 0 (Quick Wins):
  Q1 (try/catch) ─── independent
  Q2 (10F1B) ─────── depends: 10F1 installed
  Q3 (10H1B) ─────── depends: 10H1 installed
  Q4 (10I1B) ─────── depends: 10I1 installed
  Q5 (muzzle flash) ─ independent
  Q6 (damage flash) ─ independent (parallel with Q5)
  Q7 (dedup) ──────── independent

Phase 1 (Stabilization):
  S1 (bot scout) ──── depends: SCOUT-01/02, 10C1/10G1
  S2 (bot produce) ── depends: S1
  S3 (bot intel) ──── depends: S2
  S4 (coordinates) ── independent
  S5 (constants) ──── independent (parallel with S4)
  S6 (hotkeys) ────── independent
  S7 (production UI)─ independent

Phase 2 (Expansion):
  E1 (heavy_tank) ─── depends: light_tank combat works
  E2 (defense tower)─ depends: builder state machine
  E3 (minimap) ────── independent
  E4 (tech tree) ──── depends: HQ panel
  E5 (explosion) ──── depends: Q5/Q6 (optional)
  E6 (save slots) ─── independent
  E7 (mapgen) ─────── depends: S4/S5 (optional)
  E8 (dead code) ──── independent
  E9 (idle worker) ── independent
  E10 (hard bot) ──── depends: Q4, 10I1

Phase 3 (Deepening):
  D1 (factions) ───── independent
  D2 (choke points)─ depends: E7 (optional)
  D3 (center ring) ── depends: D2
  D4 (expansion) ──── depends: D2/D3
  D5 (seeded PRNG) ── depends: E7 (optional)
  D6 (bot SM) ─────── depends: S3, Q2/Q3/Q4
  D7 (bot memory) ─── depends: D6
  D8 (fog ghosts) ─── independent
  D9 (tutorial) ───── depends: stable core
  D10 (bot persona)── depends: D6
```

---

## Приоритизация внутри фаз

### Принцип: «что даёт наибольший impact при наименьшем риске»

**Phase 0 порядок выполнения:**
1. Q1 (try/catch) — 5 минут, спасает от крашей → ПЕРВЫМ
2. Q5 (muzzle flash) — самый большой UX-impact → ВТОРЫМ
3. Q6 (damage flash) — дополняет Q5 → ТРЕТЬИМ
4. Q2/Q3/Q4 (bot tuning) — делает бота играбельным → 4-6
5. Q7 (dedup) — уменьшает баг-поверхность → ПОСЛЕДНИМ в Phase 0

**Phase 1 порядок:**
1. S4/S5 (coordinates + constants) — основа для refactor → ПЕРВЫМИ
2. S7 (production UI) — quick UI win → ТРЕТЬИМ
3. S6 (hotkeys) — стандарт RTS control → ЧЕТВЁРТЫМ
4. S1/S2/S3 (bot scout chain) — важная но сложная → 5-7

**Phase 2 порядок:**
1. E8 (dead code) — лёгкий, сразу → ПЕРВЫМ
2. E6 (save slots) — лёгкий → ВТОРЫМ
3. E1 (heavy_tank) — второй боевой юнит → ТРЕТЬИМ
4. E2 (defense tower) → ЧЕТВЁРТЫМ
5. E4 (tech tree) → ПЯТЫМ
6. E3 (minimap) → ШЕСТЫМ
7. E7 (mapgen extract) → СЕДЬМЫМ
8. E5/E9/E10 — остаток

---

## Метрики успеха

### После Phase 0:
- [ ] Бот атакует даже с пустым knowledge
- [ ] Бот не убегает при потере 1 танка
- [ ] Easy бот атакует в течение 3 минут
- [ ] При атаке видна вспышка (muzzle flash)
- [ ] При уроне видна красная вспышка (damage flash)
- [ ] Игра не крашится при runtime ошибке
- [ ] 500 строк дублированного кода удалено

### После Phase 1:
- [ ] Bot производит и использует scout
- [ ] Bot intel loop работает: scout→knowledge→decision
- [ ] coordinates.js и constants.js вынесены из main.js
- [ ] Hotkeys S/B/F работают
- [ ] Production queue видна в UI

### После Phase 2:
- [ ] Heavy_tank атакует buildings и units
- [ ] Defense tower автоматически атакует enemies
- [ ] Minimap показывает карту, территорию, юнитов
- [ ] 5 tech tree upgrades доступны и работают
- [ ] 3 save slots работают
- [ ] mapgen.js вынесен из main.js
- [ ] unit_controller.js удалён

### После Phase 3:
- [ ] Фракции играют по-разному (+20% бонусы)
- [ ] Карта имеет choke points и contestable center
- [ ] Bot использует полноценную state machine
- [ ] Bot memory с decay и confidence
- [ ] Fog of war показывает ghost positions
- [ ] Tutorial проведает new player через basics
- [ ] Bot personalities делают каждую партию уникальной

---

## Риски и митигация

| Риск | Вероятность | Impact | Митигация |
|------|-------------|--------|-----------|
| Bot tuning ломает существующее поведение | medium | high | Telemetry до и после, manual smoke |
| Heavy_tank combat баланс сломан | medium | medium | Config knobs, easy to tune |
| Refactor extraction ломает runtime | low | high | Phase 1 first (pure functions), `node --check`, Playwright |
| Faction bonuses дисбаланс | low | medium | +20% максимум, можно откатить |
| Bot state machine слишком сложная | medium | medium | Incremental, каждый state = отдельный patch |
| Minimap performance | low | low | Separate canvas, low FPS OK |
| Feature creep | high | high | Строгий phase-gating, «лучше 5 систем на 100% чем 15 на 80%» |

---

## Что НЕ делать (красные флаги)

1. ❌ Multiplayer до stable PvE
2. ❌ Engine migration до FPS проблем
3. ❌ Большой refactor одним PR
4. ❌ Cheating AI (bonus resources, omniscient knowledge)
5. ❌ Новые юниты без чётких ролей
6. ❌ Сложная tech tree до простой (5 flat upgrades first)
7. ❌ Фракционная асимметрия > +30% до тестирования +20%
8. ❌ Campaign до tutorial и stable core
9. ❌ 4-player FFA до multi-owner refactor
10. ❌ Real-time multiplayer раньше чем через 6 месяцев

---

*Роадмап основан на стратегическом обзоре GLM_FUTURE_VISION_HYPOTHESES_20260510.md. Каждая идея требует отдельного обсуждения и design doc перед реализацией.*
