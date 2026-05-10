# BOT-MVP-01 — Current enemy bot audit for playable 1v1

**Дата:** 2026-05-10
**Задача:** BOT-MVP-01
**Тип:** Audit-only (Fast lane, docs only)
**Ветка:** sandbox/main
**Код НЕ менялся.** src/*, index.html, assets не затронуты.

---

## 1. Краткий итог

### Что бот уже умеет

Бот обладает полноценной экономической цепочкой и многоуровневой AI-системой принятия решений. Он стартует с HQ, добывает ресурсы через harvesters, строит separator и factory, производит light_tank, разведывает карту, атакует игрока при достаточной силе, отступает при превосходстве игрока и защищает HQ. Реализовано 7 AI-слоёв (10B–10I1) с телеметрией, debug-панелями и двумя профилями сложности.

### Что бот НЕ умеет

Бот производит только light_tank — нет разнообразия юнитов (heavy_tank, bomber, scout не производятся). Нет восполнения рабочих (harvester, builder) при их гибели. Нет защитных башен, нет ремонта юнитов. Нет hard-профиля сложности. Сложность не влияет на производство (`affectsProduction: false`). Scout-юнит существует для игрока, но бот его не производит и не использует.

### Можно ли сейчас играть против него?

**Да.** Бот функционально работоспособен для базового 1v1: строит базу, добывает ресурсы, производит танки, атакует, отступает, защищает HQ. Игра заканчивается при уничтожении HQ одной из сторон. Однако игровой опыт однообразен — бот всегда делает одно и то же (только light_tank), и после понимания паттерна перестаёт быть вызовом.

### Минимальный путь до playable 1v1 с улучшенным опытом

1. **Восполнение рабочих** — если harvester или builder погибают, бот остаётся без экономики. Это критический пробел.
2. **Второй factory или увеличенная очередь** — бот производит танки слишком медленно для осмысленного давления.
3. **Scout-интеграция** — бот должен использовать scout для разведки вместо танка.
4. **Визуальный прогресс** — difficulty-профиль должен влиять на решение о производстве, а не только на тайминги.

---

## 2. Текущая карта bot/skirmish систем

| Система | Где в коде (main.js) | Что делает | Статус | Риск |
|---------|---------------------|------------|--------|------|
| **Enemy start / base** | L1697–1906 | Создаёт enemy HQ (фиолетовая фракция), выбирает стартовую позицию (7 кандидатов, diamond-ring search), спавнит 2 harvesters + 1 builder + 1 light_tank, кладёт стартовые минералы | ✅ Работает | Low |
| **Enemy resources** | L176, L1952–1986 | `game.enemyResources = { minerals, energy, purple, greenEl, cyanEl, yellowEl }`. Harvesters добывают в enemy bucket. Storage limits считают enemy buildings | ✅ Работает | Low |
| **Enemy separator** | L6051–6327 | Строит separator через builder (30 энергии, 25 сек). Обрабатывает 15 минералов → 10 энергии + 1 элемент фракции за 6 сек цикл | ✅ Работает | Low |
| **Enemy factory** | L6347–6510 | Строит units_factory через builder (55 энергии, 40 сек). Проверяет: нет ли уже factory, есть ли separator, есть ли builder, хватает ли ресурсов | ✅ Работает | Medium |
| **Enemy production** | L6557–6777 | Производит light_tank из factory (2 элемента, 35 сек). Очередь max = 1. Только light_tank — `FE_PATCH_09E_FACTORY_UNIT_TYPE = 'light_tank'` захардкожен | ⚠️ Работает, но ограниченно | Medium |
| **Enemy harvesters** | L1605–1618 | `FE_PATCH_09AStartEnemyHarvesters()` — автостарт добычи для idle enemy harvesters | ✅ Работает | Low |
| **Enemy movement / attack** | L2748–2840, L10054–10242 | `setLightTankAttack*`, `FE_PATCH_08BSilentMoveTo`, `FE_PATCH_08BReturnUnitHome` — бот может атаковать юнитов и здания, двигаться к цели, возвращаться домой | ✅ Работает | Medium |
| **Enemy attack waves** | L3105–3188 | `FE_PATCH_08BPrepareAttack` — проверяет армейский скор ≥ порог, выбирает цель через vision, отправляет maxAttackWaveSize юнитов | ✅ Работает | Medium |
| **Phase bot (state machine)** | L4548–4687, `game._enemyBotState` | 4 фазы: defend → prepare_attack → attack → regroup. Обновляется каждый кадр, throttled по `checkIntervalMs` | ✅ Работает | Medium |
| **Vision memory (10B)** | L2508–2706 | `FE_PATCH_10BRefreshEnemyKnowledge()` — enemy юниты/здания «видят» player объекты, хранят knowledge с confidence decay, prune мёртвые объекты | ✅ Работает | Low |
| **Scouting MVP (10C1)** | L3191–3605 | `FE_10C1_updateEnemyScoutingMvp()` — отправляет idle light_tank на scout points (center, quadrant, edge-mid). Использует light_tank вместо scout | ✅ Работает | Low |
| **Knowledge scouting (10G1)** | L3293–3421 | `FE_10G1_chooseKnowledgeScoutTarget()` — приоритет: knowledge/lastSeen → map_probe fallback. Скрывает player HQ из scout targeting | ✅ Работает | Low |
| **Autopilot guard (10D1)** | L3608–3980 | Per-unit: detect player threats → attack; too far from HQ → return; idle near HQ → patrol. Не вмешивается в scout/attack orders | ✅ Работает | Low |
| **Strength estimate (10E1)** | L3983–4260 | `FE_10E1_updateStrengthGateAfterEnemyBot()` — считает local player tanks vs enemy tanks, блокирует атаку если слабее | ✅ Работает | Low |
| **Vision-driven targeting (10F1)** | L2853–3102 | `FE_PATCH_10F1SelectAttackDecision()` — бот атакует только visible/high-confidence цели. Скрытый HQ не атакуется напрямую | ✅ Работает | Medium |
| **Retreat + HQ defense (10H1)** | L4264–4544 | `FE_10H1_updateEnemyRetreatAndDefenseMvp()` — отступает при превосходстве игрока, защищает HQ от ближних угроз | ✅ Работает | Medium |
| **Difficulty profile (10I1)** | L2354–2429 | normal + easy профили. Влияет на: checkInterval, openingDelay, attackThreshold, regroupDelay, maxAttackWaveSize, retreatCooldown. `affectsProduction: false` | ⚠️ Работает, но не влияет на производство | Low |
| **Victory / defeat** | L1094–1187, L1220–1330 | HQ уничтожен → game result (victory/defeat). Overlay «ПОБЕДА» / «ПОРАЖЕНИЕ». Проверка каждый кадр | ✅ Работает | Low |
| **Debug panel (F2)** | src/dev/enemy_economy_debug_panel.js | HQ HP, bot phase, unit counts, resources, building status, knowledge summary. 250ms refresh | ✅ Работает | N/A |
| **Combat overlay (Num9)** | src/dev/combat_debug_overlay.js | Attack range diamonds, attack-move markers | ✅ Работает | N/A |
| **Bot telemetry** | `FE_BOT_TELEMETRY()`, `game.enemy*` objects | 7 telemetry-объектов для всех AI-слоёв | ✅ Работает | N/A |

---

## 3. Что уже работает

### Экономическая цепочка — полностью функциональна

1. **Harvesters добывают** — enemy harvesters автоматически стартуют добычу при skirmish start. Ресурсы поступают в `game.enemyResources.minerals`.
2. **Separator работает** — бот строит separator через builder (30 энергии, 25 сек). Separator обрабатывает 15 минералов → 10 энергии + 1 элемент за 6-секундный цикл. Формула совпадает с player-сепаратором.
3. **Factory работает** — бот строит units_factory через builder (55 энергии, 40 сек). Factory производит light_tank за 2 элемента / 35 сек.
4. **Resource flow** — minerals → separator → energy + elements → factory → light_tank. Вся цепочка подтверждена кодом и покрыта debug-панелью (F2).

### AI-поведение — многоуровневое и безопасное

1. **Phase bot** — 4-фазная state machine (defend → prepare_attack → attack → regroup) работает стабильно. Бот не атакует слепо, ждёт накопления сил.
2. **Vision-gated targeting (10F1)** — бот атакует только те цели, которые видит или знает с высокой confidence. Скрытый player HQ не является прямой целью атаки.
3. **Scouting (10C1 + 10G1)** — бот разведывает карту, предпочитает scout points на основе knowledge (устаревшие записи → priority), fallback на map_probe.
4. **Strength estimate (10E1)** — бот не атакует, если player сила локально превышает enemy.
5. **Retreat + HQ defense (10H1)** — бот отступает при неблагоприятном ratio, защищает HQ от ближних угроз.
6. **Autopilot guard (10D1)** — idle enemy танки патрулируют, реагируют на ближние угрозы, возвращаются к HQ при удалении.
7. **Difficulty profiles (10I1)** — easy профиль замедляет бота, делает его консервативнее.

### Можно тестировать руками

- **FE_BOT_TELEMETRY()** — консольная команда, показывает сводку всех AI-слоёв.
- **F2** — enemy economy debug panel: ресурсы, производство, здания, knowledge.
- **Num9** — combat debug overlay: радиусы атаки, цели.
- **0/Num0** — toggle fog: позволяет наблюдать поведение бота.
- **FE_SPAWN_ENEMY_TANK(n)** — спавнит n enemy light_tank.
- **FE_DEV_SPAWN_UNIT('scout')** — спавнит scout для тестирования.
- **FE_DEBUG_FORCE_VICTORY/DEFEAT** — принудительный конец игры.

### Victory/defeat условия — работают

- Уничтожение enemy HQ → «ПОБЕДА».
- Уничтожение player HQ → «ПОРАЖЕНИЕ».
- Проверка каждый кадр через `FE_PATCH_06DCheckVictoryDefeat()`.

---

## 4. Что не работает / не хватает

| Проблема | Где проявляется | Почему мешает 1v1 | Риск исправления |
|----------|-----------------|--------------------|------------------|
| **Только light_tank** | `FE_PATCH_09E_FACTORY_UNIT_TYPE = 'light_tank'` (L6557) — захардкожен | Бот предсказуем: всегда один тип юнита. Нет тактического разнообразия | Low — добавить выбор типа в production |
| **Очередь max = 1** | `FE_PATCH_09E_FACTORY_MAX_QUEUE = 1` (L6558) | Бот производит танки слишком медленно (1 за 35 сек). Для осмысленного давления нужен более быстрый production | Low — увеличить константу или добавить 2-ю factory |
| **Нет второй factory** | `FE_PATCH_09DEnemyFactoryExistsOrQueued()` (L6347) — возвращает true после первой | Одна factory = bottleneck. Бот не может наращивать армию быстрее | Medium — логика «строить 2-ю factory при N танках» |
| **Нет восполнения рабочих** | Нет функций для заказа harvester/builder из factory | Если player убьёт harvesters или builder, бот теряет экономику навсегда. Это критический пробел — бот становится мёртвым | Medium — добавить production logic для рабочих |
| **Scout не производится ботом** | `PATCH-SCOUT-04/05/06` не начат | Бот тратит light_tank на разведку вместо боя. Scout существует для player, но бот его не производит | Low — PATCH-SCOUT-04/05/06 уже запланированы |
| **Нет defensive towers** | `defense_tower` — stub в buildings.js (`desc:'Заложена под будущую оборону.'`) | Бот не может оборонять подходы к базе пассивными средствами | High — новая система, много нового кода |
| **Нет ремонта юнитов** | `repair_center` — stub в buildings.js | Повреждённые танки не восстанавливаются, снижая эффективность армии | High — новая система |
| **Difficulty не влияет на производство** | `affectsProduction: false` (L2408) | Easy бот производит танки с той же скоростью, что и normal — меняются только тайминги решений | Low — добавить production knobs |
| **Нет hard профиля** | Только `normal` и `easy` в `FE_10I1_BOT_BEHAVIOR_PROFILES` | Нет более агрессивного/быстрого бота для опытных игроков | Low — добавить профиль |
| **Нет observer-режима** | Нет camera follow за enemy | Для тестирования бота приходится переключаться между fog toggle и ручным скроллом | Low — добавить camera hotkey |
| **Бот не строит storages** | Нет логики заказа minerals_storage/energy_storage/elements_storage | Ресурсы упираются в storage cap, дальнейший рост экономики блокируется | Medium — добавить build logic для storages |
| **Экономика может заблокироваться** | Если builder умирает до завершения separator/factory — нет способа восстановить | Бот не может строить здания без builder. Гибель единственного builder = конец экономики | Medium — восполнение builder критично |

---

## 5. High-risk зоны

Следующие зоны **не трогать без отдельного design/audit**:

| Зона | Почему опасно | Что может сломаться |
|------|---------------|---------------------|
| **Pathfinding / movement** | Используется всеми юнитами + ботом. Прямой доступ к `game.obstacles`, `game.buildings`, `game.units`. Изменение порядка `Math.random()` ломает карту | Юниты застревают, не едут, едут сквозь стены |
| **Combat core** | 3 уровня: attack, attack-approach, attack-move. Сложная state machine с transition conditions. Связана с `setLightTankAttack*` и `updateUnitMovement` | Юниты не атакуют, атакуют своих, зависают в combat state |
| **Save/load** | Формат save привязан к структуре `game` объекта. Добавление новых полей требует миграции | Существующие сохранения ломаются |
| **Render / input** | `render()` оркестрирует все rendering subsystems, связан с canvas, camera, fog. Input/selection — сложная drag-select + context menu система | Визуальные артефакты, некликабельные юниты |
| **Map generation** | Зависит от `Math.random()` — изменение порядка вызовов = другая карта. Связан с `game.obstacles`, `game.minerals`, `game.buildings` | Баланс карты меняется непредсказуемо |
| **`updateEnemyBot()` main tick** | Вызывает 8 AI-подсистем через общий IIFE scope. Порядок вызовов важен (strength gate → autopilot → scouting → retreat → phase logic). Изменение порядка может нарушить приоритеты | Бот перестаёт атаковать, не отступает, не строит |
| **Separator production cycle** | `FE_PATCH_09C3UpdateEnemySeparatorProduction()` — потребляет minerals, производит energy + elements. Связан с `addResourceForOwner`, storage caps. Ошибка в цикле = экономика ломается | Бот не получает ресурсы, factory не работает |
| **Enemy builder state machine** | Builder имеет 5 состояний, сложные отмены. Если прервать строительство, builder должен корректно вернуться в idle | Builder зависает, не строит, не возвращается |
| **`window.FE_CORE` bridge** | Экспортирует `game`, `ctx`, `assets`, `tileToScreen`, `spriteProfile`, `TILE_W`, `TILE_H`. Все dev-модули зависят от него | Все debug-панели ломаются, доступ к game state теряется |

---

## 6. Минимальная модель playable 1v1

### MVP-логика бота (достаточная для осмысленной игры)

```
1. Бот стартует с HQ + 2 harvesters + 1 builder + 1 light_tank.
2. Harvesters добывают минералы.
3. Builder строит separator (30 энергии, 25 сек).
4. Separator обрабатывает 15 минералов → 10 энергии + 1 элемент / 6 сек.
5. Builder строит factory (55 энергии, 40 сек).
6. Factory производит light_tank (2 элемента, 35 сек).
7. Если harvester или builder погиб → factory производит замену.
8. Если есть 1+ light_tank и phase = prepare_attack → оценить силу.
9. Если сила достаточна → собрать волну 2–3 танков → атаковать.
10. Если player рядом с enemy HQ → все танки защищают.
11. Если атака провалилась → отступить, regroup, повторить.
12. Если enemy HQ уничтожен → ПОБЕДА игрока.
13. Если player HQ уничтожен → ПОРАЖЕНИЕ игрока.
```

### Что нужно добавить к текущему состоянию

| Шаг | Что | Зачем | Сложность |
|-----|-----|-------|-----------|
| A | Восполнение рабочих (harvester, builder) из factory | Критично: без рабочих экономика умирает | Medium |
| B | Увеличить `FE_PATCH_09E_FACTORY_MAX_QUEUE` до 2–3 | Ускорить production, бот создаёт давление быстрее | Low |
| C | Разрешить 2-ю factory при N+ существующих танках | Масштабирование армии в mid-game | Medium |
| D | Scout production + scouting через scout (PATCH-SCOUT-04/05) | Разведка без потери боевых юнитов | Low–Medium |
| E | Production knobs в difficulty profile | Easy бот производит медленнее, hard — быстрее | Low |
| F | Bot строит storages при приближении к storage cap | Экономика не блокируется на лимитах | Medium |

### Чего НЕ делать в MVP

- Не делать defensive towers — это новая система, high risk.
- Не делать repair center — новая система, high risk.
- Не делать heavy_tank/bomber production — требует балансировки.
- Не делать групповой combat / formation — требует стабильного attack/retreat.
- Не делать multiplayer — отдельный проект.
- Не делать полную экономическую симуляцию — текущая цепочка работает.

---

## 7. Рекомендуемые маленькие PR

| Task ID | Название | Что меняет | Expected files | Risk | Manual smoke |
|---------|----------|------------|----------------|------|--------------|
| BOT-MVP-02 | Worker replenishment | Если enemy harvester/builder погиб, factory производит замену. Добавляется `FE_PATCH_09E_FACTORY_UNIT_TYPES` — список допустимых типов. Добавляется проверка: если enemy harvesters < 2 → queue harvester; если builder < 1 → queue builder. Harvester/builder production использует civilian speed | src/main.js | Medium | Убить enemy harvester → бот производит замену. Убить builder → бот производит replacement. Factory продолжает делать танки. Экономика не ломается. |
| BOT-MVP-03 | Production queue increase | `FE_PATCH_09E_FACTORY_MAX_QUEUE: 1 → 2`. Factory может держать 2 юнита в очереди. Бот быстрее наращивает армию | src/main.js (1 константа + возможно queue display) | Low | Factory показывает очередь 2. Бот производит 2 танка подряд. Экономика не ломается. |
| BOT-MVP-04 | Second factory | При 3+ enemy light_tank → бот строит 2-ю factory. Добавляется `FE_PATCH_09DCanBuildSecondEnemyFactory()` с условием: ≥3 light_tank, enough resources, no second factory yet | src/main.js | Medium | Бот с 3 танками → заказывает 2-ю factory. Builder строит. 2 factory производят параллельно. Нет бесконечного строительства. |
| BOT-MVP-05 | Difficulty production knobs | Easy: factory queue max = 1, civilian production slower. Normal: current. Hard: factory queue max = 3, civilian production normal. Добавить `affectsProduction: true` + production knobs в `FE_10I1_BOT_BEHAVIOR_PROFILES` | src/main.js | Low | Easy профиль → бот медленнее. Normal → как сейчас. Hard → быстрее. `FE_BOT_TELEMETRY()` показывает affectsProduction. |
| BOT-MVP-06 | Bot builds storages | При приближении к storage cap (minerals ≥ 80%, energy ≥ 80%) → builder заказывает minerals_storage или energy_storage. Использует существующий builder build pipeline | src/main.js | Medium | Бот с полной экономикой → строит storages. Ресурсы не блокируются. Builder не зависает. |
| BOT-MVP-07 | Victory/defeat screen polish | Добавить кнопку «Новая игра» на экран победы/поражения. Сейчас overlay показывается, но нет способа перезапустить без F5 | src/main.js, возможно index.html | Low | Победить → кнопка «Новая игра». Нажать → skirmish перезапускается. |

---

## 8. Recommended first PR

### BOT-MVP-02 — Worker replenishment

Это самый безопасный первый кодовый PR, потому что:

1. **Маленький diff** — добавляется логика проверки count + выбор типа юнита для production. Не затрагивает pathfinding, combat, render, save/load.
2. **Использует существующий pipeline** — factory production уже работает. Нужно только расширить выбор типа юнита с `light_tank` на `harvester | builder | light_tank` с приоритетом.
3. **Легко проверить руками** — убить enemy harvester → проверить что factory производит replacement через F2 панель.
4. **Даёт видимый прогресс** — без этого бота можно «убить экономику» одним ударом по harvester/builder, что делает 1v1 хрупким.

**Критерии для реализации:**

- Не трогает pathfinding, combat core, render, input, save/load.
- `node --check src/main.js` — PASS.
- Manual smoke: kill enemy harvester → factory produces replacement.
- Manual smoke: kill enemy builder → factory produces replacement.
- Manual smoke: normal tank production continues.
- Manual smoke: economy doesn't deadlock.

---

### Готовый будущий промпт для BOT-MVP-02

```text
Repository: https://github.com/ratoker-jpg/glm-game-sandbox
Base branch: sandbox/main

Task: BOT-MVP-02 — enemy worker replenishment

Lane: Review lane.

Цель:
Если enemy harvester или builder погибают, factory должна произвести замену.
Сейчас factory производит только light_tank (FE_PATCH_09E_FACTORY_UNIT_TYPE = 'light_tank').
Нужно расширить production logic: factory может производить harvester и builder
для восполнения потерь, с приоритетом рабочих над танками.

Правила:
1. Если enemy harvesters < 2 → factory queue harvester (1 элемент, 25 сек, civilian speed).
2. Если enemy builder < 1 → factory queue builder (1 элемент, 20 сек, civilian speed).
3. Worker production имеет приоритет над tank production.
4. Если workers на месте → factory производит light_tank как обычно.
5. Factory queue max остаётся 1 (отдельный патч увеличит).
6. Не менять pathfinding, combat, render, input, save/load.
7. Не добавлять новые unit types (heavy_tank, bomber, scout).
8. Не менять player factory logic.

Что менять:
- src/main.js:
  - Заменить FE_PATCH_09E_FACTORY_UNIT_TYPE на функцию выбора типа:
    FE_PATCH_09EChooseFactoryUnitType(game) — возвращает 'harvester', 'builder' или 'light_tank'.
  - FE_PATCH_09ECanStartLightTankProduction → обобщить на FE_PATCH_09ECanStartFactoryProduction(factory, unitType).
  - FE_PATCH_09EStartLightTankProduction → обобщить на FE_PATCH_09EStartFactoryProduction(factory, unitType).
  - FE_PATCH_09ESpawnEnemyFactoryUnit → обобщить на все типы (harvester/builder/light_tank).
  - Worker priority: harvester < 2 → harvester; builder < 1 → builder; else → light_tank.
  - Production cost/time берётся из FE_UNITS[unitType].

Проверки:
- node --check src/main.js -> PASS
- Manual smoke:
  1. Запустить skirmish.
  2. F2 — увидеть enemy economy.
  3. FE_SPAWN_ENEMY_TANK(3) — дать боту танки.
  4. Убить enemy harvester через консоль или атакой.
  5. F2 — увидеть что factory начала производить harvester.
  6. Дождаться спавна replacement harvester.
  7. Проверить что harvester начал добычу.
  8. Убить builder → factory производит builder.
  9. Бот продолжает строить танки после восстановления workers.
  10. Экономика не блокируется.

Обновить:
- PATCH_REPORT.txt
- docs/project/four_elements_bot_roadmap_merged_glm.md — отметить BOT-MVP-02

Ветка: glm/bot-mvp-02-worker-replenishment
```
