# AUDIT_FROM_GLM — POWER-SYSTEM-01

**Task:** POWER-SYSTEM-01 — audit power capacity and upkeep for units/buildings
**Lane:** Audit only
**Date:** 2026-05-12

---

## 1. Root cause / цель аудита

После BOT-PROGRESSION-01 (снятие cap на танки) и BOT-ECONOMY-01A (элементный склад) экономика бота стабилизировалась, но отсутствует механизм, ограничивающий масштабирование армии/зданий. `power_plant` существует в игре, но стратегически неважен: мощность нужна только для сепаратора и фабрики, начальных 10 MW (HQ) хватает на 1 сепаратор (4 MW) + 1 фабрику (5 MW) = 9/10 MW. Один `power_plant` (+20 MW) полностью покрывает все потребности на всю игру — нет причины строить второй. Юниты вообще не потребляют мощность.

**Проблемы:**
1. Нет natural cap на количество юнитов — армия ограничена только экономикой (elements/minerals).
2. `power_plant` — «dead building»: строишь один раз и забываешь. Нет стратегического выбора.
3. Юниты не создают ongoing cost — произведённый юнит бесплатен в содержании.
4. Вражеская экономика полностью игнорирует мощность — вражеский сепаратор и фабрика работают без ограничений.

---

## 2. Текущая система мощности — полный анализ

### 2.1. Конфигурация мощности

Источники: `src/config/runtime_flags.js` L51-55, `src/main.js` L2023-2029.

```javascript
// runtime_flags.js
window.FE_POWER_HQ_MW = 10;              // HQ даёт 10 MW
window.FE_POWER_PLANT_MW = 20;           // power_plant даёт +20 MW
window.FE_SEPARATOR_ACTIVE_POWER_MW = 4; // сепаратор потребляет 4 MW при работе
window.FE_UNITS_FACTORY_ACTIVE_POWER_MW = 5; // фабрика потребляет 5 MW при производстве
window.FE_POWER_ENFORCEMENT_ENABLED = true;  // ФЛАГ ЕСТЬ, НО НИГДЕ НЕ ИСПОЛЬЗУЕТСЯ
```

`FE_POWER_ENFORCEMENT_ENABLED = true` — флаг определён, но **нигде не считывается**. Мощность всегда принудительно применяется.

### 2.2. Расчёт мощности — `evaluatePowerState()` (L2053-2098)

Функция проходит по зданиям **игрока** (`isPlayerBuilding(b)`) в фиксированном порядке:

1. **Сначала** подсчитывает `total` — сумма `hqMw` от HQ + `powerPlantMw` от power_plant (L2032-2043).
2. **Затем** резервирует мощность для сепараторов: каждый работающий сепаратор получает 4 MW. Если мощность закончилась — сепаратор получает `_powerPaused = true` (L2080-2085).
3. **Затем** резервирует мощность для фабрик: каждая фабрика с очередью получает 5 MW. Если мощности нет — фабрика получает `_powerPaused = true` (L2087-2093).

**Порядок резервирования: сепаратор → фабрика.** Это означает, что при нехватке мощности фабрика паузится первой.

### 2.3. Влияние на производство — player side

**Сепаратор (L2246):** `canRunSeparatorCycle()` проверяет только ресурсы (minerals ≥ 15, energy space ≥ 10, element space ≥ 1). Мощность проверяется через `activeSepCount` из `evaluatePowerState()`. Если сепаратор `_powerPaused` — он не включается в `activeSepCount`, цикл не тикает.

**Фабрика (L2304-2329):** `updateUnitProduction()` проверяет `b._powerPaused`. Если пауза — `continue`, производство останавливается.

### 2.4. Enemy side — мощность НЕ применяется

Критическое наблюдение: `evaluatePowerState()` использует `isPlayerBuilding(b)` на каждом шаге (L2037, L2081, L2088). Вражеские здания **полностью игнорируются** системой мощности.

Вражеский сепаратор работает через `FE_PATCH_09C3UpdateEnemySeparatorProduction()` (L9405), который проверяет только ресурсы (minerals ≥ 15, energy space, element space). Никакой проверки мощности.

Вражеская фабрика работает через `FE_PATCH_09EUpdateEnemyFactoryProduction()` (L9871), который проверяет элементы и очередь. Никакой проверки мощности.

**Итог:** enemy имеет неограниченную мощность. Это создаёт асимметрию: игрок должен строить power_plant, enemy — нет.

### 2.5. HUD мощность

`game.resources.powerTotal` и `game.resources.powerUsed` обновляются каждый кадр в `evaluatePowerState()` (L2095-2096). HUD показывает `powerPct:formatPowerValue()` = `"X/Y MW"` (L2342).

### 2.6. Строительство power_plant игроком

`FE_V04_BUILD_MENU_TYPES` включает `power_plant` (runtime_flags.js L50). Игрок может строить power_plant через build menu. Стоимость: 35 energy, 24 секунды строительства (buildings.js L22-24). `storageBonus` отсутствует — power_plant **не увеличивает лимиты хранилища**, только добавляет мощность.

### 2.7. energy_reactor — мёртвый конфиг

`BUILDINGS.energy_reactor` определён (costEnergy:45, buildTime:35, buildings.js L26-28), спрайт есть, но:
- Не включён в `FE_V04_BUILD_MENU_TYPES` — игрок не может строить.
- Не имеет `storageBonus` — не даёт никаких бонусов.
- Не используется ни в одном коде.
- Описание: «Заложен под будущую продвинутую энергосистему».

---

## 3. Как мощность выглядит в игре сейчас

Timeline типичного skirmish (player side):

1. **0:00**: HQ (10 MW). Сепаратор не построен. Фабрика не построена. Power: 0/10 MW.
2. **0:30**: Строится сепаратор. Фабрика не построена. Power: 0/10 MW (сепаратор ещё не complete).
3. **1:00**: Сепаратор complete + фабрика строится. Power: 4/10 MW (сепаратор работает, фабрика ещё нет).
4. **1:30**: Сепаратор + фабрика complete. Power: 9/10 MW. Всё работает.
5. **2:00**: Если игрок строит второй сепаратор: 4+4+5=13 > 10 MW → фабрика паузится! Нужно строить power_plant.
6. **2:30**: power_plant построен. Power: 9/30 MW. Запас огромный.
7. **Далее**: Больше нет причин строить power_plant. 30 MW хватает на 4 сепаратора + 2 фабрики = 26 MW.

**Проблема:** После одного power_plant (30 MW total) система мощности перестаёт быть ограничением. Нет ongoing cost от юнитов.

---

## 4. Что нужно исправить минимально — предложение

Есть три независимых направления, каждое решает свою часть проблемы. Предлагаю минимальный MVP для каждого:

### Fix A: Юниты потребляют мощность (upkeep)

**Проблема:** Юниты не создают ongoing cost. Армия бесплатна в содержании.

**Решение:** Каждый юнит потребляет 1 MW мощности. Если total power < used power (включая юнитов), здания начинают паузиться (сепаратор → фабрика).

```
light_tank: 1 MW
builder: 1 MW
harvester: 1 MW
scout: 1 MW
```

**Расчёт:** 5 танков + 2 harvester + 1 builder + 1 scout = 9 MW от юнитов. Плюс сепаратор (4) + фабрика (5) = 18 MW. Начальных 10 MW не хватает. Один power_plant (+20) = 30 MW. Два power_plant = 50 MW. Это создаёт реальный выбор: больше армии → больше power_plant → меньше экономики на армию.

**Влияние на gameplay:**
- Player с 5 танками и 1 power_plant: 30 MW total, 18 MW used — работает.
- Player с 8 танками и 1 power_plant: 30 MW total, 21 MW used — работает, но мало запаса.
- Player с 10 танками и 1 power_plant: 30 MW total, 23 MW used — всё ещё работает, но 2-й сепаратор (4 MW) уже не влезет: 23+4=27, фабрика (5) = 32 > 30.
- Player вынужден строить 2-й power_plant для большой армии + развитой экономики.

**Приоритетное ограничение при нехватке:** Сначала паузятся сепараторы (прекращают переработку), затем фабрики (прекращают производство). Юниты продолжают существовать и сражаться — мощность не убивает юнитов, она ограничивает экономику.

### Fix B: Enemy также подчиняется мощности

**Проблема:** Enemy не использует мощность. Асимметрия: игрок ограничен, enemy — нет.

**Решение:** Добавить `evaluateEnemyPowerState()` — аналог `evaluatePowerState()`, но для вражеских зданий и юнитов. Вражеский HQ даёт 10 MW. Enemy должен строить power_plant через BRAIN-01.

Влияние на BRAIN-01: добавить `build_power_plant` как priority между `build_elements_storage` (2.5) и `produce_builder` (3). Условие: enemy power used ≥ 80% enemy power total.

**Важно:** Enemy power state не отображается в HUD — это внутренняя механика бота. Визуально игрок видит только свою мощность.

### Fix C: Предупреждение о нехватке мощности

**Проблема:** Игрок не понимает, почему фабрика/сепаратор встали.

**Решение:** В `separatorStatusInfo()` и `factoryStatusInfo()` уже есть проверка `_powerPaused`. Показывать «мало мощности» красным текстом. Дополнительно: если `_powerPaused` и мощность < 0, показывать toast «Мало мощности! Постройте электростанцию.» один раз.

---

## 5. Детальный анализ — что затрагивает каждый Fix

### Fix A: Юниты потребляют мощность

**Изменяемые функции:**

| # | Функция | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | `evaluatePowerState()` | L2053 | Добавить подсчёт юнитов игрока: `used += units.filter(player).length * 1` |
| 2 | `calculatePowerTotal()` | L2032 | Без изменений — уже считает HQ + power_plant |
| 3 | Константа | runtime_flags | Добавить `FE_UNIT_POWER_MW = 1` (мощность на юнит) |
| 4 | `FE_PATCH_09C3UpdateEnemySeparatorProduction()` | L9405 | Если Fix B — добавить проверку enemy power |
| 5 | `FE_PATCH_09EUpdateEnemyFactoryProduction()` | L9871 | Если Fix B — добавить проверку enemy power |

### Fix B: Enemy мощность

| # | Функция | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | New: `FE_POWER_01_EvaluateEnemyPowerState()` | После L2098 | Аналог `evaluatePowerState()` для enemy |
| 2 | `FE_PATCH_09C3UpdateEnemySeparatorProduction()` | L9405 | Проверка enemy power state перед запуском цикла |
| 3 | `FE_PATCH_09EUpdateEnemyFactoryProduction()` | L9871 | Проверка enemy power state |
| 4 | `FE_PATCH_BRAIN_01_ChoosePriorityAction()` | L10112 | Добавить `build_power_plant` priority |
| 5 | `FE_PATCH_BRAIN_01_ExecuteAction()` | L10166 | Добавить `case 'build_power_plant'` |
| 6 | `FE_PATCH_BRAIN_01_ACTIONS` | L10102 | Добавить `'build_power_plant'` |
| 7 | New: `FE_POWER_01_EnemyPowerPlantExistsOrQueued()` | После L9247 | Проверка наличия power_plant у enemy |
| 8 | New: `FE_POWER_01_OrderEnemyBuilderBuildPowerPlant()` | После L9247 | Приказ builder'у строить power_plant |

### Fix C: Предупреждение о нехватке мощности

| # | Функция | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | `updateHud()` | L2331 | Если powerUsed > powerTotal, показать warning |
| 2 | Toast system | Существующая | Один toast «Мало мощности!» при первом превышении |

---

## 6. Что НЕ трогать

- Combat damage/range/cooldown
- Pathfinding / findPath / passable
- Scout lifecycle (FE_SCOUT01*, FE_INTEL01*)
- BOT-ATTACK-11/12 attack gate
- BOT-COMBAT-AWARENESS-01
- BOT-DEFENSE-RETREAT-01
- BOT-PROGRESSION-01
- VISUAL-COMBAT-FX-01
- Harvester mining state machine
- Separator conversion formula (15 → 10+1)
- Player economy (storage, production, building) — за исключением добавления unit power consumption
- Save/load — мощность уже сохраняется (powerTotal, powerUsed в resources)
- Render / fog / mapgen
- Factory queue depth
- Emergency builder
- Player building construction logic

---

## 7. Риск

**Medium-High.**

Обоснование:

- **Fix A (unit power consumption):** Изменяет core gameplay loop. Каждый юнит теперь имеет ongoing cost. Это может сделать early game слишком сложным — 2 harvester + 1 builder + separator + factory = 2+1+4+5 = 12 MW, но доступно только 10 MW от HQ. **Mitigation:** HQ можно увеличить до 15 MW (вместо 10), или дать initial grace period, или снизить unit power до 0.5 MW.

- **Fix B (enemy power):** Additive change для enemy. BRAIN-01 получает новый action. Риск: enemy может строить power_plant вместо нужных зданий. **Mitigation:** priority ниже чем separator/factory, с preflight checks. Если enemy не может позволить себе power_plant — action пропускается.

- **Fix C (warning):** Чисто UI, минимальный риск.

- **Наихудший сценарий:** Unit power consumption делает early game невыполнимым — игрок не может одновременно содержать harvester + builder + separator + factory. **Mitigation:** Тщательный баланс MW значений. Возможно, HQ = 15 MW (покрывает базовый loop: 1 builder + 1 harvester + 1 separator + 1 factory = 2+1+4+5 = 12 MW при 15 MW total).

---

## 8. Критический вопрос для GPT: какой scope?

Полный POWER-SYSTEM-01 (все три Fix'а) — это **большой патч**, затрагивающий core gameplay, enemy AI и UI. Рекомендую разделить:

### Вариант 1: Минимальный MVP (только Fix A)
Только unit power consumption для player. Enemy пока не затрагиваем. Это создаёт baseline: юниты стоят мощности, power_plant становится важен. Минимальный риск, максимальный impact.

### Вариант 2: MVP + Enemy (Fix A + Fix B)
Unit power для обеих сторон + enemy BRAIN-01 строит power_plant. Полная симметрия. Medium risk.

### Вариант 3: Полный (Fix A + B + C)
Всё + UI warnings. Самый полный, но самый рискованный.

### Вариант 4: Только Fix B (enemy power без unit upkeep)
Enemy подчиняется мощности для зданий (separator/factory), но юниты пока бесплатны. Наименьший risk, но не решает главную проблему (unit scaling).

**Моя рекомендация:** Вариант 1 (только Fix A) как POWER-SYSTEM-01A. Минимальный, обратимый, решает основную проблему (power_plant неважен, army scaling неограничен). Fix B и C — отдельные последующие патчи.

---

## 9. Telemetry / debug plan

```javascript
game._powerSystem01 = {
  unitPowerConsumption: 0,       // текущее потребление от юнитов (MW)
  buildingPowerConsumption: 0,   // текущее потребление от зданий (MW)
  totalPowerAvailable: 0,        // доступная мощность (MW)
  powerDeficit: false,           // используется ли больше чем доступно
  lastDeficitAt: 0,              // когда последний раз был дефицит
  buildingsPausedByPower: 0,     // сколько зданий паузится из-за нехватки
  unitCount: 0                   // сколько юнитов у игрока
}
```

Обновлять в `evaluatePowerState()` каждый кадр. Не добавлять per-frame логирование — только значения.

Для enemy (если Fix B):
```javascript
game._powerSystem01Enemy = {
  totalPowerAvailable: 0,
  powerUsed: 0,
  powerPlantCount: 0,
  buildingsPausedByPower: 0
}
```

---

## 10. Targeted smoke test plan

**Сценарий 1 — Unit power consumption:**
1. Start skirmish, observe HUD power value.
2. Verify: HQ gives 10 (or 15) MW. With starter units (2 harvester, 1 builder), power usage increases.
3. Build separator → verify power usage increases by 4 MW.
4. Build factory → verify power usage increases by 5 MW.
5. Verify: if total usage > total capacity, buildings pause (separator first, then factory).
6. Build power_plant → verify capacity increases by 20 MW, paused buildings resume.
7. Produce more tanks → verify power usage keeps increasing.
8. Verify: with enough tanks, need second power_plant.

**Сценарий 2 — Power plant strategic importance:**
1. Play without building power_plant. Verify: economy/army capped by power.
2. Play with 1 power_plant. Verify: significant expansion possible but still limited.
3. Play with 2 power_plants. Verify: large army + economy possible.

**Сценарий 3 — Enemy power (if Fix B):**
1. Start skirmish, observe enemy economy.
2. Wait until enemy builds power_plant (via BRAIN-01).
3. Verify: enemy buildings pause when enemy runs out of power.
4. Verify: enemy resumes after building power_plant.

**Сценарий 4 — Regression:**
1. Normal game flow — player can build, produce, fight.
2. Combat unchanged.
3. Scout lifecycle unchanged.
4. Attack wave behavior unchanged.
5. Combat FX still works.
6. Save/load preserves power state.

**Сценарий 5 — Edge case: all units killed:**
1. Player has 10 tanks (10 MW from units). Power: 23/30 MW.
2. Enemy kills all player units. Power: 13/30 MW. Buildings resume if paused.

**Сценарий 6 — Early game balance:**
1. Verify: starting units + separator + factory fit within HQ power (with margin).
2. Verify: no immediate power deficit at game start.

Жду «Делай».
