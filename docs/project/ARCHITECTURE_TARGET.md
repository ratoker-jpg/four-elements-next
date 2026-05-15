# ARCHITECTURE_TARGET — целевая архитектура Four Elements Remake

**Дата:** 2026-05-12
**Тип:** Architecture target document
**Статус:** Активный
**Назначение:** Зафиксировать целевую архитектуру проекта и правило Architecture Migration Mode как основной режим развития игры.

---

## 1.1. Почему patch accumulation больше не основной режим

Patch accumulation был допустимым и полезным подходом для быстрого прототипа. Патчи помогли собрать рабочий playable прототип Four Elements Remake: бот получает ресурсы, строит юнитов, атакует, скауты разведывают территорию, экономика работает, combat генерирует визуальные эффекты. Без патчей проект не дошёл бы до текущего playable состояния.

Однако проект перешёл порог, где патчи начинают вредить:

- **main.js разрастается** — после всех патчей файл снова вырос примерно до 15 000 строк, несмотря на рефактор-спринт, который сократил его с 12 128 до 11 358 строк. Каждый новый патч добавляет 50–300 строк, и никакой механизм не выносит устаревшую логику.
- **Логика дублируется** — одни и те же проверки (power, economy, targeting) реализуются по-разному для player и enemy. PATCh-префиксы скрывают дублирование вместо устранения.
- **Guard/flag/if-слои конфликтуют** — каждый патч добавляет новый guard или flag, которые со временем начинают противоречить друг другу. Пример: `_enemyPowerPaused` и `_enemySeparatorPaused` управляют одним и тем же поведением, но из разных подсистем.
- **GLM/AI не может удерживать весь контекст** — при размере main.js ~15 000 строк ни один AI-ассистент не способен одновременно держать в памяти все взаимодействия между подсистемами. Каждый новый патч увеличивает риск непредсказуемых побочных эффектов.
- **Каждый новый баг чинится новым условием** — вместо исправления root cause в соответствующей системе, баги закрываются очередным if-блоком, который маскирует проблему, но создаёт новые.

Правильная формулировка: **Патчи помогли собрать рабочий прототип, но больше не должны быть основным способом развития игры.**

---

## 1.2. Новый режим: Architecture Migration Mode

Architecture Migration Mode — это режим, при котором мы сохраняем текущий рабочий прототип, но новые крупные изменения делаем через системы/модули.

Главная формула:

```text
Симптом → определить систему → изменить/создать систему → подключить → проверить → удалить/пометить старую логику на вынос
```

А не:

```text
Симптом → добавить ещё один if/guard/flag в main.js
```

Architecture Migration Mode не означает переписывание игры с нуля. Он означает, что каждая новая нетривиальная фича или фикс направляется в соответствующую систему, а не встраивается в main.js как очередной патч. Старый код продолжает работать, пока система не заменит его полностью.

Ключевые принципы:

1. **Сохраняем рабочий прототип** — не ломаем то, что работает.
2. **Новые фичи — через системы** — каждая новая логика идёт в целевой модуль, не в main.js.
3. **Постепенная миграция** — старый код удаляется только после того, как система подтверждена.
4. **Wiring вместо логики** — main.js становится точкой подключения, не точкой реализации.

---

## 1.3. Роль src/main.js

Целевая роль main.js:

```text
composition root / wiring layer / orchestration layer
```

В main.js допустимо:

- bootstrap игры — создание canvas, загрузка assets, инициализация game state;
- создание/инициализация game state — стартовые ресурсы, расстановка зданий;
- подключение browser-global модулей — `window.FE_MODULE_NAME` инициализация и вызовы;
- вызовы систем в основном game loop — `updatePower()`, `updateEnemyBot()`, `render()` и т.д.;
- thin compatibility wrappers — временные обёртки для доступа к IIFE scope через `window.FE_CORE`;
- временные bridge/adaptor-вызовы — переходные вызовы от старого кода к новым модулям;
- wiring DOM/canvas/input — привязка обработчиков событий, resize, drag-select.

В main.js не должно попадать:

- крупная новая gameplay-логика — новая система боя, новая экономическая модель, новые юниты;
- новая AI-логика — новый decision layer, targeting, retreat logic, scout AI;
- новая combat/economy/render/pathfinding система целиком — такие системы создаются как отдельные модули;
- большие patch-prefixed helper chains — цепочки `FE_PATCH_XX_Helper1()` → `FE_PATCH_XX_Helper2()` → ... должны быть системами;
- уникальные функции под каждый новый юнит — `updateHeavyTank()`, `updateBomber()` и т.д.;
- очередные guard/flag/if-слои в updateEnemyBot — новые условия поверх старых патчей.

---

## 1.4. Целевые зоны проекта

Целевая структура директорий и модулей:

```
src/core/
  shared state helpers, geometry, time, constants
  Примеры: standalone_constants.js, coordinates.js, gameplay_constants.js

src/systems/
  movement_system.js      — движение юнитов, pathfinding, collision avoidance
  combat_system.js         — атака, урон, cooldown, death handling
  economy_system.js        — ресурсы, separator, power, storage, harvester
  production_system.js     — factory queue, unit production, build orders
  construction_system.js   — строительство зданий, placement, builder AI
  vision_system.js         — fog of war, visibility, reveal range
  fog_system.js            — туман войны, rendering fog overlay
  territory_system.js      — territorial control, spread, boundaries
  command_system.js        — приказы юнитам, attack-move, patrol, hold

src/ai/
  enemy_brain.js           — главный decision loop бота, приоритетные действия
  tank_decider.js          — решение отдельного танка: attack/retreat/defend/idle
  enemy_targeting.js       — выбор целей, intel-based targeting, target chain
  enemy_intel.js           — разведданные, scout intel, map knowledge
  scout_decider.js         — решение скаута: observe/return/sweep/idle
  enemy_economy.js         — экономика бота: power, resources, build decisions

src/render/
  render_world.js          — terrain, buildings, minerals rendering
  render_units.js          — юниты, анимация, direction, dust
  render_fog.js            — fog of war overlay
  render_fx.js             — визуальные эффекты: выстрелы, взрывы, спрайты
  render_ui.js             — HUD, build menu, resource panel, tooltips

src/input/
  mouse_input.js           — обработка мыши, click, drag-select, context menu
  keyboard_input.js        — горячие клавиши, пауза, save/load shortcuts
  selection_system.js      — selection box, multi-select, unit grouping

src/ui/
  hud.js                   — ресурсная панель, power indicator, timer
  build_menu.js            — меню строительства, доступность зданий
  pause_menu.js            — пауза, сохранение, загрузка
  result_screen.js         — экран победы/поражения

src/config/
  units.json/js            — характеристики юнитов: hp, speed, range, damage
  buildings.json/js        — характеристики зданий: cost, hp, power, capacity
  factions.json/js         — фракционные данные: элемент, стартовые ресурсы
  balance constants        — tuning-константы: cycle time, cap values, thresholds

src/dev/
  debug overlays           — combat overlay, economy panel, telemetry
  snapshot/export tools    — экспорт состояния игры в JSON
  telemetry panels         — debug-данные, AI state visualization
```

Важно: **не обязательно создавать эти файлы сейчас.** Это целевая карта — направление, в котором проект должен развиваться. Каждый модуль создаётся отдельным архитектурным PR по мере необходимости.

---

## 1.5. Правило добавления новой gameplay/AI-фичи

Перед началом работы над любой gameplay или AI задачей GLM обязан ответить на обязательный вопрос:

```text
В какую систему должна лечь эта логика?
```

Возможные варианты ответа:

- **Система существует** → менять существующую систему. Не добавлять новый patch-prefixed helper в main.js.
- **Системы не существует** → создать/расширить систему. Новый модуль в соответствующей директории, не новый блок в main.js.
- **Нужен временный bridge в main.js** → допустимо, но GLM обязан указать follow-up задачу на вынос логики в модуль. Bridge — не постоянное решение.

Пример применения правила:

Плохо:
```text
Юнит не атакует → добавить forceAttackIfTargetNear() в main.js
```

Хорошо:
```text
Проблема относится к command/combat/targeting boundary:
- targeting выбирает цель;
- command назначает приказ;
- movement подводит к range;
- combat наносит урон;
- decider выбирает следующее действие.
```

Если задача не может быть однозначно отнесена к одной системе — это признак того, что нужно сначала определить границу систем, а не писать код.

---

## 1.6. Как добавлять новый юнит

Новый юнит не должен требовать отдельной уникальной update-функции.

Плохо:
```javascript
updateLightTank()
updateHeavyTank()
updateBomber()
updateScout()
```

Хорошо:
```javascript
updateMovement(unit)      // для всех юнитов с movementProfile
updateCombat(unit)        // для всех юнитов с combatProfile
updateDust(unit)          // для всех юнитов с dustProfile
updateSelection(unit)     // для всех юнитов
updateAiDecision(unit)    // для enemy юнитов через decider
```

Новый юнит должен подключаться через config/profile — декларативное описание характеристик, а не императивный код:

```yaml
unit type:          light_tank
hp:                 120
speed:              1.8
movementProfile:    tracked_vehicle
combatProfile:      cannon_light
dustProfile:        light_tracks
aiRole:             combat_tank
spriteProfile:      light_tank_sprites
range:              5
damage:             15
cooldown:           1.2s
production cost:    50 energy

unit type:          heavy_tank
hp:                 250
speed:              1.0
movementProfile:    tracked_vehicle
combatProfile:      cannon_heavy
dustProfile:        heavy_tracks
aiRole:             combat_tank
spriteProfile:      heavy_tank_sprites
range:              4
damage:             35
cooldown:           2.0s
production cost:    100 energy
```

При таком подходе добавление нового юнита — это добавление записи в config, а не написание нового кода в main.js.

---

## 1.7. Как добавлять новую AI-логику

AI-логика должна идти через decision layer / decider / targeting / brain modules, а не через прямое добавление условий в updateEnemyBot.

Для enemy tanks целевой подход:

```text
tank_decider получает состояние танка и игры
tank_decider возвращает одно решение:
  - retreat       — отступить к базе
  - defend_hq     — защищать HQ
  - attack_current_target — продолжить атаку текущей цели
  - pick_next_target     — выбрать новую цель
  - regroup       — собраться с другими танками
  - patrol        — патрулировать территорию
  - idle          — ждать приказа
```

Запрещённый путь:

```text
добавить ещё один if в updateEnemyBot, который перезаписывает приказ танка
```

Каждый новый AI-паттерн должен быть выражен через существующий или новый decider, не через условие в основном цикле бота. Если текущий decider не поддерживает нужный паттерн — сначала расширить decider, потом использовать его.

---

## 1.8. Правило после двух неудачных фиксов

Если один и тот же симптом уже чинили 2 раза, третий patch/guard запрещён.

Нужно остановиться и сделать architecture audit:

1. **Какая система должна владеть поведением** — определить целевую систему, в которой логика должна жить.
2. **Почему текущие патчи конфликтуют** — понять причину: дублирование, race condition, отсутствие owner-системы.
3. **Какой слой нужно выделить** — определить abstraction boundary, который разделит ответственности.
4. **Какой старый код будет заменён** — указать, какие patch-prefixed функции будут удалены после создания системы.

Это правило особенно важно для recurrent issues: retreat/attack oscillation, targeting desync, power/economy stalls. Каждый из этих симптомов уже чинился несколько раз patch-подходом — следующий шаг должен быть системным.

---

## 1.9. Как принимать architecture PR

Каждый architecture/refactor PR должен указывать:

1. **Какую систему создаёт или расширяет** — название модуля и его назначение.
2. **Какие файлы меняет** — полный список изменённых файлов с объяснением каждого.
3. **Что остаётся в main.js и почему** — явно указать, какой код временно остаётся как bridge/wiring.
4. **Какой старый код заменён** — какие patch-prefixed функции заменены новыми системными вызовами.
5. **Какой старый код можно удалить следующим шагом** — указать follow-up задачу на cleanup.
6. **main.js before/after line count** — количественная оценка сокращения main.js.
7. **node --check по всем изменённым JS** — синтаксическая проверка обязательна.
8. **Browser smoke checklist** — минимальный набор проверок в браузере.
9. **Known risks** — известные риски и их митигация.
10. **Rollback plan** — как откатить PR, если что-то пойдёт не так.

---

## 1.10. Миграционный план

Пошаговый план миграции на архитектурный подход:

1. **DOCS-ARCH-00** — зафиксировать Architecture Migration Mode (этот документ). Docs-only, правила проекта обновлены.

2. **ARCH-MAP-01** — построить актуальную карту main.js: зоны, функции, зависимости, уже вынесенные модули. Цель — иметь точную карту для планирования миграции.

3. **ARCH-CORE-01** — вынести безопасные shared helpers/geometry/constants, если актуально. Координатные функции, утилиты, которые не зависят от game state. Низкий риск, подтверждённый опыт из рефактор-спринта.

4. **ARCH-AI-01** — создать enemy tank decision layer MVP без переписывания всего бота. Вынести tank_decider как отдельный модуль с минимальным интерфейсом. Не трогать остальной бот.

5. **ARCH-AI-02** — провести target-chain через decision layer, а не через новый guard в updateEnemyBot. Перенести целеполагание из patch-chains в decider.

6. **ARCH-AI-03** — постепенно перенести patrol/idle/regroup/defend/retreat в decision layer. Каждый паттерн — отдельный sub-PR в рамках этого шага.

7. **ARCH-SYSTEMS-01+** — переносить economy/combat/render/input только отдельными PR. Каждый PR = одна система. Не комбинировать разные системы.

8. **ARCH-CLEANUP-*** — удалять старые guard/flag/patch chains, когда система их заменила. Только после подтверждения, что новая система работает корректно.

Порядок не строго линейный — шаги 3 и 4 можно делать параллельно. Но каждый шаг — отдельный PR, отдельная проверка, отдельный merge.
