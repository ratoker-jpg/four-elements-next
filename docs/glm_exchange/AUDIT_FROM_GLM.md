# AUDIT_FROM_GLM — BOT-ECONOMY-01

**Task:** BOT-ECONOMY-01 — audit enemy economy scaling and recovery path
**Lane:** Audit only
**Date:** 2026-05-12

---

## 1. Root cause / цель аудита

После BOT-PROGRESSION-01 (disable tank cap) вражеская экономика всё ещё не масштабируется и не восстанавливается после harassment. Глубокий аудит выявил **три корневых проблемы**, работающие совместно:

### Primary: Element storage cap (20) вызывает полный stall сепаратора

`BASE_STORAGE.purple = 20` (standalone_constants.js). Один сепаратор производит 1 элемент каждые 6 секунд. Element storage заполняется за ~120 секунд. Когда хранилище элементов заполнено, `FE_PATCH_09C3EnemySeparatorCycleCheck()` (L9258) возвращает `{ok:false, reason:'element_storage_full'}`, и сепаратор **полностью останавливается** — не может конвертировать минералы ни в энергию, ни в элементы.

Это создаёт каскадный коллапс:
1. Element storage fills → separator pauses
2. No energy production → factory can't produce (needs elements)
3. No element spending → storage stays full → separator stays paused
4. Вражеская экономика полностью заморожена

**Бот никогда не строит `elements_storage`** — в BRAIN-01 нет такого действия. `BUILDINGS.elements_storage` существует в конфигурации (costEnergy:50, storageBonus: +20 каждого элемента), но нет кода, который бы приказал строителю построить его.

### Secondary: BRAIN-01 не масштабирует экономику

BRAIN-01 action list (L9980):
```
build_separator  → только если сепаратора НЕТ
build_factory    → только если фабрики НЕТ
produce_builder  → builder < 1
produce_harvester → harvester < 2
produce_combat   → иначе
wait
```

После начального построения (1 сепаратор, 1 фабрика), BRAIN-01 **никогда** не строит дополнительные экономические здания:
- Нет `build_elements_storage` — элементный сток заполняется, сепаратор стопорится
- Нет `build_minerals_storage` — минеральный сток (200) заполняется за ~60 секунд
- Нет `build_energy_storage` — энергетический сток (300) заполняется быстрее
- Нет `build_second_separator` — `FE_PATCH_09C2EnemySeparatorExistsOrQueued()` возвращает true, если хоть один существует
- Нет `build_second_factory` — `FE_PATCH_09DCanBuildEnemyFactory()` возвращает `{ok:false, reason:'factory_exists_or_queued'}`

### Tertiary: Death spiral при потере фабрики + строителя

Если игрок уничтожает вражескую фабрику И всех строителей:
1. BRAIN-01 priority 2 (`build_factory`) → требует строителя → нет строителя → FAIL
2. BRAIN-01 priority 3 (`produce_builder`) → требует фабрику → нет фабрики → FAIL
3. Враг **навсегда заблокирован** — не может производить юнитов, не может строить здания
4. Нет fallback-механизма (например, emergency builder spawn)

---

## 2. Функции economy/production

| Функция | Линия | Роль |
|---------|-------|------|
| `getStorageLimitsForOwner(owner)` | L1958 | BASE_STORAGE + storageBonus от зданий. Общая для player/enemy. |
| `ensureEnemyResources()` | L1976 | Lazy-init вражеского ресурсного бакета |
| `addResourceForOwner(owner, name, amount)` | L2001 | Добавляет ресурс с clamping по storage cap |
| `changeResourceForOwner(owner, resource, delta)` | L9042 | Расход/пополнение ресурса с cap enforcement |
| `resourceSpaceForOwner(owner, name)` | L1991 | Свободное место в хранилище |
| `FE_PATCH_09C3EnemySeparatorCycleCheck()` | L9258 | Проверка: может ли сепаратор работать. 3 условия: минералы≥15, energy space≥10, element space≥1 |
| `FE_PATCH_09C3UpdateEnemySeparatorProduction(dt)` | L9283 | Основной tick сепаратора. Таймер × количество сепараторов |
| `FE_PATCH_09C2EnemySeparatorExistsOrQueued()` | L9088 | True если хоть один сепаратор существует/строится |
| `FE_PATCH_09DCanBuildEnemyFactory()` | L9419 | **Возвращает ok:false если фабрика уже существует** — второй фабрики не бывает |
| `FE_PATCH_09DEnemyFactoryExistsOrQueued()` | L9352 | True если хоть одна фабрика существует/строится |
| `FE_PATCH_09EUpdateEnemyFactoryProduction(dt)` | L9749 | Tick производства фабрики |
| `FE_PATCH_09E_FACTORY_MAX_QUEUE` | L9577 | = 1. Глубина очереди фабрики |
| `FE_PATCH_BASELINE_01_ChooseFactoryUnitType()` | L9877 | Выбирает тип производимого юнита: builder < harvester < scout < light_tank |
| `FE_PATCH_BASELINE_01_HARVESTER_MIN` | L9865 | = 2 |
| `FE_PATCH_BASELINE_01_BUILDER_MIN` | L9866 | = 1 |
| `FE_PATCH_BASELINE_01_HARVESTER_CAP` | L9867 | = 4 |
| `FE_PATCH_BASELINE_01_BUILDER_CAP` | L9868 | = 2 |
| `FE_PATCH_BRAIN_01_ChoosePriorityAction(state)` | L9989 | Выбор приоритетного действия. Жёсткий порядок: separator → factory → builder → harvester → combat |
| `FE_PATCH_BRAIN_01_ExecuteAction(decision, state)` | L10032 | Исполнение решения BRAIN-01 |
| `FE_PATCH_BRAIN_01_TryProduceWorker(unitType)` | L10059 | Ставит юнита в очередь первой свободной фабрики |
| `updateHarvester(unit, dt)` | L8685 | State machine сборщика: mining → returning → unloading |
| `assignNextMine(unit)` | L8634 | Назначение шахты сборщику |

---

## 3. Как economy stall выглядит в игре

Timeline типичного skirmish после BOT-PROGRESSION-01:

1. **0:00–0:30**: Старт. Enemy: HQ, 2 harvesters, 1 builder, 1 tank. Ресурсы: minerals:0, energy:160, elements:0.
2. **0:30–1:00**: BRAIN-01 строит сепаратор (30 energy). Builder строит. Фабрика производит.
3. **1:00–2:00**: Сепаратор готов. Минералы → separator → energy + elements. Tank production. Enemy достигает 2–3 танков.
4. **2:00–3:00**: **Element storage заполняется (20).** Сепаратор останавливается (`element_storage_full`).
5. **3:00**: Factory продолжает потреблять элементы (tanks cost 2 elements). Как только элементы тратятся, separator кратковременно возобновляется, но быстро снова заполняет.
6. **3:00+**: **Колебательный режим** — separator включается/выключается по мере расхода элементов на танки. Production throughput ограничен element storage cap. Economy не растёт, а "дышит" вокруг порога.
7. **При harassment**: Если игрок убивает harvester, mineral income падает, separator совсем останавливается (no minerals), factory не может производить (no elements), economy коллапсирует.

---

## 4. Что нужно исправить минимально

Есть три независимых фикса, каждый решает свою часть проблемы:

### Fix A: Добавить `build_elements_storage` в BRAIN-01

**Проблема:** Element storage cap = 20. Сепаратор stall'ится. Бот не строит `elements_storage`.

**Решение:** Добавить новый action в BRAIN-01, который срабатывает когда element storage заполнен на ≥80% (≥16 из 20).

```javascript
// В FE_PATCH_BRAIN_01_ACTIONS добавить 'build_elements_storage'
// В FE_PATCH_BRAIN_01_ChoosePriorityAction добавить проверку:
var elKey = FE_PATCH_09C3EnemyElementKey();
var elLimit = getStorageLimitsForOwner('enemy')[elKey] || 20;
var elCurrent = ensureEnemyResources()[elKey] || 0;
var elementsNearFull = elCurrent >= elLimit * 0.8;
if (elementsNearFull && !FE_PATCH_09C2ElementsStorageExistsOrQueued()) {
  return { action: 'build_elements_storage', reason: 'element_storage_near_full' };
}
```

Новая helper-функция `FE_PATCH_09C2ElementsStorageExistsOrQueued()` — проверяет, есть ли `elements_storage` у enemy.

Новая функция `FE_PATCH_09C2OrderEnemyBuilderBuildElementsStorage()` — находит свободного builder, тратит 50 energy, приказывает строить `elements_storage`.

**Приоритет вставки:** После `build_factory` (priority 2.5), перед `produce_builder` (priority 3). Сепаратор и фабрика должны существовать прежде чем строить storage.

**Ожидаемый эффект:** Element storage cap увеличивается с 20 до 40. Сепаратор может работать непрерывно ~4 минуты вместо ~2. Экономика дышит реже, production throughput стабилизируется.

### Fix B: Добавить emergency builder recovery (death spiral fix)

**Проблема:** Нет factory + нет builder = permanent lockout.

**Решение:** В BRAIN-01, перед возвращением `{action:'wait'}`, добавить проверку:

```javascript
// Death spiral recovery: если нет фабрики И нет builder'а → spawn emergency builder
var hasFactory = FE_PATCH_09DEnemyFactoryExistsOrQueued();
var builderCount = FE_PATCH_BASELINE_01_CountEnemyWorkers('builder');
if (!hasFactory && builderCount === 0) {
  // Spawn emergency builder at HQ (free, no factory needed)
  return { action: 'emergency_builder', reason: 'death_spiral_recovery' };
}
```

В `FE_PATCH_BRAIN_01_ExecuteAction` добавить `case 'emergency_builder'` — создать builder юнита рядом с HQ, без затрат (или с минимальными). Это safety net, который срабатывает только в экстремальной ситуации.

### Fix C: Увеличить queue depth до 2

**Проблема:** Queue depth = 1. Фабрика может производить только 1 юнита за раз. Если в очереди танк (35с), harvester replacement задерживается на 35+ секунд.

**Решение:**
```javascript
window.FE_PATCH_09E_FACTORY_MAX_QUEUE = 2;  // было 1
```

**Ожидаемый эффект:** Factory может ставить в очередь 2 юнитов. BRAIN-01 может заказать builder/harvester пока танк ещё в производстве. Worker replacement быстрее.

**Риск:** С queue depth 2, если economy стабильна, фабрика может закупить 2 танка подряд. Это не проблема — ATTACK-12 gate уже контролирует волны. Natural economy (1 separator, element cost) ограничивает throughput.

---

## 5. Точные файлы/функции для изменения

**Единственный файл:** `src/main.js`

| # | Функция / блок | Линия | Изменение |
|---|---------|-------|-----------|
| 1 | `FE_PATCH_BRAIN_01_ACTIONS` | L9980 | Добавить `'build_elements_storage'` и `'emergency_builder'` |
| 2 | `FE_PATCH_BRAIN_01_ChoosePriorityAction(state)` | L9989 | Добавить priority 2.5: `build_elements_storage` (после factory, перед builder). Добавить priority 6: `emergency_builder` (после combat, перед wait) |
| 3 | `FE_PATCH_BRAIN_01_ExecuteAction(decision, state)` | L10032 | Добавить `case 'build_elements_storage'` и `case 'emergency_builder'` |
| 4 | New: `FE_PATCH_09C2ElementsStorageExistsOrQueued()` | После L9088 | Проверяет наличие elements_storage у enemy |
| 5 | New: `FE_PATCH_09C2OrderEnemyBuilderBuildElementsStorage()` | После L9088 | Приказ builder'у строить elements_storage. Аналог `FE_PATCH_09C2OrderEnemyBuilderBuildSeparator()` |
| 6 | New: `FE_PATCH_BRAIN_01_SpawnEmergencyBuilder()` | После L10057 | Создаёт бесплатного builder'а рядом с enemy HQ |
| 7 | `FE_PATCH_09E_FACTORY_MAX_QUEUE` | L9577 | Изменить с 1 на 2 |
| 8 | Constants | Рядом с L9577 | Добавить `FE_ECONOMY_01_ELEMENTS_STORAGE_THRESHOLD = 0.8` |

---

## 6. Что НЕ трогать

- Combat damage/range/cooldown
- Pathfinding / `findPath` / `passable`
- Scout lifecycle (`FE_SCOUT01*`, `FE_INTEL01*`)
- BOT-ATTACK-11/12 attack gate
- BOT-COMBAT-AWARENESS-01
- BOT-DEFENSE-RETREAT-01
- BOT-PROGRESSION-01
- ATTACK-04/08/10 logic
- Harvester mining logic (state machine корректна)
- Separator conversion logic (формула 15→10+1 корректна)
- Player economy (storage, production, building)
- Save/load
- Render / fog / mapgen
- Combat FX (VISUAL-COMBAT-FX-01)
- Building construction logic (FE_PATCH_09C2*, FE_PATCH_09D*)
- Unit state machine

---

## 7. Риск

**Low–Medium.**

Обоснование:

- **Fix A (elements_storage):** Additive change. BRAIN-01 получает новый action, который срабатывает только когда element storage ≥80%. Не меняет существующие приоритеты. Строительство использует тот же `findBuildPlan` + builder order механизм, что и separator/factory. Стоимость 50 energy — это значительная сумма, поэтому бот будет строить storage только когда экономика стабильна. Риск: неправильное место для строительства (builder может уйти далеко от базы). Mitigation: `findBuildPlan` уже ищет ближайшее место к builder'у.

- **Fix B (emergency builder):** Safety net. Срабатывает только в death spiral (нет factory + нет builder). Это экстремальная ситуация — без этого фикса бот гарантированно проигрывает. Риск: бесплатные юниты могут быть exploited. Mitigation: это recovery mechanism, не преимущество. Builder появляется только когда economy уже разрушена.

- **Fix C (queue depth 2):** Минимальное изменение одной константы. Natural economy limits (1 separator, element cost, build time) ограничивают throughput. ATTACK-12 gate контролирует волны. Риск: в редких случаях фабрика может заказать 2 танка подряд вместо worker replacement. Mitigation: `ChooseFactoryUnitType` проверяет worker minimum перед tank production.

- **Наихудший сценарий:** Бот строит elements_storage слишком рано (тратит 50 energy, которые нужны для factory production). Mitigation: threshold ≥80% гарантирует, что storage строится только когда element cap реально является bottleneck.

---

## 8. Telemetry / debug plan

Расширить существующий `game._brain01LastDecision` (уже записывается в L10034):

```javascript
game._economy01 = {
  elementsStorageBuilt: false,       // был ли построен elements_storage
  elementsStorageBuiltAt: 0,         // game time когда построен
  emergencyBuilderSpawned: false,     // был ли spawn emergency builder
  emergencyBuilderSpawnedAt: 0,       // game time
  separatorStallCount: 0,            // сколько раз сепаратор stall'ился
  lastSeparatorStallReason: null      // причина последнего stall
}
```

Separator stall counter обновляется в `FE_PATCH_09C3UpdateEnemySeparatorProduction` когда cycle check возвращает `{ok:false}`.

---

## 9. Targeted smoke test plan

**Сценарий 1 — Economy progression past 2 minutes:**
1. Start skirmish, observe enemy economy.
2. Wait 2+ minutes. Verify: enemy builds `elements_storage` when element storage approaches cap.
3. Verify: separator continues running after elements_storage built.
4. Verify: factory production throughput increases (tanks produced faster).

**Сценарий 2 — Emergency builder recovery:**
1. Start skirmish, let enemy build up.
2. Destroy enemy factory AND all builders using dev tools or player units.
3. Verify: enemy spawns emergency builder at HQ within BRAIN-01 tick.
4. Verify: emergency builder builds new factory → economy recovers.

**Сценарий 3 — Queue depth 2:**
1. Start skirmish, observe factory production.
2. Verify: factory can queue 2 units simultaneously.
3. Verify: when harvester dies while tank is in production, replacement harvester gets queued.

**Сценарий 4 — Regression:**
1. Normal game flow — bot builds separator, factory, workers in correct order.
2. BRAIN-01 priority loop works correctly.
3. Scout lifecycle unchanged.
4. Attack wave behavior unchanged.
5. Combat FX still works.

**Сценарий 5 — Elements storage build timing:**
1. Verify: elements_storage is NOT built when element storage < 80%.
2. Verify: elements_storage IS built when element storage ≥ 80%.
3. Verify: only one elements_storage is built (not multiple).

Жду «Делай».
