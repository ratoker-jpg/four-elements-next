# GLM Future Vision & Hypotheses — Four Elements Remake

> Это авторский стратегический обзор GLM.
> Это не обязательное ТЗ и не утверждённый roadmap.
> Идеи ниже — гипотезы, предложения и оценочные суждения на основе текущего состояния проекта.

**Дата:** 2026-05-10
**Тип:** Стратегический обзор будущего проекта (report-only)
**Ветка:** sandbox/main (Fast lane)
**Основание:** GLM-FUTURE-VISION-01

---

## 1. Executive Summary

### Что сейчас в проекте самое сильное

Проект уже имеет **работающую игру** — не демо, не прототип, а минимально играбельную RTS-партию 1×1 против бота. Экономическая петля замкнута: raw minerals → separator → energy + faction elements → buildings + units. Бот может строить экономику, производить танки, разведывать, оценивать силу, атаковать и отступать. В мире браузерных RTS это редкий результат — большинство проектов застревают на этапе «юниты ездят по карте». Изометрический Canvas-рендер работает стабильно. Система фракций заложена. Scout unit полностью реализован (player-side). Workflow (Fast/Review lane, патчи, проверки) отлажен.

### Что самый большой риск

**12 128 строк монолита `src/main.js`** — единственный файл, содержащий всю игровую логику. Один неудачный патч ломает всё. Нет try/catch в game loop — одна ошибка крашит игру. 7× дублирование helper-функций в bot AI (~500 строк мусорного кода). 879 строк мёртвого кода в `unit_controller.js`. Нет модульности — невозможно тестировать систему изолированно.

### Что мешает развитию сильнее всего

**Отсутствие визуального боевого фидбека.** Бой происходит «вслепую» — танк стреляет мгновенно без анимации, без снаряда, без вспышки. Игрок не понимает, атакует ли его юнит, наносится ли урон, жив ли ещё противник. Это не косметическая проблема — это **игрок не может играть в combat**, потому что не видит, что происходит. Для RTS, где combat = core loop, это критический gap.

### Что лучше сделать в ближайшие 1–2 недели

1. Bot AI tuning (10F1B/10G1B/10H1B/10I1B) — 4 маленьких патча, низкий риск
2. Attack animation (muzzle flash overlay) — самый большой UX-impact за минимальные усилия
3. Dedup 7× скопированных helpers — −500 строк, чистый код
4. Try/catch в update(dt) — 5 минут работы, спасает от крашей
5. Scout integration в bot (PATCH-SCOUT-04)

### Что лучше сделать в ближайший месяц

1. Heavy_tank combat implementation — второй боевой юнит
2. Defense tower — базовая оборона
3. Minimap — стратегический обзор
4. Tech tree v1 — late-game progression
5. Production queue UI display
6. Mapgen extraction из main.js
7. Hotkey system (Ctrl+1-9, S stop, B build)

### Что лучше не делать пока

Real-time multiplayer, engine migration, полный refactor одним PR, сложный AI (influence maps, HTN), 4-player FFA, новые ассеты без pipeline, кампания.

### Какой путь развития кажется наиболее здравым

**PvE bot-first → stabilize → polish → expand.** Сначала довести 1×1 skirmish до состояния «каждая партия интересна» (bot tuning + combat feedback + UI polish). Потом добавить глубину (heavy_tank, defense tower, tech tree). Потом расширять (scout для бота, map events, faction asymmetry). И только потом думать про multiplayer или engine migration. Это путь StarCraft: сначала хороший single-player, потом всё остальное.

---

### 5 главных выводов GLM

1. **Бот уже работает, но tuning — priority #1.** Пассивный easy, чрезмерный retreat, пустой knowledge блокирует атаку — 4 маленьких патча, которые делают игру из «скучной» в «играбельную».

2. **Combat без визуального фидбека = невидимый бой.** Attack animation + damage flash — это не украшательство, это **функциональная необходимость**. Без неё игрок буквально не может играть в combat.

3. **main.js рефакторинг — не紧急, но неизбежен.** Можно прожить ещё 2-3 месяца, но каждый новый патч становится рискованнее. Пошаговый extraction (coordinates → constants → helpers → mapgen) снижает риск и не требует «большого рефакторинга».

4. **Экономика заходит в тупик через 10 минут.** Нет energy sink, нет upgrades, элементы используются только для юнитов. Tech tree v1 решает эту проблему и даёт late-game purpose.

5. **Scout — самый недооценённый юнит.** Он уже реализован, уже производит, но ни игрок, ни бот не используют его по назначению. Scout → intel → decision — это та петля, которая делает RTS интересной, а не просто «произведи больше танков».

---

### 5 главных рисков проекта

1. **main.js монолит** — один неудачный патч ломает всё; нет изоляции систем; невозможно тестировать локально
2. **Combat невидим** — игрок не понимает, что происходит в бою; combat — core loop RTS
3. **Нет try/catch в game loop** — одна ошибка = полный краш без восстановления
4. **Экономический тупик в late-game** — нет sink для ресурсов → игра становится скучной после 10 минут
5. **Bot AI не протестирован hands-on** — 10F1/10G1/10H1/10I1 применены, но manual smoke pending

---

### 5 самых полезных quick wins

1. **Try/catch в update(dt)** — 3 строки, спасает от 90% крашей (сложность: low, риск: нет)
2. **Muzzle flash overlay** при атаке — 1 спрайт, 20 строк кода (сложность: low, риск: low)
3. **Damage flash** на целевом юните — красная вспышка при получении урона (сложность: low, риск: low)
4. **Dedup 7× helpers** — удалить 500 строк дублирования (сложность: low, риск: low)
5. **Bot tuning 10F1B/10H1B** — 2 пороговых изменения, делают бота играбельным (сложность: low, риск: low)

---

## 2. Текущее состояние проекта

### Что уже реализовано (подтверждено кодом/docs)

**✅ Полностью работает:**
- Изометрический Canvas-рендер с 8-direction sprites, depth sorting, camera WASD + zoom
- Генерация карты: spawn-relative resources, obstacles (mountains/volcanoes/rocks), center infinite mine
- Экономическая петля: raw minerals → separator (15→10 energy + 1 element) → buildings / units
- Строительство зданий: builder state machine, build cost, cancel/refund 75%
- Производство юнитов: factory queue (max 2), civilian/combat speed, power gating
- Territory: медленное распространение от зданий (1 клетка / 15 сек), радиус 5
- Fog of War: unit/building/territory vision, explored/visible layers
- Combat (light_tank): attack approach → attack cycle → damage/destroy
- Enemy bot AI: phase bot + 7 subsystems (vision, scouting, autopilot, strength, targeting, retreat, difficulty)
- Scout unit (player-side): shell + factory production, speed 0.72, view 7, canAttack:false
- Save/Load: localStorage, single slot, auto-save every 45s
- Power grid: HQ 10MW + Power Plant 20MW, здания паузятся при нехватке
- 4 фракции с бонусами (cyan/green/yellow/purple)
- Playwright E2E тесты (smoke, bot AI, menu flow)
- GitHub Pages live demo

**✅ Работает, но MVP:**
- Bot AI: phase bot работает, но tuning неизвестен; нет «hard» difficulty; нет production manager
- Combat: только light_tank атакует; нет animation; нет projectile; нет damage indicator
- Economy: separator formula работает, но нет late-game sink; нет upgrades
- UI: HUD показывает ресурсы, но нет minimap, production queue display, hotkeys, tooltips

**⚠️ Временное / патчевое:**
- 7× дублированные helper-функции (`getGameObject`, `isEnemyUnit`, `distTiles`, `getEnemyHQ` — каждая скопирована 4-7 раз с префиксами `FE_10C1_`, `FE_10D1_` и т.д.)
- Dead code после `return` в 4+ функциях
- Hardcoded константы вместо config: separator formula (15, 10, 1), cycle time (6.0s), territory spread (15s), auto-save (45s), HQ HP (1000)
- `unit_controller.js` — 879 строк мёртвого кода (FE_UNIT_CONTROLLER_ENABLED = false)
- `applyTestBuildingCostsX10()` — disabled, но не удалён

### Что держится на main.js

Абсолютно всё. Один IIFE замыкание содержит ~200+ функций, все разделяют один scope. Нет dependency injection. Нет модульности. Каждая система — от генерации карты до debug overlay — живёт в одном файле. Порядок определения функций важен (hoisting не работает для `const`/`let`). Функции модифицируют `game`, `selected`, `selectedUnits`, `keys`, `mouse`, `assets`, `ctx`, DOM-элементы напрямую из closure scope.

### Что сейчас мешает масштабированию

1. **Невозможно добавить систему без риска сломать существующие** — всё связано через closure
2. **Нет unit-тестов** — только E2E Playwright, которые не покрывают корректность логики
3. **Fog of War O(mapW×mapH) каждый кадр** — при переходе к larger maps будет bottleneck
4. **BFS pathfinding** — без A*, без weighted costs; при 96×96 карте начнёт тормозить
5. **Нет Web Workers** — pathfinding и AI делят time budget с рендерингом в главном потоке
6. **Один HTML файл** — весь UI в index.html (1700+ строк), весь game logic в main.js

### Что уже можно считать рабочей базой

- Экономическая петля (raw → separator → energy + elements → buildings/units) — стабильна
- Строительство (builder state machine) — стабильно
- Производство (factory queue) — стабильно
- Territory spread — стабильно
- Fog of War — стабильно
- Canvas rendering pipeline — стабильно

### Какие системы выглядят хрупкими

- **Bot AI** — много патчей, много duplicated code, tuning не проверен hands-on
- **Combat** — один юнит атакует, нет визуального feedback, нет error handling
- **Save/Load** — нет versioning, нет validation, single slot, localStorage limit
- **Harvester AI** — иногда idle рядом с минералами; нет optimal path

### Какие системы уже можно расширять

- **Фракции** — config-driven, добавить бонусы легко
- **Юниты** — pipeline отработан на scout; добавить новый юнит = config + sprites + пара строк в main.js
- **Здания** — config-driven; добавить здание = config + sprite + build menu
- **Map generation** — легко добавить новые patterns и obstacles

### Текущие ограничения без backend

- Нет real-time multiplayer
- Нет leaderboards
- Нет save sync между устройствами
- Нет matchmaking
- Нет server-side validation
- Нет analytics/telemetry collection
- GitHub Pages = статика, нет server-side logic

---

## 3. Генерация карты

### 3.1 Стартовая зона

**Quick win:** Добавить гарантированный «карман» — 2-3 горы, формирующие узкий проход к старту. Это создаёт естественный choke point для обороны, аналогично стартовым позициям в StarCraft. Сейчас старт — это просто радиус 9 клеток без препятствий, что делает старт слишком открытым и предсказуемым.

**Medium idea:** Вариативные стартовые зоны. Не каждый старт — «карман». Некоторые старты более открыты (больше ресурсов рядом, но уязвимее), некоторые — более закрыты (безопаснее, но дольше добираться до expansion). Это создаёт стратегическое разнообразие: игрок выбирает стиль через выбор стартовой позиции.

**Long-term idea:** Ручное размещение стартовых зон в map editor. Игрок или mappack автор определяет, где именно начинается игра, какие ресурсы рядом, какие проходы ведут к центру.

### 3.2 Центр карты

**Quick win:** Окружить central infinite mine кольцом гор с 1-2 проходами. Это делает центр高风险/высокоприбыльной зоной — аналог gold expansion в StarCraft. Захват центра = экономическое преимущество, но удержание требует investment в defense.

**Medium idea:** Центральный «артефакт» — neutral building в центре, дающий бонус (vision radius +3, production speed +5%, или +1 element per separator cycle для владельца территории). Это создаёт contestable objective даже без боя.

**Long-term idea:** Динамический центр — ресурс в центре истощается со временем, заставляя игроков расширяться. Или: несколько «центров» на large карте, каждый с разными бонусами.

**Нужна ли бесконечная залежь?** Я считаю, что да — но только одна на карте, и она должна быть contestable. Бесконечный ресурс = late-game anchor; без него партия может зайти в тупик «оба без ресурсов».

### 3.3 Ресурсы

**Quick win:** «Богатые» минералы с yield 15-20 (вместо 10), но быстрее истощаемые. Это создаёт risk/reward: быстрая добыча сейчас vs. долгосрочная стабильность. Легко добавить — просто `yieldMultiplier` в `FE_MINE_TYPES`.

**Medium idea:** Expansion-кластеры — 2-3 группы medium+small минералов на полпути между стартом и центром, с достаточным пространством для застройки. Игрок решает: сидеть на базе или расширяться. В StarCraft это называется «expansion» — второй базы возле ресурсов.

**Long-term idea:** Редкие ресурсные типы. «Кристаллы» — дают +2 элемента вместо +1, но spawn редко. «Энергетические залежи» — дают +20 energy напрямую, минуя separator. Разные типы ресурсов = разные стратегии добычи.

**Как завязать ресурсы на разведку:** Сейчас ресурсы видны только если разведаны (fog of war). Но игрок интуитивно знает, что ресурсы есть рядом — spawn-relative generation предсказуема. Предложение: часть ресурсов (expansion-кластеры, редкие типы) размещать random, а не pattern-based. Тогда scout = реально нужен для поиска.

### 3.4 Препятствия

**Quick win:** Намеренное создание choke points — 2-3 узких прохода (1-2 клетки шириной) через горные хребты между стартами. Это делает карту более интересной тактически: flanking, ambush, defensive positioning.

**Medium idea:** Проходимые препятствия — «кусты» (dry_bush) не блокируют движение, но снижают скорость на 30%. «Песчаные дюны» (sand_bump) — то же самое. Это добавляет terrain tactics без полного блокирования.

**Long-term idea:** Destroyable obstacles — некоторые горы можно разрушить heavy_tank или bomber, открывая новый путь. Это создаёт динамическую карту: террайн меняется в ходе партии.

**Pathfinding-риск:** Любое добавление препятствий требует проверки, что путь от старта к старту существует. Нужно добавить path validation после generateMap() — если путь заблокирован, убрать часть obstacles.

### 3.5 Биомы и визуальная вариативность

**Quick win:** Визуальные зоны — различные shade значения в terrain[][] для разных областей карты (песок, камень, лава). Чисто косметическое различие, не влияющее на gameplay. Легко добавить через существующую terrain system.

**Medium idea:** Gameplay-биомы. «Вулканическая зона» — юниты теряют 1 HP/сек при нахождении. «Песчаная буря» — снижает view radius на 2. «Кристаллические пещеры» — скорость движения -20%. Каждый биом = tactical consideration.

**Long-term idea:** Руины — neutral structures на карте, дающие бонус при занятии (repair zone, vision boost, resource cache). Neutral zones — территории, которые никто не может claim, но которые дают бонусы.

**Фракционные зоны:** Я считаю, что это too early. Пока фракции не имеют значимой асимметрии, фракционные зоны будут косметическими. Ввести после того, как фракции станут действительно разными.

### 3.6 Replayability

**Quick win:** Seeded PRNG — заменить `Math.random()` в `generateMap()` на seeded generator. Добавить `mapSeed` в `startNewGame()` и save data. Это позволяет: воспроизводить карты, делиться интересными картами, «карта дня» для community.

**Medium idea:** Симметричные карты для fair play — оба игрока имеют зеркальные стартовые условия. Для 1v1 это важно для конкурентной игры. Реализуется через mirror-map generation: одна половина генерируется, вторая — зеркальная копия.

**Long-term idea:** Scripted scenarios — предустановленные карты с фиксированными позициями, ресурсами, юнитами. Campaign missions, challenge maps, tutorial scenarios. Требует map editor.

**Random events:** Я бы отложил до стабилизации core gameplay. Sandstorm (снижает vision), mineral surge (кратный доход), volcano eruption (повреждает юниты в зоне) — интересно, но отвлекает от основных механик.

### 3.7 Fog of war и разведка

**Подтверждено кодом:** Fog of War работает — `fogVisible[][]` и `fogExplored[][]`, visibility от units (range 4-7), buildings (range 6), territory (range 1 + faction bonus).

**Quick win:** «Призраки» последних видимых позиций — показывать ghost-иконку юнита, который был виден, но ушёл в fog. Через 15 секунд ghost исчезает. Это даёт игроку информацию без omniscience.

**Medium idea:** Разведка как gameplay — scout не просто «ходит и видит», но и ставит «sensor beacon» (временный vision point на 60 сек). Это делает scout активным инструментом, а не просто быстрым юнитом.

**Long-term idea:** Intelligence panel — отдельная вкладка UI, показывающая: «Последний раз врага видели тут (15 сек назад)», «Замечено: 2 танка, 1 harvester», «Предположительная сила: слабая/средняя/сильная». Это превращает разведку из механики «посмотреть» в механику «собрать информацию и принять решение».

---

## 4. Юниты и роли

### 4.1 Builder

**Подтверждено кодом:** Builder state machine реализована — idle → moving_to_build → building → complete. Build cost, cancel/refund 75%, resume construction. Строит все типы зданий из FE_V04_BUILD_MENU_TYPES.

**Что можно улучшить:**
- Автоматическое возобновление прерванной стройки при клике на builder (сейчас нужно вручную resume)
- Очередь строительства (shift-click несколько зданий) — уменьшает micromanagement
- Build preview (показывать footprint здания при наведении) — стандарт RTS UX

**Ремонт:** Сейчас repair_center есть в config, но не реализован (desc: «Заложен под будущий ремонт»). Предложение: builder может чинить здания рядом за energy cost (5 energy/HP). Это делает builder нужным в mid/late-game, а не только в начале.

**Риск микроменеджмента:** Builder требует много micro — выбрать, поставить здание, ждать, перейти к следующему. Решение: queue + auto-resume + hotkey (B = open build menu when builder selected).

### 4.2 Harvester

**Подтверждено кодом:** Harvester state machine — idle → moving_to_mine → harvesting → returning → unloading. Auto-assign через `assignNextMine()`. Cargo capacity 10.

**Что можно улучшить:**
- Auto-restart при idle (если рядом есть минералы, harvester должен автоматически начать добычу, а не стоять)
- Визуальный индикатор cargo (progress bar над harvester — насколько полный груз)
- Уязвимость: harvester — лёгкая цель, HP 100, без атаки. Игрок должен защищать. Это правильно для RTS.

**Как сделать важным, но не раздражающим:** Harvester не должен требовать micro для базового цикла (добывать → разгружать → добывать). Micro нужен только для: выбора другого минерала, retreat при атаке, redirect на expansion. Автоматизация базового цикла = меньше раздражения.

**Поведение при полном хранилище:** Harvester должен автоматически возвращаться к разгрузке, а не стоять у mines. Сейчас это работает через state machine, но иногда harvester застревает. Нужно добавить guard: если harvester idle с cargo > 0, принудительно отправить на разгрузку.

### 4.3 Scout

**Подтверждено кодом:** Scout полностью реализован player-side: speed 0.72, view 7, canAttack:false, HP 70, cost 1 element / 18 сек, civilian production speed, factory production button.

**Текущая роль:** Разведчик — быстрый, хрупкий, с широким обзором, без боевой ценности. Это правильная роль. Scout = информация, не сила.

**Как игрок должен использовать:**
1. Произвести scout (1 элемент — дёшево)
2. Отправить к вражеской базе
3. Получить информацию о составе армии и экономики врага
4. Решить: атаковать, защищаться, или продолжать разведку

**Как бот должен использовать (pending PATCH-SCOUT-04/05/06):**
1. Произвести 1-2 scout'а
2. Отправлять scout к точкам интереса (центр, expansion-зоны, last-seen player positions)
3. Использовать информацию для принятия решений
4. Scout не должен атаковать — он собирает информацию

**Upgrades для scout:**
- Sensor beacon (ставит временный vision point на 60 сек) — medium
- Speed boost (+15% speed, 0.72 → 0.83) — low
- Stealth (невидим для enemy вне radius 2) — high, risky
- Enhanced sensors (view 7 → 9) — low

**Может ли scout ставить маяки/сенсоры/метки:** Я считаю, что да — это естественное развитие роли. Sensor beacon = simplest version: scout ставит «флажок» на карте, который даёт vision radius 3 на 60 секунд. Это делает scout стратегически ценным даже после разведки.

### 4.4 Light Tank

**Подтверждено кодом:** Light tank — единственный боевой юнит с реализованной атакой. Attack approach → attacking → damage cycle. HP 160, speed 0.55, cost 2 elements, range 5, view 4.

**Роль:** Универсальный боевой юнит early/mid-game. Не самый быстрый, не самый мощный, но сбалансированный. Аналог marine в StarCraft — основа армии.

**Слабости:** Уязвим к concentrated fire (HP 160 — не так много), медленнее scout, не может разведывать без риска (view 4 vs. scout view 7).

**Как отличить от scout:** Scout = информация (быстрый, широкий обзор, нет атаки). Light tank = сила (атакует, больше HP, медленнее). Никогда не использовать танк для разведки, если есть scout.

### 4.5 Heavy Tank

**Подтверждено из config:** heavy_tank: HP 260, speed 0.42, cost 4 elements, productionTime 60, view 4. Визуал = placeholder 56×56. **Attack logic не реализована.**

**Роль:** Тяжёлый ударный юнит для late-game. Медленный, мощный, дорогой. Аналог siege tank в StarCraft — ломает оборону, но уязвим к flanking и быстрым юнитам.

**Предложение по реализации:**
- Damage: 25 per shot (vs. light_tank ~12-15)
- Attack range: 6 (больше light_tank)
- Attack cooldown: 2.0s (медленнее light_tank)
- Speed: 0.42 (подтверждено из config — медленный)
- Role: siege, anti-building, anti-defense-tower

**Цена:** 4 elements — значительная investment. 2 light_tank (4 elements) vs. 1 heavy_tank — стратегический выбор: количество vs. качество.

**Медлительность как баланс:** Heavy tank не должен быть просто «лучше light_tank». Его медлительность = уязвимость. Scout находит, light_tanks отвлекают, heavy_tank наносит главный удар — вот правильная тактика.

### 4.6 Bomber

**Подтверждено из config:** bomber: HP 130, speed 0.58, cost 6 elements, productionTime 55, view 4. Визуал = placeholder 56×56. **Attack logic не реализована.**

**Роль:** Воздушный юнит, специализирующийся на атаке зданий. Диверсификация combat: не всё решается танками.

**Как не сделать имбу:**
- Урон по зданиям высокий (40), по юнитам низкий (15) — anti-building specialist
- Уязвим к defense tower (AA mode) — нужен counter
- Дорогой (6 elements) — нельзя масс-produce
- Низкий HP (130) — погибает при focus fire

**Нужна ли ПВО / defense tower:** Да, обязательно. Без AA defense bomber не имеет контры. Defense tower с AA mode (switch: ground/air/auto) — simplest counter.

### 4.7 Новые юниты, которых нет

#### Engineer

**Что это:** Продвинутый builder — строит быстрее, чинит, может строить advanced buildings.  
**Зачем:** Late-game builder, который не бесполезен после начальной застройки.  
**Сложность:** medium  
**Риск баланса:** low — просто лучший builder  
**Нужен ли:** Позже. Сначала текущий builder должен работать без проблем.

#### Repair Drone

**Что это:** Автоматический ремонт юнитов рядом. Медленный, без атаки, дорогой.  
**Зачем:** Support unit для army — танки не умирают в бою, если рядом repair drone.  
**Сложность:** medium  
**Риск баланса:** medium — может сделать танки неубиваемыми  
**Нужен ли:** После defense tower и heavy_tank. Не priority.

#### Artillery

**Что это:** Дальнобойный юнит с большим range (10+), но минимальным direct combat capability.  
**Зачем:** Siege warfare — разрушение defense tower и зданий из-за пределов их range.  
**Сложность:** high  
**Риск баланса:** high — range imbalance  
**Нужен ли:** Позже. Сначала нужны basics (heavy_tank, defense tower).

#### Mobile Radar

**Что это:** Медленный юнит с огромным view radius (12+), без атаки.  
**Зачем:** Стационарный observation point, который можно перемещать.  
**Сложность:** medium  
**Риск баланса:** low — информация, не сила  
**Нужен ли:** Позже. Scout + sensor beacon = simpler version.

#### Shield Unit

**Что это:** Юнит, создающий защитное поле вокруг себя (damage reduction для nearby allies).  
**Зачем:** Support для army — tanks получают меньше урона.  
**Сложность:** high  
**Риск баланса:** high — может сделать army неубиваемой  
**Нужен ли:** Very later. Слишком рано для таких механик.

#### Transporter

**Что это:** Транспорт, перевозящий юнитов. Быстрый, без атаки.  
**Зачем:** Быстрая переброска войск.  
**Сложность:** high  
**Риск баланса:** medium — drop tactics  
**Нужен ли:** Very later. Сначала нет даже heavy_tank.

#### Mine Layer

**Что это:** Юнит, ставящий invisible mines на карте.  
**Зачем:** Area denial, defensive tactics.  
**Сложность:** high  
**Риск баланса:** high — invisible damage frustrating  
**Нужен ли:** No. Слишком frustrating для PvE.

#### Anti-Air Unit

**Что это:** Юнит, специализирующийся на атаке воздушных целей.  
**Зачем:** Counter для bomber.  
**Сложность:** medium  
**Риск баланса:** low — rock-paper-scissors  
**Нужен ли:** После bomber. Если bomber нет, AA не нужен.

#### Stealth Scout

**Что это:** Scout, невидимый для врага вне radius 2.  
**Зачем:** Глубокая разведка без риска.  
**Сложность:** high  
**Риск баланса:** medium — invisible unit can be frustrating  
**Нужен ли:** Позже. Сначала обычный scout должен работать.

#### Siege Unit

**Что это:** Юнит, наносящий огромный урон зданиям, но очень медленный и уязвимый.  
**Зачем:** Late-game building destruction.  
**Сложность:** high  
**Риск баланса:** medium  
**Нужен ли:** Heavy_tank = simpler version этого. Не нужен как отдельный юнит.

---

## 5. Анимации и визуальная обратная связь юнитов

### 5.1 Movement animation

**Подтверждено кодом:** 8-direction idle sprites для всех юнитов. Move frames = idle (копия). Dust particles для builder, harvester, light_tank, scout.

**Что нужно:**
- Movement «bounce» для wheeled units — лёгкое покачивание при движении, имитирующее неровности terrain. Не bounce в классическом смысле, а subtle vertical oscillation (±1-2px). Сложность: low (sprite offset animation).
- Wheel rotation — если спрайты позволяют, анимация вращения колёс. Сложность: medium (нужны отдельные wheel sprites или overlay).
- Следы на песке (track marks) — временные следы, исчезающие через 30 сек. Сложность: medium.

**Поворот:** Сейчас юнит мгновенно поворачивается при смене направления. Плавный поворот (interpolation через 2-3 промежуточных sprite directions) был бы лучше, но сложнее. Я бы предложил оставить мгновенный поворот — это стандарт для 8-dir RTS.

### 5.2 Idle

**Критичное правило: стоячие юниты НЕ должны дёргаться без причины.**

**Допустимые idle-эффекты:**
- Лёгкое покачивание (sway) ±0.5px — создаёт ощущение «живого» юнита, но не дёргает
- Scout: вращение антенны/радара — подчёркивает роль разведки
- Harvester: лёгкое движение ковша — «готов к работе»
- Buildings: пульсация света/дыма — «здание работает»

**Запрещённые idle-эффекты:**
- Bouncing (прыгание) — раздражает
- Shaking (тряска) — выглядит как баг
- Резкая смена sprite frame — дёргается
- Произвольное вращение — дезориентирует

**Как не создавать ощущение «юнит висит»:** Юнит без действия должен выглядеть «ждущим», а не «зависшим». Subtle breathing/sway + contextual icon (idle harvester = ⛏, idle builder = 🔧) = понятно, что юнит жив и ждёт приказа.

### 5.3 Harvest / Build / Repair

**Подтверждено кодом:** Harvester state machine имеет состояния harvesting и returning, но нет визуальной разницы. Builder state machine имеет building state, но нет build animation.

**Что нужно:**
- Harvester: «ковш опускается» при добыче — sprite overlay или frame change
- Harvester: «ковш поднимается» при полной загрузке — визуальный индикатор cargo
- Builder: «молоток/сварка» при строительстве — sprite overlay
- Builder: progress bar над строящимся зданием — уже есть progress в data, нужно только рисовать
- Repair (future): зелёные искры при ремонте

### 5.4 Combat animation

**Это priority #1 для визуального фидбека.**

**MVP-вариант (quick win):**
- Muzzle flash: белый/жёлтый overlay sprite на ~100ms при выстреле
- Damage flash: красная вспышка на целевом юните на ~150ms
- Explosion: оранжевый burst при destroy unit/building

**Полноценная версия:**
- Projectile: маленький sprite, летящий от attacker к target
- Hit effect: искры/фрагменты при попадании
- Damage smoke: чёрный дым от повреждённых юнитов (HP < 50%)
- Destroyed state: wreck sprite остаётся на месте на 10 сек
- Building damage stages: building sprite меняется при HP < 50% / < 25%

### 5.5 Selection / Command feedback

**Подтверждено кодом:** Selection ring работает, HP bars работают, click markers работают.

**Что добавить:**
- Animated pulse при выделении (ring слегка расширяется и сужается)
- Color coding: green (HP > 70%) → yellow (30-70%) → red (< 30%)
- Move path preview: тонкая линия от юнита к destination при выбранном юните
- Attack target marker: красный crosshair над целью
- Group selection: brackets вместо rings при multi-select (как в StarCraft)

### 5.6 Sprite pipeline

**Когда хватает PNG:** Пока < 10 юнитов × 8 directions × 2 frames = 160 PNG — индивидуальные файлы работают. При 10+ юнитах с attack/harvest/build animation = 500+ PNG — нужны spritesheets.

**Когда нужны spritesheets:** При переходе к 3+ animation states × 4+ frames × 8 directions = 96+ sprites per unit. Это точка, где individual PNG становится неудобным.

**Как хранить 8 directions:** Текущий подход (scout_idle_dir0_0.png ... scout_idle_dir7_0.png) работает, но не масштабируется. Предложение: spritesheet per unit per animation state (scout_idle.png, scout_move.png, scout_attack.png) с 8 columns × N rows.

**Как не сломать anchors:** При переходе на spritesheet нужно сохранить anchor point (сейчас anchorX:0.50, anchorY:0.88). Это критично для правильного позиционирования. Каждый spritesheet должен иметь метаданные с anchor.

**Как валидировать новые ассеты:** Automated script: для каждого unit type проверить, что все 8 directions существуют, правильный размер, правильный alpha cutoff, anchor в ожидаемом диапазоне. Playwright может делать screenshot comparison.

---

## 6. Экономика

### 6.1 Resources

**Подтверждено кодом:** 4 типа ресурсов: minerals (сырьё), energy, power (электричество), faction elements (purple, greenEl, cyanEl, yellowEl). Storage limits: minerals 200, energy 300, elements 20 each (увеличиваются складами).

**Моя оценка:** Система ресурсов правильная, но неполная. Минералы и энергия имеют чёткие источники и sink'и. Elements используются только для юнитов. Power — gate, но не расходный ресурс. Нет late-game sink ни для одного ресурса.

### 6.2 Minerals (сырьё)

**Подтверждено кодом:** Raw minerals добываются harvester'ами из mines (cargo 10 per trip). Разгружаются в HQ/base buildings. Small (8 remaining), medium (25), large (50), infinite mines.

**Риск экономического тупика:** Если все mines рядом с базой истощены, а harvester не может добраться до дальних mines (блокировка врагом) — экономика останавливается. Это правильная механика (economic harassment), но нужно убедиться, что всегда есть путь к хотя бы одному mine.

**Предложение:** Infinite mine в центре карты = safety net. Если все остальные mines истощены, оба игрока борются за центр. Это создаёт естественный late-game objective.

### 6.3 Energy

**Подтверждено кодом:** Energy производится в separator (15 raw → 10 energy + 1 element). Тратится на строительство зданий (30-55 energy per building). Начальная energy: 160.

**Как должна производиться:** Текущая схема (separator only) работает для early/mid-game. В late-game нужно больше источников: power_plant (пассивная генерация 5 energy/30сек), energy_reactor (10 energy/30сек). Оба здания уже в config, но не реализованы (desc: «Заложены под будущую энергосистему»).

**Для чего нужна:** Строительство, upgrades (future), repair (future), special abilities (future). Energy = универсальный расходный ресурс, аналог vespene gas в StarCraft.

**Чем отличается от power:** Energy = расходный ресурс (тратится и запасается). Power = capacity (сколько зданий может работать одновременно). Это правильное разделение.

**Нужно ли тратить energy на юнитов:** Нет. Юниты стоят elements — это правильная схема. Если юниты будут стоить energy + elements, экономика станет сложнее без добавления глубины.

### 6.4 Power (электричество)

**Подтверждено кодом:** HQ генерирует 10 MW, power_plant 20 MW. Separator потребляет 4 MW, factory 5 MW при работе. Buildings pause если insufficient power.

**Предложение:** Energy upkeep для зданий — каждое здание потребляет 1-2 MW постоянно (не только при работе). Это создаёт power как настоящий limited resource: больше зданий = нужно больше power plants. Power plant chain: 1 plant = 20 MW = ~10 зданий. Это делает power management стратегическим решением.

**Что происходит при нехватке:** Сейчас здания просто pause. Предложение: priority system — игрок выбирает, какие здания важнее (factory > separator > storage). Или: здания с наименьшим приоритетом pause первыми.

### 6.5 Elements (элементы фракций)

**Подтверждено кодом:** 4 типа: purple, greenEl, cyanEl, yellowEl. Производятся в separator (1 per cycle). Тратятся на производство юнитов через factory. Storage: 20 each (увеличивается elements_storage).

**Зачем нужны:** Elements = gate для производства юнитов. Без elements = нет армии. Это правильно.

**Как избежать бесполезного накопления:** Сейчас elements копятся, если не производить юнитов. Нужно больше sink'ов: upgrades (2-3 elements per upgrade), special abilities (5 elements для faction ability), tech unlocks (10 elements для advanced building). Без этого elements = «ресурс, который всегда есть в избытке».

**Как использовать чужие элементы:** Сейчас фракция производит только свой element. Чужие элементы бесполезны. Предложение: «Converter» — здание, превращающее 3 чужих element в 1 свой. Или: захваченный enemy separator производит ваш element. Это создаёт incentive для захвата вражеской экономики.

### 6.6 Storage

**Подтверждено кодом:** minerals_storage (+200), energy_storage (+300), elements_storage (+20 each). Здания складов увеличивают лимит.

**Как сделать meaningful:** Сейчас storage = просто «больше места». Предложение: buildings без adequate storage теряют efficiency (separator замедляется, если energy близка к cap). Это заставляет строить склады.

**Как не раздражать лимитами:** Всегда показывать, насколько заполнен storage (progress bar в HUD). Предупреждение за 80% заполнения. Не hard cap (ресурсы не пропадают), а efficiency penalty (separator медленнее, factory медленнее).

### 6.7 Build order

**Текущий early game:** Start → harvester добывает → separator (30 energy) → factory (55 energy) → produce units.

**Что должно быть обязательным:** Separator и factory — без них нет economy и нет армии. Это правильно.

**Что optional:** Storage buildings (можно подождать), power plant (пока хватает HQ), energy_reactor (late-game), repair_center, defense_tower.

**Как не сделать один единственный правильный билд:** Вариативность через: (1) timing — ранний factory vs. ранний harvester; (2) scout decision — если враг рашит, нужны defense; если нет, можно экономить; (3) faction bonus — cyan делает civilian быстрее, yellow делает combat быстрее = разные оптимальные билды.

### 6.8 Production

**Подтверждено кодом:** Factory queue max 2, civilian/combat speed, power gating, faction speed modifiers.

**Предложение:**
- Queue display в UI — игрок видит, что в очереди
- Queue max 3-5 (вместо 2) — меньше micro для массового производства
- Rally point — юниты выходят в указанную точку, а не рядом с factory
- Production hotkey — быстрый заказ юнитов без клика на factory

### 6.9 Upgrades

#### HQ Upgrades

**Что это:** Улучшения HQ: больше power (+10 MW per level), больше starting vision, faster territory spread.  
**Зачем:** Late-game progression без строительства новых зданий.  
**Когда:** Medium-term. Сначала базовые механики.  
**Сложность:** medium.

#### Unit Upgrades

**Что это:** +10% damage, +10% speed, +10% HP для всех юнитов типа.  
**Зачем:** Late-game army improvement; sink для elements.  
**Когда:** Medium-term.  
**Сложность:** medium.

#### Building Upgrades

**Что это:** Faster separator cycle, faster factory production, stronger defense tower.  
**Зачем:** Economic/military progression.  
**Когда:** Medium-term.  
**Сложность:** medium.

#### Faction Upgrades

**Что это:** Уникальные улучшения для каждой фракции. Cyan: separator +1 element output. Green: buildings +20% HP. Yellow: tanks +15% damage. Purple: territory vision +2.  
**Зачем:** Фракционная асимметрия.  
**Когда:** После базовых upgrades.  
**Сложность:** medium.

#### Economy Upgrades

**Что это:** Harvester cargo +5, faster mining, reduced storage penalty.  
**Зачем:** Economic progression.  
**Когда:** Medium-term.  
**Сложность:** low.

#### Vision Upgrades

**Что это:** Scout view +2, sensor beacon duration +30 сек, fog-of-war reveal radius +1.  
**Зачем:** Интеллектуальная progression.  
**Когда:** После scout integration.  
**Сложность:** low.

#### Combat Upgrades

**Что это:** Attack range +1, attack speed +10%, new damage type.  
**Зачем:** Military progression.  
**Когда:** После heavy_tank и defense tower.  
**Сложность:** medium.

---

## 7. Фракции и асимметрия

### 7.1 Cyan (Голубые)

**Подтверждено кодом:** civilianProductionSpeed: 1.10 (+10% к производству гражданских юнитов).

**Стиль игры:** Экономическая фракция — больше юнитов, быстрее development, но каждый юнит «стандартный».

**Усиление бонуса:** 1.10 → 1.20 (+20%) — заметно, но не ломает баланс. Cyan производит builder/harvester/scout на 20% быстрее = быстрее экономика, больше рабочих.

**Экономика:** Separator может иметь +1 element output (за upgrade). Harvester cargo +2 (за upgrade). «Экономический гений» — каждый ресурс считается.

**Разведка:** Стандартная. Cyan не имеет бонуса к vision или scouting — компенсируется большим количеством scout'ов (дешёвых и быстрых).

**Юниты:** Стандартный набор. Уникальный юнит: Economic Drone — дешёвый (0.5 element), медленный, cargo 5, но можно производить 2 за раз (parallel production slot).

**Технологии:** Сепаратор эффективности, storage optimization, production chain upgrades.

**Слабости:** Нет боевого бонуса. В ранней игре уязвима к rush. Если не успеть нарастить экономику — проигрывает.

### 7.2 Green (Зелёные)

**Подтверждено кодом:** buildSpeed: 1.10 (+10% к скорости строительства).

**Стиль игры:** Строительная/оборонительная фракция — быстрее строит, крепче здания, territorial control.

**Усиление бонуса:** 1.10 → 1.25 (+25% к скорости строительства). Green builder строит separator за 20 сек вместо 25, factory за 32 сек вместо 40 — заметная разница.

**Строительство:** Builder может строить 2 здания одновременно (unique ability). Fortification wall (1×3, HP 200, блокирует movement) — уникальное здание.

**Восстановление:** Buildings медленно чинятся автоматически (1 HP/5 сек), если powered.

**Growth:** Territory распространяется быстрее (1 cell/10 сек вместо 15).

**Слабости:** Нет боевого и экономического бонуса. Медленнее наращивает армию. Пассивная игра = потеря инициативы.

### 7.3 Yellow (Жёлтые)

**Подтверждено кодом:** combatProductionSpeed: 1.10 (+10% к производству боевых юнитов).

**Стиль игры:** Агрессивная военная фракция — быстрее производит танки, сильнее атака, но слабее экономика.

**Усиление бонуса:** 1.10 → 1.20 (+20%). Light_tank производится за 29 сек вместо 35. Heavy_tank за 50 сек вместо 60. Разница = лишний танк каждые 3-4 минуты.

**Агрессия:** Light tank +10% damage (unique passive). Assault buggy — уникальный юнит: fast attack unit, HP 50, speed 0.65, damage 8, range 3. Дешёвый (1 element), быстрый, хрупкий — для harassment.

**Слабости:** Нет экономического бонуса. Медленнее строит здания. Если rush не удался — отстаёт экономически.

### 7.4 Purple (Фиолетовые)

**Подтверждено кодом:** territoryViewBonus: 1 (окрашенные клетки раскрывают радиус 2 вместо 1).

**Стиль игры:** Информационная/территориальная фракция — видит больше, контролирует территорию, хирургические удары.

**Усиление бонуса:** territoryViewBonus: 1 → 2 (+2 к radius). Territory даёт vision radius 3 вместо 1. Purple «видит» свою территорию на 3 клетки — огромный информационный advantage.

**Vision:** Scout production speed +30%. Sensor Tower — уникальное здание: stationary, view radius 10, reveals area permanently, cost 3 elements. На порядок лучше observation point.

**Control:** Territory spread radius 7 (вместо 5). Больше территории = больше информации.

**Слабости:** Нет экономического и боевого бонуса. Самая слабая в прямом бою. Должна побеждать через информацию и positioning, а не через грубую силу.

### 7.5 Random faction

**Зачем нужна:** Стандартная опция в RTS — случайный выбор фракции. Для players, которые хотят разнообразия. Для skirmish — не знать заранее, кто за кого играет.

**Как балансировать:** Random = случайный выбор из 4 фракций без дополнительного бонуса. Честный random. Если фракции сбалансированы, random не даёт advantage/disadvantage.

**Бонус random:** Я против бонуса для random — это создаёт incentive выбирать random ради бонуса, а не ради разнообразия. Если фракции интересные и разные, игроки будут выбирать random и без бонуса.

**Риски:** Если фракции сильно асимметричны, random = huge variance в game outcome. Поэтому асимметрия должна быть осторожной (MVP: +20% к одному параметру, не +100%).

### 7.6 Фракционные элементы

**Как использовать собственные элементы:** Текущая схема: собственные elements → производство юнитов. Правильно.

**Как использовать чужие:** Converter (здание, превращающее 3 чужих → 1 свой). Или: захваченный enemy separator производит ваш element.

**Трофеи:** При уничтожении enemy harvester с cargo — часть cargo становится вашими mineral'ами на земле (temporary pickup). При захвате enemy HQ — все enemy elements переходят к вам. Это создаёт incentive для агрессивной игры.

### 7.7 Уникальные юниты и технологии

**MVP-вариант (minimum viable asymmetry):**

| Фракция | Уникальный юнит | Уникальное здание | Уникальный upgrade |
|---------|----------------|-------------------|-------------------|
| Cyan | Economic Drone (cheap, parallel slot) | — | Separator +1 output |
| Green | — | Fortification Wall | Auto-repair buildings |
| Yellow | Assault Buggy (fast, cheap, fragile) | — | Tank +10% damage |
| Purple | — | Sensor Tower | Territory vision +2 |

**Later-вариант (full asymmetry):**

| Фракция | Уникальный юнит | Уникальное здание | Уникальный стиль победы |
|---------|----------------|-------------------|------------------------|
| Cyan | Economic Drone + Transport | Trade Post | Economic dominance |
| Green | Fortification Wall + Engineer | Repair Bay | Territorial control |
| Yellow | Assault Buggy + Bomber v2 | War Factory | Military victory |
| Purple | Stealth Scout + Mobile Radar | Sensor Tower | Intelligence victory |

---

## 8. Боевая система

### 8.1 MVP combat

**Подтверждено кодом:** Light_tank attack: approach → attacking → damage cycle. Damage: instant, no projectile. Buildings attackable. Victory: destroy enemy HQ.

**Что уже работает:** Базовая атака работает. Танк подходит на расстояние атаки и наносит damage.

**Чего не хватает для MVP:**
1. Визуальный feedback (muzzle flash, damage flash) — без него combat «невидим»
2. Error handling — если target умер, attacker не зависает
3. Target validation — нельзя атаковать свой юнит

### 8.2 Attack-move

**Подтверждено кодом:** Attack-move реализован для individual light_tank (A + click). Group attack-move не реализован.

**Когда вводить:** Сейчас. Это стандартная RTS-механика, без которой играть неудобно.

**Как должен работать:** Unit движется к точке. Если по пути видит enemy — атакует. Если enemy убит/ушёл — продолжает движение. Это отличается от manual attack (где unit игнорирует всё, кроме указанной цели).

**Target priority при attack-move:** Ближайший enemy unit → ближайшее enemy building. Scout не атакует никогда. Defense tower атакует nearest enemy.

### 8.3 Target priority

**Предложение:**

| Unit | Priority 1 | Priority 2 | Priority 3 |
|------|-----------|-----------|-----------|
| Light tank | Enemy combat unit | Enemy harvester | Enemy building |
| Heavy tank | Enemy building/defense | Enemy combat unit | Enemy harvester |
| Bomber | Enemy building | Enemy defense tower | Enemy unit |
| Defense tower | Nearest enemy unit | Enemy harvester | — |
| Scout | Не атакует | — | — |

**Приоритет harvester:** В StarCraft атака harvesters = economic harassment. Это важная тактика. Tanks должны атаковать harvesters, если нет боевых целей рядом.

**Приоритет building:** HQ > factory > separator > storage > power plant. Уничтожение production = strategic advantage.

### 8.4 Damage model

**MVP:** Flat damage — каждый юнит наносит фиксированный урон per shot. Просто и понятно.

**Medium-term:** Armor rating — heavy_tank имеет armor 3, снижающий входящий урон на 3 per shot. Light_tank armor 1. Scout armor 0. Это делает heavy_tank устойчивым к light damage, но уязвимым к heavy damage.

**Long-term:** Damage types — kinetic (light/heavy tank), explosive (bomber, artillery), energy (future). Kinetic → слаб против armor. Explosive → сильный против buildings. Energy → игнорирует armor.

**Splash:** Только для bomber и (future) artillery. Splash radius 1.5 tiles. Friendly fire = yes (иначе bombing слишком безопасен).

### 8.5 Unit roles в combat

| Unit | Role | Strength | Weakness |
|------|------|----------|----------|
| Scout | Разведка | Speed, vision | HP 70, no attack |
| Light tank | General combat | Balanced | Not exceptional |
| Heavy tank | Siege, anti-building | Damage, HP | Speed, cost |
| Bomber | Anti-building | Air, high building damage | HP 130, AA vulnerable |
| Defense tower | Base defense | Range, continuous fire | Stationary, power cost |

### 8.6 Buildings combat

**HQ:** HP 1000 (подтверждено). Главное здание. Уничтожение = victory/defeat. Не атакует.

**Defense tower:** HP 420 (предложение). Attack: 8 damage/1.2s, range 7, auto-targets nearest enemy. AA mode: 12 damage/1.5s vs. air units. Power: 8 MW. Cost: 180 energy + 2 elements.

**Repair center:** Не реализован. Предложение: чинит юнитов рядом (5 HP/sec, costs 1 energy/HP). Range 3.

**Walls/gates:** Предложение для Green faction. Wall: HP 200, blocks movement, cost 1 element per segment. Gate: HP 150, opens/closes, cost 2 elements.

### 8.7 Fog of war + combat

**Видимость цели:** Юнит может атаковать только то, что видит (isVisible = true). Если target ушёл в fog — attack cancel.

**Можно ли стрелять в туман:** Нет. Attack order на unseen target = move order к последней известной позиции. Если target найден — attack. Если нет — stop.

**Chase behavior:** Юнит преследует врага до max chase distance (18 tiles от home). Если враг ушёл дальше — return home. Это предотвращает бесконечную погоню.

**Потеря цели:** Если target умер или ушёл в fog — юнит ищет новую цель в attack range. Если целей нет — возвращается к attack-move destination или idle.

### 8.8 UX combat

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| Attack cursor (красный) | Понятно, что это attack order | low |
| Target highlight (красная рамка) | Понятно, кого атакуем | low |
| Range indicator (circle) | Понятно, достанет ли | medium |
| Damage numbers (-12) | Понятно, сколько урона | medium |
| Health change flash | Понятно, что юнит получает урон | low |

### 8.9 Balance risks

**Rush:** Early light_tank rush может быть uncounterable. Solution: defense tower как early defensive option, opening delay для bot (уже есть).

**Turtle:** Бесконечная оборона = скучная игра. Solution: artillery/siege в late-game, resource depletion forcing expansion.

**Bomber imbalance:** Mass bomber может разрушить всё. Solution: AA defense tower, bomber vulnerability, high cost (6 elements).

**Tower spam:** Много defense towers = не пробить. Solution: power limit, siege range > tower range, cost 2 elements per tower.

**Economy harassment:** Убийство harvesters = слишком эффективно. Solution: harvester auto-retreat при атаке, repair center, slightly more HP.

---

## 9. Enemy bot / AI

### 9.1 Bot philosophy

**Мой взгляд:** Для текущего проекта лучше всего подходит **staged state-machine bot** — бот, который проходит через фазы игры, каждая из которых состоит из набора правил. Это не «умный» AI, но и не глупый scripted bot. Это rule-based bot с иерархической структурой.

**Почему не cheating AI:** Cheating AI (знает всю карту, получает бонусные ресурсы) — это quick fix, который создаёт долгосрочные проблемы. Игрок чувствует, что бот «нечестный». Это разрушает доверие к игре. StarCraft AI тоже играет честно (на нормальном уровне).

**Почему не machine learning:** Слишком сложно для текущего проекта. Нет training environment, нет reward function, нет replay data. Rule-based bot с хорошими правилами = 90% эффекта при 10% effort.

**Подход:** Phase-based state machine с rule set для каждой фазы. Каждое правило = простое условие → действие. Это читаемый, тестируемый, настраиваемый подход.

### 9.2 Bot perception

**Текущее состояние (подтверждено кодом):** Bot имеет vision через свои юниты и здания (`FE_PATCH_10B`). Знает `visibleNow`, `lastSeenPosition`, `lastSeenTime`. Но всё ещё есть code paths, использующие full map knowledge (legacy).

**Как бот должен получать информацию:**
1. Vision: бот видит то, что видят его юниты/здания (реализовано)
2. Memory: бот помнит последние виденные позиции (реализовано частично)
3. Inference: бот предполагает, исходя из того, что видел (не реализовано)

**Должен ли бот использовать fog of war:** Да, обязательно. Bot vision = player vision. Никакого всеведения. Это не только честно, но и интересно — бот может «удивляться» player actions.

### 9.3 Bot memory

**Что бот должен помнить:**

| Тип информации | Сколько хранить | Как использовать |
|----------------|-----------------|------------------|
| Player unit position | 30 сек (easy), 60 сек (normal), 120 сек (hard) | Target для scouting, attack decisions |
| Player building position | Вечно (once seen) | Attack target priority |
| Player harvester location | 60 сек | Economic harassment target |
| Resource locations | Вечно (once seen) | Expansion decisions |
| Danger zones (где потерял юнитов) | 120 сек | Avoidance / caution |
| Scout results | До следующего scout | Decision making |
| Chokepoints | Статические (вычисляются один раз) | Movement planning |

**Memory decay:** Информация устаревает. 30 секунд назад видел 3 танка — возможно, уже 5. 2 минуты назад — возможно, уже 8 или 0. Decay rate зависит от difficulty.

### 9.4 Bot prediction

**Простые эвристики (можно реализовать сейчас):**

1. **«Вижу 2+ harvesters» → player строит экономику** → можно атаковать раньше (пока army слабая)
2. **«Вижу factory» → player может производить танки** → scouting priority: проверить, сколько танков
3. **«Не видел player 60+ сек» → player может строить hidden expansion** → scout expansion zones
4. **«Вижу 3+ танка» → player готовит атаку** → defend priority
5. **«Player HQ неповреждён» → player likely still strong** → don't rush

**Не нужно точное ML.** Нужно несколько if-then правил, которые дают «разумное» поведение. Цель — не идеальное prediction, а поведение, которое выглядит логичным для игрока.

### 9.5 Bot scouting

**Зачем бот scout:** Без информации бот слеп. Атака вслепую = waste армии. Scout = investment, который окупается через лучший decision making.

**Как выбрать scout unit:** Scout unit (если есть) → light_tank (fallback). Scout быстрее и с большим обзором, но хрупкий. Light_tank медленнее, но может защитить себя.

**Как выбирать точки разведки:**
1. Last known player position (если > 30 сек не проверяли)
2. Expansion zones (между стартами и центром)
3. Center of map (infinite mine control)
4. Random probe (неисследованная территория)
5. Player likely building locations (near resources)

**Как не отправлять scout бессмысленно:**
- Minimum interval между scout missions: 30 сек (easy), 20 сек (normal), 10 сек (hard)
- Если scout погиб — не отправлять в ту же зону 60 сек
- Если недавно уже разведывали (< 15 сек) — не дублировать
- Max 1 scout mission одновременно (не весь army отправлять на разведку)

**Как бот реагирует, если scout погиб:** Запомнить зону как «dangerous». Отправить следующий scout в другую зону или в ту же с боевой поддержкой (light_tank escort).

### 9.6 Bot economy

**Build order (подтверждено из roadmap):**
```
Start: 2 harvesters + 1 builder + 1 light_tank
→ Harvesters gather minerals
→ Builder builds separator (30 energy)
→ Separator produces energy + elements
→ Builder builds factory (55 energy)
→ Factory produces light_tank (2 elements, 35 sec)
→ Cycle: more harvesters → more elements → more tanks
```

**Когда строить нового harvester:** Если minerals не добываются (все mines заняты/истощены) → expansion harvester. Если elements < 2 и нет элемента для tank → нужна добыча.

**Когда строить scout:** Если нет scout и есть 1 spare element. Max 2 scout'а.

**Когда строить tank:** Всегда, когда есть 2 elements. Production priority: tank > scout > harvester > builder.

**Когда строить defense tower:** Если player виден рядом с base. Или: если army score < player army estimate.

### 9.7 Bot combat

**Early harassment (5-8 min):** 1-2 light_tanks атакуют player harvesters. Цель: economic damage, не уничтожение. Отступление при потере 1 танка.

**Small attack waves (8-12 min):** 2-3 light_tanks атакуют player buildings. Цель: pressure. Отступление при сильном resistance.

**Medium attack waves (12-18 min):** 3-5 light_tanks + 1 heavy_tank. Цель: серьёзный damage. Target: factory, separator.

**Big push (18+ min):** 5+ tanks + bomber support. Цель: уничтожение HQ. Commitment: не отступать, пока есть шанс.

**Target priority:** Harvesters > factory > separator > HQ. Экономический damage > прямой attack. Но при достаточной силе — идти на HQ.

**Retreat conditions:** Потеряно > 50% attack force. Player reinforcements > bot remaining. Chase distance > 18 tiles от home.

### 9.8 Bot difficulty levels

| Параметр | Easy | Normal | Hard |
|----------|------|--------|------|
| Vision radius | Стандарт | Стандарт | Стандарт |
| Resource multiplier | ×1.0 | ×1.0 | ×1.0 |
| Reaction time | 3.0 сек | 1.5 сек | 0.5 сек |
| Attack frequency | Редко (каждые 5+ мин) | Умеренно (3-4 мин) | Часто (2-3 мин) |
| Build speed | Стандарт | Стандарт | Стандарт |
| Scouting accuracy | Случайные точки | Targeted scouting | Strategic scouting |
| Memory duration | 30 сек | 60 сек | 120 сек |
| Micro quality | Нет micro | Basic focus fire | Good target selection |
| Opening delay | 16 сек | 10 сек | 5 сек |
| Retreat threshold | Рано (50% losses) | Умеренно (60%) | Поздно (75%) |

**Ключевой принцип:** Difficulty = поведение, не ресурсы. Easy = медленный, предсказуемый, неадаптивный. Hard = быстрый, стратегический, адаптивный. Ресурсы одинаковые.

### 9.9 Bot personality

| Personality | Стиль | Когда атакует | Когда защищается |
|-------------|-------|---------------|------------------|
| Aggressive | Ранний rush, постоянный pressure | Как можно раньше | Минимально |
| Economic | Фокус на экономику, поздняя армия | Только при advantage | Когда экономика под угрозой |
| Defensive | Оборона базы, counter-attacks | После отражения атаки | Всегда |
| Scout-heavy | Постоянная разведка, surgical strikes | По результатам разведки | При обнаружении угрозы |

**Связь с фракциями:** Yellow = aggressive по умолчанию. Green = defensive. Cyan = economic. Purple = scout-heavy. Но personality ≠ faction — можно играть Yellow defensive или Green aggressive.

### 9.10 Bot state machine

```
OPENING (0-10 сек)
  ├─ Условие входа: старт игры
  ├─ Действия: harvesters добывают, builder строит separator
  └─ Условие выхода: separator complete → SCOUTING

SCOUTING (10-120 сек)
  ├─ Условие входа: separator работает
  ├─ Действия: отправить scout к player territory
  └─ Условие выхода: scout нашёл player base → ECONOMY

ECONOMY (120-300 сек)
  ├─ Условие входа: есть разведданные
  ├─ Действия: строить factory, производить юнитов, storage
  └─ Условие выхода: factory complete + 2+ танка → DECISION

DECISION (постоянно)
  ├─ Если player army > bot army → DEFENDING
  ├─ Если bot army > player army → PREPARING_ATTACK
  ├─ Если info устарела → SCOUTING
  └─ Если экономика слабая → ECONOMY

DEFENDING
  ├─ Условие входа: player army > bot army или player рядом с base
  ├─ Действия: tanks near base, defense tower, scout enemy
  └─ Условие выхода: threat neutralised → DECISION

PREPARING_ATTACK
  ├─ Условие входа: bot army > player army
  ├─ Действия: accumulate forces, scout target, choose attack vector
  └─ Условие выхода: army ready + target identified → ATTACKING

ATTACKING
  ├─ Условие входа: army ready + target identified
  ├─ Действия: move army to target, attack, monitor losses
  └─ Условие выхода: target destroyed / losses > 50% → RECOVERING

RECOVERING (15-30 сек)
  ├─ Условие входа: атака завершена (успех или неудача)
  ├─ Действия: regroup near base, rebuild economy, produce replacements
  └─ Условие выхода: army restored → DECISION

EXPANDING (опционально)
  ├─ Условие входа: ресурсы истощены + есть spare elements
  ├─ Действия: build 2nd base near expansion resources
  └─ Условие выхода: expansion established → ECONOMY

FINAL_PUSH (late-game)
  ├─ Условие входа: bot имеет значительное преимущество
  ├─ Действия: all-in attack на player HQ
  └─ Условие выхода: victory или defeat
```

### 9.11 Bot telemetry

**Текущее состояние (подтверждено кодом):** 6 telemetry objects: enemyTargetingMvp, enemyScoutingMvp, enemyAutopilotMvp, enemyStrengthEstimateMvp, enemyRetreatMvp, enemyDifficultyMvp.

**Что нужно добавить:**

| Поле | Зачем |
|------|-------|
| currentPhase | Какая фаза сейчас |
| currentGoal | Текущая цель (scout, build, attack, defend) |
| scoutingTarget | Куда отправлен scout |
| attackTarget | Куда направлена атака |
| lastSeenPlayerPosition | Где последний раз видели player |
| threatScore | Оценка угрозы (0-100) |
| economyScore | Оценка своей экономики (0-100) |
| armyScore | Оценка своей армии (0-100) |
| playerArmyEstimate | Оценка армии player |
| chosenPlan | Текущий план (attack/defend/scout/economy) |
| decisionReason | Почему принято решение |

### 9.12 Bot roadmap

**MVP bot (текущий уровень):** ✅ Реализовано. Phase bot + economy chain + vision + difficulty.

**Better scripted bot (1-2 недели):** Bot tuning (10F1B/10G1B/10H1B/10I1B). Scout integration. Hard difficulty. Это минимальные улучшения, которые делают бота играбельным.

**Rule-based bot (1 месяц):** State machine из 9.10. Memory system из 9.3. Prediction heuristics из 9.4. Scouting priorities из 9.5. Economy discipline из 9.6. Combat tactics из 9.7.

**Strategic bot (2-3 месяца):** Personality profiles. Adaptive strategy. Expansion logic. Multi-factory coordination. Late-game decision making.

**Multiplayer alternative:** Когда/если будет multiplayer — bot AI = основа для серверного game logic. Та же state machine, но с network synchronization.

**Что опасно делать сейчас:**
- Полный rewrite bot AI (слишком рискованно, текущий работает)
- Machine learning (нет infrastructure, нет data)
- Cheating AI (нарушает design philosophy)
- Multi-bot coordination (текущая архитектура не поддерживает > 2 sides)

**Что требует рефакторинга:**
- Multi-owner system (для 4-player FFA)
- Bot class extraction из main.js (для testability)
- Shared helper dedup (7× copies → 1 shared module)

---

## 10. Новые gameplay-фишки

### 10.1 Neutral objectives

### Идея: Observation Tower (Xel'Naga Tower)

**Что это:** Neutral building на карте. Юнит, стоящий рядом, получает +3 vision radius. Контролируется тем, чей юнит ближе.

**Зачем игроку:** Contestable map objective даже без combat. Control information = advantage.

**Почему я так думаю:** В StarCraft II observation towers — одна из лучших механик для early-game interest. Не требует боя, но создаёт tension.

**Что уже есть:** Fog of war system, unit vision, territory system.

**Чего не хватает:** Neutral building concept, capture mechanic, vision boost.

**Сложность:** medium
**Риск:** низкий
**Зависимости:** Fog of war system (уже работает)
**МVP-вариант:** 2-3 towers на карте, static vision bonus для ближайшего юнита.
**Полноценная версия:** Capture mechanic + territory-based control + visual indicator.
**Стоит делать сейчас?** Позже. Сначала basic gameplay должен быть стабильным.

### 10.2 Artifacts / relics

### Идея: Центральный артефакт

**Что это:** Unique object в центре карты. Контроль территории вокруг артефакта даёт +1 element per separator cycle. Holder = экономическое advantage.

**Зачем игроку:** Late-game objective. Centre = contestable. Не только combat, но и economic advantage.

**Сложность:** medium
**Риск:** средний
**Стоит делать сейчас?** Позже. Сначала basics.

### 10.3 Tech tree

### Идея: Простое дерево технологий

**Что это:** 3 уровня улучшений. Level 1: basic upgrades (дешёвые). Level 2: advanced upgrades. Level 3: faction-specific upgrades.

**Зачем игроку:** Late-game progression. Sink для elements и energy. Каждый game разный (разные upgrade paths).

**Сложность:** medium
**Риск:** средний
**МVP-вариант:** 5 upgrades: tank damage +10%, tank HP +10%, harvester cargo +5, separator speed +15%, vision +1.
**Полноценная версия:** Branching tree с mutually exclusive choices.
**Стоит делать сейчас?** Через 2-3 недели. После bot tuning и combat feedback.

### 10.4 Territory mechanics

**Текущее состояние (подтверждено кодом):** Territory spread от зданий, radius 5, 1 cell/15 сек. Territory даёт vision bonus.

**Новые идеи:**

| Идея | Зачем | Сложность | Когда |
|------|-------|-----------|-------|
| Territory as build influence | Можно строить только на своей территории | medium | 1 месяц |
| Territory as resource boost | Mines на своей территории дают +20% yield | low | 2-3 недели |
| Territory conflict | Перекрывающаяся territory = contested zone | medium | Позже |
| Territory decay | Territory без nearby building slowly decays | low | Позже |

### 10.5 Events

| Идея | Зачем | Сложность | Когда |
|------|-------|-----------|-------|
| Sandstorm (vision -2 на 30 сек) | Dynamism | medium | Позже |
| Mineral surge (×2 yield на 30 сек) | Economic opportunity | low | Позже |
| Volcano eruption (damage zone) | Area denial | high | Much later |
| Resource meteor (new temporary mine) | Expansion incentive | medium | Позже |

**Моя оценка:** Events — интересно, но отвлекает от core gameplay. Добавлять только после того, как core loop станет fun.

### 10.6 Missions / scenarios

| Тип | Зачем | Сложность | Когда |
|-----|-------|-----------|-------|
| Tutorial | Обучение новым игрокам | medium | 1 месяц |
| Skirmish | Текущий режим | ✅ работает | — |
| Survival (waves of enemies) | Challenge | medium | Позже |
| Capture center | Alternative victory | medium | Позже |
| Escort/defend | Mission variety | high | Much later |

### 10.7 Progression

| Идея | Зачем | Сложность | Когда |
|------|-------|-----------|-------|
| Achievements (first win, fast win) | Motivation | low | 2-3 недели |
| Difficulty progression | Challenge curve | low | 2 недели |
| Unlockable factions | Progression reward | low | 1 месяц |
| Campaign (later) | Content | very high | Much later |

### 10.8 UX helpers

| Идея | Зачем | Сложность | Когда |
|------|-------|-----------|-------|
| «Next recommended action» hint | Onboarding | medium | 1 месяц |
| Idle worker notification | Не забыть про idle | low | 2 недели |
| Production complete toast | Awareness | low | 2 недели |
| Under attack warning | Emergency awareness | low | 2 недели |
| Resource cap warning | Economic awareness | low | 2 недели |

---

## 11. UI / UX

### 11.1 HUD

**Текущее состояние:** HUD показывает minerals, energy, elements, power. Читаемо, но минимально.

**Что добавить:**

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| Resource change indicators (+10, -2) | Economic feedback | low |
| Resource cap progress bars | Storage awareness | low |
| Power status indicator (green/yellow/red) | Power management | low |
| Game clock | Timing awareness | low |
| Population count (если будет limit) | Army awareness | medium |

### 11.2 Production UI

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| Queue display (что производится) | Awareness | low |
| Production progress bar | Timing | low |
| Disabled state с reason | Why can't produce | low |
| Cost display в кнопках | Economic decision | low |
| Hotkeys (1=builder, 2=harvester, 3=tank, 4=scout) | APM | low |

### 11.3 Unit command panel

| Команда | Зачем | Сложность | Когда |
|---------|-------|-----------|-------|
| Move (right-click) | ✅ Работает | — | — |
| Stop (S) | Cancel current action | low | Сейчас |
| Attack (A + click) | ✅ Работает | — | — |
| Attack-move (A + ground) | ✅ Работает (individual) | — | — |
| Patrol (P) | Area control | medium | Позже |
| Hold position (H) | Don't chase | low | 2 недели |

### 11.4 Minimap

**Нужна ли:** Да. Безусловно. RTS без minimap = слепая игра. Это не luxury, это necessity.

**Когда:** 2-3 недели. После bot tuning и combat feedback.

**Как сделать в canvas:** Отдельный canvas element в углу экрана. Масштабированная версия карты: terrain, territory, units (dots), fog. Click для перемещения камеры.

**Что показывать:** Terrain (shade), territory (faction color), units (colored dots: green=player, red=enemy), buildings (larger dots), fog (dark overlay).

### 11.5 Selection UX

**Подтверждено кодом:** Single select ✅, drag select ✅, double-click same type ✅ (light_tank only).

**Что добавить:**

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| Ctrl+1-9: control groups | Fast army selection | medium |
| Tab: cycle selected units | Group management | low |
| Selected unit info panel | Stats, state, orders | medium |
| Multi-unit panel (icons + HP) | Group overview | medium |

### 11.6 Feedback

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| Click marker (move) | ✅ Работает | — |
| Attack marker (red) | Attack confirmation | low |
| Cannot move marker (red X) | Clear feedback | low |
| Resource floating text (+10 minerals) | Economic feedback | medium |
| Damage feedback (red flash) | Combat feedback | low |
| Construction progress bar | Building awareness | low |

### 11.7 Menus

**Текущее состояние:** Main menu ✅, pause ✅, result ✅. Settings = basic.

**Что улучшить:**

| Элемент | Зачем | Сложность |
|---------|-------|-----------|
| UI scale (100/125/150%) | Accessibility | low |
| Save slots (3+) | Convenience | low |
| Difficulty selector | Player choice | low |
| Hotkey reference | Learning | low |
| Audio volume | When sound added | low |

### 11.8 Tutorial / onboarding

**Первые 5 минут:**

1. «Добро пожаловать в Four Elements. Выберите фракцию.» — Показать бонусы каждой фракции простым текстом.
2. «Это ваши стартовые юниты: сборщик, строитель, лёгкий танк. Клик для выбора, правый клик для перемещения.» — Highlight каждого юнита.
3. «Отправьте сборщика к минералам.» — Highlight ближайшего mine.
4. «Постройте сепаратор для переработки сырья.» — Builder → build menu → separator.
5. «Постройте фабрику для производства армии.» — Builder → build menu → factory.
6. «Разведайте карту, чтобы найти врага.» — Produce scout → send to explore.
7. «Уничтожьте штаб врага для победы!» — Attack command.

**Сложность:** medium. Но impact огромный — без tutorial большинство новых игроков бросают игру через 2 минуты.

---

## 12. Архитектура и main.js

### 12.1 Оценка текущего риска

**Почему большой main.js опасен:**

1. **Один патч может сломать всё** — все системы связаны через closure scope
2. **Нет изоляции** — баг в dust particles может сломать combat
3. **7× дублирование** — изменение helper функции нужно делать в 7 местах
4. **Нет unit-тестов** — только E2E, которые медленные и неполные
5. **Нет dependency injection** — функции обращаются к closure variables напрямую
6. **Каждый новый патч рискованнее предыдущего** — код растёт, dependencies усложняются

**Что ломается чаще всего:** Bot AI (самая сложная система, больше всего патчей, больше всего дублирования). Movement (взаимодействие с pathfinding, terrain, collision). Visual calibration (DIR_MAP, offsets, ring positions — всё hardcoded).

**Почему patching становится рискованным:** Каждый новый патч добавляет код в уже перегруженный файл. Новые функции добавляются с уникальными префиксами (FE_10C1_, FE_10D1_), что увеличивает когнитивную нагрузку. Откат патча = revert всего commit, потому что изменения перемешаны.

### 12.2 Модульная структура

| Модуль | Что вынести | Строк | Приоритет |
|--------|-------------|-------|-----------|
| `coordinates.js` | tileToWorld, worldToTile, screenToTile, clamp, dist, inBounds | ~80 | Phase 1 |
| `constants.js` | TILE_W, TILE_H, MAP_SIZES, BASE_STORAGE, separator formula, economy constants | ~60 | Phase 1 |
| `patterns.js` | Resource patterns, obstacle patterns | ~150 | Phase 1 |
| `helpers.js` | Shared helpers: getGameObject, isEnemyUnit, distTiles, getEnemyHQ | ~100 | Phase 1 |
| `mapgen.js` | makeArrays, generateResourceClusters, generateMap, obstacle helpers | ~530 | Phase 2 |
| `debug.js` | debugLog, safeCloneForLog, exportDebugLog, snapshot, enemy economy panel | ~400 | Phase 2 |
| `particles.js` | Dust system: spawn, update, draw | ~200 | Phase 2 |
| `fog.js` | updateFog, reveal, isVisible, footprintVisible | ~130 | Phase 3 |
| `territory.js` | claimTerritoryCell, updateTerritory | ~100 | Phase 3 |
| `economy.js` | getStorageLimits, addResource, updateProduction, queueUnitProduction | ~400 | Phase 3 |
| `combat.js` | Light tank combat, damageUnit, destroyUnit, attack approach | ~800 | Phase 3 |
| `enemy_bot.js` | All FE_10*, FE_PATCH_08B*, FE_PATCH_09* functions, updateEnemyBot | ~2500 | Phase 4 |
| `builder.js` | updateBuilder, orderBuild, build cost, cancel, resume | ~2000 | Phase 4 |
| `harvester.js` | updateHarvester, startHarvester, assignNextMine | ~600 | Phase 4 |
| `movement.js` | findPath, updateUnitMovement, path recovery | ~500 | Phase 4 |
| `ui.js` | HUD, menus, selection panel, factory menu | ~600 | Phase 4 |
| `input.js` | Click, keyboard, drag select handlers | ~800 | Phase 4 |
| `rendering.js` | drawTile, drawSprite, drawUnit, drawBuilding, render | ~1300 | Phase 4 |
| `save_load.js` | Already partially in FE_SAVE_MANAGER | ~100 | Phase 3 |

### 12.3 Порядок безопасного выноса

#### Phase 1: Нулевой риск

**coordinates.js:**
- Что вынести: 7 pure functions, no state
- Почему первым: Zero risk, упрощает тестирование
- Как проверить: `node --check` + Playwright smoke
- PR: 1 commit, ~80 строк

**constants.js:**
- Что вынести: Все hardcoded values из main.js
- Почему первым: Позволяет tuning без code changes
- Как проверить: Сравнить runtime values до и после
- PR: 1 commit, ~60 строк

**helpers.js (dedup):**
- Что вынести: 7× getGameObject, 4× isEnemyUnit, 4× distTiles, 4× getEnemyHQ → 1 copy each
- Почему первым: Убирает ~500 строк дублирования, уменьшает баг-поверхность
- Как проверить: `node --check` + bot AI telemetry unchanged
- PR: 1 commit, net -400 строк

#### Phase 2: Низкий риск

**mapgen.js:**
- Что вынести: Вся генерация карты (runs once, easy to test in isolation)
- Почему: Самый большой standalone блок, нет runtime dependencies
- Риск: Низкий — запускается один раз
- Как проверить: Generate map, compare с baseline
- PR: 1 commit, ~530 строк

**debug.js:**
- Что вынести: Все debug/logging функции
- Почему: Read-only, не влияет на gameplay
- Риск: Низкий
- PR: 1 commit, ~400 строк

**particles.js:**
- Что вынести: Dust system
- Почему: Self-contained visual system
- Риск: Низкий
- PR: 1 commit, ~200 строк

#### Phase 3: Средний риск

**fog.js, territory.js, economy.js, combat.js:**
- Риск: Средний — эти системы вызываются каждый кадр или влияют на gameplay
- Требуется: Careful interface design, comprehensive smoke testing
- Каждый модуль = отдельный PR
- Не менять interface одновременно с extraction

#### Phase 4: Высокий риск

**enemy_bot.js, builder.js, harvester.js, movement.js, ui.js, input.js, rendering.js:**
- Риск: Высокий — глубокая интеграция с closure scope
- Требуется: Significant refactoring, dependency injection
- Лучше делать после Phase 1-3, когда архитектура яснее
- Рассмотреть Codex для review

### 12.4 Что нельзя трогать первым

- **Render loop** (`update(dt)`, `render()`, `loop(now)`) — зависит от всего
- **Pathfinding** (`findPath`) — performance-critical, вызывается часто
- **Combat** (`updateLightTankCombat`) — core gameplay, много dependencies
- **Save/Load** — serialization tight-coupled с game state shape
- **Bot state** (`game._enemyBotState`) — сложная структура, много subsystem dependencies
- **Coordinate conversions** — используются везде, но extraction safe (pure functions)

### 12.5 Anti-regression strategy

1. **`node --check`** — обязательный после каждого PR
2. **Playwright smoke** — запускать после каждого extraction PR
3. **Spawn tests** — FE_DEV_SPAWN_UNIT для каждого типа юнита
4. **Visual checklist** — screenshot comparison для key screens
5. **Helper scripts** — automated diff analysis
6. **Feature flags** — `FE_UNIT_CONTROLLER_ENABLED` pattern для safety rollout

### 12.6 Когда нужен Codex

| Задача | Исполнитель | Почему |
|--------|-------------|--------|
| Dedup helpers (Phase 1) | GLM | Simple, low risk |
| Extract coordinates/constants (Phase 1) | GLM | Pure functions |
| Extract mapgen (Phase 2) | GLM | Standalone, testable |
| Extract debug/particles (Phase 2) | GLM | Self-contained |
| Extract fog/territory (Phase 3) | Codex review | Runtime-critical |
| Extract economy (Phase 3) | Codex | Core gameplay |
| Extract combat (Phase 3) | Codex | High risk |
| Extract bot AI (Phase 4) | Codex | Most complex system |
| Extract builder/harvester (Phase 4) | Codex | Deep integration |
| Delete unit_controller.js | GLM | Dead code removal |

---

## 13. Движок, платформа, сайт и онлайн

### 13.1 Остаться на vanilla JS/canvas

**Плюсы:** Ноль migration risk, всё работает, нет dependencies, полный контроль, любой браузер.

**Минусы:** Нет GPU acceleration, нет sprite batching, performance ceiling, нет built-in audio/physics/input, ручное управление всем.

**Сколько можно прожить:** 3-6 месяцев при текущем масштабе (< 50 юнитов на карте, < 60 FPS requirement). При добавлении heavy_tank, bomber, defense tower — до 100+ юнитов, Canvas 2D начнёт тормозить.

**Когда станет тесно:** 200+ sprites per frame, large maps (96×96), particle effects > 100, complex rendering (shadows, lighting).

### 13.2 PixiJS

**Зачем:** WebGL sprite batching = 10-100× faster rendering. Built-in interaction, filters, particles, text. 2D-focused.

**Выгоды:** GPU rendering, automatic batching, built-in sprite sheet support, filters (glow, blur), faster development for visual features.

**Риски миграции:** Rewrite всего rendering (2000+ строк). Новый API для всего visual. Learning curve. Potential bugs в WebGL fallback.

**Когда переходить:** Когда FPS падает ниже 30 при 100+ юнитов. Или: когда нужен sprite atlas / particle system / filters, которые на Canvas 2D слишком медленные.

**Моя оценка:** PixiJS = наиболее прагматичный путь, если Canvas станет узким местом. Миграция render-only, не game logic.

### 13.3 Phaser

**Плюсы:** Full framework (physics, audio, scenes, tilemaps). Large community. Proven for 2D games.

**Минусы:** Complete rewrite. Opinionated architecture. Bundle size. Less control over rendering pipeline. Not ideal для RTS (designed для platformers/puzzles).

**Подходит ли RTS:** Частично. Phaser's scene system = good для menu/game split. Но physics engine не нужен для RTS. Tilemap support = good для terrain. RTS-specific logic (pathfinding, fog, territory) = всё равно custom.

**Моя оценка:** Phaser = overkill для этого проекта. Если делать complete rewrite — лучше Godot.

### 13.4 Godot

**Плюсы:** Full engine, visual editor, GDScript/C#, web export, proven for 2D. Scene system идеально подходит для RTS units/buildings. Built-in pathfinding, tilemap, animation.

**Минусы:** Complete rewrite (все 12 000+ строк). Web export = large download (~20MB). Learning curve. Different paradigm (scene-based vs. code-only). GDScript ≠ JavaScript.

**Веб-экспорт:** Работает, но heavier чем pure HTML/JS. Demo через web = возможно, но не так быстро как GitHub Pages.

**Цена миграции:** 2-3 месяца full-time work. Все gameplay systems нужно переписать с нуля. Assets = reusable, но logic = нет.

**Моя оценка:** Godot = правильный выбор, если проект превращается в «serious indie game» с командой. Для one-person browser project = слишком дорого.

### 13.5 Unity

**Плюсы:** Industry standard, massive ecosystem.

**Минусы:** Overkill для 2D browser RTS. WebGL export = huge download (~50MB+). Unity WebGL runtime issues. Not designed для browser-first games.

**Моя оценка:** Unity = нет для этого проекта. Это как использовать бульдозер для посадки цветов.

### 13.6 GitHub Pages как demo

**Что можно:** Single-player game, save/load (localStorage), bot AI, static assets, shareable link.

**Чего нельзя:** Real-time multiplayer, server-side saves, leaderboards, WebSocket, custom server logic, dynamic content.

**Ограничения:** 100MB repo size (soft), 1GB bandwidth/month (soft), no server-side processing, no custom HTTP headers, no WebSocket.

**Моя оценка:** GitHub Pages = отличный demo hosting. Не пытаться сделать его «полноценным сайтом». Demo = GitHub Pages, full site = separate hosting если/когда понадобится.

### 13.7 Отдельный сайт

**Когда нужен:** Когда проект получает community и нужен custom domain, leaderboards, forums, documentation.

**Где хостить:** Vercel/Netlify (free tier), или VPS ($5-20/month).

**Зачем:** SEO, custom domain, server-side features, analytics.

**Что даст игроку:** Leaderboards, save sync, community features, better discoverability.

**Моя оценка:** Позже. Когда игра будет «достаточно хороша» для публичного release.

### 13.8 Backend

**Когда нужен:** Когда нужны: leaderboards, save sync, accounts, multiplayer, analytics, telemetry.

**Минимальный backend:** Firebase/Supabase free tier — authentication, real-time database, static hosting. Leaderboards + save sync = 1-2 дня работы.

**Full backend:** Node.js + PostgreSQL + WebSocket. Accounts, matchmaking, rooms, authoritative server. 1-3 месяца работы.

**Моя оценка:** Firebase для leaderboards/save sync = realistic quick win (2 недели). Full backend = позже, только если будет multiplayer.

### 13.9 Online multiplayer

**Real-time multiplayer:**
- Сложность: Very high
- Требует: Authoritative server, state synchronization, lag compensation, rollback
- RTS + network = hardest genre для multiplayer
- StarCraft потратил годы на netcode
- Моя оценка: Не в ближайший год. Это отдельный проект.

**Asynchronous multiplayer:**
- Идея: Turn-based RTS (каждый ход = 5-10 сек real-time)
- Сложность: Medium
- Проблема: RTS не работает как turn-based
- Моя оценка: Возможно как эксперимент, но не приоритет

**Co-op vs bot:**
- Идея: 2 players vs 1 hard bot
- Сложность: Medium (shared game state, split screen or shared view)
- Моя оценка: Interesting, но требует multi-owner system

**PvE leaderboard:**
- Идея: Score based on: time to win, units lost, resources gathered
- Сложность: Low (Firebase leaderboard)
- Моя оценка: Quick win, можно сделать за 2-3 дня

**WebSocket backend:**
- Требует: VPS, socket.io, matchmaking, rooms
- Сложность: High
- Моя оценка: Только если будет real multiplayer

**Мой вердикт:** Сначала PvE bot-first до состояния «каждая партия интересна». Потом leaderboard. Потом думать про multiplayer. Честная оценка: multiplayer = минимум 3-6 месяцев отдельной работы, не раньше.

---

## 14. Тестирование и инструменты

### 14.1 Smoke tests

| Тест | Что проверяет | Сложность |
|------|---------------|-----------|
| Game boots | Страница загружается, canvas виден | ✅ Есть |
| Spawn each unit type | Каждый тип юнита создаётся без ошибок | low |
| Move unit | Юнит перемещается по команде | low |
| Produce unit | Factory производит юнита | medium |
| Attack target | Light_tank атакует target | medium |
| Save/load round-trip | Save → load = same state | medium |

### 14.2 Visual tests

| Тест | Что проверяет | Сложность |
|------|---------------|-----------|
| Unit centering | Юнит по центру клетки | medium |
| Direction maps | Правильная ориентация спрайтов | medium |
| Selection rings | Ring под юнитом | low |
| HP bars | Bar над юнитом | low |
| Map rendering | Все tiles видны | low |

### 14.3 Bot tests

| Тест | Что проверяет | Сложность |
|------|---------------|-----------|
| Scouting telemetry | Bot отправляет scout | medium |
| Build order | Bot строит separator → factory | medium |
| No stuck states | Bot не зависает | medium |
| Attack wave | Bot атакует после подготовки | high |

### 14.4 Economy tests

| Тест | Что проверяет | Сложность |
|------|---------------|-----------|
| Resource generation | Harvester добывает minerals | medium |
| Production cost | Factory тратит elements | low |
| Storage limits | Resources cap на storage limit | medium |
| No deadlock | Economy не застревает | high |

### 14.5 Playwright

**Автоматизировать:**
- New game flow ✅
- Bot AI subsystem init ✅
- Difficulty switch ✅

**Не стоит автоматизировать:**
- Visual balance (subjective)
- Bot behavior quality (needs human judgement)
- Fun factor (can't test)

### 14.6 Asset validation

| Проверка | Что | Сложность |
|----------|-----|-----------|
| Missing files | Все sprite paths существуют | low |
| PNG alpha | Правильный alpha channel | low |
| Sprite dirs | Все 8 directions есть | low |
| Size | Размер в пределах допуска | low |
| Anchors | Anchor point в ожидаемом диапазоне | medium |

### 14.7 PR checklist

```text
□ node --check src/main.js → PASS
□ node --check других изменённых JS → PASS
□ Playwright smoke → PASS
□ Manual smoke (play a game) → PASS
□ PATCH_REPORT.txt updated
□ Roadmap updated
□ No unintended side effects
□ Git diff reviewed
□ No hardcoded values that should be in config
□ No duplicate code that should use shared helper
□ Changed area matches expected scope
```

---

## 15. Предложенный roadmap GLM

### 15.1 Next 1 week

| # | Задача | Исполнитель | Lane | Сложность | Риск | Area |
|---|--------|-------------|------|-----------|------|------|
| 1 | Bot tuning 10F1B (пустой knowledge) | GLM | Review | low | low | main.js bot |
| 2 | Bot tuning 10H1B (чрезмерный retreat) | GLM | Review | low | low | main.js bot |
| 3 | Bot tuning 10I1B (Easy слишком пассивный) | GLM | Review | low | low | main.js bot |
| 4 | Try/catch в update(dt) | GLM | Review | low | нет | main.js loop |
| 5 | Muzzle flash overlay при атаке | GLM | Review | low | low | main.js render |
| 6 | Damage flash на целевом юните | GLM | Review | low | low | main.js render |
| 7 | Dedup 7× helpers → shared module | GLM | Review | low | low | main.js bot |

### 15.2 Next 2 weeks

| # | Задача | Исполнитель | Lane | Сложность | Риск | Area |
|---|--------|-------------|------|-----------|------|------|
| 8 | PATCH-SCOUT-04: Bot использует scout | GLM | Review | medium | medium | main.js bot |
| 9 | PATCH-SCOUT-05: Bot производит scout | GLM | Review | medium | medium | main.js bot |
| 10 | Extract coordinates.js | GLM | Review | low | нет | main.js |
| 11 | Extract constants.js | GLM | Review | low | нет | main.js |
| 12 | Production queue UI display | GLM | Review | low | low | main.js UI |
| 13 | Hotkey S = stop, B = build | GLM | Review | low | low | main.js input |
| 14 | Economy constants → config | GLM | Review | low | нет | main.js + config |

### 15.3 Next 1 month

| # | Задача | Исполнитель | Lane | Сложность | Риск | Area |
|---|--------|-------------|------|-----------|------|------|
| 15 | Heavy_tank combat implementation | GLM/Codex | Review | medium | medium | main.js combat |
| 16 | Defense tower implementation | GLM/Codex | Review | medium | medium | main.js combat + buildings |
| 17 | Minimap | GLM | Review | medium | low | main.js UI + canvas |
| 18 | Tech tree v1 (5 basic upgrades) | GLM/Codex | Review | medium | medium | main.js economy |
| 19 | Save slots (3+) | GLM | Review | low | low | save_manager.js |
| 20 | Extract mapgen.js | GLM | Review | low | low | main.js |
| 21 | Delete unit_controller.js dead code | GLM | Review | low | нет | unit_controller.js |
| 22 | Hard difficulty profile | GLM | Review | medium | medium | main.js bot |
| 23 | Bot scouting knowledge integration | GLM/Codex | Review | medium | medium | main.js bot |
| 24 | Idle worker notification | GLM | Review | low | low | main.js UI |

### 15.4 Later

| Задача | Сложность | Когда |
|--------|-----------|-------|
| Faction asymmetry v1 | medium | 1-2 месяца |
| Map events (sandstorm, mineral surge) | medium | 1-2 месяца |
| Observation towers (neutral objectives) | medium | 1-2 месяца |
| Bot personality profiles | medium | 2 месяца |
| Tutorial / onboarding | medium | 2 месяца |
| Attack animation (projectile) | medium | 2 месяца |
| Bot expansion logic | high | 2-3 месяца |
| Faction-specific units | medium | 2-3 месяца |
| Campaign scenarios | high | 3+ месяца |
| Leaderboards (Firebase) | medium | Когда нужен backend |
| Multiplayer | very high | 6+ месяцев |

### 15.5 Risky / only after refactor

| Задача | Почему risky | Когда можно |
|--------|-------------|-------------|
| Extract bot AI из main.js | 2500 строк, deep closure dependencies | После Phase 1-3 extraction |
| Extract builder/harvester | Complex state machines | После Phase 2 |
| Multi-owner system (4P FFA) | Всё assumes 2 sides | После major refactor |
| Engine migration (PixiJS) | Rewrite rendering | Если FPS проблемы |
| Real-time multiplayer | Полная архитектурная перестройка | После stable PvE |
| Full bot rewrite | Current bot works | Никогда — только incremental |

---

## 16. Top 20 Recommendations

| # | Рекомендация | Приоритет | Сложность | Риск | Почему важно | Когда | Что будет, если не делать |
|---|--------------|-----------|-----------|------|-------------|-------|--------------------------|
| 1 | Bot AI tuning (10F1B/10G1B/10H1B/10I1B) | high | low | low | Бот делает игру скучной или frustrating | Сейчас | Игра не fun |
| 2 | Attack animation (muzzle flash + damage flash) | high | low | low | Без visual feedback combat невидим | Сейчас | Игрок не понимает бой |
| 3 | Try/catch в game loop | high | low | нет | Одна ошибка = полный краш | Сейчас | Игра крашится |
| 4 | Dedup 7× helpers | high | low | low | 500 строк мусора, баг-поверхность | 1 неделя | Каждый патч рискованнее |
| 5 | Minimap | high | medium | low | RTS без minimap = слепая игра | 2 недели | Игрок не может стратегически планировать |
| 6 | Heavy_tank combat | high | medium | medium | Один боевой юнит = tactical poverty | 3 недели | Combat скучный |
| 7 | Defense tower | high | medium | medium | Нет defensive option | 3 недели | Base defence = only tanks |
| 8 | Production queue UI display | medium | low | low | Игрок не видит, что производится | 2 недели | Frustration |
| 9 | Tech tree v1 | medium | medium | low | Late-game тупик | 1 месяц | Игра скучная после 10 мин |
| 10 | Scout integration в bot (PATCH-SCOUT-04/05) | medium | medium | low | Scout = unused unit | 2 недели | Scout бесполезен для AI |
| 11 | Save slots (3+) | medium | low | low | Один save = нельзя экспериментировать | 2 недели | Players боятся пробовать |
| 12 | Hotkey system (Ctrl+1-9, S, B, F) | medium | medium | low | Без hotkeys = медленный control | 2 недели | Low APM ceiling |
| 13 | Economy constants → config | medium | low | нет | Tuning без code changes | 1 неделя | Каждый balance tweak = risky patch |
| 14 | Extract coordinates/constants (refactor Phase 1) | medium | low | нет | Основание для дальнейшего refactor | 2 недели | main.js продолжает расти |
| 15 | Idle worker notification | medium | low | low | Игрок забывает про idle юнитов | 2 недели | Wasted economy |
| 16 | Faction asymmetry v1 (+20% bonuses) | medium | medium | low | Фракции одинаковые = скучный выбор | 1 месяц | Faction choice meaningless |
| 17 | Tutorial / onboarding | medium | medium | low | Новые игроки бросают через 2 мин | 1 месяц | No new players |
| 18 | Delete unit_controller.js dead code | low | low | нет | 879 строк мёртвого кода | 2 недели | Code confusion |
| 19 | Extract mapgen.js (refactor Phase 2) | medium | low | low | Самый большой standalone блок | 1 месяц | main.js продолжает расти |
| 20 | Hard difficulty bot profile | low | medium | medium | Нет challenge для опытных игроков | 1 месяц | Game too easy after learning |

---

## 17. Что НЕ стоит делать сейчас

### Полный engine migration

**Почему рискованно:** Migration = rewrite 12 000+ строк. 2-3 месяца без новых фич. Текущий Canvas работает. Риск regression огромный.

**Когда можно вернуться:** Когда FPS проблемы станут реальными (100+ юнитов, large maps). Или когда проект решит «начать заново с лучшей архитектурой».

### Real-time multiplayer

**Почему рискованно:** Требует сервер, netcode, lag compensation, matchmaking. RTS = hardest genre для multiplayer. Минимум 3-6 месяцев работы. Текущий single-player даже не stabilised.

**Когда можно вернуться:** После того, как PvE bot будет «интересным» в каждой партии. После leaderboard. После того, как будет community, который хочет multiplayer.

### Большой refactor одним PR

**Почему рискованно:** Один PR затрагивает все системы = невозможно откатить частично. Один баг в extraction ломает всё.

**Когда можно вернуться:** Никогда. Refactor = только пошагово, один модуль за раз, каждый PR = одна цель.

### Сложный AI до стабилизации economy/combat

**Почему рискованно:** Influence maps, HTN planning, ML — это academic research. Economy ещё не fun, combat ещё не readable. Smart AI в broken game = smart AI в неинтересной игре.

**Когда можно вернуться:** После: bot tuning, combat feedback, heavy_tank, defense tower, tech tree. Когда core loop = fun, можно делать smart AI.

### Новые юниты без ролей

**Почему рискованно:** Каждый юнит = sprites (32 PNG), code (movement, combat, AI), balance testing. Юнит без чёткой роли = wasted effort.

**Когда можно вернуться:** После heavy_tank (role: siege) и defense tower (role: defense). Каждый новый юнит должен отвечать на вопрос: «какую проблему игрока он решает, которую не решает существующий юнит?»

### Новые ассеты без pipeline

**Почему рискованно:** Scout buggy прошёл pipeline вручную. Каждый новый юнит = Blender render × 8 dirs × 4 factions = 32 PNG + faction color swap. Без автоматизации это дни работы на каждый юнит.

**Когда можно вернуться:** После automated Blender render script и faction color swap mechanism.

### Сложная кампания

**Почему рискованно:** Нужен content creator, writer, level designer. Текущий проект = code-first. Нет editor, нет scripting system, нет cutscene system.

**Когда можно вернуться:** После map editor, scripting system, tutorial. 6+ месяцев.

### Сложная tech tree

**Почему рискованно:** Branching tech tree с mutually exclusive choices = balance nightmare. Каждая комбинация = отдельный test case.

**Когда можно вернуться:** После simple tech tree (5 flat upgrades). Если simple работает → branching. Если simple не работает → fix simple first.

### Переписывание экономики без тестов

**Почему рискованно:** Economy = core system. Изменение separator formula, storage, production без тестов = risk regression.

**Когда можно вернуться:** После economy tests (automated). Тогда можно менять баланс с confidence.

### Чрезмерная асимметрия фракций

**Почему рискованно:** +100% бонус к одному параметру = одна фракция всегда лучше в одной ситуации. Баланс 4 фракций = exponential complexity.

**Когда можно вернуться:** После базовой асимметрии (+20% к одному параметру). Если +20% работает → +30%. Если нет → fix.

---

## 18. Личное мнение GLM

### Куда бы я развивал игру, если бы был архитектором проекта

Я бы сфокусировался на **петле «разведка → решение → действие»**. Это то, что отличает интересную RTS от скучной. Сейчас Four Elements = «произведи больше танков и атакуй». Я хочу, чтобы она стала: «разведай → оцени → реши → действуй → оцени результат → скорректируй».

Это значит:
1. **Scout** должен стать ключевым юнитом, не опциональным. Без scout = слепой. Со scout = informed decisions.
2. **Bot** должен играть через информацию, не через brute force. Scout → knowledge → decision. Не omniscient attack.
3. **Map** должна поощрять разведку. Скрытые ресурсы, expansion зоны, observation points — всё, что reward exploration.
4. **Combat** должен быть readable. Игрок должен видеть бой, понимать его, и принимать решения на основе того, что видит.

### Что бы я сделал первым

1. **Bot AI tuning** — 4 патча, 2 дня работы, огромный impact на playability
2. **Attack animation + damage flash** — 1 день, решает biggest UX gap
3. **Dedup helpers** — 1 день, уменьшает баг-поверхность на 500 строк
4. **Try/catch** — 5 минут, спасает от крашей

### Что бы я точно не делал

- Не делал бы multiplayer раньше, чем single-player станет fun
- Не мигрировал бы на движок раньше, чем Canvas станет узким местом
- Не делал бы большой refactor одним PR
- Не добавлял бы юниты без чётких ролей
- Не делал бы cheating AI

### Какой путь кажется самым сильным

**PvE bot-first с фокусом на информацию.** Сначала — бот, который «думает» через разведку. Потом — игрок, который тоже «думает» через разведку. Потом — карта, которая reward разведку. Потом — фракции, которые по-разному работают с информацией. Это не самый простой путь, но самый интересный.

### Где проект может стать реально интересным

**Информационная война.** Если scout, sensor beacons, observation towers, fog of war, bot memory, player knowledge — все эти системы работают вместе, Four Elements станет не «ещё одной RTS про танки», а **RTS про информацию**. Это уникальная ниша. StarCraft про механику. Warcraft про lore. Four Elements может быть про **знание**.

### Где проект может утонуть

**Feature creep без стабилизации.** Если добавлять heavy_tank, bomber, defense tower, tech tree, faction units, map events — всё одновременно — проект утонет в незаконченных системах. Каждая система на 80% = ни одна не работает правильно. Лучше 5 систем на 100% чем 15 на 80%.

### Какой «идеальный MVP через 1 месяц» я вижу

Через 1 месяц я хочу иметь:

1. **Bot, который интересно играть** — tuned, с scout, с memory, с тремя difficulty уровнями
2. **Combat, который видно** — muzzle flash, damage flash, attack animation, death animation
3. **Два боевых юнита** — light_tank + heavy_tank с разными ролями
4. **Оборону** — defense tower, которая работает
5. **Tech tree v1** — 5 flat upgrades для late-game purpose
6. **Minimap** — стратегический обзор
7. **Production queue display** — видно, что производится
8. **Hotkeys** — Ctrl+1-9, S, B, F
9. **Save slots** — 3 слота + auto-save
10. **Refactor Phase 1** — coordinates, constants, helpers extracted

Это амбициозно, но реально. Каждая задача = 1-3 дня. Суммарно = ~20 рабочих дней = 1 месяц.

Результат: **игра, в которую интересно играть 1v1 против бота на любой сложности, с видимым боем, с late-game progression, и с кодовой базой, которая начинает дышать.**

---

*Конец документа. Это стратегический обзор GLM, не утверждённый roadmap. Каждая идея требует отдельного обсуждения и design doc перед реализацией.*
