# GLM Strategy Review — Four Elements Remake

**Дата:** 2026-05-10
**Тип:** Стратегический аудит проекта
**Ветка:** sandbox/main (Fast lane — docs only)
**Автор:** GLM

---

## 1. Executive Summary

### Что уже сильное

Проект уже преодолел самую сложную фазу браузерной RTS — **минимальная играбельная партия 1×1 работает**. Бот может строить экономику (harvesters → separator → energy + elements → factory → light_tank), защищать базу, разведывать, оценивать силу армии, отступать при проигрыше, и атаковать по разведданным. Это редкий результат для браузерной RTS, где большинство проектов застревают на этапе «юниты ездят по карте». Экономическая петля (raw minerals → separator → energy + faction element → buildings/units) цельная и логичная, без «магических» спавнов. Система фракций (4 фракции с уникальными бонусами) заложена, хотя бонусы пока численно близки. Изометрический рендер на Canvas работает стабильно, а Playwright-тесты дают хотя бы базовую безопасность.

### Главный технический риск

**12 128 строк монолита `src/main.js`**. Это единственный файл, содержащий ВСЁ: генерацию карты, движение юнитов, боевую систему, экономику, AI бота, туман войны, рендеринг, UI, сохранения, debug-инструменты. Файл вырос органически через патчи (08B, 09C, 10F1, 10G1…), каждый из которых оставил свою копию `getGameObject()`, `isEnemyUnit()`, `distTiles()`, `getEnemyHQ()` — минимум 7× дублирование helper-функций. Один неудачный патч в этом монолите ломает всё. Нет try/catch в game loop — одна ошибка крашит игру. Нет модульности — невозможно тестировать отдельную систему изолированно.

### Куда логичнее развивать в ближайшие 1–2 месяца

**Стабилизация текущего gameplay loop** — не добавлять новые системы, а отшлифовать те, что уже работают. Приоритеты: (1) bot AI tuning (известные проблемы: слишком пассивный на easy, слишком осторожный retreat, пустой knowledge блокирует атаку); (2) экономический баланс (separator 15→10+1 — работает, но отсутствует экономический pressure: нет способа потратить избыток энергии в late-game); (3) боевой feedback (нет анимации атаки, нет звука, нет визуального индикатора урона — игрок не понимает, что происходит в бою); (4) UI/UX полировка (minimap, hotkeys, production queue display).

### Что лучше отложить

**Multiplayer**, **миграция на движок** (PixiJS/Phaser/Godot), **полный refactor main.js одним PR**, **4-player FFA**, **сложный AI до стабилизации economy/combat**, **новые ассеты без pipeline**. Все эти направления интересны, но каждое из них — месяцы работы, которые заморозят развитие gameplay.

---

## 2. Current Project State

### Что уже реализовано (подтверждено из кода/docs)

| Система | Статус | Детали |
|---------|--------|--------|
| Изометрический Canvas-рендер | ✅ Работает | 8-direction sprites, depth sorting, camera WASD + zoom |
| Генерация карты | ✅ Работает | Spawn-relative resources, obstacles, center infinite mine |
| Экономика | ✅ Работает | raw → separator (15→10 energy + 1 element) → buildings/units |
| Строительство зданий | ✅ Работает | Builder state machine, build cost, cancel/refund 75% |
| Производство юнитов | ✅ Работает | Factory queue (max 2), civilian/combat speed, power gating |
| Territory | ✅ Работает | Slow spread from buildings (1 cell/15s), radius 5 |
| Fog of War | ✅ Работает | Unit/building/territory vision, explored/visible layers |
| Combat (light_tank) | ✅ Работает | Attack approach → attack cycle, damage/destroy |
| Enemy bot AI | ✅ Работает | Phase bot + 7 subsystems: vision, scouting, autopilot, strength, targeting, retreat, difficulty |
| Scout unit (player) | ✅ Работает | Shell + factory production, speed 0.72, view 7, canAttack:false |
| Save/Load | ✅ Работает | localStorage, single slot, auto-save every 45s |
| Power grid | ✅ Работает | HQ 10MW + Power Plant 20MW, buildings pause if underpowered |
| Playwright tests | ✅ Работают | Smoke, bot AI behavior, bot AI smoke, menu flow |
| GitHub Pages demo | ✅ Работает | Live demo с .nojekyll |
| Фракции | ✅ Работают | Cyan/green/yellow/purple с бонусами |

### Что выглядит MVP

- **Bot AI**: Phase bot работает, но tuning неизвестен (10F1/10G1/10H1/10I1 pending manual smoke). Нет «hard» difficulty. Нет production manager. Economy brain отложен.
- **Combat**: Только light_tank атакует. Нет attack animation, нет projectile, нет damage indicator. Heavy_tank и bomber — shell только (config есть, визуал 56×56 placeholder).
- **Economy**: Separator formula работает, но нет способа тратить избыток энергии. Нет upgrades. Нет tech tree. Elements фракций используются только для производства юнитов — нет альтернативных sink'ов.
- **UI**: HUD показывает ресурсы, но нет minimap, нет production queue display, нет hotkey hints, нет tooltips.

### Что выглядит временным/патчевым

- **7× дублированные helper-функции** в bot AI (`getGameObject`, `isEnemyUnit`, `distTiles`, `getEnemyHQ` — каждая скопирована 4-7 раз с разными префиксами `FE_10C1_`, `FE_10D1_`, `FE_10E1_`, `FE_10F1_`, `FE_10H1_`)
- **Dead code после `return`** в 4+ функциях (setLightTankAttack, spawnLightTankForOwner и др.)
- **Hardcoded константы** вместо config: separator formula (15, 10, 1), cycle time (6.0s), territory spread interval (15s), auto-save interval (45s), HQ HP (1000), building HP (320)
- **unit_controller.js** — 879 строк полностью мёртвого кода (FE_UNIT_CONTROLLER_ENABLED = false), дублирующего builder/harvester state machines из main.js
- **`applyTestBuildingCostsX10()`** — disabled, но код остался
- **Cache-busting** через query strings в asset_loader.js — ручной, нестабильный

### Где главный технический долг

1. **main.js монолит (12 128 строк)** — все системы в одном IIFE, нет модульности, нет dependency injection
2. **7× дублирование helpers** в bot AI (~500 строк лишнего кода)
3. **Нет try/catch в game loop** — одна ошибка = краш всей игры
4. **unit_controller.js = 879 строк dead code** — если включить, будет конфликт с main.js
5. **Нет unit-тестов** — только E2E Playwright, которые не покрывают корректность логики
6. **Fog of War O(mapW×mapH) каждый кадр** — full reset + per-entity reveal; при 4-player карте будет bottleneck
7. **BFS pathfinding** — без A*, без weighted costs, нет diagonal movement; при 48×48 карте ещё терпимо, при 96×96 будет тормозить
8. **Нет error handling** в asset loading, DOM operations, localStorage operations

### Ограничения текущего browser/canvas/main.js подхода

- **Нет Web Workers** — весь game loop в главном потоке, pathfinding и AI делят time budget с рендерингом
- **Canvas 2D** — нет GPU-accelerated sprite batching, нет instanced rendering; при 200+ юнитов начнутся проблемы
- **Нет модульной системы** — IIFE + window globals, нет ES modules, нет tree-shaking
- **localStorage = единственный storage** — 5-10MB лимит, нет версионности, нет compression
- **GitHub Pages = статика** — нет сервера, нет WebSocket, нет leaderboard
- **Один HTML файл** — весь UI в index.html (1700+ строк), весь game logic в main.js (12 128 строк)

---

## 3. Map Generation Ideas

### 3.1 Стартовая зона: улучшенный безопасный коридор

**Идея:** Каждый игрок начинает в защищённом «кармане» — узком проходе к центру карты, закрытом горами с 2-3 сторон. Аналог StarCraft: стартовые позиции на противоположных концах с choke points. Сейчас стартовые зоны — это просто радиус 9 клеток без препятствий, но нет намеренного создания ключевых проходов.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Стратегические choke points для обороны; ранний game более предсказуем; различие между «защищённым» и «открытым» стартом |
| Сложность | medium |
| Риск | medium — может сделать некоторые старты слишком лёгкими для обороны |
| Текущая архитектура | Можно добавить в `generateMap()` — новый pattern для стартовых зон |

### 3.2 Центр карты: contested resource + terrain feature

**Идея:** Центральная infinite mine уже есть, но нет центрального terrain feature. В StarCraft центр карты — это «часовня» или мост. В Warcraft — мост через реку. Предложение: окружить infinite mine горами, создав единственный проход (choke point). Это делает центр高风险/высокоприбыльной зоной — аналогично gold expansion в StarCraft.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Контроль центра = экономическое преимущество; strategic decision: закрепиться в центре или фокусироваться на базе |
| Сложность | medium |
| Риск | low — additive, не ломает текущую генерацию |
| Текущая архитектура | Добавить mountain ring вокруг center infinite mine в `generateMap()` |

### 3.3 Ресурсы: стратегическое размещение

**Идея:** Сейчас ресурсы генерируются spawn-relative patterns — это хорошо. Но нет концепции «экспансии» (expansion). В StarCraft/Warcraft игрок должен строить базы возле минералов. Предложение: создать 2-3 «экспансионных» кластера (medium + small mines) на середине пути между стартом и центром. Каждый кластер окружён 1-2 клетками свободного пространства для застройки.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Решение: сидеть на базе или расширяться; риск/награда; contestable ресурсы |
| Сложность | low — очередной pattern в `generateResourceClusters()` |
| Риск | low — additive |
| Текущая архитектура | Добавить `EXPANSION_FIELD_PATTERN` между starter и neutral |

### 3.4 Препятствия: биомы вместо случайных гор

**Идея:** Сейчас obstacles — это mountains/volcanoes/rocks с band-based distribution. Предложение: ввести биомы — зоны карты с визуальным и gameplay-стилем. Например: «пустыня» (sand bumps, dry bushes, speed bonus), «вулканическая зона» (volcanoes, lava, damage over time), «горный хребет» (choke points, narrow passages). Каждый биом влияет на gameplay.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Визуальное разнообразие; tactical decisions на основе terrain; уникальные зоны для контроля |
| Сложность | high |
| Риск | medium — может нарушить баланс |
| Текущая архитектура | Требует расширения terrain system (сейчас terrain = shade только) |

### 3.5 Баланс minerals: small/medium/large/infinite

**Идея:** Сейчас 4 типа минералов: small (8 remaining, yield 10), medium (25), large (50), infinite. Проблема: yield всегда 10, отличие только в remaining. В StarCraft minerals = 1500 per patch, но есть vespene geysers (отдельный тип ресурса). Предложение: ввести «богатые» минералы с yield 15-20, но быстрее истощаемые. Это создаёт risk/reward: быстрая добыча сейчас vs. долгосрочная стабильность.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Интересные решения: богатый but fragile vs. стабильный but медленный |
| Сложность | low — добавить `yieldMultiplier` в `FE_MINE_TYPES` |
| Риск | low — additive |
| Текущая архитектура | `harvester cargo` уже зависит от `yield` поля в mine |

### 3.6 Генерация интересных маршрутов

**Идея:** Сейчас препятствия генерируются band-based (mountains at edges, volcanoes mid-ring). Предложение: намеренное создание «дорог» — коридоров между горами, которые создают альтернативные пути к врагу. Аналог: bridges в Warcraft, ramps в StarCraft. Это особенно важно для PvP: один путь = слишком предсказуемо.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Flanking opportunities; multiple attack vectors; scouting decisions |
| Сложность | medium |
| Риск | medium — может случайно заблокировать путь |
| Текущая архитектура | Требует path validation после размещения obstacles |

### 3.7 Разведка карты: observation points

**Идея:** Разместить на карте 3-5 «observation points» — возвышенностей, дающих увеличенный радиус обзора (view +3) любому юниту на них. В StarCraft аналог — Xel'Naga towers (Heart of the Swarm). Это создаёт contestable map objectives даже без combat.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Контроль информации = advantage; scout rush к observation point; contestable neutral objectives |
| Сложность | medium — требует нового terrain type + vision logic |
| Риск | low — additive, не ломает текущий fog system |
| Текущая архитектура | Можно реализовать через special tile в `game.terrain[][]`, который проверяется в `updateFog()` |

### 3.8 Replayability

**Идея:** Поддержка seeded random generation. Сейчас `generateMap()` вызывается без seed — каждая новая игра уникальна, но нельзя воспроизвести конкретную карту. Предложение: добавить опциональный `mapSeed` в `startNewGame()`, сохранить его в save, и использовать для воспроизведения. Также: «карта дня» — фиксированный seed для всех игроков.

| Аспект | Значение |
|--------|----------|
| Эффект для игрока | Воспроизводимые карты для fair play; карта дня для community; возможность делиться интересными картами |
| Сложность | medium — требует seeded PRNG |
| Риск | low — additive |
| Текущая архитектура | Заменить `Math.random()` в `generateMap()` на seeded PRNG |

---

## 4. Unit Animation and Visual Feedback Ideas

### 4.1 Idle / Movement / Attack анимации

**Текущее состояние:** Все юниты используют idle-only sprites. Move frames = idle (копия). Нет attack animation для light_tank. Нет harvest animation для harvester. Нет build animation для builder.

**Предложения:**

| Анимация | Юнит | Эффект | Сложность | Риск |
|----------|------|--------|-----------|------|
| Movement bounce/wheel rotation | Все vehicles | Чувство движения, «живость» | medium (sprite pipeline) | low — additive |
| Attack recoil + muzzle flash | light_tank, heavy_tank | Игрок видит, что танк стреляет | medium | low — overlay sprite |
| Harvest drill/scoop cycle | harvester | Понятно, что harvester работает | medium | low |
| Build hammer/weld cycle | builder | Понятно, что строитель строит | medium | low |
| Scout antenna rotation | scout | «Сканирует» территорию — визуальный storytelling | low | low |

**Важно:** Стоящие юниты не должны дёргаться. Idle animation должна быть subtle: лёгкое покачивание (sway) для наземных юнитов, вращение антенны для scout, пульсация света для зданий. Не bouncing, не shaking.

### 4.2 Dust / trail particles

**Текущее состояние:** Dust particles реализованы для builder, harvester, light_tank, scout. Настроены через `FE_*_DUST_*` flags. Работают корректно.

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Track marks на песке | Визуальная история движения; tactical info (видно, где ездил враг) | medium | low |
| Engine exhaust для heavy_tank | Различие юнитов по visual signature | low | low |
| Explosion particles при destroy unit | Удовлетворительный feedback уничтожения | medium | low |
| Building construction dust cloud | Понятно, что стройка идёт | low | low |

### 4.3 Selection ring improvements

**Текущее состояние:** Selection ring работает, настраивается через `ringTuneByType`. Scout ring откалиброван вручную (y:-28).

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Animated pulse при выделении | «Живой» feedback выбора | low | low |
| Color coding: green (full HP) → yellow → red | Быстрая оценка состояния без взгляда на HP bar | low | low |
| Multi-select brackets вместо rings | Стандарт RTS для group selection | medium | low |

### 4.4 HP bars improvements

**Текущее состояние:** HP bar рисуется над юнитом. Position зависит от типа.

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Damage flash (красная вспышка при получении урона) | Игрок видит, что юнит под атакой, даже если не смотрит на HP bar | low | low |
| HP number overlay при выбранном юните | Точная информация | low | low |
| Shield bar для future shielded units | Расширяемость | medium | low |

### 4.5 Click markers / command feedback

**Текущее состояние:** `FE_UNIT_CLICK_MARKER` работает — маленький ground marker на move command.

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Different markers для move / attack / attack-move | Игрок понимает тип приказа | low | low |
| Attack target line (unit → target) | Понятно, кого атакует юнит | medium | low |
| Rally point visual для factory | Понятно, куда будут выходить юниты | low | low |

### 4.6 Unit state feedback

**Текущее состояние:** Почти нет. Единственный feedback — HP bar + selection ring. Нет индикации: harvesting, building, attacking, idle, moving.

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Status icon над юнитом (⚙ building, ⛏ harvesting, ⚔ attacking) | Быстрая оценка state всех юнитов | medium | low |
| Progress bar для harvester cargo | Понятно, насколько полон груз | low | low |
| Building progress bar над incomplete buildings | Понятно, сколько осталось | low — уже есть progress в data | low |

### 4.7 Future sprite pipeline

**Текущее состояние:** Ручной pipeline: концепт → Blender render → PNG export → manual placement в assets/. Scout buggy прошёл через этот pipeline успешно.

**Предложения:**

| Идея | Эффект | Сложность | Риск |
|------|--------|-----------|------|
| Автоматизированный render script (Blender Python) | Ускорение создания спрайтов для новых юнитов | medium | low |
| Faction color swap через shader/config вместо per-faction render | Один рендер вместо 4-х; мгновенное добавление фракций | medium | medium — может потребовать WebGL |
| Sprite atlas (spritesheet) вместо individual PNGs | Меньше HTTP requests, быстрее загрузка | medium | low |

---

## 5. Economy Ideas

### 5.1 Текущая экономика: анализ

**Подтверждено из кода:**

```
Raw minerals (mines) → Harvester harvests (cargo 10) → Returns to HQ → Unloads
game.resources.minerals += cargo (10 per trip)

game.resources.minerals (15 per cycle) → Separator (6s cycle, powered 4MW)
→ game.resources.energy += 10
→ game.resources[element_key] += 1

game.resources[element_key] → Units Factory (powered 5MW)
→ Produces units: builder(1), harvester(1), scout(1), light_tank(2), heavy_tank(4), bomber(6)

Energy → Building construction (30-55 per building)
```

**Проблемы текущей экономики:**
1. **Нет energy sink в late-game** — после строительства всех зданий энергия копится бесконечно
2. **Elements используются только для юнитов** — нет альтернативных расходов
3. **Storage caps тривиальны** — легко обойти постройкой складов
4. **Нет экономического pressure** — невозможно «задушить» врага экономически
5. **Harvester state machine не оптимальна** — иногда idle, когда рядом есть минералы
6. **Power grid простейший** — нет penalties за превышение, просто пауза зданий

### 5.2 Quick wins (low effort, high impact)

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Element cost для upgrades | Sink для elements в late-game | low | high |
| Energy upkeep для зданий | Energy sink; экономический pressure | low | high |
| Harvester auto-assign при idle | Меньше micro-management | low | high |
| Building power consumption display | Игрок понимает, почему здания не работают | low | high |
| Resource change indicators (+10, -2) | Feedback на экономические изменения | low | medium |

### 5.3 Medium-term systems

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Tech tree / upgrades | Sink для elements + energy; progression | medium | high |
| Energy reactor (advanced power) | Более мощный power source; late-game building | medium | medium |
| Trade route / market | Альтернативный способ конвертации ресурсов | medium | low |
| Resource depletion = strategic pressure | Finite mines заставляют расширяться | medium | high |
| Building damage reduces efficiency | Экономический ущерб от атаки | medium | medium |
| Repair cost (energy) для повреждённых зданий | Sink + tactical decision | medium | medium |

### 5.4 Late-game ideas

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Super unit (6 elements = bomber, но реальный) | Climactic late-game unit | high | medium |
| Faction-specific ultimate ability | Уникальность фракций; late-game power spike | high | medium |
| Nuclear/elemental strike | Game-ending ability; asymmetric victory condition | high | low |
| Economic victory condition | Альтернатива combat victory | high | low |

### 5.5 Роль каждого ресурса

| Ресурс | Текущая роль | Предлагаемая роль |
|--------|---------------|-------------------|
| Raw minerals (сырьё) | Вход в separator | То же + истощение = pressure к расширению |
| Energy | Строительство зданий | Строительство + upkeep + upgrades + repair |
| Elements (фракционные) | Производство юнитов | Юниты + upgrades + faction abilities |
| Power (электричество) | Gate для separator/factory | Upkeep система: больше зданий = нужно больше power |

---

## 6. Factions and Asymmetry

### 6.1 Текущие фракции (подтверждено из factions.js)

| Фракция | Бонус | Численно |
|---------|-------|----------|
| Cyan (Голубые) | +10% civilian production speed | civilianProductionSpeed: 1.10 |
| Green (Зелёные) | +10% build speed | buildSpeed: 1.10 |
| Yellow (Жёлтые) | +10% combat production speed | combatProductionSpeed: 1.10 |
| Purple (Фиолетовые) | Territory view bonus | territoryViewBonus: 1 |

**Проблема:** Бонусы численно близки (+10% — почти незаметно). Purple bonus радикально отличается (информация vs. скорость). Нет уникальных юнитов, технологий или стилей игры.

### 6.2 Предложения по развитию асимметрии

#### Cyan — «Экономическая фракция»

- **Усиление текущего бонуса:** civilianProductionSpeed 1.10 → 1.20 (заметно)
- **Уникальная способность:** Separator +20% output (15 raw → 12 energy + 1.2 elements → округляется до 12/1)
- **Уникальный юнит:** Economic drone — дешёвый (0.5 element), медленный, cargo 5, но можно производить 2 за раз
- **Стиль игры:** Быстрая экономика, больше юнитов, но каждый слабее
- **Риск дисбаланса:** Нет — компенсируется слабым combat bonus

#### Green — «Строительная фракция»

- **Усиление текущего бонуса:** buildSpeed 1.10 → 1.25
- **Уникальная способность:** Builder может строить 2 здания одновременно
- **Уникальный юнит:** Fortification wall (1×3, HP 200, блокирует movement)
- **Стиль игры:** Оборонительная, территориальная, bunker down
- **Риск дисбаланса:** Medium — wall может сделать базу неуязвимой; нужен counter

#### Yellow — «Военная фракция»

- **Усиление текущего бонуса:** combatProductionSpeed 1.10 → 1.20
- **Уникальная способность:** Light tank +10% damage
- **Уникальный юнит:** Assault buggy — fast attack unit, light damage, canAttack:true, HP 50, speed 0.65
- **Стиль игры:** Агрессивная, rush-oriented, ранний pressure
- **Риск дисбаланса:** Medium — rush может быть uncounterable на small maps

#### Purple — «Информационная фракция»

- **Усиление текущего бонуса:** territoryViewBonus: 1 → 2 (+1 к радиусу обзора территории)
- **Уникальная способность:** Scout production speed +30%
- **Уникальный юнит:** Sensor tower — stationary building, view radius 10, reveals area permanently
- **Стиль игры:** Разведка, предвидение, surgical strikes
- **Риск дисбаланса:** Low — информация не даёт прямого боевого преимущества

### 6.3 Random faction

**Нужна ли?** Да, для skirmish mode. В StarCraft/Warcraft random selection — стандарт.

**Риски:**
- Если фракции слишком асимметричные, random = huge variance в game outcome
- Нужна компенсация: random bonus (+5% ко всему?) или чисто random без бонуса

**Предложение:** Random faction = случайный выбор из 4 при старте + скрытая до первого действия. Без дополнительного бонуса — честный random.

**Балансировка:** Тестировать каждую фракцию 1v1 mirror и cross-faction. Цель: 45-55% win rate на mirror, 40-60% на cross.

---

## 7. Combat System Ideas

### 7.1 Текущая боевая система (подтверждено из кода)

```
light_tank combat:
- attack_approach: BFS к клетке в пределах range
- attacking: damage cycle с cooldown
- damage: instant, no projectile, no animation
- damageUnit() → destroyUnit() at 0 HP
- Building attack: analog to unit attack
- Victory: destroy enemy HQ
```

**Проблемы:**
1. Только light_tank атакует — heavy_tank и bomber = placeholder
2. Нет визуального feedback атаки (нет muzzle flash, нет projectile)
3. Нет damage indicator на целевой юните
4. Нет target priority — юнит атакует то, на что нажали
5. Нет armor system — все получают одинаковый урон
6. Нет attack-move для группы (есть individual, но не group)
7. Нет focus fire control
8. Нет retreat из боя (только cancel attack order)

### 7.2 MVP combat improvements

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Attack animation (muzzle flash overlay) | Игрок видит, что танк стреляет | low | high |
| Damage flash на цели | Понятно, что урон наносится | low | high |
| Heavy_tank attack logic | Второй combat unit;慢但 мощный | medium | high |
| Attack-move для группы | Стандарт RTS control | low | high |
| Target priority (auto-target nearest enemy) | Меньше micro; юниты не стоят idle рядом с врагом | medium | high |

### 7.3 Medium-term combat

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Damage types (kinetic, explosive, energy) | Rock-paper-scissors; tactical depth | medium | medium |
| Armor rating + penetration | Heavy_tank tanky vs light weapons | medium | medium |
| Range visualization (attack range circle) | Понятно, достанет ли юнит | low | medium |
| Focus fire (select group → target one enemy) | Эффективнее убивать по одному | medium | medium |
| Retreat from combat (move order cancels attack + moves back) | Сохранение юнитов | low | medium |

### 7.4 Defense tower ideas

**Текущее состояние:** defense_tower в config (costEnergy: 180, buildTime: 30) но **не реализовано** (desc: «Заложена под будущую оборону»).

**Предложения:**

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| HP | 420 | Существенно больше здания, но меньше HQ |
| Attack damage | 8 per shot | Меньше light_tank, но continuous fire |
| Attack range | 7 | Больше light_tank (должен контролировать зону) |
| Attack cooldown | 1.2s | Быстрее light_tank |
| Power consumption | 8 MW | Значительный; не построить много |
| Target priority | Nearest enemy unit | Автоматическая оборона |

### 7.5 Bomber role ideas

**Текущее состояние:** bomber в config (costElement: 6, productionTime: 55, hp: 130, speed: 0.58) но визуал = placeholder 56×56.

**Предложения:**

| Параметр | Значение | Обоснование |
|----------|----------|-------------|
| Role | Air unit; attacks buildings primarily | Диверсификация combat |
| Damage | 40 per bomb (vs buildings), 15 vs units | Anti-building specialist |
| Range | Drops bomb from range 2, then circles | Different from tank combat |
| Speed | 0.58 (faster than tank) | Strike and retreat |
| Vulnerability | No air defense yet → needs counter | Requires defense tower with AA mode |

### 7.6 Fog of war + combat interaction

**Критичная проблема:** Сейчас enemy bot может атаковать цели, которые «видит» через fog (10F1 исправляет это частично). Но player не получает информацию о том, был ли замечен. Предложения:

- **Last-seen markers:** Показывать ghost-иконки юнитов, которые были видны, но ушли в fog
- **Sound cues:** Звук боя рядом, но за fog
- **Minimap indicators:** Красные точки в зоне последней видимости

---

## 8. Enemy Bot / AI Ideas

### 8.1 Текущее состояние бота (подтверждено из кода/docs)

```
Phase bot: defend → prepare_attack → attack → regroup
Subsystems: vision (10B), scouting (10C1), autopilot (10D1), 
            strength estimate (10E1), targeting (10F1), 
            retreat (10H1), difficulty (10I1)
Production: harvesters → separator → energy + elements → factory → light_tank
```

**Известные проблемы:**
- 10F1: Слишком пассивный при пустом knowledge
- 10G1: Переиспользует lastSeen позиции
- 10H1: Слишком defensive retreat
- 10I1: Easy слишком пассивный
- Нет «hard» difficulty
- Нет scout usage (pending PATCH-SCOUT-04/05/06)

### 8.2 Simple scripted bot (MVP — текущий уровень)

Это уже реализовано и работает. Следующий шаг — **tuning**, не rewrite.

**Tuning B-patches (подтверждено из roadmap):**

| Патч | Что исправляет | Сложность |
|------|----------------|-----------|
| 10F1B | Пустой knowledge не должен блокировать атаку полностью; fallback к default behavior | low |
| 10G1B | LastSeen не должен переиспользоваться бесконечно; decay timer | low |
| 10H1B | Retreat не должен быть слишком частым; повысить порог | low |
| 10I1B | Easy не должен быть полностью пассивным; минимальная активность | low |

### 8.3 Rule-based bot (medium-term)

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Build order script (separator → factory → tanks → expansion) | Предсказуемое, но эффективное развитие | medium | high |
| Economy discipline (don't queue if can't afford) | Бот не тратит ресурсы впустую | low | high |
| Adaptive strategy (if player rushes, build defense; if player turtles, expand) | Реакция на действия игрока | high | medium |
| Production priority (tanks > scouts > workers; ratio зависит от phase) | Разумный состав армии | medium | medium |
| Multi-factory coordination | Больше 1 factory = faster production | medium | medium |
| Expansion logic (build second base near expansion minerals) | Late-game economy | high | low |

### 8.4 Advanced AI (long-term)

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| Influence map (spatial evaluation of threat/opportunity) | Понимание карты как целого | high | low |
| Plan-based AI (hierarchical task network) | Стратегическое планирование | very high | low |
| Learning from replays | Адаптация к мета-игре | very high | low |
| Personality profiles (aggressive, defensive, economic, balanced) | Разнообразие opponents | medium | medium |

### 8.5 Fog of war: cheating vs fair AI

**Текущая политика (подтверждено из roadmap PATCH-09C5):** Difficulty = behavior, not resources. Bot must not be omniscient in final gameplay logic.

**Предложение по staged approach:**

| Уровень | Vision | Честность |
|---------|--------|-----------|
| Easy | Видит только то, что видят его юниты/здания | Полностью честный |
| Normal | Видит + short memory (30s после потери визуального контакта) | Почти честный |
| Hard | Видит + long memory (120s) + inference (если видел 2 танка, предполагает 3-й) | Честный с inference |

**Категорически запрещено:**
- Видеть через fog
- Знать точные координаты hidden buildings
- Идеально реагировать на unseen actions
- Получать бонусные ресурсы

### 8.6 Telemetry для debugging

**Текущее состояние:** 6 telemetry objects (`enemyTargetingMvp`, `enemyScoutingMvp`, `enemyAutopilotMvp`, `enemyStrengthEstimateMvp`, `enemyRetreatMvp`, `enemyDifficultyMvp`).

**Предложения:**

| Идея | Зачем | Сложность |
|------|-------|-----------|
| AI decision log (timestamped list of decisions + reasons) | Отладка «почему бот атаковал?» | medium |
| Heatmap overlay (bot's knowledge of map) | Визуализация blind spots | medium |
| Decision tree visualization | Понимание AI logic в реальном времени | high |
| APM counter (bot actions per minute) | Оценка активности AI | low |

### 8.7 Staged MVP approach

```
Stage 1 (current):  Phase bot + economy chain + vision + difficulty ✅
Stage 2 (next):     Bot tuning + scout integration + hard difficulty
Stage 3 (1 month):  Production manager + expansion logic + adaptive strategy
Stage 4 (later):    Influence maps + plan-based AI + multiplayer bot
```

---

## 9. Gameplay Features Missing from Roadmap

| Идея | Зачем игроку | Сложность | Приоритет |
|------|--------------|-----------|-----------|
| **Tech tree / upgrades** | Progression в late-game; sink для resources; каждый game разный | medium | high |
| **Neutral objectives** (observation points, resource caches) | Fight over map control, не только base attack | medium | high |
| **Relics / artifacts** (temporary buffs) | Rewards за exploration; risk/reward | medium | medium |
| **Central resource conflict** (upgradeable infinite mine) | Late-game objective; forces engagement | low | high |
| **Tutorial / onboarding** | Новый игрок понимает, что делать | medium | high |
| **Achievements** (first win, fast win, etc.) | Motivation; replayability | low | medium |
| **Map events** (meteor storm, sandstorm = reduced vision) | Dynamism; unpredictability | high | low |
| **Faction-specific objectives** | Разный game experience для каждой фракции | high | low |
| **Save slots** (3+ instead of 1) | Multiple concurrent games | low | high |
| **Resource change feed** (+10 minerals, -1 element) | Понимание экономики без взгляда на числа | low | high |
| **Auto-repair buildings** (costs energy) | Less micro; buildings slowly heal when powered | low | medium |
| **Unit veterancy** (survived units get +5% stats) | Attachment to units; tactical preservation | medium | low |
| **Queued building placement** (like StarCraft shift-queue) | Less APM needed; smoother build order | medium | medium |

---

## 10. UI / UX Ideas

### 10.1 HUD improvements

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| **Minimap** | Обзор всей карты; quick navigation; enemy tracking | medium | high |
| **Production queue display** | Понятно, что производится и когда | low | high |
| **Resource change indicators** (+10, -2 animated) | Economic feedback | low | high |
| **Selected unit info panel** (stats, state, orders) | Понятно, что делает юнит | low | high |
| **Game clock** | Timing; APM; game duration | low | medium |

### 10.2 Unit command panel

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| **Command card** (move/attack/stop/patrol buttons) | Альтернатива hotkeys; clickable commands | medium | medium |
| **Waypoint display** (shift-queued move orders) | Визуализация planned route | medium | medium |
| **Rally point** для factory | Понятно, куда выходят юниты | low | high |
| **Guard mode toggle** (auto-attack nearby enemies) | Control over unit behavior | medium | medium |

### 10.3 Tooltips and help

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| **Building tooltips** (cost, function, power) | Информация перед строительством | low | high |
| **Unit tooltips** (stats, abilities) | Понимание юнитов | low | high |
| **Hotkey reference** (F1 = help overlay) | Learning curve | low | high |
| **Contextual tips** (e.g., «Build a separator to process minerals») | Onboarding без tutorial | medium | medium |

### 10.4 Hotkeys

| Клавиша | Текущее действие | Предлагаемое дополнение |
|---------|-------------------|------------------------|
| WASD | Camera movement | ✅ Работает |
| A | Attack-move | ✅ Работает |
| Escape | Pause / menu | ✅ Работает |
| F2 | Enemy economy debug | ✅ Работает |
| Space | — | Center on selected unit / last event |
| Tab | — | Toggle minimap size |
| S | — | Stop selected unit |
| Ctrl+1-9 | — | Control group assignment |
| 1-9 | — | Select control group |
| B | — | Open build menu (if builder selected) |
| F | — | Open factory menu (if factory selected) |

### 10.5 Pause / settings

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| **Pause overlay improvement** | Сейчас minimal; нужно meaningful (game state summary) | low | medium |
| **Settings: UI scale** (100/125/150%) | Accessibility | low | medium |
| **Settings: hotkey remapping** | Player preference | medium | low |
| **Settings: audio volume** | When sound is added | low | low |

### 10.6 Save slots

**Текущее:** Single slot, auto-save every 45s.

**Предложение:** 3 manual save slots + 1 auto-save slot. Save screen shows: game time, map size, faction, turn count.

### 10.7 Onboarding / tutorial

| Шаг | Что показывает | Сложность |
|-----|----------------|-----------|
| 1 | «Welcome to Four Elements. Select your faction.» | low |
| 2 | «These are your starting units. Click to select, right-click to move.» | low |
| 3 | «Harvesters gather minerals. Send one to a nearby mine.» | low |
| 4 | «Build a separator to process raw minerals into energy and elements.» | medium |
| 5 | «Build a units factory to produce combat units.» | medium |
| 6 | «Scout the map to find the enemy base.» | low |
| 7 | «Attack the enemy HQ to win!» | low |

### 10.8 Debug/dev overlay separation

**Текущая проблема:** Dev tools (F2 economy panel, F8 snapshot, 0 full reveal, 9 combat overlay) смешаны с player UI.

**Предложение:**
- Все dev tools за `FE_DEV_HOTKEYS_ENABLED = true` gate (уже частично так)
- Dev overlay в отдельном div с другим z-index
- Production build: все dev flags = false, dev code tree-shaken

---

## 11. Architecture and main.js Refactor

### 11.1 Анализ монолита

`src/main.js` = 12 128 строк в одном IIFE. Содержит ~200+ функций, все разделяют closure scope. Нет dependency injection. Нет модульности.

**Распределение по системам (оценка из анализа кода):**

| Система | Строк | % |
|---------|-------|---|
| Bot AI (patches 08B-10I1) | ~2 500 | 21% |
| Builder logic | ~2 000 | 17% |
| Rendering | ~1 300 | 11% |
| Input / selection | ~1 000 | 8% |
| Harvester logic | ~600 | 5% |
| Map generation | ~500 | 4% |
| Economy / production | ~400 | 3% |
| Combat (light_tank) | ~800 | 7% |
| Territory / fog | ~300 | 2% |
| UI / menus | ~400 | 3% |
| Movement / pathfinding | ~500 | 4% |
| Debug / dev tools | ~500 | 4% |
| Constants / state setup | ~300 | 3% |
| Enemy setup / skirmish | ~500 | 4% |
| Other | ~900 | 7% |

### 11.2 Предлагаемые модули и порядок выноса

#### Phase 1: Нулевой риск (pure functions, constants)

| Модуль | Что вынести | Строк | Почему | Риск |
|--------|-------------|-------|--------|------|
| `coordinates.js` | `tileToWorld`, `worldToTile`, `worldToScreen`, `tileToScreen`, `screenToTile`, `clamp`, `dist`, `inBounds` | ~80 | Pure functions, no state | Нет |
| `constants.js` | `TILE_W`, `TILE_H`, `MAP_SIZES`, `BASE_STORAGE`, `FACTION_ELEMENT_KEY`, economy constants, separator formula | ~60 | Config values | Нет |
| `patterns.js` | `SPAWN_STARTER_RESOURCE_PATTERN`, `CENTER_RESOURCE_PATTERN`, all resource patterns | ~150 | Data only | Нет |

#### Phase 2: Низкий риск (runs once, reads game state)

| Модуль | Что вынести | Строк | Почему | Риск |
|--------|-------------|-------|--------|------|
| `mapgen.js` | `makeArrays`, `generateResourceClusters`, `generateMap`, obstacle helpers | ~530 | Runs once at game start | Низкий |
| `debug.js` | `debugLog`, `safeCloneForLog`, `exportDebugLog`, snapshot, enemy economy panel | ~400 | Read-only observer | Низкий |
| `particles.js` | Dust system: `spawnBuilderDust`, `updateBuilderDust`, `drawDustParticles` | ~200 | Self-contained visual | Низкий |

#### Phase 3: Средний риск (core systems, needs careful interface)

| Модуль | Что вынести | Строк | Почему | Риск |
|--------|-------------|-------|--------|------|
| `fog.js` | `updateFog`, `reveal`, `isVisible`, `footprintVisible` | ~130 | Performance-critical, called every frame | Средний |
| `territory.js` | `claimTerritoryCell`, `updateTerritory` | ~100 | Runs periodically, modifies game state | Средний |
| `economy.js` | `getStorageLimits`, `addResource`, `canRunSeparatorCycle`, `updateProduction`, `queueUnitProduction` | ~400 | Core game system | Средний |
| `combat.js` | Light tank combat: `updateLightTankCombat`, `damageUnit`, `destroyUnit`, attack approach | ~800 | Core gameplay | Средний |

#### Phase 4: Высокий риск (deep integration, many dependencies)

| Модуль | Что вынести | Строк | Почему | Риск |
|--------|-------------|-------|--------|------|
| `enemy_bot.js` | All `FE_10*`, `FE_PATCH_08B*`, `FE_PATCH_09*` functions, `updateEnemyBot` | ~2 500 | Largest system, many closure dependencies | Высокий |
| `builder.js` | `updateBuilder`, `orderBuild`, build cost, cancel, resume | ~2 000 | Complex state machine, deep integration | Высокий |
| `harvester.js` | `updateHarvester`, `startHarvester`, `assignNextMine` | ~600 | State machine, less complex than builder | Высокий |
| `movement.js` | `findPath`, `updateUnitMovement`, path recovery | ~500 | Performance-critical, called every frame for every unit | Высокий |

### 11.3 Чего НЕ трогать сразу

- **IIFE wrapper** — не ломать, пока модули не выделены
- **Game loop** (`update(dt)`, `render()`, `loop(now)`) — менять только после всех extraction'ов
- **Input handlers** — слишком много closure dependencies
- **Rendering** — слишком много sprite/asset dependencies; лучше дождаться sprite atlas или WebGL migration

### 11.4 Безопасные PR по одному

1. **PR-1:** Extract `coordinates.js` — pure functions, zero risk
2. **PR-2:** Extract `constants.js` — data only, zero risk
3. **PR-3:** Remove 7× duplicated helpers → single shared module — reduces ~500 lines
4. **PR-4:** Extract `mapgen.js` — runs once, testable in isolation
5. **PR-5:** Extract `debug.js` — read-only, easy to verify
6. **PR-6:** Delete `unit_controller.js` dead code — removes 879 lines of duplication
7. **PR-7:** Remove dead code after `return` statements — removes ~120 lines
8. **PR-8:** Move hardcoded economy constants to config — enables tuning
9. **PR-9:** Add try/catch to `update(dt)` — prevents game loop crash
10. **PR-10:** Extract `particles.js` — self-contained visual system

### 11.5 Как снизить риск регрессий

- Каждый PR = одна цель, одна система
- `node --check` обязателен
- Playwright smoke после каждого PR
- Manual smoke после каждого extraction PR
- Не менять interface одновременно с extraction
- Не рефакторить extracted код в том же PR, что и extraction
- Rollback plan: если что-то ломается, revert конкретного PR

---

## 12. Engine / Platform Future

### 12.1 Оставаться на текущем vanilla JS/Canvas

**Плюсы:**
- Ноль migration risk
- Всё уже работает
- Нет external dependencies
- Полный контроль над рендерингом
- Работает на любом браузере

**Минусы:**
- Нет GPU-accelerated rendering
- Нет sprite batching
- Performance ceiling при 200+ юнитов
- Нет built-in audio/physics/input
- Ручное управление всем

**Когда имеет смысл:** Пока < 100 юнитов на карте и нет проблем с FPS — оставаться.

### 12.2 PixiJS

**Плюсы:** WebGL sprite batching, built-in interaction, filters, mature ecosystem, 2D-focused
**Минусы:** Migration = rewrite всего rendering (2000+ строк), не решает main.js монолит, другой API
**Когда имеет смысл:** Если FPS падает при 100+ спрайтах; когда нужна particle system / filters
**Когда НЕ имеет смысла:** Если текущий Canvas работает; ради «более современного» подхода

### 12.3 Phaser

**Плюсы:** Full game framework (physics, audio, input, scenes, tilemaps), large community
**Минусы:** Migration = complete rewrite (весь main.js + все модули), opinionated architecture, bundle size
**Когда имеет смысл:** Если проект решает «начать заново с лучшей архитектурой»
**Когда НЕ имеет смысла:** Если нужно развивать текущую кодовую базу

### 12.4 Godot

**Плюсы:** Full engine, visual editor, GDScript/C#, export to web, proven for 2D games
**Минусы:** Complete rewrite, different paradigm (scene-based vs. code-only), learning curve, export template size
**Когда имеет смысл:** Если проект превращается в «serious indie game» с командой 2-3 человек
**Когда НЕ имеет смысла:** Пока это one-person browser project

### 12.5 Unity

**Плюсы:** Industry standard, massive ecosystem, WebGL export
**Минусы:** Overkill для 2D isometric browser RTS, massive download, Unity WebGL runtime issues
**Когда имеет смысл:** Никогда для этого проекта. Unity — для 3D/AAA, не для browser 2D RTS.

### 12.6 GitHub Pages как demo

**Текущее состояние:** Работает. Live demo: https://ratoker-jpg.github.io/glm-game-sandbox/

**Плюсы:** Free hosting, automatic deployment, no backend needed
**Минусы:** No server-side, no WebSocket, no leaderboards, 100MB limit, no custom server logic

**Рекомендация:** Оставить GitHub Pages как demo. Не пытаться сделать его «полноценным сайтом».

### 12.7 Отдельный сайт/домен

**Плюсы:** Custom domain, SEO, can add backend later
**Минусы:** Cost, maintenance, SSL, hosting
**Когда имеет смысл:** Если проект получает community и нужен custom URL
**Когда НЕ имеет смысла:** Пока это personal project / demo

### 12.8 Online multiplayer

См. раздел 13.

### Резюме по engine/platform

**Рекомендация:** Оставаться на vanilla JS/Canvas ещё 3-6 месяцев. Если FPS проблемы появятся — мигрировать на PixiJS (наименее болезненный путь). Phaser/Godot = только если проект решает начать заново. Unity = нет.

---

## 13. Online / Multiplayer Possibilities

### 13.1 Real-time multiplayer

**Сложность:** Very high
**Требует:** Backend server, WebSocket, state synchronization, lag compensation, matchmaking
**Проблемы:** RTS + network = hardest genre for multiplayer (StarCraft потратил годы на netcode)
**Вердикт:** Не в ближайший год. Это отдельный проект.

### 13.2 Asynchronous multiplayer

**Идея:** Каждый игрок делает ход, потом gameState отправляется opponent'у (по email/link). Аналог play-by-mail chess.
**Сложность:** Medium — нужен только save/load sharing
**Проблемы:** RTS не работает как turn-based; медленный темп
**Вердикт:** Возможно как эксперимент, но не приоритет

### 13.3 PvE bot-first путь

**Текущее состояние:** Уже реализовано и работает.
**Следующие шаги:** Bot tuning → hard difficulty → multiple bot personalities → campaign scenarios
**Вердикт:** Это правильный путь для проекта. 95% игроков browser RTS играют vs AI.

### 13.4 Local skirmish

**Идея:** 2+ bots на одной карте, игрок vs 1-3 AI opponents. Different start positions.
**Сложность:** Medium — нужен multi-owner system (сейчас player/enemy binary)
**Проблемы:** Territory/fog/resources all assume 2 sides
**Вердикт:** Medium-term. После стабилизации 1v1.

### 13.5 Hosted server / WebSocket backend

**Требует:** Node.js server, WebSocket (socket.io), matchmaking, rooms
**Сложность:** High
**Проблемы:** GitHub Pages не поддерживает server-side; нужен VPS ($5-20/month)
**Вердикт:** Только если проект решает добавить real multiplayer

### 13.6 Firebase / Supabase

**Плюсы:** Real-time database, auth, hosting, free tier
**Минусы:** Vendor lock-in, latency for game state sync, not designed for real-time game loop
**Идея:** Leaderboards + save sharing через Firebase — realistic quick win
**Вердикт:** Leaderboards/save sharing — yes. Real-time game state — no.

### 13.7 GitHub Pages limitations

| Возможно на GitHub Pages | Требует backend |
|--------------------------|-----------------|
| Single-player game | Real-time multiplayer |
| Save/load (localStorage) | Server-side saves |
| Bot AI | Matchmaking |
| Leaderboards (read-only, static) | Dynamic leaderboards |
| Static assets | WebSocket connections |
| Shareable links (with save data in URL hash) | Real-time rooms |

---

## 14. Testing / QA / Tooling

### 14.1 Current test coverage

| Тип | Файл | Покрытие |
|-----|------|----------|
| Smoke | `smoke.spec.js` | Страница грузится, нет ошибок |
| Menu flow | `menu_flow.spec.js` | Click «New Game», нет ошибок |
| New game flow | `new_game_standard_flow.spec.js` | Выбор карты, нет ошибок |
| Bot AI behavior | `bot-ai-behavior-scenario.spec.js` | Bot subsystems init, difficulty switch |
| Bot AI smoke | `bot-ai-smoke.spec.js` | Bot telemetry exists |

**Пробелы:**
- Нет unit-тестов (только E2E)
- Нет тестов для save/load
- Нет тестов для economy
- Нет тестов для combat
- Нет visual regression tests
- Нет performance benchmarks

### 14.2 Proposed test additions

| Идея | Зачем | Сложность | Приоритет |
|------|-------|-----------|-----------|
| **Unit spawn test** (spawn each type, verify stats) | Catch config/data mismatches | low | high |
| **Economy flow test** (harvest → separator → factory → unit) | Catch economy regression | medium | high |
| **Combat outcome test** (tank vs tank, tank vs building) | Catch damage formula bugs | medium | high |
| **Save/load round-trip test** | Catch serialization bugs | medium | high |
| **Bot build order test** (verify bot follows chain) | Catch AI regression | medium | medium |
| **Asset validation test** (all sprites load, correct sizes) | Catch missing assets | low | medium |
| **Performance benchmark** (FPS at 50/100/200 units) | Catch performance regression | medium | medium |
| **Visual regression** (screenshot comparison) | Catch rendering bugs | medium | low |

### 14.3 PR checklist

Для каждого Review lane PR:

```text
□ node --check src/main.js → PASS
□ node --check других изменённых JS → PASS
□ Playwright smoke → PASS
□ Manual smoke (play a game) → PASS
□ PATCH_REPORT.txt updated
□ Roadmap updated (mark done + next)
□ No unintended side effects
□ Git diff reviewed
□ No hardcoded values that should be in config
□ No duplicate code that should use shared helper
```

### 14.4 Regression checklist

После каждого gameplay-изменяющего PR:

```text
□ New game starts correctly
□ Player can select units
□ Player can move units
□ Player can build buildings
□ Player can produce units
□ Player can attack enemies
□ Enemy bot builds economy
□ Enemy bot produces tanks
□ Enemy bot attacks/defends
□ Fog of war works
□ Save/load works
□ Victory/defeat triggers correctly
□ No console errors
□ No visual glitches
```

---

## 15. Recommended Roadmap

### Next 1–2 weeks

| # | Задача | Lane | Сложность | Impact |
|---|--------|------|-----------|--------|
| 1 | PATCH-SCOUT-04: Bot использует scout для разведки | Review | medium | Bot AI improvement |
| 2 | PATCH-10F1B: Fix пустой knowledge → не блокирует атаку полностью | Review | low | Bot tuning |
| 3 | PATCH-10H1B: Fix слишком частый retreat | Review | low | Bot tuning |
| 4 | PATCH-10I1B: Fix Easy слишком пассивный | Review | low | Bot tuning |
| 5 | REFACTOR-01: Extract coordinates.js из main.js | Review | low | Architecture |
| 6 | REFACTOR-02: Удалить 7× дублированные helpers | Review | low | Code quality |
| 7 | PATCH-SCOUT-05: Bot производит 1-2 scout'а | Review | medium | Bot AI improvement |
| 8 | Economy constants → config | Review | low | Maintainability |
| 9 | Add try/catch в update(dt) | Review | low | Stability |
| 10 | Manual smoke всех pending bot patches | — | low | Validation |

### Next 1 month

| # | Блок | Сложность | Цель |
|---|------|-----------|------|
| 1 | Bot AI stabilization (tuning + hard difficulty) | medium | Играбельный bot на всех уровнях |
| 2 | Heavy_tank combat implementation | medium | Второй combat unit |
| 3 | Defense tower implementation | medium | Base defense option |
| 4 | Minimap | medium | Strategic overview |
| 5 | Production queue display | low | UI clarity |
| 6 | Tech tree / upgrades v1 | medium | Late-game progression |
| 7 | Mapgen extraction | low | Architecture improvement |
| 8 | Save slots (3+) | low | Player convenience |
| 9 | Attack animation + damage flash | low | Combat feedback |
| 10 | Hotkey system (Ctrl+1-9 groups, S stop, B build) | medium | APM improvement |

### Later / risky

| Блок | Почему отложить |
|------|-----------------|
| Multiplayer | Требует сервер, netcode, полностью другую архитектуру |
| Engine migration (PixiJS/Phaser) | Massive rewrite, не решает текущие проблемы |
| Full main.js refactor одним PR | Слишком рискованно; только пошаговый extraction |
| Complex AI (influence maps, HTN) | До стабилизации economy/combat |
| New unit assets (bomber, assault buggy) | Нужен pipeline; placeholder визуал достаточен для MVP |
| 4-player FFA | Требует multi-owner систему |
| Campaign mode | Требует content |
| Sound/music | Полезно, но не блокирует gameplay |

---

## 16. Top 10 Recommendations

| # | Рекомендация | Приоритет | Сложность | Риск | Почему важно |
|---|--------------|-----------|-----------|------|-------------|
| 1 | **Bot AI tuning (10F1B/10G1B/10H1B/10I1B)** | high | low | low | Бот уже работает, но tuning критичен для playability. Пассивный/слишком оборонительный бот = скучная игра |
| 2 | **Attack animation + damage flash** | high | low | low | Без visual feedback combat «невидим». Игрок не понимает, происходит ли бой. Это single biggest UX gap |
| 3 | **Minimap** | high | medium | low | RTS без minimap = слепая игра. Игрок не может стратегически планировать без overview |
| 4 | **Extract bot AI helpers (dedup 7× copies)** | high | low | low | 500+ строк дублирования = баги, трудно менять, невозможно тестировать. Quick win для code quality |
| 5 | **Heavy_tank + defense tower combat** | high | medium | medium | Один combat unit = tactical poverty. Heavy_tank + tower = базовые варианты attack/defense |
| 6 | **Tech tree / upgrades v1** | medium | medium | low | Без upgrades нет late-game sink и нет progression. Экономика заходит в тупик через 10 минут |
| 7 | **Add try/catch в update(dt)** | high | low | нет | Одна ошибка = краш игры. Это 5 минут работы, но huge stability improvement |
| 8 | **Production queue UI display** | medium | low | low | Игрок не видит, что производится. Click factory → see queue = basic RTS UX |
| 9 | **Scout integration в bot AI** | medium | medium | low | Scout = ключевой юнит для разведки. Bot должен использовать его вместо tank |
| 10 | **Save/load multi-slot** | medium | low | low | Один save slot = нельзя экспериментировать. Три slots = игрок может пробовать разные стратегии |

---

## 17. What NOT to Do Yet

| Что | Почему не сейчас |
|-----|------------------|
| **Real-time multiplayer** | Требует сервер, netcode, matchmaking, lag compensation. Это отдельный проект объёмом в месяцы. Текущий проект даже single-player ещё не stabilised |
| **Engine migration** (PixiJS / Phaser / Godot) | Migration = rewrite 12 000+ строк. Текущий Canvas работает. Если появятся FPS проблемы → PixiJS, но не раньше |
| **Полный main.js refactor одним PR** | Слишком рискованно. Только пошаговый extraction по одному модулю за раз. Каждый extraction = отдельный PR с smoke test |
| **Сложный AI до стабилизации economy/combat** | Influence maps, HTN planning, learning from replays — это academic research. Сначала economy должен быть fun, combat должен быть readable, потом можно делать smart AI |
| **Новые ассеты без pipeline** | Scout buggy прошёл pipeline успешно, но это был ручной процесс. Каждый новый юнит = Blender render × 8 directions × 4 factions = 32 PNG. Нужен automated pipeline |
| **4-player FFA / multiple bots** | Текущая архитектура бинарная: player vs enemy. Territory, fog, resources, bot — все assume 2 sides. Multi-owner = massive refactor |
| **Sound/music** | Полезно, но не блокирует gameplay. Лучше добавить после combat feedback и UI improvements |
| **Mobile touch controls** | Игра работает в браузере, но touch controls = отдельный input layer. Сначала desktop, потом mobile |
| **Campaign / story content** | Нужен content creator + writer. Сначала gameplay loop должен быть fun |
| **IAP / monetization** | Преждевременно. Проект ещё не имеет стабильного gameplay loop |

---

## Приложение A: Подтверждённые данные vs Предположения vs Идеи

### Подтверждено из кода/docs ✅

- Экономика: raw → separator (15→10+1) → buildings/units
- Bot phases: defend → prepare_attack → attack → regroup
- 7 bot AI subsystems implemented
- Scout unit player-side: speed 0.72, view 7, canAttack:false, cost 1 element
- main.js = 12 128 строк IIFE
- 7× дублирование helper функций
- unit_controller.js = 879 строк dead code
- Playwright tests exist but coverage is minimal
- Faction bonuses: +10% civilian/build/combat speed, territory view

### Предположения (не подтверждено, но вероятно) 🟡

- Heavy_tank и bomber не имеют attack logic (только config)
- Defense tower не имеет gameplay logic (только config)
- Bot tuning issues (passive, over-retreat) — confirmed in docs, not yet playtested
- No performance issues at current unit counts (< 30 units per side)
- localStorage save limit is not yet reached in typical games

### Идеи / Гипотезы (предложения, не проверенные) 💡

- Tech tree / upgrades would improve late-game engagement
- Minimap would significantly improve strategic play
- Attack animation would be the single biggest UX improvement for combat
- Biome-based map generation would improve replayability
- Faction asymmetry beyond +10% would make faction choice meaningful
- Observation points (Xel'Naga towers) would create neutral objectives
- Seeded PRNG would enable map sharing and daily challenges

---

*Конец отчёта. Этот документ — стратегический аудит, не спецификация реализации. Каждая идея требует отдельного design doc перед implementation.*
