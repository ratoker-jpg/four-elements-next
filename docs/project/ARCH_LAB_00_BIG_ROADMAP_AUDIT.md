# ARCH-LAB-00 — Большой архитектурный roadmap-аудит

**Дата:** 2026-05-12
**Обновлено:** 2026-05-12 (ARCH-LAB-00B corrections)
**Тип:** Architecture roadmap audit / docs-only
**Статус:** Активный
**Назначение:** Провести аудит текущей архитектуры, сравнить стратегии перехода от patch/main.js-хаоса к нормальной модульной архитектуре, построить roadmap из крупных архитектурных шагов и рекомендовать режим разработки.

**ARCH-LAB-00B corrections:** LAB-05 split на 05A–05D, добавлен Playwright E2E smoke baseline, решение по unit_controller.js, таблица line count tracking, wiring/bridge budget, обновлён dependency graph и next recommended arch.

---

## 1. Executive summary

### Текущий статус проекта

Four Elements Remake v0.4 — browser RTS, работающий как один IIFE в `src/main.js` на 15 611 строк (проверено `wc -l` 2026-05-12). Файл содержит 604 функции, 650 `FE_PATCH_`-ссылок, 184 обращения к `window.FE_*`, 23 уникальных `_enemy*`-свойства и 48 `_scout*`-свойств. Внешние модули: 21 файл в 6 директориях (`src/core/`, `src/dev/`, `src/config/`, `src/modules/`, `src/ui/`, `src/ai/`). Index.html содержит 21 script tag, загружающий все модули в строгом порядке перед `main.js`.

Крупнейшие зоны main.js:
- Z13 Enemy Bot AI: 5 255 строк (34% файла)
- Z17 Builder/Construction: 2 660 строк (17%)
- Z22 Input/Selection: 1 629 строк (10%)
- Z20 Render: 1 266 строк (8%)
- Z7 Game Setup/Combat: 866 строк (6%)
- Z14 Movement: 568 строк (4%)
- Z11 Economy/Power: 545 строк (3%)

Проект перешёл в Architecture Migration Mode (DOCS-ARCH-00), выполнены ARCH-MAP-01 (карта систем), ARCH-AI-DESIGN-01 (модель принятия решений танка), ARCH-AI-01 (tank_decider.js MVP). Проект playable: бот строит, добывает, атакует, скауты работают, экономика функционирует.

### Почему маленькие арчи могут превратиться в те же патчи

Текущий подход — incremental architecture PR — успешно создал tank_decider.js и заложил основу для Architecture Migration Mode. Однако, если продолжать в том же темпе, есть конкретные риски:

1. **Каждый маленький PR добавляет wiring в main.js вместо сокращения.** ARCH-AI-01 добавил 232 строки в main.js (контекст, вызов, выполнение, guards, телеметрия), а tank_decider.js — 276 строк. main.js вырос с 15 379 до 15 611 строк (+232). То есть мы не уменьшаем main.js, а увеличиваем его «переходным» кодом, который должен быть временным, но может стать постоянным.

2. **Guard-chains воспроизводятся на уровне architecture PR.** Каждый новый architecture PR вынужден добавлять guards для совместимости со старым кодом. Суммарно guards, bridges, compatibility wrappers могут занять больше места, чем сама новая система. Это та же паттерн-патология, которую DOCS-ARCH-00 обещал устранить.

3. **Review fatigue.** Пользователь уже устал от 30–50 patch/PR в день. Каждая маленькая architecture PR требует review, smoke-теста, node--check, PR description. С 7–10 запланированными ARCH-AI-01–06 и аналогичным количеством ARCH-CORE, ARCH-SYSTEMS, ARCH-UI — общее число PR может превысить 30, что неприемлемо.

4. **Синхронизация между маленькими PR становится проблемой.** Если ARCH-AI-02 меняет tank_decider, ARCH-AI-03 зависит от ARCH-AI-02, а ARCH-CORE-02 меняет координатные функции, которые использует и tank_decider, и main.js —merge-конфликты и порядок загрузки превращаются в координационный кошмар.

5. **Context limit.** GLM не может держать весь main.js в памяти. Каждый маленький PR работает с фрагментом, и чем больше фрагментов, тем выше риск, что GLM упустит скрытую зависимость.

### Почему полный rewrite запрещён

Полный rewrite с нуля — недопустим по нескольким причинам. Во-первых, текущий код содержит 683 FE_PATCH_-ссылки, каждая из которых фиксирует конкретный баг или добавляет конкретное поведение, найденное через итеративное тестирование. Переписывание потеряет этот накопленный опыт. Во-вторых, нет автоматических browser-тестов — единственная проверка playable состояния — ручной smoke-тест в браузере. Переписанный код нельзя автоматически верифицировать. В-третьих, production-path (C:\Users\Den\Desktop\four elements\four_elements_core_base) остаётся рабочим прототипом, и потерять playable состояние без возможности отката — неприемлемый риск. Наконец, GLM context limit делает полный rewrite практически невозможным — ни одна AI-сессия не способна удержать 15 611 строк + все зависимости в памяти одновременно.

### Рекомендуемый режим

**Hybrid lab strategy** (Стратегия C) — sandbox/main остаётся стабильным baseline, где игра всегда запускается, а крупная архитектурная работа ведётся в отдельной lab-ветке, где игра может временно не запускаться. Это позволяет делать крупные перестройки без review fatigue и без риска сломать baseline, при этом сохраняя возможность быстрого sync-back.

Примерно 10 architecture-lab шагов (ARCH-LAB-01–07, где LAB-05 разделён на 05A–05D), каждый — большой блок работы в lab-ветке с checkpoint-коммитами, но с обязательными merge-back milestones, когда игра снова playable. Перед LAB-01 создаётся Playwright E2E smoke baseline для автоматической верификации merge-back.

### Что будет считаться успехом

1. main.js сокращён до 5 000–8 000 строк (composition/wiring layer + boot + game loop). Из них 2 000–3 000 строк — постоянный orchestration/wiring budget, остальное — временные bridges, которые LAB-07 удалит.
2. Все AI-подсистемы вынесены в src/ai/ (brain, decider, targeting, intel, scout, economy).
3. Все systems вынесены в src/systems/ (movement, combat, economy, production, construction, territory, command).
4. Все render-подсистемы вынесены в src/render/.
5. Все input-подсистемы вынесены в src/input/.
6. FE_PATCH_-ссылки сокращены с 650 до <100 (только bridges, которые ещё не заменены).
7. Игра playable на каждом merge-back milestone — верифицируется Playwright E2E smoke baseline.
8. Каждый модуль имеет чёткий contract (API) и может быть протестирован изолированно.
9. unit_controller.js решён (deprecate/archive) до LAB-04, движение не зависит от мёртвого альтернативного controller.

---

## 2. Current architecture reality

### Что уже вынесено

На данный момент из main.js вынесено 21 файл в 6 директориях:

**src/config/ (5 файлов):**
- `buildings.js` — статичные определения зданий (57 строк, Low risk)
- `units.js` — статичные определения юнитов (11 строк, Low risk)
- `factions.js` — определения фракций (25 строк, Low risk)
- `environment.js` — определения минералов и препятствий (21 строк, Low risk)
- `sprite_profiles.js` — профили спрайтов (48 строк, Low risk)
- `runtime_flags.js` — 74 runtime-флага и tuning-константы (150 строк, Medium risk — часть флагов управляет gameplay)

**src/core/ (4 файла):**
- `standalone_constants.js` — замороженные константы TILE_W/H, SAVE_KEY, MAP_SIZES (28 строк, Low)
- `storage_guard.js` — защита localStorage от переполнения debug-логами (51 строка, Low)
- `asset_loader.js` — загрузка спрайтов и анимаций (108 строк, Low)
- `save_manager.js` — save/load + UI слотов (105 строк, Medium — зависит от API из main.js)
- `unit_controller.js` — альтернативный контроллер движения (878 строк, Medium — дублирует логику main.js, по умолчанию выключен через FE_UNIT_CONTROLLER_ENABLED)

**src/dev/ (3 файла):**
- `combat_debug_overlay.js` — debug-оверлей для боевых юнитов (220 строк, Low — dev-only, read-only)
- `enemy_economy_debug_panel.js` — панель экономики врага (335 строк, Low — dev-only, read-only)
- `snapshot_export.js` — экспорт snapshot игры в JSON (280 строк, Low — dev-only, read-only)

**src/ui/ (1 файл):**
- `screen_manager.js` — управление экранами (mainMenu, factionMenu и др.)

**src/modules/ (4 файла):**
- `render/visual_anchor.js` — visual anchor для depth sort
- `render/sprite_alpha.js` — alpha-обработка спрайтов
- `render/visual_calibrator.js` — калибровка визуальных параметров
- `debug/debug_tools.js` — debug-инструменты

**src/ai/ (1 файл):**
- `tank_decider.js` — Priority Stack decision layer для enemy light_tank (276 строк, Medium — ARCH-AI-01 MVP)

**Итого вынесено:** ~2 600 строк в 21 файл. Основной выигрыш — в config/data и dev/debug модулях. Gameplay-логика почти не вынесена.

### Что всё ещё живёт в main.js

15 611 строк, из которых:

| Зона | Строки | % файла | Содержимое |
|------|-------:|--------:|-----------|
| Z13: Enemy Bot AI | 5 255 | 33.7% | Весь enemy bot: vision, scout, attack, retreat, intel, strength, autopilot, attack-12 gate, BRAIN-01 |
| Z17: Builder/Construction | 2 660 | 17.0% | Player+enemy builder, enemy economy (separator, factory, power), BRAIN-01 decision loop, construction helpers |
| Z22: Input/Selection | 1 629 | 10.4% | Mouse/keyboard, selection, attack-approach state machine |
| Z20: Render | 1 266 | 8.1% | drawTile, drawBuilding, drawUnit, drawDust, render, FX |
| Z7: Game Setup/Combat | 866 | 5.5% | createUnit, createBuilding, damageUnit, attack buildings |
| Z14: Movement | 568 | 3.6% | updateUnitMovement, recoverUnitPath, clickMarkers |
| Z11: Economy/Power | 545 | 3.5% | Ресурсы, storage, power, separator, production |
| Z6: Map Generation | 535 | 3.4% | Генерация карты, минералов, препятствий |
| Z16: Harvester | 576 | 3.7% | startHarvester, assignNextMine, updateHarvester |
| Z1-Z5, Z8-Z10, Z12, Z18-Z19, Z21, Z23-Z26 | 1 711 | 11.0% | Bootstrap, asset loading, geometry, FE_CORE bridge, screen manager, pathfinding, territory/fog, save/load, UI panels, main loop, debug, boot |

### Самые крупные зоны и основной риск

**Z13 (5 255 строк)** — самый большой риск. Внутри смешаны 12+ логических подсистем, которые все имеют доступ к общему IIFE scope. Каждая подсистема может независимо перезаписать приказ enemy tank, создавая order-overwrite cascade (подробно описано в ARCH-AI-DESIGN-01). 16 overwrite-точек, 8-stage cascade, async setTimeout(0) race condition. Эта зона — главный источник oscillation и jittery behaviour, и она же — самый сложный кандидат на вынос, потому что все подсистемы связаны через `game._enemyBotState` и `game._enemyKnowledge`.

**Z17 (2 660 строк)** — второй по размеру риск. Смешаны player builder, enemy builder, enemy economy, BRAIN-01, construction helpers. Ключевая проблема: `FE_PATCH_09C2/09C3` (separator build/processing), `FE_PATCH_09D/09E` (factory build/production) и `FE_PATCH_BRAIN_01` (decision loop) — все вызывают друг друга через IIFE scope, и вынос одной части без чёткого init(deps) паттерна ломает runtime-связи.

**Z22 (1 629 строк)** — высокий риск из-за перемешивания input handling (mouse, keyboard) с attack-approach state machine и selection logic. Canvas event listeners привязаны к функциям, которые одновременно обрабатывают клики и назначают attack targets.

### Что уже сделал ARCH-AI-01

ARCH-AI-01 (PR merged, SHA b43a779) создал:
- `src/ai/tank_decider.js` — Priority Stack decider с 4 MVP правилами (defend_hq priority 100, retreat priority 90, keep_attacking priority 80, idle fallback priority 10)
- `window.FE_TANK_DECIDER_ENABLED = false` в runtime_flags.js — feature flag для безопасного rollout
- Wiring в main.js (~232 строки): контекст, вызов evaluateTankDecision, выполнение через существующие helpers, per-tank маркер `_tankDeciderManagedAt`, legacy overwrite guards, телеметрия `game._tankDecider01`
- Script tag в index.html

ARCH-AI-01 — полезный первый модуль, который:
- Создал первый AI-модуль вне main.js
- Доказал, что Priority Stack работает как arbitration layer
- Установил pattern: pure decider → context в main.js → execution через helpers → legacy suppression через per-tank marker
- НЕ уменьшил main.js (добавил 232 строки wiring)

### Feature flags / fallback paths

Текущие feature flags, которые управляют архитектурным поведением:

| Флаг | Default | Назначение |
|------|---------|-----------|
| `FE_TANK_DECIDER_ENABLED` | false | Включает tank_decider для enemy light_tank |
| `FE_UNIT_CONTROLLER_ENABLED` | false | Альтернативный контроллер движения |
| `FE_POWER_ENFORCEMENT_ENABLED` | true | Power capacity/upkeep enforcement |
| `FE_DEV_HOTKEYS_ENABLED` | true | Dev hotkeys (Num9, F2, F8) |
| `FE_DEV_CAMERA_ZOOM_ENABLED` | true | Dev camera zoom |
| `FE_DEV_FULL_MAP_REVEAL_ENABLED` | true | Full map reveal key (0) |
| `FE_RESOURCE_CLUSTER_GENERATION_ENABLED` | true | Spawn-relative resource clusters |
| `FE_SPAWN_BASED_RESOURCE_GENERATION_ENABLED` | true | Spawn-based resource generation |

Критический fallback path: установка `FE_TANK_DECIDER_ENABLED = false` полностью отключает decider и возвращает legacy behavior 1:1. Это главный механизм отката.

---

## 3. Strategy comparison

### Стратегия A: Incremental arch PRs

**Описание:** Продолжать текущий подход — каждый architecture PR маленький (1 система, 1 модуль, 1 зона), идёт через branch + PR в sandbox/main, требует browser smoke-тест, node--check, review. Игра должна запускаться после каждого PR.

| Аспект | Оценка |
|--------|--------|
| Pros | Каждый PR безопасен и откатываем; можно делать параллельно; понятный review scope; sandbox/main всегда playable |
| Cons | main.js продолжает расти (каждый PR добавляет wiring); review fatigue (30+ PR); guards/bridges накапливаются; нет возможности делать крупные структурные изменения; синхронизация между PR; GLM context limit при работе с фрагментами |
| Risks | Количество wiring-кода превысит количество вынесенной логики; merge-конфликты между параллельными PR; каждый PR тестируется изолированно, но взаимодействие между новыми модулями — только при ручном smoke |
| When to use | Small fixes, emergency, thin bridge/wiring, docs-only, config changes |
| Verdict | **Недостаточен для крупных архитектурных перестроек** — подходит для доводки отдельных модулей, но не для breakout main.js |

### Стратегия B: Big Architecture Lab branch

**Описание:** Создать одну большую lab-ветку `arch/lab-main-breakout`, куда мержатся все архитектурные изменения. Игра может временно не запускаться. Работа ведётся большими блоками. Периодические sync-back в sandbox/main.

| Аспект | Оценка |
|--------|--------|
| Pros | Можно делать крупные структурные изменения без оглядки на smoke-тесты; нет review fatigue (один большой PR вместо 30 маленьких); можно реорганизовать index.html script order, удалить старые guards, переписать wiring целиком; нет параллельных merge-конфликтов |
| Cons | Если lab-ветка застрянет — нет playable состояния; огромный diff невозможен для review; drift от sandbox/main может стать необратимым; нет checkpoint-ов playable состояния; если GLM context limit исчерпан — нельзя продолжить |
| Risks | Lab-ветка может drift'ить неделями без playable состояния; пользователь не может играть в промежутке; если lab-ветка зашла в тупик — потерянное время; один огромный PR сложнее откатить, чем 5 маленьких |
| When to use | Только если есть уверенность, что вся работа выполнима в одной AI-сессии; или если есть автоматические тесты для верификации |
| Verdict | **Слишком рискованно без checkpoint-ов** — отсутствие playable состояния на протяжении всей работы неприемлемо |

### Стратегия C: Hybrid lab strategy

**Описание:** sandbox/main остаётся стабильным baseline (игра всегда запускается). Создаётся lab-ветка для крупных архитектурных блоков. Каждый блок — это подветка от lab с checkpoint-коммитами. Периодические merge-back из lab в sandbox/main, когда достигнут playable milestone. Lab-ветка может быть временно broken, но каждый merge-back — playable.

| Аспект | Оценка |
|--------|--------|
| Pros | sandbox/main всегда playable; можно делать крупные перестройки в lab; checkpoint-коммиты дают точки отката; merge-back milestones — playable проверки; меньше review fatigue (5–7 merge-back PR вместо 30); можно экспериментировать в lab без страха сломать baseline |
| Cons | Синхронизация между sandbox/main и lab требует дисциплины; lab-ветка может drift'ить; merge-back может быть сложным при расхождении; нужен чёткий процесс: когда lab broken, когда playable, когда merge |
| Risks | Merge-back конфликты; lab drift; пользователь может забыть про sandbox/main и работать только в lab; нет автоматических тестов для верификации merge-back |
| When to use | **Рекомендуемый режим** — для всех крупных архитектурных перестроек |
| Verdict | **Оптимальный баланс риска и скорости** — позволяет делать крупные перестройки с playable fallback |

### Итоговая таблица

| Strategy | Description | Pros | Cons | Risks | When to use | Verdict |
|----------|-------------|------|------|-------|-------------|---------|
| A: Incremental PRs | Маленькие безопасные PR в sandbox/main | Безопасность, playable всегда | Review fatigue, wiring growth, нет крупных изменений | Wiring > logic, merge-конликты | Small fixes, docs, config | Дополнение |
| B: Big Lab branch | Одна большая lab-ветка, может быть broken | Крупные изменения, нет review fatigue | Нет playable, огромный diff, drift | Застревание, потеря времени | Только с автотестами | НЕТ |
| C: Hybrid lab | sandbox/main stable + lab с checkpoint + merge-back milestones | Playable baseline + крупные изменения + checkpoint-и | Синхронизация, merge-back конфликты | Lab drift, merge-back сложность | Все крупные перестройки | **ДА** |

### Выводы по breakage

- **Можно ломать:** lab-ветку (arch/lab-*). В lab-ветке игра может временно не запускаться, если это задокументировано в коммите.
- **Нельзя ломать:** sandbox/main. После каждого merge-back sandbox/main должен быть playable.
- **Baseline:** sandbox/main = текущее состояние (15 611 строк main.js, все 21 script tag, все feature flags). Lab-ветки могут меняться свободно, но merge-back = playable.

---

## 4. Recommended branch model

### Модель веток

```text
sandbox/main
  Стабильный baseline. Игра всегда запускается.
  Legacy/default flags работают.
  Только merge-back из lab или Fast lane direct push.

arch/lab-main-breakout
  Главная lab-ветка для архитектурной перестройки.
  Может быть временно broken.
  Checkpoint-коммиты каждые ~500 строк изменений.
  Sync от sandbox/main перед каждым крупным блоком работы.

arch/lab-ai-brain
  Подветка lab для enemy AI breakout.
  Зависит от arch/lab-main-breakout (или от sandbox/main для изолированных работ).

arch/lab-systems-core
  Подветка lab для core/systems breakout.
  Может вестись параллельно с arch/lab-ai-brain.

arch/lab-render-input
  Подветка lab для render/input breakout.
  Зависит от arch/lab-main-breakout.
```

### Правила работы с ветками

**Когда создавать lab branch:**
- Перед началом каждого ARCH-LAB-XX шага
- Lab-ветка создаётся от sandbox/main (или от предыдущей lab-ветки, если есть зависимость)
- Имя ветки: `arch/lab-{NN}-{краткое-описание}`

**Кто туда мержит:**
- GLM делает работу в lab-ветке
- GPT может делать audit/review через exchange files
- Merge-back в sandbox/main — только после явного approval пользователя

**Когда lab может быть broken:**
- В процессе активной работы (между checkpoint-ами)
- Если коммит содержит `BREAKING:` префикс в сообщении
- Обязательно: каждый broken коммит должен описывать ожидаемое состояние («game starts but render broken», «game does not start — missing module dependency»)

**Как часто синкаться с sandbox/main:**
- Перед каждым новым блоком работы в lab (git merge sandbox/main в lab)
- После каждого merge-back в sandbox/main (все lab-ветки обновляются)

**Когда lab можно merge обратно:**
- Игра запускается
- Browser smoke checklist пройден (см. раздел 11)
- node--check на всех изменённых JS
- main.js line count trend улучшился или wiring responsibility clarified
- Нет красных console errors

**Что делать, если lab застрял:**
1. Проверить: можно ли откатиться к последнему checkpoint-коммиту?
2. Если checkpoint playable — создать новый branch от checkpoint и продолжить
3. Если нет playable checkpoint — откатиться к sandbox/main и начать lab заново с меньшим scope
4. Застрявшая lab-ветка не мержится в sandbox/main — это жёсткое правило

### Диаграмма workflow

```text
sandbox/main ──────────────────────────────────────►  (всегда playable)
     │                                                  ↑
     │  merge-back                                      │
     │  (playable milestone)                            │
     │                                                  │
     ├──► arch/lab-main-breakout ──────────────────────►│
     │      (may be broken between checkpoints)          │
     │      checkpoint 1 ── checkpoint 2 ── merge-back   │
     │                                                   │
     ├──► arch/lab-ai-brain ───────────────────────────►│
     │      (depends on lab-main-breakout or main)       │
     │                                                   │
     └──► arch/lab-systems-core ───────────────────────►│
            (parallel with lab-ai-brain)                  │
```

---

## 5. Controlled breakage policy for lab

### Расширение правила DOCS-ARCH-00C

DOCS-ARCH-00C устанавливал правило контролируемого breakage для architecture migration. Для hybrid lab strategy это правило расширяется:

### Для sandbox/main

```text
Жёсткие правила:
1. Игра должна запускаться
2. Legacy/default flags должны работать
3. Нет broken baseline
4. FE_TANK_DECIDER_ENABLED=false = 1:1 текущее поведение
5. Каждый merge-back PR проходит browser smoke checklist
6. node--check на всех изменённых JS
```

### Для arch/lab-* веток

```text
Мягкие правила:
1. Игра МОЖЕТ временно не запускаться
2. Каждый коммит/PR должен объяснять ожидаемое broken состояние
3. Должен быть restore plan (checkpoint-коммит, откат)
4. Checkpoint-коммиты каждые ~500 строк изменений
5. Перед merge-back — полный browser smoke checklist
6. Коммиты с breakage помечаются префиксом BREAKING:
```

### Критерии: acceptable broken state

```text
Приемлемо:
- Игра не запускается из-за отсутствующего module dependency (описано в коммите)
- Render частично сломан (юниты не отображаются, но карта видна)
- AI не функционирует (бот не принимает решений, но игра не крашит)
- Input частично работает (мышь работает, клавиатура нет)
- Console warnings допустимы
```

### Критерии: unacceptable broken state

```text
Неприемлемо:
- Бесконечный loop / freeze браузера
- Uncaught exception в game loop
- Data loss (save/load corruption)
- Memory leak (рост памяти без остановки)
- Отсутствие restore plan
```

### Rollback strategy

```text
1. Каждый lab-ветку начинать с checkpoint-коммита "CHECKPOINT: initial state from sandbox/main SHA xxx"
2. Каждые ~500 строк — checkpoint-коммит "CHECKPOINT: [описание текущего playable/broken состояния]"
3. Если lab застрял — git reset --hard до последнего checkpoint
4. Если checkpoint нет — git checkout sandbox/main и начать заново
5. Merge-back в sandbox/main делается только из playable checkpoint
```

### Как не утонуть в review

```text
1. User смотрит только decision points:
   - Выбор стратегии (A/B/C) — одобряет пользователь
   - Merge-back PR — одобряет пользователь
   - Lab checkpoint summaries — просматривает, но не детально
2. GPT проверяет diff/scope перед merge-back
3. GLM делает self-checks (node--check, line count, API contracts)
4. Полный browser QA — только на merge-back milestones
5. Lab-ветки не требуют approval на каждый коммит
```

---

## 6. Big arch roadmap

### Обзор roadmap

Вместо 30 микрошагов — 7 крупных архитектурных блоков (LAB-05 разделён на 4 подшага 05A–05D, итого 10 merge-back milestones). Каждый блок — это lab-подветка с checkpoint-коммитами и merge-back milestone.

### Line count tracking

| Date | SHA / PR | main.js lines | Change | Reason |
|------|----------|-------------:|-------:|--------|
| 2026-05-10 | REF-MAIN-GLM-07 | 11 358 | — | После refactor sprint/checkpoint (проверено REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md) |
| 2026-05-12 | ARCH-MAP-01 | 15 379 | +4 021 | Merged gameplay/bot/economy/FX/power patches после refactor sprint (BOT-SCOUT-*, BOT-ATTACK-*, BOT-INTEL-01, POWER-SYSTEM-01A и др.) |
| 2026-05-12 | ARCH-AI-01 | 15 611 | +232 | Wiring: контекст, вызов decider, execution, guards, телеметрия для tank_decider |

Рост между 11 358 и 15 379 строк пришёл от merged gameplay/bot/economy/FX/power patches после refactor sprint. ARCH-AI-01 добавил wiring (+232 строки), не уменьшив main.js.

### Wiring/bridge budget

Цель main.js: 5 000–8 000 строк. Почему не 1 600 строк? Потому что main.js остаётся composition root / orchestration layer даже после выноса всех систем.

| Metric | Current | Target |
|--------|--------:|-------:|
| main.js total lines | 15 611 | 5 000–8 000 |
| FE_PATCH references | ~650 | <100 |
| Owner systems (explicit) | low | explicit для каждой зоны |
| Permanent orchestration/wiring budget | uncontrolled | 2 000–3 000 |
| Temporary bridge debt | high | explicitly tracked, removed in LAB-07 |
| Playwright E2E smoke coverage | partial (590 lines in 5 specs) | boot→menu→faction→game→enemy baseline |

Объяснение бюджета:
- **Permanent wiring (~2 000–3 000 строк):** bootstrap, game loop calls, FE_CORE bridge, DOM/canvas/input wiring, module initialization. Этот код остаётся навсегда.
- **Temporary bridges (~1 000–2 000 строк):** compatibility wrappers, feature flag checks, legacy guards. Этот код удаляется в LAB-07.
- **Progress metric:** не только line count, но и responsibility count — сколько зон main.js имеют явного owner system.

### Playwright E2E smoke baseline

Проект уже имеет Playwright infrastructure:
- `playwright.config.js` — конфигурация с baseURL http://127.0.0.1:8010
- `tests/` — 5 spec files, 590 строк: smoke.spec.js, menu_flow.spec.js, new_game_standard_flow.spec.js, bot-ai-smoke.spec.js, bot-ai-behavior-scenario.spec.js
- Существующий smoke.spec.js: загружает страницу, ждёт canvas, проверяет console errors
- Существующий new_game_standard_flow.spec.js: boot → main menu → new game → standard map click → проверка console errors

Но текущие тесты не покрывают полный merge-back baseline: faction select → game starts → enemy bot starts. Нужно добавить минимальный E2E smoke, который верифицирует playable baseline для каждого merge-back.

### unit_controller.js decision (до LAB-04)

`src/core/unit_controller.js` — 878 строк, выключен через `FE_UNIT_CONTROLLER_ENABLED = false`. Дублирует движение builder и harvester из main.js. Вызывается из main.js только когда `FE_UNIT_CONTROLLER_ENABLED === true`.

**Рекомендация: вариант C — archive/deprecate before movement extraction.**

Обоснование:
- unit_controller выключен по умолчанию и не используется как source-of-truth для движения. Вся активная gameplay-логика движения живёт в main.js.
- Использовать его как basis для movement_system (вариант B) рискованно — он реализует альтернативную модель движения (свою stuck detection, свою speed logic, свои state transitions), которая может конфликтовать с основной.
- Удалить полностью (вариант A) тоже рискованно — есть скрытые зависимости через `u._feUnitController` свойства на юнитах.
- Лучший вариант: archive/deprecate — переместить в `src/core/_archived/unit_controller.js`, добавить WARNING-заголовок, установить `FE_UNIT_CONTROLLER_ENABLED = false` как permanent, документировать, что movement extraction (LAB-04) не зависит от unit_controller.

Acceptance criteria:
- Нет hidden dependency: grep по `_feUnitController` и `FE_UNIT_CONTROLLER` показывает только deprecated references
- `FE_UNIT_CONTROLLER_ENABLED = false` documented как permanent
- movement extraction (LAB-04) не зависит от мёртвого альтернативного controller

### ARCH-LAB-01A — Playwright E2E smoke baseline

| Поле | Значение |
|------|----------|
| Goal | Создать минимальный Playwright E2E smoke test для верификации playable baseline при каждом merge-back: boot → main menu → new game → faction select → game starts → enemy bot starts. |
| Expected files/modules | tests/e2e/merge_back_smoke.spec.js (new, ~80 lines); обновлённый playwright.config.js если нужно |
| Can be broken? | Нет — только добавление теста. Не влияет на gameplay. |
| Risk | Low — dev-only, не влияет на game code |
| Dependencies | Нет — может быть создан до любого LAB шага |
| Acceptance criteria | `npx playwright test tests/e2e/merge_back_smoke.spec.js` PASS; тест покрывает boot → menu → new game → faction select → game starts → enemy bot starts; нет красных console errors; test занимает < 30 секунд |
| Merge-back criteria | Каждый merge-back PR должен PASS этот smoke. Без него merge-back = high-risk. |
| Smoke/Checks | Сам тест и есть smoke. Не заменяет manual QA. |

### ARCH-LAB-01 — Main breakout skeleton / project structure + smoke baseline

| Поле | Значение |
|------|----------|
| Goal | Создать скелет модульной структуры: директории, script tag order, bootstrap/wiring pattern, FE_CORE bridge. Вынести безопасные pure-data и pure-function модули. Archive/deprecate unit_controller.js. |
| Expected files/modules | src/core/coordinates.js, src/core/game_constants.js; src/core/_archived/unit_controller.js (moved); обновлённый index.html с новым script order; src/main.js сокращён на ~400 строк (geometry/coords + constants) |
| Can be broken? | Нет — только safe extractions. Игра должна запускаться после каждого шага. |
| Risk | Low — чистые функции и константы, минимальная связанность |
| Dependencies | ARCH-LAB-01A (E2E smoke baseline создан для верификации) |
| Acceptance criteria | main.js сокращён; все coordinate helpers работают через FE_CORE; unit_controller.js archived; FE_UNIT_CONTROLLER_ENABLED=false documented as permanent; node--check PASS; E2E smoke PASS |
| Smoke/Checks | node--check, E2E merge_back_smoke, browser: map renders, units move, camera works, clicks accurate |

### ARCH-LAB-02 — Game state + bootstrap + loop

| Поле | Значение |
|------|----------|
| Goal | Вынести game state initialisation, boot sequence, main loop в отдельные модули. main.js становится тонким orchestration layer. |
| Expected files/modules | src/core/game_state.js, src/core/boot.js, src/core/game_loop.js; src/main.js сокращён на ~350 строк |
| Can be broken? | Лаб может быть временно broken (bootstrap restructure), но merge-back = playable |
| Risk | Medium — bootstrap и game loop затрагивают все подсистемы |
| Dependencies | ARCH-LAB-01 (coordinates вынесены, FE_CORE bridge работает) |
| Acceptance criteria | Игра загружается, main menu работает, new game начинается, game loop работает |
| Smoke/Checks | Browser: boot, menu, faction select, new game start, update loop runs |

### ARCH-LAB-03 — Core helpers / coordinates / config / shared dependencies

| Поле | Значение |
|------|----------|
| Goal | Вынести все shared helpers, которые используются из нескольких зон: pathfinding (Z12), territory/fog (Z18), utility functions. Создать src/systems/ скелет. |
| Expected files/modules | src/systems/pathfinding.js, src/systems/territory_system.js, src/core/shared_helpers.js; src/main.js сокращён на ~700 строк |
| Can be broken? | Лаб может быть broken (pathfinding restructure), merge-back = playable |
| Risk | Medium-High — pathfinding вызывается из десятков мест |
| Dependencies | ARCH-LAB-01 (coordinates), ARCH-LAB-02 (bootstrap) |
| Acceptance criteria | Pathfinding работает, territory обновляется, fog работает, все юниты двигаются |
| Smoke/Checks | Browser: units path correctly, territory spreads, fog reveals/hides |

### ARCH-LAB-04 — Command + movement + combat boundary

| Поле | Значение |
|------|----------|
| Goal | Вынести movement system (Z14), command system (attack-approach, attack-move из Z22), combat system (Z7 combat portion). Разделить input от gameplay logic. |
| Expected files/modules | src/systems/movement_system.js, src/systems/combat_system.js, src/systems/command_system.js, src/input/mouse_input.js, src/input/keyboard_input.js, src/input/selection_system.js; src/main.js сокращён на ~3 000 строк |
| Can be broken? | Лаб может быть broken (command/movement restructure), merge-back = playable |
| Risk | High — command/movement/combat — фундаментальные системы, затрагивают все юниты |
| Dependencies | ARCH-LAB-03 (pathfinding, shared helpers) |
| Acceptance criteria | Player tanks двигаются и атакуют, enemy tanks двигаются, attack-approach работает, selection работает, drag-select работает |
| Smoke/Checks | Browser: right-click move, A-click attack, drag select, attack-approach state machine, combat damage, death handling |

### ARCH-LAB-05A — Scout + enemy_intel extraction

| Поле | Значение |
|------|----------|
| Goal | Вынести scout lifecycle (Z13g, ~1 475 строк) и intel system (Z13h, ~283 строки) и scouting coordinator (Z13i, ~459 строк) в src/ai/scout_decider.js и src/ai/enemy_intel.js. Это самый изолированный блок AI — scout и intel имеют чёткую границу с остальным AI. |
| Expected files/modules | src/ai/scout_decider.js, src/ai/enemy_intel.js; src/main.js сокращён на ~2 000 строк |
| Can be broken? | Лаб может быть broken (scout/intel restructure), merge-back = playable |
| Risk | High — scout lifecycle имеет ~30 _scout* свойств и сложный state machine, но чётко ограниченная зона |
| Dependencies | ARCH-LAB-04 (command/movement для scout movement) |
| Acceptance criteria | Scout lifecycle работает (outbound, observe, return, cooldown); intel обновляется из scout и tank vision; enemy bot стартует; E2E smoke PASS |
| Smoke/Checks | E2E merge_back_smoke, browser: scout outbound/observe/return, intel updates, bot starts |

### ARCH-LAB-05B — Enemy_targeting extraction

| Поле | Значение |
|------|----------|
| Goal | Вынести attack intelligence (Z13d, ~259 строк), attack-12 intel gate (Z13f, ~710 строк) и attack-08 invariant repair (Z13e, ~49 строк) в src/ai/enemy_targeting.js. Это целевой выбор и intel-based attack decision — чётко ограниченная ответственность. |
| Expected files/modules | src/ai/enemy_targeting.js; src/main.js сокращён на ~1 000 строк |
| Can be broken? | Лаб может быть broken (targeting restructure), merge-back = playable |
| Risk | High — targeting затрагивает attack dispatch и wave composition |
| Dependencies | ARCH-LAB-05A (intel system вынесен — targeting зависит от intel data) |
| Acceptance criteria | Attack waves dispatch корректно; intel-based gate работает; ATTACK-08 repair может быть упрощён; E2E smoke PASS |
| Smoke/Checks | E2E merge_back_smoke, browser: attack waves, intel gate, no oscillation |

### ARCH-LAB-05C — Tank decision / attack-retreat-defense Priority Stack migration

| Поле | Значение |
|------|----------|
| Goal | Расширить tank_decider.js (ARCH-AI-01 MVP) полным Priority Stack: добавить правила priority 70 (pick_next_target), 60 (regroup), 50 (intel_target), 40 (rally), 20 (patrol). Перевести 10H1 defend/retreat, 10D1 autopilot, 10E1 strength gate на decider output. Удалить ATTACK-08 invariant repair для decider-managed танков. |
| Expected files/modules | src/ai/tank_decider.js (expanded с 276 до ~500 строк), src/ai/enemy_brain.js (new, bot tick orchestration); src/main.js сокращён на ~1 500 строк (10H1/10D1/10E1 wiring replaced) |
| Can be broken? | Лаб может быть broken (decision restructure — самая сложная часть), merge-back = playable |
| Risk | Very High — 10H1/10D1/10E1 — основные источники oscillation, любое изменение требует careful testing |
| Dependencies | ARCH-LAB-05A (intel), ARCH-LAB-05B (targeting — decider использует targeting для pick_next_target) |
| Acceptance criteria | FE_TANK_DECIDER_ENABLED=true: defend/retreat/attack без oscillation; FE_TANK_DECIDER_ENABLED=false: legacy 1:1; ATTACK-08 repair не нужен для managed танков; E2E smoke PASS |
| Smoke/Checks | E2E merge_back_smoke, browser: defend, retreat, attack, regroup, no oscillation, toggle flag on/off |

### ARCH-LAB-05D — Enemy_brain cleanup / old guard-chain cleanup / enemy economy

| Поле | Значение |
|------|----------|
| Goal | Завершить AI breakout: вынести bot knobs/state (Z13a), bot movement helpers (Z13c), enemy_brain (Z13l, ~748 строк) в src/ai/enemy_brain.js. Вынести Z17 enemy portion (separator, factory, power) в src/ai/enemy_economy.js + src/systems/production_system.js + src/systems/construction_system.js. Удалить/деактивировать старые guard-chains, которые decider заменил. |
| Expected files/modules | src/ai/enemy_brain.js (expanded), src/ai/enemy_economy.js, src/systems/production_system.js, src/systems/construction_system.js; src/main.js сокращён на ~1 500 строк |
| Can be broken? | Лаб может быть broken (economy/brain restructure), merge-back = playable |
| Risk | High — enemy economy и BRAIN-01 тесно связаны через IIFE scope |
| Dependencies | ARCH-LAB-05C (decider мигрирован, guards удалены) |
| Acceptance criteria | Enemy bot полный цикл: строит, добывает, атакует; экономика работает; BRAIN-01 production работает; старые FE_10H1/10D1/10E1 guards удалены; E2E smoke PASS |
| Smoke/Checks | E2E merge_back_smoke, browser: full bot session, economy loop, production, no dead guards |

### ARCH-LAB-06 — Render / UI / input split + economy/player systems

| Поле | Значение |
|------|----------|
| Goal | Вынести render (Z20, 1 266 строк) в src/render/, UI panels (Z21) в src/ui/, harvester (Z16) в src/systems/economy_system.js, player economy/power (Z11) в src/systems/economy_system.js + src/systems/power_system.js. |
| Expected files/modules | src/render/render_world.js, src/render/render_units.js, src/render/render_fx.js, src/render/render_fog.js, src/render/render_ui.js, src/ui/hud.js, src/ui/build_menu.js, src/ui/result_screen.js, src/systems/economy_system.js, src/systems/power_system.js; src/main.js сокращён на ~3 500 строк |
| Can be broken? | Лаб может быть broken (render/input restructure), merge-back = playable |
| Risk | Medium — render/UI изолированы, economy/power имеют умеренную связанность |
| Dependencies | ARCH-LAB-04 (command/movement), ARCH-LAB-05 (enemy economy — player economy зависит от тех же helpers) |
| Acceptance criteria | Игра выглядит идентично, HUD работает, build menu работает, save/load работает, economy корректна |
| Smoke/Checks | Browser: visual parity, HUD updates, build menu, save/load, power indicator, resource counts |

### ARCH-LAB-07 — Restore playable loop + cleanup + merge-back readiness

| Поле | Значение |
|------|----------|
| Goal | Полная верификация playable loop. Удалить dead FE_PATCH_ chains, неиспользуемые guards, устаревшие feature flags. Почистить index.html script order. Проверить все модульные API. Подготовить финальный merge-back. |
| Expected files/modules | Все файлы — cleanup pass; src/main.js target: ~5 000–8 000 строк (composition/wiring + boot + loop); index.html — clean script order |
| Can be broken? | Нет — это merge-back milestone. Должно быть fully playable. |
| Risk | Low-Medium — cleanup, не structural changes |
| Dependencies | ARCH-LAB-01–06 все завершены и вмержены |
| Acceptance criteria | Полный browser smoke checklist PASS; main.js < 8 000 строк; FE_PATCH_ < 100; нет dead flags; все модули имеют чёткие API |
| Smoke/Checks | Full session QA: boot → menu → faction → new game → economy → build → attack → defend → scout → save → load → victory → defeat |

### Сводная таблица roadmap

| Arch | Goal | Expected reduction | Can be broken? | Risk | Dependencies | Acceptance criteria | Smoke/Checks |
|------|------|-------------------:|----------------|------|--------------|---------------------|--------------|
| ARCH-LAB-01A | E2E smoke baseline | +80 строк теста | Нет | Low | Нет | Playwright PASS | Playwright merge_back_smoke |
| ARCH-LAB-01 | Skeleton + safe extractions + unit_controller archive | ~400 строк | Нет | Low | LAB-01A | coords + archive + smoke | E2E + browser: map, camera, clicks |
| ARCH-LAB-02 | Bootstrap + game loop | ~350 строк | Lab может | Medium | LAB-01 | Boot, loop run | Browser: boot, menu, game start |
| ARCH-LAB-03 | Pathfinding + territory + helpers | ~700 строк | Lab может | Med-High | LAB-01, 02 | Path, territory, fog | Browser: movement, territory |
| ARCH-LAB-04 | Command + movement + combat + input | ~3 000 строк | Lab может | High | LAB-03 | All unit actions work | Browser: move, attack, select |
| ARCH-LAB-05A | Scout + enemy_intel extraction | ~2 000 строк | Lab может | High | LAB-04 | Scout lifecycle + intel | E2E + browser: scout lifecycle |
| ARCH-LAB-05B | Enemy_targeting extraction | ~1 000 строк | Lab может | High | LAB-05A | Attack dispatch + intel gate | E2E + browser: attack waves |
| ARCH-LAB-05C | Tank decider Priority Stack migration | ~1 500 строк | Lab может | Very High | LAB-05A, 05B | No oscillation, flag toggle | E2E + browser: defend/retreat/attack |
| ARCH-LAB-05D | Enemy_brain + economy + guard cleanup | ~1 500 строк | Lab может | High | LAB-05C | Full bot cycle, no dead guards | E2E + browser: full bot session |
| ARCH-LAB-06 | Render + UI + player economy | ~3 500 строк | Lab может | Medium | LAB-04, 05D | Visual parity | Browser: full visual QA |
| ARCH-LAB-07 | Cleanup + merge-back readiness | Cleanup only | Нет | Low-Med | LAB-01–06 | main.js 5K–8K, FE_PATCH_ <100 | Full session QA |

---

## 7. Dependency graph

### Линейные зависимости

```text
ARCH-LAB-01A E2E smoke baseline
  → ARCH-LAB-01 skeleton + unit_controller archive
    → ARCH-LAB-02 bootstrap/loop
      → ARCH-LAB-03 pathfinding/territory/helpers
        → ARCH-LAB-04 command/movement/combat/input
          → ARCH-LAB-05A scout + enemy_intel
            → ARCH-LAB-05B enemy_targeting
              → ARCH-LAB-05C tank decider Priority Stack migration
                → ARCH-LAB-05D enemy_brain + economy + guard cleanup
                  → ARCH-LAB-06 render/UI/player economy
                    → ARCH-LAB-07 cleanup/merge-back
```

### Параллелизм

```text
                    ARCH-LAB-01A (E2E smoke)
                          |
                    ARCH-LAB-01 (skeleton)
                   /            \
          ARCH-LAB-02          (docs/exchange
              |                  parallel work)
          ARCH-LAB-03
           /        \
    ARCH-LAB-04    (LAB-05 prep:
        |            AI design docs,
    ARCH-LAB-05A   intel audit,
        |           targeting spec)
    ARCH-LAB-05B
        |
    ARCH-LAB-05C
        |
    ARCH-LAB-05D
        |
    ARCH-LAB-06
        |
    ARCH-LAB-07

После ARCH-LAB-04:
  ARCH-LAB-05A–05D (AI) строго последовательно.
  ARCH-LAB-06 может начаться после LAB-05D.
```

### Что можно делать параллельно

- ARCH-LAB-01A + docs/exchange work (E2E smoke можно создать параллельно с любым другим)
- ARCH-LAB-03 + AI design docs (targeting spec, intel spec)
- ARCH-LAB-05A + LAB-05B design (intel spec можно писать параллельно с scout extraction)

### Что строго последовательно

- LAB-01A → LAB-01 → LAB-02 → LAB-03 → LAB-04 (каждый зависит от предыдущего)
- LAB-04 → LAB-05A (AI execution зависит от command/movement/combat)
- LAB-05A → LAB-05B → LAB-05C → LAB-05D (AI подшаги строго последовательно)
- LAB-05D → LAB-06 (player economy зависит от enemy economy helpers)
- LAB-06 → LAB-07 (cleanup требует все системы на месте)

---

## 8. What to do with current ARCH-AI-01

### ARCH-AI-01 уже смержен в sandbox/main

ARCH-AI-01 — полезный первый модуль, который доказал viability Priority Stack pattern. Откатывать его не нужно.

### Решение

1. **Оставляем как полезный первый модуль.** tank_decider.js — это первый AI-модуль вне main.js, и он устанавливает pattern, который LAB-05 расширит.

2. **Переносим/адаптируем в lab architecture.** Когда ARCH-LAB-05 начнёт enemy AI breakout, tank_decider.js будет расширен:
   - Добавлены правила priority 70 (pick_next_target), 60 (regroup), 50 (intel_target), 40 (rally), 20 (patrol)
   - Context будет упрощён (больше не нужен per-tank marker, если decider — единственная точка решения)
   - Wiring в main.js будет заменён на вызов из enemy_brain.js
   - Legacy guards будут удалены

3. **Откатывать не нужно.** Feature flag `FE_TANK_DECIDER_ENABLED = false` обеспечивает полную обратную совместимость.

4. **Что проверить перед дальнейшим lab:**
   - FE_TANK_DECIDER_ENABLED = true: запустить игру, проверить, что enemy tanks принимают решения через decider, нет oscillation, нет console errors
   - FE_TANK_DECIDER_ENABLED = false: проверить, что поведение идентично legacy
   - Telemetry: game._tankDecider01 корректно обновляется

5. **Как использовать FE_TANK_DECIDER_ENABLED в lab:**
   - В lab-ветке: FE_TANK_DECIDER_ENABLED = true по умолчанию (lab — место, где decider активен)
   - В sandbox/main: FE_TANK_DECIDER_ENABLED = false (baseline safe)
   - При merge-back: если decider проверен — можно переключить default на true в sandbox/main
   - Если decider проблемы — fallback на false, legacy работает

---

## 9. How to avoid "patches called arch"

### Критерии: это НЕ арч

Задача НЕ считается архитектурной, если она:

1. **Добавила guard** — новый `if` или `typeof` check без изменения owner-системы. Пример: добавление `if (!unit._tankDeciderManagedAt)` в updateEnemyBot без изменения ответственности.
2. **Добавила flag** — новый `window.FE_*_ENABLED` без новой системы. Пример: добавление `FE_ENEMY_BETTER_RETREAT = true` без создания retreat_decider.
3. **Добавила helper в main.js** — новая `FE_PATCH_XX_Helper()` функция, которая живёт в main.js и не имеет owner-системы. Пример: `FE_PATCH_12A_BetterTargetSelection()`.
4. **Починила симптом без смены owner-системы** — третий фикс одного и того же поведения. Пример: ATTACK-04, ATTACK-05, ATTACK-07 — все чинят одну и ту же проблему (order overwrite), но каждый добавляет guard вместо системного решения.
5. **Вынесла 200 строк в новый файл без изменения ответственности** — механический перенос кода, где новый файл просто копирует старую логику с другим названием, без нового API, без нового contract, без owner-системы.

### Критерии: это арч

Задача считается архитектурной, если она:

1. **Создала owner-систему** — новый модуль с чёткой ответственностью и API. Пример: `src/ai/tank_decider.js` — владеет решениями танка, имеет `evaluateTankDecision(context) → result` API.
2. **Перенесла ответственность** — старый код в main.js теряет ответственность за поведение, новый модуль становится owner. Пример: после ARCH-AI-01, `tank_decider.js` владеет решениями defend_hq/retreat/keep_attacking для decider-managed танков.
3. **Уменьшила/изоляла patch-chain** — после арча patch-chain либо удалена, либо изолирована за feature flag, либо заменена системным вызовом. Пример: после ARCH-AI-04, `FE_10H1_startRetreat` и `FE_10H1_defendHq` будут заменены decider rules.
4. **main.js стал thinner** — после арча main.js содержит меньше логики и больше wiring. Если main.js вырос — арч не достиг цели.
5. **Появился explicit contract between systems** — после арча системы взаимодействуют через чёткий API, а не через shared game._* properties. Пример: tank_decider получает context через параметр, а не через game._enemyBotState напрямую.
6. **Старый путь помечен на удаление или закрыт feature flag** — после арча старый код не просто существует рядом с новым, а явно помечен как deprecated/legacy с планом удаления.

### Правило: «patch если < 3 из 6 критериев, arch если >= 4»

Если задача набирает 4+ критериев из списка «это арч» — это архитектурная задача. Если < 3 — это патч.

---

## 10. Review load plan for user

### Проблема

Пользователь устал от 30–50 патчей/PR в день. Нужно предложить процесс, где меньше ручного review, но контроль сохраняется.

### Рекомендуемый workflow

```text
1. GLM делает lab branch / audit
   - Создаёт lab-ветку
   - Делает работу с checkpoint-коммитами
   - Сам делает node--check на каждом checkpoint
   - Сам проверяет API contracts
   - Пишет checkpoint summary в коммит-сообщении

2. GPT checks
   - Читает checkpoint summaries из exchange files
   - Проверяет diff scope (не вышел ли за рамки задачи)
   - Флагует проблемы: hidden dependencies, API breaks, missing guards

3. User merges or holds
   - Пользователь смотрит только merge-back PR
   - Merge-back PR содержит: summary of all lab work, main.js before/after, smoke results
   - Пользователь не смотрит промежуточные lab-коммиты

4. Каждые N commits — checkpoint summary
   - Каждый checkpoint: краткое описание сделанного, текущее playable/broken состояние, следующий шаг
   - Checkpoint summaries пишутся в git commit message и в exchange files

5. Browser QA только на restore milestones
   - Browser QA не нужен на каждом lab-коммите
   - Browser QA нужен только при merge-back в sandbox/main
   - Между merge-back — lab может быть broken, это ок
```

### Конкретный процесс

```text
SHOULD_REVIEW (пользователь обязательно смотрит):
  - Merge-back PR (sandbox/main ← arch/lab-*)
  - Стратегические решения (выбор стратегии A/B/C)
  - Новые API contracts
  - Feature flag default changes

MAY_REVIEW (пользователь может посмотреть):
  - Checkpoint summaries (git log)
  - Exchange files (AUDIT_FROM_GLM, GPT_REVIEW)

NO_REVIEW (пользователь не смотрит):
  - Промежуточные lab-коммиты
  - node--check outputs
  - Line count reports
  - Wiring details
```

### Ожидаемое количество review

```text
Текущий подход (30 small PR): 30 review sessions
Hybrid lab approach (7 lab milestones): 7 merge-back review sessions + 2-3 strategic decisions = ~10 review sessions

Снижение review load: ~3x
```

---

## 11. Merge-back criteria

Когда lab можно возвращать в sandbox/main:

### Обязательные критерии

1. **Game starts** — main menu виден, нет uncaught exceptions
2. **Main menu works** — кнопки New Game, Continue работают
3. **New game starts** — faction select, map generation, game setup
4. **No red console errors on startup** — warnings допустимы, errors — нет
5. **Faction select works** — можно выбрать любую фракцию
6. **Harvester/basic economy works** — harvester добывает минералы, separator обрабатывает, power работает
7. **Builder can build** — placement работает, строительство завершается
8. **Enemy bot starts** — HQ появляется, harvesters начинают работу
9. **Tank movement/attack does not crash** — player и enemy tanks двигаются, атакуют, не крашат
10. **Feature flags documented** — каждый FE_*_ENABLED flag имеет описание и default value
11. **node--check all changed JS** — синтаксическая проверка пройдена
12. **main.js line count trend improved** или wiring responsibility clarified — если main.js не сократился, объяснить почему и указать follow-up

### Дополнительные критерии для AI-specific merge-back

13. **FE_TANK_DECIDER_ENABLED=false: behaviour 1:1 current** — legacy path работает
14. **FE_TANK_DECIDER_ENABLED=true: no oscillation** — defend/retreat/attack не осциллируют
15. **Scout lifecycle works** — outbound, observe, return, cooldown
16. **Attack waves dispatch** — ATTACK-11/12 gate работает
17. **BRAIN-01 production works** — bot строит, производит, не stall'ит

---

## 12. Risks

### 1. GLM context limit

**Риск:** GLM не может держать весь main.js (15 611 строк) в памяти. При работе с фрагментами есть риск упустить скрытые зависимости.

**Mitigation:**
- Каждый lab-шаг работать с конкретной зоной, не со всем файлом
- Перед началом lab-шага — grep анализ зависимостей (как в ARCH-AI-01 Phase 1)
- Проверять через `rg` все ссылки на выносимые функции
- Checkpoint-коммиты — если GLM потерял контекст, откатиться к checkpoint

### 2. Huge diff impossible to review

**Риск:** Merge-back PR из lab может содержать тысячи строк изменений, что делает review невозможным.

**Mitigation:**
- Каждый lab-штап — отдельная подветка с отдельным merge-back PR
- Merge-back PR содержит summary + diff stats, не полный diff
- GPT проверяет scope перед merge-back
- Пользователь смотрит только decision points, не полный diff

### 3. Broken lab can drift too far

**Риск:** Lab-ветка может drift'ить неделями без playable состояния, и merge-back становится невозможным.

**Mitigation:**
- Checkpoint-коммиты каждые ~500 строк
- Каждый checkpoint описывает playable/broken состояние
- Если lab broken > 3 дней — приостановить и переоценить
- Sync от sandbox/main перед каждым новым блоком работы

### 4. index.html script order

**Риск:** Browser-global IIFE модули зависят от порядка загрузки в index.html. Изменение порядка может сломать все модули.

**Mitigation:**
- Не менять script order без явной необходимости
- Каждый новый модуль добавляется в конец списка (перед main.js)
- При restructure — создать отдельный lab-коммит для script order testing
- Проверять в браузере после каждого script order изменения

### 5. Browser-global IIFE coupling

**Риск:** Все модули используют `window.FE_*` для коммуникации. Это создаёт скрытые зависимости через global scope.

**Mitigation:**
- Каждый модуль экспортирует чёткий API через `window.FE_MODULE_NAME`
- Модули не читают внутренние переменные других модулей
- FE_CORE bridge для доступа к game state — единая точка
- Deps injection через init(deps) pattern для новых модулей

### 6. Hidden dependencies through game object

**Риск:** `game._enemyBotState`, `game._enemyKnowledge`, `game._enemy*` — 23 свойства, которые доступны из любого места. Вынос модуля может сломать hidden dependencies.

**Mitigation:**
- Перед выносом модуля — grep анализ всех `game._*` ссылок
- Выносимый модуль получает нужные данные через context/params, не через direct game access
- Telemetry может читать game.* для debug, но decision logic — только через context

### 7. No automated browser tests

**Риск:** Единственная проверка playable состояния — ручной smoke-тест. Нет автоматических тестов для верификации merge-back.

**Mitigation:**
- Browser smoke checklist формализован (см. раздел 11)
- Playwright scenarios существуют, но не покрывают все gameplay-сценарии
- Для критических изменений — ручной QA перед merge-back
- Long-term: добавить E2E тесты для critical paths

### 8. User fatigue

**Риск:** Пользователь устал от большого количества PR и review.

**Mitigation:**
- Hybrid lab approach снижает количество review sessions с ~30 до ~10
- Summary-first reports (пользователь смотрит только decision points)
- GPT проверяет diff/scope
- GLM делает self-checks
- Lab-ветки не требуют approval на каждый коммит

---

## 13. Recommended next action

```text
Next Arch: ARCH-LAB-01A — Playwright E2E smoke baseline

Goal:
  Создать минимальный Playwright E2E smoke test для merge-back верификации:
  boot → main menu → new game → faction select → game starts → enemy bot starts

Branch: arch/lab-01a-e2e-smoke-baseline
  (от sandbox/main)

Files expected:
  tests/e2e/merge_back_smoke.spec.js (new, ~80 lines)
  playwright.config.js (possibly updated)

Code allowed? Да — тестовый код только, не влияет на game
Can be broken? Нет — тест не влияет на gameplay

Checks:
  npx playwright test tests/e2e/merge_back_smoke.spec.js PASS
  Тест покрывает: boot → menu → new game → faction select → game starts → enemy bot starts
  Нет красных console errors
  Тест занимает < 30 секунд

Stop conditions:
  Тест не PASS → исправить тест или game code
  Тест > 60 секунд → упростить

Почему LAB-01A перед LAB-01:
  Каждый merge-back нуждается в автоматической верификации.
  Без E2E smoke merge-back = high-risk.
  E2E smoke — это guardrail, а не замена manual QA.
```

---

## 14. What NOT to do

1. **Не делать full rewrite** — мы не переписываем игру с нуля. Мы мигрируем по одной системе за раз, даже в lab-ветке.

2. **Не удалять текущий playable prototype** — sandbox/main остаётся playable baseline. Удаление рабочего кода без замены — запрещено.

3. **Не мержить broken lab в sandbox/main** — lab-ветка может быть broken, но sandbox/main — никогда. Merge-back только после playable milestone.

4. **Не делать 30 tiny guard PR под "arch" name** — если задача набирает < 3 критериев из раздела 9, это не арч, а патч. Не называть патч архитектурой.

5. **Не переносить хаос из main.js в один giant enemy_bot.js** — enemy bot должен быть разделён на brain, decider, targeting, intel, scout, economy — каждый как отдельный модуль с чётким API.

6. **Не менять gameplay balance в architecture breakout** — баланс (hp, damage, cost, range, cooldown) не меняется во время архитектурной работы, если это не scoped явно.

7. **Не делать economy + AI + render + input в одном unreviewable PR без lab branch** — если задача затрагивает > 2 систем, она должна идти через lab-ветку, не через incremental PR в sandbox/main.

8. **Не добавлять новые FE_PATCH_ chains в main.js** — если задача добавляет новый `FE_PATCH_XX_*` helper в main.js вместо создания/расширения модуля — это нарушение Architecture Migration Mode.
