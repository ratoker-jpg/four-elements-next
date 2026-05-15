# REF-MAIN-GLM-07 — Main.js micro-refactor sprint checkpoint

**Дата:** 2026-05-10
**Тип:** Docs checkpoint (Fast lane)
**Ветка:** sandbox/main
**Основание:** REF-MAIN-GLM-01 → REF-MAIN-GLM-06 (все 5 кандидатов выполнены)

---

## 1. Краткий итог

### Зачем был нужен refactor sprint

`src/main.js` — монолитный IIFE на 12 128 строк, содержащий всю игровую логику: рендеринг, ввод, бот AI, экономику, производство, строительство, сохранение, combat, pathfinding. Такой размер файла делает невозможным безопасный рефакторинг большими блоками — любая ошибка в shared closure scope ломает игру непредсказуемо.

### Почему выбран GLM-first подход

Codex ранее пытался выполнить широкий рефакторинг (REFACTOR-MAIN-01/02): вынос нескольких модулей одновременно в рамках одного большого PR. Результат — игра сломалась на старте после выбора фракции. Причины провала:

1. **Слишком широкий scope** — Codex выносил несколько модулей одновременно, не проверяя каждый по отдельности.
2. **map_generation.js** — extraction изменил порядок вызовов `Math.random()`, карта стала другой, баланс сломался.
3. **Потеря shared closure scope** — функции потеряли доступ к `game`, `canvas`, `ctx` через IIFE замыкание.
4. **Не было browser-тестирования** — `node --check` прошёл, но игра не загрузилась.
5. **Один большой PR** — невозможно откатить одну сломанную часть, не откатывая всё.

GLM-first подход решает каждую из этих проблем: один PR = один кандидат, каждый кандидат минимального размера, каждый проверяется в браузере вручную.

### Почему Codex snapshot не принят

Codex REFACTOR-MAIN-01/02 snapshot не прошёл browser-проверку. Он не пушится, не импортируется, не считается source of truth. Используется только как lessons/reference для понимания, какие зоны нельзя трогать без browser-safe стратегии.

Единственный source of truth — `sandbox/main` на GitHub.

### Почему дальше делаем маленькие PR, а не большой refactor

Каждый из 5 принятых патчей — атомарная единица, которая:
- прошла `node --check`;
- была проверена руками в браузере;
- не сломала gameplay после merge;
- может быть откачена через `git revert` без побочных эффектов.

Любой будущий extraction должен следовать той же дисциплине: один PR = одна изолированная система, минимальный diff, `node --check` + browser smoke.

---

## 2. Принятые патчи

| Patch | Что сделано | main.js before | main.js after | Статус |
|---|---|---:|---:|---|
| REF-MAIN-GLM-02 | Dead code cleanup: удалено 9 блоков (unreachable, no-op, commented calls) | 12 128 | 11 919 | ✅ Принят, PR #15 |
| REF-MAIN-GLM-03 | Combat debug overlay: 6 функций FE_LT_04C6* → src/dev/combat_debug_overlay.js | 11 919 | 11 783 | ✅ Принят, PR #16 |
| REF-MAIN-GLM-04 | Enemy economy debug panel: 10 функций + F2 handler → src/dev/enemy_economy_debug_panel.js | 11 783 | 11 567 | ✅ Принят, PR #17 |
| REF-MAIN-GLM-05 | Snapshot/export system: feMakeSnapshot + F8 handler → src/dev/snapshot_export.js | 11 567 | 11 382 | ✅ Принят, PR #19 |
| REF-MAIN-GLM-06 | Standalone constants: 7 pure constants → src/core/standalone_constants.js | 11 382 | 11 358 | ✅ Принят, PR #20 |

---

## 3. Итог по main.js

```text
main.js: 12 128 → 11 358
Суммарно: -770 строк, -6.4%
```

Текущий размер `src/main.js` — 11 358 строк (проверено на sandbox/main, коммит 2dddd82).

---

## 4. Созданные модули

### src/dev/ (3 модуля — dev-only, не влияют на gameplay)

| Модуль | Browser global | Строк | Назначение | Активация |
|---|---|---:|---|---|
| `src/dev/combat_debug_overlay.js` | `window.FE_COMBAT_DEBUG_OVERLAY` | 218 | Отрисовка debug overlay для light_tank combat | Num9 toggle, по умолчанию выключен |
| `src/dev/enemy_economy_debug_panel.js` | `window.FE_ENEMY_ECONOMY_DEBUG_PANEL` | 266 | Панель экономики врага (ресурсы, производство, лимиты) | F2 toggle, по умолчанию выключена |
| `src/dev/snapshot_export.js` | `window.FE_SNAPSHOT_EXPORT` / `window.FE_EXPORT_SNAPSHOT` | 254 | Экспорт snapshot состояния игры в JSON-файл | F8, по умолчанию выключен |

### src/core/ (1 модуль — core, загружается до main.js)

| Модуль | Browser global | Строк | Назначение | Загрузка |
|---|---|---:|---|---|
| `src/core/standalone_constants.js` | `window.FE_STANDALONE_CONSTANTS` | 31 | 7 standalone pure констант (SAVE_KEY, SETTINGS_KEY, TILE_W, TILE_H, MAP_SIZES, BASE_STORAGE, FACTION_ELEMENT_KEY) | Script tag до main.js, `Object.freeze()` |

---

## 5. Паттерн extraction

Каждый extraction из sprint следует одному паттерну:

1. **Аудит** — кандидат идентифицирован в `REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md` с оценкой риска.
2. **PROMPT SELF-REVIEW GATE** — перед выполнением оценивается риск. Если выше low — задача не выполняется.
3. **Создание модуля** — новый `.js` файл, browser global через `window.FE_MODULE_NAME = { ... }` (IIFE или объектный литерал). Не ES modules.
4. **Замена в main.js** — удаление определений, замена вызовов на `window.FE_MODULE_NAME.method()`. Для зависимостей от IIFE scope — `window.FE_CORE` bridge или `init(deps)` паттерн.
5. **Script tag в index.html** — добавляется до `src/main.js` с cache-busting `?v=<patch_id>`.
6. **Проверки** — `node --check` на обоих файлах, rg-верификация, что старые определения удалены, все ссылки работают.
7. **PATCH_REPORT.txt** — полная запись: что вынесено, что не тронуто, проверки, риски, manual smoke checklist.
8. **Feature branch + PR** — Review lane: ветка `glm/ref-main-NN-<description>`, PR через GitHub.

### Ключевые архитектурные решения

- **Не ES modules** — проект использует browser globals через script tags. Это не меняется.
- **`window.FE_CORE` bridge** (строки 275-283 в main.js) — существующий мост, экспортирующий `game`, `ctx`, `assets`, `tileToScreen`, `spriteProfile`, `TILE_W`, `TILE_H`. Модули используют его для доступа к IIFE scope.
- **`init(deps)` паттерн** — если модулю нужны IIFE-scope функции (например, `inBounds`, `isObstacleBlocked`, `canPlaceBuilding`), они передаются через `init()` вызов из main.js после определения всех функций.
- **Fallback `|| {}`** — destructuring с `window.FE_MODULE_NAME || {}` обеспечивает отсутствие crash, если скрипт не загрузился.
- **`Object.freeze()`** — для pure constants (shallow freeze), предотвращает случайную мутацию.

---

## 6. Зоны, которые НЕ трогались

Следующие зоны остались в main.js и не были затронуты рефакторингом:

| Зона | Причина не трогать | Когда можно |
|---|---|---|
| `render()` | Оркестрирует все rendering subsystems, связан с canvas, camera, fog | После extraction всех rendering subsystems |
| `drawUnit` | Сложная логика: 8-направления, анимация, selection ring, HP | Phase D |
| Input / selection | Глубоко связан с `selected`, `selectedUnits`, `dragSelect` | Phase D |
| Movement / pathfinding | Используется всеми юнитами + ботом, доступ к game.obstacles/buildings/units/minerals | Phase C (только после shared state) |
| Combat | 3 уровня: attack, attack-approach, attack-move. Сложная state machine | Phase D |
| Enemy bot main tick | `updateEnemyBot()` вызывает 8 подсистем через общий IIFE scope | Phase D |
| Builder state machine | 5 состояний, сложные отмены | Phase D |
| Harvester state machine | idle→moving→harvesting→returning→unloading, auto-gather loop | Phase D |
| Save/load | Формат save привязан к структуре game объекта | Phase D |
| Map generation | Зависит от game через прямое обращение, использует `Math.random()` — изменение порядка = другая карта | Только после browser-safe strategy + seed-based testing |
| `debugLog` | Вызывается из ~58 production call sites с eager evaluation | Только после lazy-eval refactor всех call sites |

---

## 7. Дальнейшие refactor-кандидаты

Sprint закрыл все 5 кандидатов из `REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md`. Дальнейшие extraction-кандидаты могут быть определены на основе:

1. **`GLM_ROADMAP_20260510.md`** — Phase 1 (Stabilization):
   - PATCH-GLM-S4 — Extract coordinates.js (7 pure functions: tileToWorld, worldToTile, screenToTile, clamp, dist, inBounds). Low risk.
   - PATCH-GLM-S5 — Extract constants.js (расширение `standalone_constants.js` или новый `src/core/gameplay_constants.js` с hardcoded values: separator formula, economy constants, cycle time, territory spread, auto-save interval, HQ HP). Low risk.
   - PATCH-GLM-E7 — Extract mapgen.js (~530 строк). Требует browser-safe strategy для `Math.random()`.

2. **Новые кандидаты** — могут быть идентифицированы через повторный аудит `src/main.js` в текущем состоянии (11 358 строк).

### Правила для будущих extraction

- Один PR = одна изолированная система.
- PROMPT SELF-REVIEW GATE обязателен перед выполнением.
- `node --check` на всех изменённых файлах.
- Browser smoke: игра загружается, выбор фракции проходит, нет console errors.
- PATCH_REPORT.txt с полной записью.
- Feature branch + PR (Review lane).
- Не менять значения констант, баланс, gameplay.
- Не менять save/load формат и localStorage keys.
- Для доступа к IIFE scope — `window.FE_CORE` bridge или `init(deps)` паттерн.

---

## 8. Проверки и верификация

Все 5 патчей прошли:

| Проверка | Результат |
|---|---|
| `node --check src/main.js` | ✅ PASS после каждого патча |
| `node --check` на новых модулях | ✅ PASS для всех 4 модулей |
| Browser: игра загружается | ✅ После каждого merge |
| Browser: выбор фракции | ✅ Проходит дальше |
| Browser: debug modules не ломают gameplay | ✅ Num9, F2, F8 — работают при активации, не влияют при неактивации |
| Browser: console без красных ошибок | ✅ |
| `window.FE_STANDALONE_CONSTANTS.TILE_W === 76` | ✅ |
| `window.FE_CORE.TILE_W === 76` | ✅ (FE_CORE bridge не сломан) |
| Save/load работает | ✅ (SAVE_KEY не изменён) |

---

## 9. Исходные документы

| Документ | Назначение | Статус |
|---|---|---|
| `docs/project/REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md` | Аудит с 5 кандидатами | Все 5 DONE |
| `PATCH_REPORT.txt` | Записи всех патчей | Обновлён после каждого патча |
| `AGENTS.md` | Правила sandbox (Fast/Review lane) | Актуален |
| `README_GLM_SANDBOX.md` | Описание sandbox, workflow | Актуален |
| `docs/project/GLM_ROADMAP_20260510.md` | Перспективный роадмап развития | Актуален, содержит Phase 0-4 |
| `docs/project/GLM_STRATEGY_REVIEW_20260510.md` | Стратегический аудит проекта | Актуален |
| `docs/project/MAIN_REFACTOR_CODEX_HANDOFF_20260510.md` | Codex handoff (lessons) | Только reference, не source of truth |
| `docs/project/codex_sprint_closeout_20260509.md` | Codex sprint closeout | Только reference |
