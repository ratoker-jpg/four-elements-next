# Ashen Crown AI Audit for Four Elements

## Статус

Аудит проведён по архиву `ashen-crown-main (1).zip`, загруженному в чат. Цель — не копировать код, а выделить архитектурные решения для следующего слоя бота Four Elements.

Текущий checkpoint Four Elements на момент аудита:

```text
PATCH-07C4-PLAYABLE-SKIRMISH-CHECKPOINT-DOCS
stable gameplay checkpoint = 07C3
```

В игре уже есть playable skirmish MVP: старт игрока и enemy, enemy purple, enemy minerals, enemy light_tank threat, victory/result Esc flow.

---

## 1. Общий вывод

Ashen Crown полезен как референс RTS-архитектуры:

- AI вынесен в отдельную систему;
- экономика вынесена в отдельную систему;
- pathfinding вынесен в отдельную систему;
- formation вынесен в отдельную систему;
- entity-модель имеет явные состояния и команды;
- AI действует фазами, а не одним тупым таймером;
- AI защищает базу, собирает армию, атакует волной, перегруппировывается.

Для Four Elements это значит:

```text
не копировать Phaser/TypeScript-код,
а адаптировать модель поведения:
defend → prepare_attack → attack → regroup → позже economy/production.
```

---

## 2. Лицензия и перенос кода

В корне архива не найден явный `LICENSE`-файл. Поэтому:

- не копировать код дословно;
- не переносить функции как есть;
- использовать только идеи, структуру, паттерны и собственную реализацию.

---

## 3. Что найдено в Ashen Crown

Ключевые файлы:

```text
src/systems/AI.ts
src/systems/Economy.ts
src/systems/Formation.ts
src/systems/Pathfinding.ts
src/systems/PlayerAutopilot.ts
src/systems/SpatialIndex.ts
src/entities/Unit.ts
src/entities/Building.ts
src/entities/ResourceNode.ts
src/scenes/GameScene.ts
src/config.ts
src/world/FogOfWar.ts
task/backlog/011-skirmish-ai-rules-polish.md
```

---

## 4. AI.ts — самая полезная часть

### 4.1. AIState

В Ashen Crown AI хранит состояние:

```ts
phase: 'economy' | 'military' | 'defense' | 'attack' | 'regroup'
nextCheckMs
armyTargetScore
regroupUntilMs
lastPressureMs
lastAttackOrderMs
lastDefenseOrderMs
lastCaravanOrderMs
```

Что важно для нас:

- AI не думает каждый кадр;
- AI хранит фазу;
- AI умеет защищаться;
- AI умеет атаковать волной;
- AI умеет перегруппировываться;
- AI постепенно повышает требования к армии после неудачной атаки.

### 4.2. runAI

Основной цикл делает:

```text
1. Проверяет nextCheckMs.
2. Собирает buildings / units / workers / army.
3. Находит townhall.
4. Назначает idle workers на ресурсы.
5. Проверяет pressure near townhall.
6. Строит farm/barracks/workshop/tower.
7. Тренирует workers/army.
8. Если есть давление — defense.
9. Если есть caravan opportunity — отправляет малую группу.
10. Считает armyScore.
11. Если phase=regroup — rally army.
12. Если phase=attack и атакующая сила упала — regroup.
13. Если armyScore >= target — attack.
14. Иначе economy/military.
```

Для Four Elements нужно забрать не всё, а только скелет:

```text
check interval
phase
pressure near enemy HQ
armyScore
attack wave
regroup
```

---

## 5. Economy.ts

У них простая экономика:

```ts
gold
lumber
food
foodCap
canAfford
spend
deposit
hasFoodRoom
```

Для Four Elements прямой перенос не подходит, потому что наша экономика:

```text
raw minerals → separator → energy + element
```

Что забираем:

- экономика должна быть отдельной системой/слоем;
- ресурсные операции должны быть owner-aware;
- у бота и игрока должны быть одинаковые базовые правила;
- позже нужен enemy resource state, а не хаки через spawn timers.

Что не делаем сейчас:

- не переносим `gold/lumber/food`;
- не запускаем full enemy economy в 08B;
- не делаем production loop раньше поведения защиты/атаки.

---

## 6. Formation.ts

Полезные идеи:

- group target превращается в слоты;
- spacing учитывает радиус юнитов;
- для 2 юнитов side-by-side;
- для группы grid slots;
- назначение слотов role-aware:
  - melee впереди;
  - siege сзади;
  - workers сзади, если есть military;
  - ranged ближе к задней части;
- assignClosest уменьшает лишние пересечения.

Для Four Elements это полезно позже, когда enemy начнёт атаковать группой.

Прямо сейчас для 08B можно не трогать formation, потому что у врага один танк. Но для 08D/09C, когда появятся 3–5 enemy tanks, нужно не отправлять всех в одну клетку, а распределять слоты.

---

## 7. Pathfinding.ts

У них:

- A* по tile grid;
- 8-direction movement;
- запрет диагонального среза через закрытые углы;
- `nearestWalkable` для заблокированной цели;
- maxIter = 4000;
- pathfinding stats:
  - calls;
  - totalMs;
  - avgMs;
  - maxMs;
  - iterations;
  - limitHits;
  - emptyResults.

Для Four Elements прямой перенос A* не нужен. Но полезны идеи:

```text
1. bot logic не должен решать pathfinding;
2. bot выбирает цель, movement исполняет;
3. нужен nearest reachable / fallback point;
4. нужны pathfinding stats для будущих больших групп;
5. нужен max iteration guard.
```

Для 08B pathfinding не трогать.

---

## 8. PlayerAutopilot.ts

Это неожиданно полезный файл. Он показывает, как делать локальное поведение юнита без глобального ИИ:

- worker autopilot:
  - если есть cargo → return cargo;
  - если idle → строить unfinished building;
  - иначе искать ресурс;
- military autopilot:
  - хранит anchor;
  - не уходит слишком далеко от anchor;
  - если target вне leash — возвращается;
  - ищет ближайшего видимого enemy;
  - защищает базу рядом с anchor;
- есть leash и grace distance.

Для Four Elements это прямо подходит для enemy defender behavior:

```text
enemy tank anchor = enemy HQ / rally point
если player unit рядом — defend
если танк ушёл слишком далеко — return to anchor
если нет угроз — idle/guard
```

Это можно адаптировать раньше экономики.

---

## 9. SpatialIndex.ts

Простая spatial hash-сетка:

```text
cellSize
rebuild(items)
queryRadius(x, y, radius, out)
```

Для Four Elements это полезно позже, когда проверка nearest enemy / pressure / visibility станет дорогой. Для 08B можно начать с обычного перебора, но сразу в roadmap заложить:

```text
после роста юнитов заменить частые full scan на spatial query.
```

---

## 10. Unit.ts / Building.ts

### Unit

У юнита явные состояния:

```text
idle
move
attack_move
attack
gather
return_cargo
build
dead
```

Есть поля:

```text
path
pathDest
groupMoveId
groupSlot
attackMoveTo
targetUnit
targetBuilding
targetResource
returnTo
cargo
autopilotAnchor
autopilotNextThinkMs
```

Для нас важно:

- не смешивать состояние бота и состояние юнита;
- бот должен только выдавать команды;
- юнит должен исполнять через уже существующие movement/combat helpers.

### Building

У здания есть:

```text
completed
buildProgress
queue
rally
tickProduction(dtMs)
enqueue(kind)
canAttack()
```

Для Four Elements это будущая модель для units_factory/enemy production, но не для 08B.

---

## 11. GameScene integration

Ashen Crown хорошо показывает, где системы вызываются:

```text
update():
  rebuildUnitSpatialIndex()
  runPlayerAutopilot()
  updateUnits()
  updateBuildings()
  combatTick()
  updateFog()
  runAI()
  checkVictory()
  pruneDead()
```

Важная идея:

```text
AI вызывается из update loop через delay/interval,
но AI сам не двигает спрайты и не считает path.
AI отдаёт orderMove/orderAttack/orderAttackMoveGroup.
```

Для Four Elements это ключевой принцип для 08B.

---

## 12. Backlog 011 — хороший целевой стандарт

`011-skirmish-ai-rules-polish.md` формулирует то, что нам нужно:

- AI строит экономику;
- не забывает production;
- собирает army group перед атакой;
- защищает базу при нападении;
- не отправляет одиночные suicide attacks без причины;
- easy/normal/hard отличаются темпом;
- параметры в config;
- AI не omniscient, если есть fog;
- AI использует те же movement/order systems, что игрок.

Это нужно встроить в наш roadmap v7.

---

## 13. Целевая модель бота Four Elements

### 13.1. Не делаем

Не делаем сейчас:

```text
full enemy economy
enemy construction AI
enemy production loop
expansion
faction-specific AI
pathfinding refactor
formation refactor
```

### 13.2. Делаем сначала

Минимальная модель:

```js
enemyBot.phase = 'defend' | 'prepare_attack' | 'attack' | 'regroup'
```

Поля:

```js
enemyBot = {
  phase,
  nextCheckAt,
  openingUntil,
  regroupUntil,
  lastPressureAt,
  lastOrderAt,
  armyTargetScore,
  homeX,
  homeY
}
```

Параметры:

```js
checkIntervalMs: 1200
openingDelayMs: 10000
defendRadiusTiles: 12
defenseHoldMs: 8000
attackScoreThreshold: 2
regroupDelayMs: 8000
maxChaseDistanceTiles: 35
```

---

## 14. Предлагаемый roadmap патчей

### 08A0 — Ashen Crown audit docs

```text
PATCH-08A0-ASHEN-CROWN-AI-AUDIT-DOCS
```

Docs-only:

- добавить этот audit-док;
- обновить roadmap v7;
- обновить AGENTS / reglament / new chat prompt;
- зафиксировать: Ashen Crown используется как reference, не как donor code.

### 08A — Bot behavior read-only audit

```text
PATCH-08A-BOT-BEHAVIOR-MVP-AUDIT
```

Codex read-only:

- найти текущий `updateEnemyBot` в Four Elements;
- найти где enemy tank сейчас получает тупую команду;
- найти anchors для phase-based state;
- проверить, как безопасно отдавать enemy move/attack;
- не менять код.

### 08B — Bot phase MVP

```text
PATCH-08B-BOT-PHASE-MVP
```

Кодовый патч:

- заменить тупую автоатаку на `defend / prepare_attack / attack / regroup`;
- enemy tank защищает HQ;
- атака запускается по таймеру/score;
- если ушёл далеко/потерял цель — regroup;
- enemy harvesters/builders пока idle.

### 08C — Bot knobs config

```text
PATCH-08C-BOT-KNOBS-CONFIG
```

Локальный GPT-патч:

- вынести параметры бота в config/runtime block;
- без изменения поведения.

### 08D — Enemy wave/production placeholder

```text
PATCH-08D-BOT-REINFORCEMENT-MVP
```

Временный слой до экономики:

- enemy HQ жив → по лимиту может получить подкрепление;
- не чаще N секунд;
- max enemy combat units.

### 09A — Enemy harvester MVP

```text
PATCH-09A-ENEMY-HARVESTER-MVP
```

- enemy harvester ищет минерал возле enemy HQ;
- добывает сырьё;
- возвращается к enemy HQ/storage;
- без сепараторов.

### 09B — Enemy resource loop

```text
PATCH-09B-ENEMY-RESOURCE-LOOP
```

- raw minerals → energy/elements;
- owner-aware storage/limits;
- enemy separator logic.

### 09C — Enemy production MVP

```text
PATCH-09C-ENEMY-PRODUCTION-MVP
```

- enemy units_factory производит light_tank;
- использует элементы/энергию по правилам проекта;
- armyScore начинает отражать реальную экономику.

---

## 15. Что отдать Codex в 08A

Codex должен получить:

```text
CODEX_APPROVED_FOR_AUDIT
PATCH-08A-BOT-BEHAVIOR-MVP-AUDIT
```

ТЗ:

- читать Four Elements latest context;
- учитывать этот Ashen Crown audit;
- не копировать Ashen Crown code;
- найти минимальные точки для phase-based bot;
- не менять код;
- вернуть TXT summary.

---

## 16. Итоговое решение

Лучший порядок:

```text
1. Docs patch 08A0: зафиксировать аудит Ashen Crown.
2. Codex read-only 08A: найти точки в нашем main.js.
3. Code patch 08B: phase-based enemy tank behavior.
4. Local config 08C.
5. Потом экономика/production.
```

Это лучше, чем сразу делать “умного бота”, потому что снижает риск сломать текущий playable checkpoint.
