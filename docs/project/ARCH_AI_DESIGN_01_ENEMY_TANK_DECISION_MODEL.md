# ARCH-AI-DESIGN-01 — Enemy Tank Decision Model

**Дата:** 2026-05-12
**Тип:** Architecture design document
**Статус:** Активный
**Назначение:** Спроектировать первый архитектурный слой принятия решений для enemy tanks, который решает проблему order overwrite и позволяет постепенную миграцию.

---

## 1. Executive summary

### Какую проблему решаем

Enemy tank приказы могут перезаписываться 7+ независимыми подсистемами в пределах одного game tick. Результат — осциллирующее поведение: танк получает `attack_approach` → `manual_move` (retreat) → `defend` → `attack_approach` через несколько тиков, или даже в пределах одного тика. Это корневая причина jittery/oscillating enemy behavior, которая чинилась множество раз patch-подходом (ATTACK-04/05/07/08/10, 10H1 stand-and-fight, DEFENSE-RETREAT-01), но ни один патч не решил фундаментальную проблему: отсутствие единой точки принятия решения.

### Почему простое выделение `enemy_bot.js` недостаточно

Перенос 5 255 строк enemy bot AI в один файл `enemy_bot.js` не решает проблему order overwrite. Подсистемы внутри бота (strength gate, retreat/defend, autopilot guard, attack-12 gate, scout dispatch) будут продолжать перезаписывать приказы друг другу — просто в другом файле. Нужен не structural extraction, а architectural layer — единая точка, где танк принимает ОДНО решение за tick.

### Рекомендованный pattern

**Priority Stack** — танк оценивает набор правил по приоритету и выбирает первое активное. Это самый безопасный первый шаг, потому что:

1. Он наиболее близок к текущей логике — многие подсистемы уже работают по принципу "проверить условие → выдать приказ", просто без координации.
2. Его можно внедрять постепенно — добавлять правила по одному, не переписывая весь бот.
3. Он не требует новой state machine — текущие состояния (`attack_approach`, `attacking`, `manual_move`, `idle`) сохраняются.
4. Он не требует full rewrite — достаточно добавить один слой арбитража перед существующими подсистемами.

### Почему Priority Stack безопаснее для текущего проекта

Текущий код уже содержит элементы priority-based логики (BRAIN-01, ATTACK-12 gate, strength gate). Priority Stack формализует этот подход и делает его единым owner-ом решений. Другие patterns (Utility AI, FSM, Behaviour Tree) требуют более глубокой реструктуризации и могут быть рассмотрены позже как evolution.

---

## 2. Текущая проблема decision flow

### Карта overwrite-точек

В `updateEnemyBot()` и связанных функциях минимум 16 точек, где приказ enemy tank может быть перезаписан:

| # | Функция | Устанавливает | Перезаписывает | Критичность |
|---|---------|--------------|---------------|-------------|
| 1 | `FE_PATCH_08BSilentMoveTo` (L2979) | `manual_move` + path | `attack_approach`, `attacking` | **HIGH** — не очищает attackApproachTargetId |
| 2 | `FE_PATCH_08BReturnUnitHome` (L3003) | `manual_move` home | любой активный приказ | **HIGH** — вызывается из regroup/defend/prepare |
| 3 | `FE_PATCH_08BCommandEnemyTankAttack` (L2927) | `attack_approach` или `attacking` | предыдущую цель | **MEDIUM** — есть NeedsNewAttackOrder guard |
| 4 | `FE_10H1_clearAttackOrder` (L6776) | очищает все attack fields | активные attack orders | **HIGH** — вызывается при retreat |
| 5 | `FE_10H1_startRetreat` (L6868) | `regroup` + `manual_move` home | все attack/defend orders | **HIGH** |
| 6 | `FE_10H1_defendHqWithAvailableTanks` (L6921) | `attack_approach` на threat | attack на другую цель | **MEDIUM** — есть stand-and-fight guard |
| 7 | `FE_10D1_tryAttack` (L6125) | **НЕКОРРЕКТНО**: attackTargetId + state=attack_approach | patrol/idle | **HIGH** — создаёт неконсистентное состояние |
| 8 | `FE_10D1_tryMove` (L6164) | `moving` + targetX/Y | `attack_approach`, `attacking` | **MEDIUM** — есть ATTACK-07 guard с gap |
| 9 | `FE_10E1_clearAttackOrder` (L6544) | `idle` + очищает attack | активный attack | **HIGH** — strength gate suppression |
| 10 | `FE_10E1_returnToHq` (L6564) | `moving` + targetX/Y=HQ | attack orders | **HIGH** |
| 11 | `10E1B Early Hook` (L7033) | делегирует к 9+10 | что угодно | **CRITICAL** — runs async via setTimeout(0) |
| 12 | `FE_PATCH_08BDefend` (L5208) | `defend` + `attack_approach` | любой предыдущий приказ | **MEDIUM** |
| 13 | `FE_PATCH_08BStartRegroup` (L3304) | `phase=regroup` | attack phase | **MEDIUM** |
| 14 | `FE_PATCH_08BPrepareAttack` (L5220) | intel rally `manual_move` | idle tanks | **LOW** |
| 15 | `ATTACK-11 rally conversion` (L7627) | attack на найденную цель | intel rally `manual_move` | **LOW** — намеренно |
| 16 | `ATTACK-03 re-issue` (L7671) | `attack_approach` | idle state | **LOW** — намеренный фикс |

### Каскад перезаписи в одном tick

Последовательность выполнения в `updateEnemyBot()`:

```
1. [L7024-7058] 10E1B Early Hook: strength gate → clear attack + return home
2. [L7061-7066] 10D1 Autopilot Guard: tryAttack или tryMove → перезаписывает 1
3. [L7068-7074] 10C1 Scouting: может назначить скаута → перезаписывает 2
4. [L7465-7511] 10H1 Retreat/Defend: retreat или defend → перезаписывает 1-3
5. [L7513-7543] pressureTarget → FE_PATCH_08BDefend → перезаписывает 4!
6. [L7551-7572] OverChasing → StartRegroup → перезаписывает 5!
7. [L7599-7744] Attack phase: ATTACK-11/03/07 → перезаписывает 6!
8. [L7754-7759] 10E1 post-attack hook → может подавить 7!
9. [L15093] ATTACK-08 invariant repair — post-hoc фикс всех нарушений
```

**Результат:** К моменту завершения tick, танк может получить 5+ противоречащих приказов. ATTACK-08 ремонт чинит некоторые, но не все, и с задержкой в один tick.

### Симптом-фиксы, подтверждающие проблему

| Симптом-фикс | Что чинит | Почему это patch, а не решение |
|-------------|----------|-------------------------------|
| `FE_ATTACK08RepairEnemyAttackInvariant` | state≠attack_approach при attackApproachTargetId set | Чинит следствие, не причину — подсистемы продолжают ломать invariant |
| ATTACK-07 sync block | Path-goal mismatch при attack | Перепутьё вместо предотвращения рассинхронизации |
| ATTACK-04 hq_push protection | Блокирует retreat/defend при hq_push | Частичный guard — не блокирует pressureTarget |
| `FE_DEFENSE_RETREAT01ShouldStandAndFight` | Не даёт отступить танку, который уже дерётся | Guard для одного случая, не системное решение |
| `setTimeout(run10e1bStrengthGate, 0)` | Async strength gate check | Создаёт race condition — может перезаписать orders от основного tick |

---

## 3. Сравнение 4 вариантов

### 3.1 Priority Stack

**Как работает:** Танк имеет упорядоченный список правил. Каждое правило проверяет условие и предлагает действие. Выбирается первое активное правило с наивысшим приоритетом. Одно решение за tick.

| Аспект | Оценка |
|--------|--------|
| Плюсы | Простая реализация; наиболее близок к текущей логике; можно внедрять постепенно; предсказуемое поведение; легко отлаживать; нет hidden state |
| Минусы | Жёсткий приоритет — не учитывает "степень" угрозы; может дать неоптимальные решения на границах правил; сложнее добавлять взвешенные решения позже |
| Риск для проекта | **Низкий** — формализует уже существующую логику, не требует новой state machine |
| Подходит сейчас? | **Да** — лучший первый шаг |

### 3.2 Utility AI

**Как работает:** Каждое возможное действие получает score (0–1) на основе текущего контекста. Выбирается действие с наивысшим score. Позволяет плавные переходы между решениями.

| Аспект | Оценка |
|--------|--------|
| Плюсы | Гибкость — учитывает "степень" угрозы; плавные переходы; хорошо масштабируется |
| Минусы | Требует tuning каждого scorer; сложнее отлаживать (почему выбрано это действие?); нужна curve-математика; может дать неожиданные результаты при плохо настроенных весах |
| Риск для проекта | **Средний-Высокий** — требует существенного redesign текущей логики; tuning может занять много итераций; сложнее откатить |
| Подходит сейчас? | **Позже** — как evolution Priority Stack, не как первый шаг |

### 3.3 Finite State Machine (FSM)

**Как работает:** Танк находится в одном состоянии (idle, attack, retreat, defend, patrol). Переходы между состояниями определяются условиями. В каждом состоянии — своё поведение.

| Аспект | Оценка |
|--------|--------|
| Плюсы | Понятная модель; легко визуализировать; каждый state инкапсулирован |
| Минусы | Текущий код УЖЕ неформальная FSM с проблемами; формализация не решит order overwrite — тот же конфлик переходов; количество переходов растёт квадратично с числом состояний; нужен separate arbitration для конфликтов переходов |
| Риск для проекта | **Средний** — формализует текущий хаос, но не решает корневую проблему арбитража; может создать новый слой конфликтов переходов |
| Подходит сейчас? | **Нет** — не решает проблему order overwrite, только переносит её на уровень переходов |

### 3.4 Behaviour Tree

**Как работает:** Дерево узлов (selector, sequence, decorator, action). Selector выбирает первую успешную ветку. Sequence выполняет все дочерние по порядку. Дерево оценивается каждый tick.

| Аспект | Оценка |
|--------|--------|
| Плюсы | Мощная модель для сложного AI; модульная — легко добавлять новые ветки; reusability поддеревьев; хорошо тестируется |
| Минусы | Значительный redesign текущего кода; нужна чёткая декомпозиция поведения; overhead по сложности для текущего масштаба; debugging требует visualizer; несовместима с текущим flat-function подходом |
| Риск для проекта | **Высокий** — требует полной реструктуризации enemy bot; текущий код не декомпозирован для behaviour tree; переходный период будет нестабильным |
| Подходит сейчас? | **Нет** — слишком большой шаг для первого migration; рассмотреть как ARCH-AI-10+ |

### Итоговое сравнение

| Pattern | Решает order overwrite? | Можно внедрить постепенно? | Риск для проекта | Подходит как первый шаг? |
|---------|----------------------|--------------------------|-----------------|------------------------|
| Priority Stack | Да — одно решение за tick | Да | Низкий | **Да** |
| Utility AI | Да — одно решение за tick | Частично | Средний-Высокий | Позже |
| FSM | Частично — конфликты переходов | Да | Средний | Нет |
| Behaviour Tree | Да — дерево arbitration | Нет — нужен полный перенос | Высокий | Нет |

---

## 4. Рекомендованный первый pattern: Priority Stack

### Почему Priority Stack решает order overwrite

Вместо 7+ подсистем, независимо устанавливающих приказы, Priority Stack даёт единую точку арбитража:

```text
tank_decider.evaluate(tank, context) → { action, target, reason, priority }
```

Все подсистемы становятся "правилами" внутри decider. Decider проверяет правила по приоритету и возвращает первое активное. После этого НИКАКАЯ другая подсистема не может перезаписать приказ в текущем tick.

### Почему можно внедрять постепенно

Priority Stack не требует переноса всех подсистем сразу. MVP может содержать 2–3 правила, а остальные продолжают работать через старый код. Каждое новое правило, добавленное в decider, заменяет соответствующий участок старого кода — постепенная миграция.

### Почему не требует full bot rewrite

Decider — это thin arbitration layer. Он не заменяет существующие функции (findPath, setLightTankAttackApproach, SilentMoveTo) — он решает, КАКОЙ приказ выдать, а не КАК его выполнить. Execution layer остаётся в main.js.

### Какие решения должен принимать первым

MVP должен арбитражить три самых конфликтующих решения:

1. **defend_hq** — если база под угрозой (вместо 10H1 defend + pressureTarget + 10D1 tryAttack конфликта)
2. **retreat** — если танк проигрывает / overextended (вместо 10H1 retreat + 10E1 strength gate конфликта)
3. **keep_attacking** — если текущая цель валидна (вместо ATTACK-07 sync + ATTACK-08 repair + 10D1 tryMove конфликта)

---

## 5. Минимальная модель enemy tank decision

### Input

```text
tankDeciderContext = {
  tank: unit,                          // текущий танк
  game: game,                          // полный game state (временно — см. no-omniscience)
  enemyBotState: game._enemyBotState,  // bot state (phase, home position)
  enemyKnowledge: game._enemyKnowledge, // видение/память бота
  nearbyThreats: threat[],             // враги в зоне видимости танка
  currentOrder: {                      // текущий приказ танка
    state: tank.state,                 // 'attack_approach' | 'attacking' | 'manual_move' | 'idle' | ...
    attackTargetId: tank.attackTargetId,
    attackApproachTargetId: tank.attackApproachTargetId,
    command: tank.command,
    targetX: tank.targetX,
    targetY: tank.targetY
  },
  homeBase: { x, y },                 // позиция enemy HQ
  now: number                          // текущее время
}
```

### Output

```text
tankDeciderResult = {
  action: 'defend_hq' | 'retreat' | 'attack_current_target' | 'pick_next_target' | 'regroup' | 'patrol' | 'idle',
  targetId: string | null,             // ID цели (building или unit)
  targetX: number | null,              // координаты цели (для движения)
  targetY: number | null,
  reason: string,                      // человекочитаемая причина решения
  priority: number,                    // приоритет правила, которое выдало решение
  telemetry: {                         // минимальная телеметрия
    ruleName: string,                  // какое правило сработало
    evaluatedRules: number,            // сколько правил было оценено
    contextSnapshot: object | null     // для debug (не в production)
  }
}
```

### Contract

1. Decider вызывается ОДИН раз за tick для каждого enemy tank.
2. После возврата результата, execution layer выполняет действие через существующие функции.
3. Никакая другая подсистема не может перезаписать приказ после decider в текущем tick.
4. Если decider не может принять решение (context incomplete), он возвращает `idle` с reason.
5. Decider не выполняет side effects — только вычисляет решение. Execution делает main.js.

---

## 6. Первичный priority list

```text
Приоритет  Правило                                  Owner/источник данных         MVP?
─────────  ───────────────────────────────────────  ────────────────────────────  ─────
100        defend_hq_if_base_threatened              enemyKnowledge + nearbyThreats  Да
90         retreat_if_losing_or_overextended         nearbyThreats + unit hp         Да
80         keep_attacking_valid_current_target       currentOrder + target validity  Да
70         pick_next_local_target_after_kill         nearbyThreats + enemyKnowledge  Нет
60         regroup_with_wave                         enemyBotState.attack wave       Нет
50         attack_assigned_intel_target              enemyKnowledge + attack gate    Нет
40         move_to_attack_rally                      enemyBotState.prepare_attack    Нет
20         patrol_home_area                          idle tank autopilot             Нет
10         idle                                      default                         Да
```

### Каждое правило — детали

**100 — defend_hq_if_base_threatened**
- Условие: player units/buildings в радиусе N клеток от enemy HQ, и танк ближе к HQ, чем к текущей цели
- Источник: `nearbyThreats` (threats near home), `enemyBotState.homeX/Y`
- Заменяет: `FE_10H1_defendHqWithAvailableTanks` + `FE_PATCH_08BDefend` (pressureTarget)
- MVP: Да — это самый частый источник oscillation

**90 — retreat_if_losing_or_overextended**
- Условие: танк имеет низкий HP, или численно уступает рядом, или далеко от базы при отступлении союзников
- Источник: `tank.hp`, `nearbyThreats` count, distance to home
- Заменяет: `FE_10H1_startRetreat` + `FE_10E1 strength gate`
- MVP: Да — второй по частоте источник oscillation

**80 — keep_attacking_valid_current_target**
- Условие: танк имеет `attackApproachTargetId` или `attackTargetId`, цель жива, танк в состоянии attack/attack_approach
- Источник: `currentOrder`, `findUnitById(targetId).hp > 0`
- Заменяет: `FE_ATTACK08RepairEnemyAttackInvariant` + ATTACK-07 sync
- MVP: Да — устраняет необходимость в post-hoc invariant repair

**70 — pick_next_local_target_after_kill**
- Условие: текущая цель мертва, рядом есть другая вражеская цель
- Источник: `nearbyThreats`, `currentOrder` (target dead)
- Заменяет: `tryRetargetAfterKill` + `FE_10D1_tryAttack`
- MVP: Нет — требует targeting system, которую нужно проектировать отдельно

**60 — regroup_with_wave**
- Условие: танк один, нет активной цели, есть attack wave формируется
- Источник: `enemyBotState.phase`, attack wave composition
- MVP: Нет — сложная логика, требует design

**50 — attack_assigned_intel_target**
- Условие: ATTACK-12 gate разрешил атаку, танк назначен в attack wave
- MVP: Нет — зависит от ATTACK-12 gate, который нужно интегрировать

**40 — move_to_attack_rally**
- Условие: prepare_attack phase, танк должен собраться у rally point
- MVP: Нет — зависит от attack preparation flow

**20 — patrol_home_area**
- Условие: танк idle, нет угроз, нет attack orders
- MVP: Нет — самый низкий приоритет, текущий 10D1 autopilot достаточно

**10 — idle**
- Условие: ничего не подошло
- MVP: Да — fallback по умолчанию

---

## 7. Boundary: tank_decider vs enemy_brain vs targeting

### Ответственность

| Модуль | Ответственность | Что НЕ делает |
|--------|----------------|---------------|
| `enemy_brain` | Стратегические решения: когда атаковать, строить, скаутить. Управляет `game._enemyBotState.phase`. Вызывает BRAIN-01 для production/building. | Не решает, что делает конкретный танк в текущий tick |
| `tank_decider` | Тактическое решение для танка/группы танков в текущий tick. Оценивает правила, возвращает ОДНО решение. | Не управляет bot phase, не строит здания, не производит юнитов |
| `enemy_targeting` | Поиск/ранжирование целей. Возвращает список candidate targets с scores. | Не принимает решение атаковать — только предлагает цели |
| `enemy_intel` | Что бот знает/помнит. Хранит vision data, scout intel, combat contacts. | Не принимает решений, не выбирает цели |
| `movement/command system` | Выполнение решения: pathfinding, movement, attack-approach. | Не принимает тактических решений |

### Поток решений

```text
1. enemy_brain устанавливает bot phase (opening, attack, regroup, idle)
2. tank_decider оценивает правила на основе phase + context
3. tank_decider возвращает { action, target, reason, priority }
4. execution layer выполняет действие через существующие функции
5. НИКТО не перезаписывает приказ после step 4 в текущем tick
```

### Кто НЕ должен перезаписывать приказ после tank_decider

```text
FE_10H1_startRetreat         — НЕ перезаписывает. Проверяет tank_decider result.
FE_10H1_defendHq             — НЕ перезаписывает. Проверяет tank_decider result.
FE_10D1_tryAttack/tryMove    — НЕ перезаписывает. Проверяет tank_decider result.
FE_10E1_strengthGate         — НЕ перезаписывает. Проверяет tank_decider result.
FE_PATCH_08BDefend           — НЕ перезаписывает. Проверяет tank_decider result.
FE_ATTACK08Repair            — НЕ нужен. tank_decider не создаёт invariant violations.
```

Каждая из этих подсистем становится правилом внутри tank_decider. Они предлагают решения, но не выполняют их напрямую. Execution — через decider output.

---

## 8. No-omniscience policy

### Правила

1. **tank_decider не должен использовать full-map omniscience.** Решения по целям должны использовать только:
   - `visible` — юниты/здания в зоне видимости танка
   - `known` — из `enemyKnowledge` (scout intel, combat contacts)
   - `inferred` — выводы на основе видимых данных (например, нет видимых войск → вероятно, враг готовит атаку)

2. **Debug может смотреть всё, gameplay logic — нет.** Telemetry может включать full-map snapshot для анализа, но decision logic должна работать только с тем, что бот "знает".

3. **Текущий код временно использует full game state** — это technical debt. В MVP, `tankDeciderContext.game` даёт доступ ко всему, но правила должны извлекать только "известные" данные через `enemyKnowledge` и `nearbyThreats`. Прямой доступ к `game.units` (все юниты на карте) — только для debug telemetry.

4. **Future improvement:** Добавить `enemyKnowledge.getKnownEnemies()` и `enemyKnowledge.getKnownBuildings()`, которые возвращают только то, что бот видел/помнит. Decision logic переключается на эти методы.

---

## 9. Migration plan

### PR 1: ARCH-AI-01 — Создать `src/ai/tank_decider.js` MVP

- **Цель:** Создать модуль с Priority Stack decider, тремя MVP правилами (defend_hq, retreat, keep_attacking), и минимальным wiring в main.js
- **Files expected:** `src/ai/tank_decider.js` (new), `src/main.js` (wiring: вызов decider + execution), `index.html` (new script tag)
- **Risk:** Medium — новый модуль, но execution через существующие функции
- **Smoke test:** Игра загружается, enemy bot стартует, танки двигаются, defend/retreat/attack работают, console без ошибок
- **Что меняет:** Добавляет decider как arbitration layer ПЕРЕД существующими подсистемами. Существующий код продолжает работать для правил, не добавленных в decider.
- **Что НЕ трогает:** BRAIN-01, economy, power, production, scout lifecycle, save/load, render, input

### PR 2: ARCH-AI-02 — Подключить один безопасный decision case

- **Цель:** Перевести `keep_attacking_valid_current_target` (priority 80) на decider. Убрать ATTACK-08 invariant repair для этого случая.
- **Files expected:** `src/ai/tank_decider.js` (updated), `src/main.js` (ATTACK-08 disabled for decider-managed tanks)
- **Risk:** Low — одно правило, легко откатить
- **Smoke test:** Танки продолжают атаковать, если цель валидна. Нет oscillation. ATTACK-08 ремонт не триггерит для decider-managed танков.

### PR 3: ARCH-AI-03 — Target-chain через decider

- **Цель:** Добавить `pick_next_local_target_after_kill` (priority 70) в decider. Перевести `tryRetargetAfterKill` + `FE_10D1_tryAttack` на decider output.
- **Files expected:** `src/ai/tank_decider.js` (updated), `src/main.js` (10D1 tryAttack replaced for decider-managed tanks)
- **Risk:** Medium — затрагивает targeting, нужна careful testing
- **Smoke test:** После убийства цели танк выбирает следующую ближайшую. Нет jitter. Нет revert к старой логике.

### PR 4: ARCH-AI-04 — Defend/retreat arbitration через decider

- **Цель:** Перевести `defend_hq` (priority 100) и `retreat` (priority 90) на decider. Убрать прямые вызовы `FE_10H1_defendHqWithAvailableTanks` и `FE_10H1_startRetreat` для decider-managed танков.
- **Files expected:** `src/ai/tank_decider.js` (updated), `src/main.js` (10H1 calls replaced for decider-managed tanks)
- **Risk:** Medium-High — основные источники oscillation, но и самые важные для исправления
- **Smoke test:** Танки защищают базу при угрозе. Отступают при перевесе врага. Нет oscillation defend↔retreat. Нет перезаписи attack→defend→retreat в одном tick.

### PR 5: ARCH-AI-05 — Cleanup old order-overwrite guards

- **Цель:** Удалить/деактивировать patch-цепочки, которые decider заменяет: ATTACK-08 repair (для managed танков), 10E1 async hook, scattered typeof guards
- **Files expected:** `src/main.js` (cleanup), `src/ai/tank_decider.js` (minor updates)
- **Risk:** Medium — удаление fallback логики, нужна тщательная проверка
- **Smoke test:** Полная game session без regression. Нет new oscillation. Console чистая.

### PR 6: ARCH-AI-06 — Telemetry / debug panel for decision output

- **Цель:** Добавить debug panel, показывающий решения decider в реальном времени (какое правило, почему, какой приоритет)
- **Files expected:** `src/ai/tank_decider.js` (telemetry enhanced), `src/dev/tank_decider_debug_panel.js` (new)
- **Risk:** Low — dev-only, не влияет на gameplay
- **Smoke test:** Debug panel открывается, показывает решения. Не влияет на gameplay при закрытом panel.

---

## 10. First implementation recommendation

```text
Recommended next PR:
ARCH-AI-01 — Enemy Tank Decider MVP (Priority Stack)

Goal:
  Создать src/ai/tank_decider.js с Priority Stack decider.
  Три MVP правила: defend_hq (100), retreat (90), keep_attacking (80).
  Wiring в main.js: вызов decider для enemy light_tank, execution через существующие функции.
  Decider-managed танки получают приказ только через decider, старый код отключается для них.

Files expected:
  src/ai/tank_decider.js (new, ~200-300 lines)
  src/main.js (wiring: ~50 lines — вызов decider + execution dispatch)
  index.html (1 new script tag)

Risk: Medium
  Новый модуль, но execution через существующие функции.
  Feature flag: window.FE_TANK_DECIDER_ENABLED (default false) для безопасного rollout.

What it changes:
  - Добавляет tank_decider как arbitration layer перед updateEnemyBot
  - Decider-managed танки (feature flag on) получают ОДНО решение за tick
  - Существующий код продолжает работать для не-managed танков (feature flag off)

What it does NOT touch:
  - BRAIN-01 / production / building decisions
  - Economy / power system
  - Scout lifecycle
  - Factory production
  - Combat damage/cooldown/range
  - Pathfinding / findPath / passable
  - Save/load
  - Render / fog / territory
  - Input / selection
  - Player units
  - Map generation

Telemetry:
  game._tankDecider01 = {
    enabled: boolean,
    decisionsThisTick: number,
    lastDecision: { unitId, action, reason, priority, ruleName },
    totalDefendHq: number,
    totalRetreat: number,
    totalKeepAttacking: number,
    totalIdle: number
  }

Manual smoke:
  - Игра загружается
  - Enemy bot стартует
  - FE_TANK_DECIDER_ENABLED=false: поведение идентично текущему (baseline)
  - FE_TANK_DECIDER_ENABLED=true: танки защищают базу, отступают, продолжают атаку
  - Нет oscillation defend↔retreat при включённом decider
  - Нет console errors
  - Save/load работает

Rollback:
  Установить FE_TANK_DECIDER_ENABLED=false → возврат к старому поведению.
  Удалить script tag из index.html → полный rollback.
```

---

## 11. Risks and non-goals

### Non-goals

- Не переписывать всего бота — decider — это thin arbitration layer, не замена updateEnemyBot
- Не менять экономику — BRAIN-01, separator, factory, power продолжают работать как есть
- Не менять power system — FE_POWER_01 остаётся без изменений
- Не менять pathfinding — findPath, passable, movement остаются как есть
- Не менять combat damage/cooldown/range — combat system не затронут
- Не менять production — factory queue, unit spawning остаются как есть
- Не менять scout lifecycle — скауты продолжают работать через FE_SCOUT02*
- Не менять save/load — decider state не персистится (decider без state)

### Risks

1. **Hidden coupling через game._enemyBotState** — bot state может содержать поля, которые неочевидно влияют на решения. MVP должен читать только явные поля (phase, homeX/Y, attack-related).

2. **Order overwrite still possible if old code runs after decider** — если не все подсистемы переключены на decider, старый код может перезаписать decider output. Решение: feature flag + постепенное переключение подсистем.

3. **Current commands may mix movement/combat state** — `FE_10D1_tryAttack` создаёт неконсистентное состояние (attackTargetId + state=attack_approach без attackApproachTargetId). Decider должен корректно инициализировать ВСЕ необходимые поля при выдаче решения.

4. **Manual QA required** — decider влияет на gameplay, нужна ручная проверка поведения enemy в различных сценариях (база под атакой, атака на игрока, retreat, idle).

5. **10E1B async setTimeout(0)** — этот async hook может перезаписать decider decision в том же tick. Нужно либо удалить async hook, либо добавить guard: "если decider уже выдал решение, не перезаписывать".

---

## 12. Acceptance criteria

Документ считается хорошим, если он:

- [x] Ясно выбирает pattern — Priority Stack
- [x] Объясняет, почему не просто structural extraction — extraction не решает order overwrite, нужен arbitration layer
- [x] Даёт contract для `tank_decider` — Input/Output с чёткими типами и правилами
- [x] Показывает первый safe MVP — три правила (defend_hq, retreat, keep_attacking) + feature flag
- [x] Не предлагает full rewrite — decider — thin layer, execution через существующие функции
- [x] Не меняет код — docs-only
