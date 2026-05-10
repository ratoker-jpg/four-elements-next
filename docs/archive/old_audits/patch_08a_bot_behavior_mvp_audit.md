---
> ⚠️ ARCHIVED / NOT SOURCE OF TRUTH
>
> Этот документ сохранён только как исторический контекст.
> Не использовать как актуальную инструкцию для GPT/GLM/Codex.
> Актуальный порядок чтения: docs/project/AI_READ_FIRST.md.
>
> Причина архивации: ARCHIVE_CANDIDATE — аудит PATCH-08A уже выполнен
> и принят (08B тоже выполнен). Историческая ценность, не actionable.
> Архивирован: DOCS-CLEANUP-01, 2026-05-10.
---


# PATCH-08A-BOT-BEHAVIOR-MVP-AUDIT

Source: `_inbox/session_summary_20260508_PATCH-08A-BOT-BEHAVIOR-MVP-AUDIT.txt`

Status: completed read-only audit. This file promotes the uploaded audit into canonical project docs so future GPT/Codex sessions can safely route the next bot patch.

---

PATCH-08A-BOT-BEHAVIOR-MVP-AUDIT

Verdict

Да, PATCH-08B-BOT-PHASE-MVP можно делать безопасно, если держать scope узким:
- менять только `src/main.js`;
- не трогать selection/input/fog/victory UI;
- не переписывать movement/combat/pathfinding;
- заменить текущую тестовую rush-логику внутри существующего enemy-bot блока на phase-based state на уровне `game`.

Detailed audit

1. Где сейчас находится текущая test enemy threat logic

- Инициализация skirmish bot runtime:
  - `src/main.js:1814` `FE_PATCH_07ASetupSkirmishStart(options={})`
  - `src/main.js:1852` `game._enemyBotTimer = 0;`
  - `src/main.js:1853` `game._enemyBotDelay = 6.5;`
  - `src/main.js:1854` `game._enemyBotActivated = false;`
- Текущий bot block:
  - `src/main.js:2304` `FE_PATCH_07B_BOT_CONTROLLER_MVP_START`
  - `src/main.js:2305` `FE_PATCH_07BNearestPlayerLightTank(attacker)`
  - `src/main.js:2312` `FE_PATCH_07BEnemyBotTarget(attacker)`
  - `src/main.js:2316` `FE_PATCH_07BShouldOrderEnemyTank(unit)`
  - `src/main.js:2324` `FE_PATCH_07BCommandEnemyTank(unit)`
  - `src/main.js:2342` `updateEnemyBot(dt)`
  - `src/main.js:2364` `FE_PATCH_07B_BOT_CONTROLLER_MVP_END`
- Встраивание в main update loop:
  - `src/main.js:7801` `function update(dt)`
  - `src/main.js:7866` `updateEnemyBot(dt);`

2. Где enemy light_tank сейчас получает команду ехать атаковать

- Источник команды:
  - `src/main.js:2360-2361`
    - `if (!FE_PATCH_07BShouldOrderEnemyTank(unit)) continue;`
    - `FE_PATCH_07BCommandEnemyTank(unit);`
- Выбор цели:
  - `src/main.js:2312-2314`
    - nearest player light_tank
    - иначе `findBaseBuilding('player')`
- Выдача приказа:
  - `src/main.js:2335-2339`
    - если цель в range: `FE_PATCH_07BAssignLightTankAttack(...)`
    - иначе: `setLightTankAttackApproachGeneric(...)`

Итог: enemy tank сейчас не "думает" фазами. Он просто после delay каждые ~0.9 сек получает новый приказ, если idle.

3. Конкретные функции/участки `src/main.js`, относящиеся к enemy bot/threat

- Skirmish bootstrapping:
  - `FE_PATCH_06ASpawnEnemyBase()` at `1762`
  - `FE_PATCH_07ASetupSkirmishStart()` at `1814`
- Enemy ownership/base lookup:
  - `buildingOwner()` at `1682`
  - `isEnemyBuilding()` at `1690`
  - `findBaseBuilding(owner='player')` at `1698`
  - `isEnemyUnit()` at `857`
  - `isLightTank()` at `845`
- Current bot block:
  - `FE_PATCH_07BNearestPlayerLightTank()` at `2305`
  - `FE_PATCH_07BEnemyBotTarget()` at `2312`
  - `FE_PATCH_07BShouldOrderEnemyTank()` at `2316`
  - `FE_PATCH_07BCommandEnemyTank()` at `2324`
  - `updateEnemyBot()` at `2342`
- Combat/move helpers, already reusable by bot:
  - `unitDistanceCells()` at `865`
  - `FE_PATCH_06BDistanceToBuilding()` at `946`
  - `FE_PATCH_07BGetHostileLightTankTargetKind()` at `1328`
  - `FE_PATCH_07BAssignLightTankAttack()` at `1347`
  - `setLightTankAttackGeneric()` at `1371`
  - `updateLightTankCombat()` at `1429`
  - `setManualMove()` at `2622`
  - `updateUnitMovement()` at `2813`
  - `setLightTankAttackApproachGeneric()` at `6866`
  - `updateLightTankAttackApproach()` at `6949`
- Safety systems that 08B must not break:
  - `updateFog()` at `4898`
  - `FE_PATCH_06DCheckVictoryDefeat()` at `1130`
  - `FE_PATCH_06CDestroyBuilding()` at `1029`
  - input/selection click block around `7250-7367`

4. Где лучше хранить `enemyBotState`

Лучшее место: на объекте `game`, а не на unit и не на `window`.

Почему:
- текущий bot timer уже живёт на `game`;
- skirmish lifecycle инициализируется в `FE_PATCH_07ASetupSkirmishStart()`;
- `updateEnemyBot(dt)` уже читает только `game`;
- один phase controller сейчас нужен для одной enemy skirmish-side, а не для каждого юнита отдельно.

Рекомендация:

`game._enemyBotState = {`
- `phase: 'defend' | 'prepare_attack' | 'attack' | 'regroup'`
- `nextCheckAt: number`
- `openingUntil: number`
- `regroupUntil: number`
- `lastPressureAt: number`
- `lastAttackOrderAt: number`
- `lastDefendOrderAt: number`
- `lastKnownTargetId: string | null`
- `lastKnownTargetKind: 'unit' | 'building' | null`
- `homeBaseId: string | null`
- `homeX: number`
- `homeY: number`
- `attackScoreThreshold: number`
`}`

Минимально достаточно даже короче:
- `phase`
- `nextCheckAt`
- `openingUntil`
- `regroupUntil`
- `lastPressureAt`
- `homeBaseId`
- `homeX`
- `homeY`

5. Какие helpers уже есть и подходят для 08B

Движение юнитов:
- `setManualMove(unit, tx, ty)` at `2622`
- `updateUnitMovement(unit, dt)` at `2813`
- `findPath(start, goal, unitId)` at `2409`
- `passable(x, y, unitId)` at `2407`
- `findNearestLightTankDestinationCell(...)` already used by player move/attack flow

Атака юнитов:
- `FE_PATCH_07BGetHostileLightTankTargetKind(attacker, target)` at `1328`
- `FE_PATCH_07BAssignLightTankAttack(...)` at `1347`
- `setLightTankAttackGeneric(...)` at `1371`
- `updateLightTankCombat(...)` at `1429`

Атака зданий:
- уже встроена в общий hostility path через:
  - `FE_PATCH_07BGetHostileLightTankTargetKind(...)`
  - `FE_PATCH_06BDistanceToBuilding(...)`
  - `FE_PATCH_07BAssignLightTankAttack(...)`
- building target ограничен HQ, что для 08B нормально и даже safer

Подъезд к атаке:
- `setLightTankAttackApproachGeneric(...)` at `6866`
- `updateLightTankAttackApproach(...)` at `6949`

Поиск enemy/player targets:
- `FE_PATCH_07BNearestPlayerLightTank(...)` at `2305`
- `findBaseBuilding(owner)` at `1698`
- есть все owner-aware predicates:
  - `isPlayerUnit`
  - `isEnemyUnit`
  - `isPlayerBuilding`
  - `isEnemyBuilding`

Проверка расстояний:
- `unitDistanceCells(...)` at `865`
- `FE_PATCH_06BDistanceToBuilding(...)` at `946`

Поиск HQ:
- `findBaseBuilding(owner='player')` at `1698`

6. Где безопасно вставить phase-based AI tick

Лучшее место не менять:
- оставить тот же call site в `update(dt)`:
  - `src/main.js:7866` `updateEnemyBot(dt);`

Лучшее место для новой логики:
- внутри текущего блока `FE_PATCH_07B_BOT_CONTROLLER_MVP_START/END`
- заменить внутренности `updateEnemyBot(dt)` и соседних helper-функций

Почему это безопасно:
- bot думает после movement/combat tick юнитов текущего кадра;
- до `updateFog()` и `FE_PATCH_06DCheckVictoryDefeat()` уже будут известны свежие координаты/состояния;
- не нужен новый модуль и не нужно трогать input path;
- это уже изолированный anchor block из 07B.

7. Как не сломать selection, combat, fog, victory/defeat

Не ломать selection:
- не трогать click-handlers around `7250-7367`;
- не трогать `selected`, `selectedUnits`, `setSingleSelection`, `setMultiSelection`;
- bot не должен вызывать player-only wrappers вроде UI-driven command paths.

Не ломать combat:
- не переписывать `updateLightTankCombat()`;
- не расширять target matrix шире, чем нужно;
- использовать уже существующие generic helpers:
  - `FE_PATCH_07BAssignLightTankAttack`
  - `setLightTankAttackApproachGeneric`
- не менять attack cooldown/state machine semantics.

Не ломать fog:
- не менять `updateFog()` at `4898`;
- не добавлять reveal from enemy side;
- если bot needs "visibility-like" restraint, делать это через simple target policy, а не через изменение fog system.

Не ломать victory/defeat:
- не менять `FE_PATCH_06CDestroyBuilding()` and `FE_PATCH_06DCheckVictoryDefeat()`;
- fallback attack target на player HQ уже совместим с текущим victory flow.

8. Какие anchors использовать для будущего PATCH-08B

Primary anchors:
- `// FE_PATCH_07B_BOT_CONTROLLER_MVP_START`
- `// FE_PATCH_07B_BOT_CONTROLLER_MVP_END`

Important line anchors:
- `function FE_PATCH_07ASetupSkirmishStart(options={}) {` at `1814`
- `game._enemyBotTimer = 0;` at `1852`
- `game._enemyBotDelay = 6.5;` at `1853`
- `game._enemyBotActivated = false;` at `1854`
- `function FE_PATCH_07BNearestPlayerLightTank(attacker) {` at `2305`
- `function FE_PATCH_07BEnemyBotTarget(attacker) {` at `2312`
- `function FE_PATCH_07BShouldOrderEnemyTank(unit) {` at `2316`
- `function FE_PATCH_07BCommandEnemyTank(unit) {` at `2324`
- `function updateEnemyBot(dt) {` at `2342`
- `function findBaseBuilding(owner='player') {` at `1698`
- `function unitDistanceCells(a, b) {` at `865`
- `function FE_PATCH_06BDistanceToBuilding(unit, building) {` at `946`
- `function setManualMove(unit, tx, ty) {` at `2622`
- `function setLightTankAttackApproachGeneric(attacker, target, options={}) {` at `6866`
- `function update(dt) {` at `7801`
- `updateEnemyBot(dt);` at `7866`

Recommended PATCH-08B plan

1. State shape

Store on `game`:

`game._enemyBotState = {`
- `phase`
- `nextCheckAt`
- `openingUntil`
- `regroupUntil`
- `lastPressureAt`
- `lastAttackOrderAt`
- `lastDefendOrderAt`
- `homeBaseId`
- `homeX`
- `homeY`
`}`

2. Proposed bot knobs

- `checkIntervalMs: 1200`
- `openingDelayMs: 10000`
- `defendRadiusTiles: 12`
- `attackScoreThreshold: 1`
- `regroupDelayMs: 8000`
- `maxChaseDistanceTiles: 18`

Why these values:
- one enemy light_tank already exists, so `attackScoreThreshold = 1` keeps 08B reachable without adding economy/production;
- `defendRadiusTiles = 12` is close to Ashen Crown-style defense radius and wide enough for HQ area;
- `maxChaseDistanceTiles = 18` is intentionally tighter than old blind rush, so regroup can actually happen.

3. Pseudocode for future 08B

`on skirmish start`
- resolve enemy HQ
- create `game._enemyBotState`
- set `phase='defend'`
- set `openingUntil = game.time + openingDelayMs/1000`
- set home anchor near enemy HQ center

`updateEnemyBot(dt)`
- return if not skirmish / paused / no game
- return if no enemy HQ
- if `game.time < nextCheckAt` return
- set `nextCheckAt = game.time + checkIntervalMs/1000`
- collect alive enemy combat units = enemy light_tanks
- collect nearby player threats around enemy HQ
- compute `armyScore = enemy combat units count`

`if nearby player threat inside defendRadius`
- `phase = 'defend'`
- `lastPressureAt = game.time`
- choose nearest player unit threatening HQ
- for each idle/available enemy tank:
  - if in range -> assign attack
  - else -> attack approach target
- return

`if phase === 'defend' and game.time < openingUntil`
- keep/return tanks near home anchor
- do not launch attack
- return

`if phase !== 'attack' and no pressure and game.time >= openingUntil`
- `phase = 'prepare_attack'`

`if phase === 'prepare_attack'`
- if `armyScore < attackScoreThreshold`
  - keep tank near HQ / home anchor
  - return
- choose target priority:
  - nearest player combat unit
  - else player HQ
  - else any player building
- issue attack/approach
- `phase = 'attack'`
- `lastAttackOrderAt = game.time`
- return

`if phase === 'attack'`
- if no valid target -> `phase='regroup'`, `regroupUntil = now + regroupDelay`
- if tank too far from HQ (`> maxChaseDistanceTiles`) -> regroup
- if hp too low or no combat unit remains -> regroup
- else do nothing and let existing movement/combat finish

`if phase === 'regroup'`
- order tank back toward home anchor if too far
- if `now < regroupUntil` return
- if pressure exists -> `phase='defend'`
- else `phase='prepare_attack'`

4. Suggested target policy for 08B

Defense priority:
- nearest player unit inside defend radius around enemy HQ

Attack priority:
- nearest player `light_tank`
- else player HQ
- else any player building only if later needed

Important constraint:
- do not add omniscient global hunt beyond current simple knowledge model;
- for 08B it is enough that target choice is based on existing world state, but leash/regroup keeps behavior believable.

5. Exact anchors for future patch.py

Anchor A:
- start after `// FE_PATCH_07B_BOT_CONTROLLER_MVP_START`
- replace current helper set with:
  - state init helper
  - defend/prepare/attack/regroup helpers
  - threat query helpers
  - regroup/home-anchor helpers

Anchor B:
- inside `FE_PATCH_07ASetupSkirmishStart(options={})`
- replace:
  - `_enemyBotTimer`
  - `_enemyBotDelay`
  - `_enemyBotActivated`
- with creation/reset of `game._enemyBotState`

Anchor C:
- keep function shell `updateEnemyBot(dt)` in place
- replace body only

Anchor D:
- keep call site `updateEnemyBot(dt);` inside `update(dt)` unchanged

Anchor E:
- reuse, but do not rewrite deeply:
  - `setLightTankAttackApproachGeneric(...)`
  - `FE_PATCH_07BAssignLightTankAttack(...)`
  - `findBaseBuilding(...)`
  - `unitDistanceCells(...)`
  - `FE_PATCH_06BDistanceToBuilding(...)`

Risks

High-risk places for 08B:
- `updateLightTankCombat()` and `updateLightTankAttackApproach()`
- input/selection block around `7250-7367`
- `updateFog()`
- victory/defeat flow in `FE_PATCH_06CDestroyBuilding()` and `FE_PATCH_06DCheckVictoryDefeat()`

Medium-risk places:
- `setManualMove()` if used too aggressively every tick
- `FE_PATCH_07BShouldOrderEnemyTank()` if it starts reissuing commands while a tank is already busy
- any change that broadens building attack rules beyond current HQ-only contract

Specific 08B failure modes:
- bot spams new orders every check and cancels ongoing approach/combat
- tank gets pulled out of attack into regroup too early
- tank never leaves defend because score/phase gates are impossible for 1-unit MVP
- tank chases too far and accidentally changes match pacing back into blind rush

What NOT to touch in 08B

- `src/config/runtime_flags.js` behavior-wise
  - knobs can wait for 08C
- fog logic
- save/load flow
- UI panels / overlays
- player input / selection logic
- pathfinding implementation
- attack-move thin layer
- harvester/builder logic
- enemy economy/mining/production/building AI
- start rosters

Recommendation

Recommendation for implementation route: Codex patch for 08B.

Why:
- patch is still local to `src/main.js`, but it touches the live combat command surface;
- state transition bugs are more likely than syntax bugs here;
- Codex is a better fit for keeping the patch narrow while reasoning about side effects.

GPT `patch.py` is suitable after this only for:
- 08C knobs extraction;
- tiny follow-up tuning if 08B already works.
