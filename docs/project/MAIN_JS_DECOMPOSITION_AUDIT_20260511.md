# MAIN_JS_DECOMPOSITION_AUDIT — аудит декомпозиции `src/main.js`

**Дата:** 2026-05-11  
**Тип:** architecture audit / long-term refactor roadmap  
**Lane:** Fast / docs-only  
**Цель:** сохранить карту декомпозиции `src/main.js`, чтобы вернуться к ней после доведения бота до playable MVP.

---

## 0. Контекст

Пользователь поставил вопрос:

```text
Насколько реально прийти к состоянию, где main.js остаётся около 1000 строк,
а основная логика вынесена в отдельные модули?
```

GLM провёл аудит текущей структуры `main.js` и предложил план декомпозиции примерно на 24 патча.

Этот документ фиксирует:

- результаты аудита;
- риски;
- рекомендуемый порядок;
- корректировки GPT-аудита;
- правило: не запускать большой refactor до playable bot MVP.

---

## 1. Текущее состояние `main.js`

По аудиту GLM:

| Метрика | Значение |
|---|---:|
| Всего строк | ~12 574 |
| IIFE-блоков | 3 |
| Основной IIFE | строки ~1–12404 |
| Playwright helper IIFE | строки ~12407–12528 |
| ESC guard IIFE | строки ~12532–12572 |
| `window.FE_*` экспортов | ~19 |
| Внутренних `FE_PATCH_*` / `FE_*` функций | 120+ |
| Ссылок на `game.*` | ~438 |
| Вызовов `findPath()` | 13 точек |
| Самый крупный блок | Enemy AI Bot, ~3 180 строк, ~25% файла |

Главная архитектурная проблема:

```text
game — глобальная переменная замыкания, используемая почти всеми подсистемами.
```

Из-за этого любое извлечение модуля требует явного способа доступа к состоянию игры:

```text
1. параметр функции — самый чистый вариант;
2. window.FE_CORE.game getter — уже используется в части dev/debug модулей;
3. отдельный getGame() — допустимо, но нельзя плодить много разных getGame-фоллбэков.
```

---

## 2. Критические узлы

### Узел 1 — Enemy AI Bot

Оценка:

```text
~3 180 строк
~25% файла
очень высокий риск декомпозиции
```

Внутри смешаны:

- видение;
- разведка;
- autopilot;
- оценка сил;
- отступление;
- волны атак;
- поведенческие профили;
- hooks в `updateEnemyBot()`;
- патчи `ATTACK-01..10`;
- scout-related logic.

Риск:

```text
Нельзя вырезать одним куском. Нужно сначала стабилизировать интерфейсы и новые bot-фичи делать module-first.
```

---

### Узел 2 — Builder + Enemy Economy

Оценка:

```text
~2 083 строк
средне-высокий риск
```

Проблема:

```text
секция Builder фактически содержит не только builder игрока,
но и заметную часть enemy economy / factory / production / AI priority logic.
```

Сцепления:

- `findPath`;
- `passable`;
- `canPlaceBuilding`;
- production queue;
- enemy factory;
- separator / economy timers;
- builder actions.

Риск:

```text
Нельзя выносить builder и enemy economy одним комком.
Нужно сначала разделить player builder и enemy economy responsibilities.
```

---

### Узел 3 — Combat рассеян по файлу

Оценка:

```text
~2 100 строк в нескольких местах
средне-высокий риск
```

Проблема:

```text
combat не лежит в одном блоке.
Лёгкие танки, attack-move, targeting, retargeting, здания и victory/death связаны через функции в разных частях main.js.
```

Риск:

```text
Сначала нужен audit dependency map, потом уже вынос.
Нельзя делать одновременно с bot brain или pathfinding.
```

---

## 3. Группы для будущей декомпозиции

| # | Группа | Оценка строк | Риск |
|---:|---|---:|---|
| 1 | Константы и конфиг | ~30 | 🟢 низкий |
| 2 | Изометрические утилиты | ~230 | 🟢 низкий |
| 3 | Генерация карты | ~536 | 🟢 низкий/средний |
| 4 | Система юнитов / создание / движение / harvester | ~1 400 | 🟡 средний |
| 5 | Система зданий / территория / туман | ~410 | 🟢 низкий/средний |
| 6 | Боевая система | ~2 100 | 🟡 средне-высокий |
| 7 | Enemy AI Bot | ~3 180 | 🔴 высокий |
| 8 | Enemy Economy | ~1 100 | 🟡 средне-высокий |
| 9 | Система строительства | ~345 | 🟢 низкий/средний |
| 10 | Pathfinding / passable / A* | ~130 | 🔴 высокий по влиянию, несмотря на малый размер |
| 11 | Rendering | ~1 124 | 🟡 средний |
| 12 | UI / input | ~770 | 🟡 средний |
| 13 | Skirmish setup | ~107 | 🟢 низкий |
| 14 | Game loop / boot | ~198 | 🔴 ядро, извлекать последним |
| 15 | ESC guard / Playwright helpers | ~217 | 🟢 низкий |

---

## 4. Важная поправка GPT-аудита

GLM отметил pathfinding как лёгкий блок, потому что там мало строк.

GPT-поправка:

```text
Pathfinding нельзя считать low-risk только из-за малого размера.
```

Причина:

- 13 вызовов `findPath()`;
- используется movement, scout, tank attack, builder, harvester;
- ошибки в `passable` / `unitAt` / `buildingAt` ломают всю игру;
- баги pathfinding часто выглядят как баги AI, combat или production.

Решение:

```text
Pathfinding выносить только после playable bot MVP и только с очень узким интерфейсом + smoke tests.
```

---

## 5. Почему нельзя делать быстрый refactor 3–5 большими патчами

Оценка риска GLM:

```text
3–5 больших патчей на декомпозицию main.js -> ~80% риск сломать игру.
```

GPT-аудит согласен.

Причины:

```text
1. AI-бот — 3 180 строк переплетённых подсистем.
2. game.* используется сотни раз.
3. combat рассеян в разных местах.
4. builder и enemy economy сцеплены.
5. pathfinding малый по строкам, но критичный по последствиям.
6. Большие refactor PR плохо откатываются и плохо тестируются.
```

Вывод:

```text
Декомпозиция main.js — это отдельный refactor sprint, не параллельная фоновая задача во время активного bot gameplay sprint.
```

---

## 6. Цель `main.js ~1000 строк`

Цель допустимая как долгосрочная:

```text
main.js должен стать orchestration layer:
- init;
- startNewGame;
- update(dt);
- render call;
- loop(now);
- wiring modules;
- минимальное состояние UI/game bridge.
```

Но это НЕ ближайшая цель.

Приоритет сейчас:

```text
1. playable bot MVP;
2. новые фичи module-first;
3. затем refactor sprint main.js.
```

---

## 7. Рекомендуемый принцип до playable bot MVP

Пока бот не стал играбельным, не запускать массовую декомпозицию `main.js`.

Но все новые крупные фичи делать по правилу:

```text
module-first
```

То есть:

```text
новая подсистема -> отдельный файл src/game/* или src/config/*
main.js -> только тонкий bridge / init / вызов
```

Примеры для ближайших bot-фич:

```text
src/game/enemy_scout_behavior.js
src/game/enemy_knowledge.js
src/game/enemy_attack_readiness.js
src/config/bot_difficulty.js
src/dev/bot_debug_panel.js
```

Цель:

```text
не раздувать main.js дальше, даже если старый код пока остаётся внутри.
```

---

## 8. Безопасный refactor до playable bot MVP

Разрешены только низкорисковые extract-патчи, если они не мешают bot gameplay.

Можно делать:

```text
REF-DECOMP-00 — этот audit / roadmap doc
REF-DECOMP-01 — game_access/deps contract doc или маленький helper
REF-DECOMP-02 — вынести Playwright helpers + ESC guard
REF-DECOMP-03 — iso_utils
REF-DECOMP-04 — map_generator, если после отдельного аудита риск подтверждён низким
```

Не делать до playable bot MVP:

```text
- enemy AI monolith extraction;
- combat extraction;
- movement extraction;
- pathfinding extraction;
- builder/economy split;
- game loop extraction;
- massive UI/input extraction.
```

---

## 9. Долгосрочная карта декомпозиции

Это не immediate plan, а backlog после playable bot MVP.

### Фаза 1 — инфраструктура

| # | Патч | Суть |
|---:|---|---|
| 1 | `REF-DECOMP-01` | `src/core/game_access.js` / единый способ получить `game` и deps |
| 2 | `REF-DECOMP-02` | `src/core/iso_utils.js` — координаты, clamp/dist/inBounds/uid, если зависимости чистые |
| 3 | `REF-DECOMP-03` | dependency map для `findPath/passable`, без выноса pathfinding |

### Фаза 2 — низкий риск

| # | Патч | Суть |
|---:|---|---|
| 4 | `REF-DECOMP-04` | Playwright helpers + ESC guard в отдельные IIFE/modules |
| 5 | `REF-DECOMP-05` | `src/game/skirmish.js` |
| 6 | `REF-DECOMP-06` | `src/game/map_generator.js`, после smoke |
| 7 | `REF-DECOMP-07` | `src/game/building_system.js`, если территория/туман не цепляют render слишком сильно |

### Фаза 3 — средний риск

| # | Патч | Суть |
|---:|---|---|
| 8 | `REF-DECOMP-08` | player builder отдельно от enemy economy |
| 9 | `REF-DECOMP-09` | harvester state machine |
| 10 | `REF-DECOMP-10` | unit movement, только после стабильного pathfinding contract |

### Фаза 4 — combat

| # | Патч | Суть |
|---:|---|---|
| 11 | `REF-DECOMP-11` | combat dependency map / no code move |
| 12 | `REF-DECOMP-12` | tank combat core |
| 13 | `REF-DECOMP-13` | player attack-move / targeting |
| 14 | `REF-DECOMP-14` | combat module cleanup |

### Фаза 5 — enemy AI

| # | Патч | Суть |
|---:|---|---|
| 15 | `REF-DECOMP-15` | enemy vision / knowledge |
| 16 | `REF-DECOMP-16` | enemy scout behavior |
| 17 | `REF-DECOMP-17` | enemy autopilot / retreat / defend layers |
| 18 | `REF-DECOMP-18` | enemy attack waves ATTACK-01..10 |
| 19 | `REF-DECOMP-19` | final enemy_bot controller |

### Фаза 6 — enemy economy

| # | Патч | Суть |
|---:|---|---|
| 20 | `REF-DECOMP-20` | enemy economy / factory / production manager |
| 21 | `REF-DECOMP-21` | cleanup builder↔economy cross-links |

### Фаза 7 — render/UI

| # | Патч | Суть |
|---:|---|---|
| 22 | `REF-DECOMP-22` | renderer module |
| 23 | `REF-DECOMP-23` | input/UI module |

### Фаза 8 — финал

| # | Патч | Суть |
|---:|---|---|
| 24 | `REF-DECOMP-24` | оставить в `main.js` orchestration layer, целевой размер около 1000 строк |

---

## 10. Когда возвращаться к этому плану

Вернуться к декомпозиции main.js после выполнения минимум:

```text
BOT-SCOUT-02A — scout targetable / killable
BOT-SCOUT-02B — observe-return-cooldown lifecycle
BOT-BRAIN-02A — attack readiness / no one-tank suicide
BOT-DEFENSE-01 — base defense reaction
BOT-WAVE-01 — regroup/retry after failed attack
BOT-SMOKE-01 — 10–15 минут smoke без критических багов
```

После этого можно запускать отдельный refactor sprint.

---

## 11. Вердикт

```text
Аудит GLM принять как долгосрочную карту.
Цель main.js ~1000 строк реалистична, но не быстрым рывком.
Безопасная оценка: около 24 refactor-патчей.
До playable bot MVP не трогать AI/combat/movement/pathfinding/economy extraction.
Новые bot-фичи делать module-first, чтобы не увеличивать main.js.
```
