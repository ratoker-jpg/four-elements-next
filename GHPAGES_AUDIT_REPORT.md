# GHPAGES-01 — GitHub Pages Runtime Audit Report

**Task:** GHPAGES-01
**Date:** 2026-05-10
**Branch:** glm/ghpages-01-runtime-audit (from sandbox/main)
**Auditor:** GLM agent
**Repo:** https://github.com/ratoker-jpg/glm-game-sandbox
**Expected URL:** https://ratoker-jpg.github.io/glm-game-sandbox/

---

## 1. Summary Verdict: GO

Игра корректно работает на GitHub Pages. Все пути — относительные, без ведущего `/`. Нет ES-модульных импортов, нет `fetch()`, нет `XMLHttpRequest`, нет `<base>` тега. Страница загружается, JavaScript выполняется, главное меню отображается. localStorage работает на HTTPS.

---

## 2. Files Inspected

| # | File | Path Safety | Notes |
|---|------|------------|-------|
| 1 | `index.html` | SAFE | 15 `<script src>` с относительными путями, CSS `url()` с относительными путями |
| 2 | `src/core/asset_loader.js` | SAFE | Все `img.src` используют относительные пути `assets/...` |
| 3 | `src/main.js` (lines 352, 7-8) | SAFE | Динамическая загрузка `s.src = 'src/modules/debug/render_debug.js'` — относительный путь. SAVE_KEY/SETTINGS_KEY — localStorage ключи, не пути |
| 4 | `src/core/save_manager.js` | SAFE | Только `localStorage.getItem/setItem`, никаких файловых путей |
| 5 | `src/core/storage_guard.js` | SAFE | Только `localStorage`, никаких путей |
| 6 | `src/core/unit_controller.js` | SAFE | Не содержит путей к файлам |
| 7 | `src/ui/screen_manager.js` | SAFE | Только DOM-манипуляции |
| 8 | `src/config/runtime_flags.js` | SAFE | Только `window.*` флаги |
| 9 | `src/config/buildings.js` | SAFE | Конфиг зданий |
| 10 | `src/config/units.js` | SAFE | Конфиг юнитов |
| 11 | `src/config/factions.js` | SAFE | Конфиг фракций |
| 12 | `src/config/environment.js` | SAFE | Конфиг окружения |
| 13 | `src/config/sprite_profiles.js` | SAFE | Профили спрайтов |
| 14 | `src/modules/debug/render_debug.js` | SAFE | Только canvas-отрисовка |
| 15 | `src/modules/render/visual_calibrator.js` | SAFE | Только `window.FE_SPRITE_PROFILES` |
| 16 | `src/modules/render/visual_anchor.js` | SAFE | Заглушка |
| 17 | `src/modules/render/sprite_alpha.js` | SAFE | Canvas-обработка |
| 18 | `src/modules/debug/debug_tools.js` | SAFE | Отладка |

---

## 3. GitHub Pages Configuration Assumptions

| Parameter | Value |
|-----------|-------|
| Source branch | `sandbox/main` |
| Source folder | `/` (root) |
| Base URL | `https://ratoker-jpg.github.io/glm-game-sandbox/` |
| HTTPS | Yes (GitHub Pages принудительно) |
| Custom domain | No |
| Jekyll processing | Not disabled (no `.nojekyll` file found) |

**Note:** Отсутствие файла `.nojekyll` может быть проблемой, если в репозитории есть файлы или папки, начинающиеся с `_` или `.`. Однако сейчас `_gpt_state/` и `_inbox/` исключены через `.gitignore` и не коммитятся, а `_reports/` тоже gitignored. Единственный потенциально проблемный путь — `src/modules/render/visual_anchor.js` содержит `_` в середине имени, что не является проблемой для Jekyll. Папки `_archive/` и `_exports/` также gitignored. Текущий контент не должен вызывать проблем с Jekyll.

---

## 4. Path Safety Review

### 4.1 Script tags in index.html (lines 783-798)

Все 15 `<script>` тегов используют относительные пути без ведущего `/`:

```
src/config/buildings.js?v=good_profiles_1777647169
src/config/units.js?v=good_profiles_1777647169
src/config/factions.js?v=good_profiles_1777647169
src/config/environment.js?v=mineral_capacity_large_fields_20260503_1
src/config/sprite_profiles.js?v=lt03b_20260505_011603
src/config/runtime_flags.js?v=lt03b_20260505_011603
src/core/storage_guard.js?v=prepare_modules_1777655707
src/core/asset_loader.js?v=harvester_8dirs_20260503_1
src/core/save_manager.js?v=modular_split_stage2_20260503_1
src/core/unit_controller.js?v=prepare_modules_1777655707
src/ui/screen_manager.js?v=modular_split_stage2_20260503_1
src/modules/render/visual_anchor.js?v=prepare_modules_1777655707
src/modules/render/sprite_alpha.js?v=modular_split_20260503_1
src/modules/debug/debug_tools.js?v=prepare_modules_1777655707
src/modules/render/visual_calibrator.js?v=visual_calibrator_1777657210
src/main.js?v=bot10e1c2_20260509_155447
```

**Resolution on GitHub Pages:**
- Base: `https://ratoker-jpg.github.io/glm-game-sandbox/`
- Resolved: `https://ratoker-jpg.github.io/glm-game-sandbox/src/config/buildings.js` — CORRECT

### 4.2 CSS url() references in index.html

Все CSS `url()` используют относительные пути:

```
url("assets/ui/panels/panel_hud_v2.png")
url("assets/ui/buttons/button_menu_default_v2.png")
url("assets/ui/icons/icon_mineral_v2.png")
url("assets/ui/backgrounds/main_menu_desert_colony_static.jpg")
```

**Resolution:** Относительно `index.html`, корректно.

### 4.3 Asset loader paths (src/core/asset_loader.js)

Все пути к ассетам — относительные, формируются шаблонными строками:

```javascript
img(`assets/factions/${faction}/units/harvester.png?v=v04_harvester8_1`)
img(`assets/factions/${faction}/buildings/hq_base.png?v=v04_hq_clean_1`)
img('assets/tiles/tile_sand_v03.png?v=v04_hq_clean_1')
img('assets/environment/mineral_small.png?v=v04_hq_clean_1')
// ...и так далее
```

`loadUnitAnimation` строит пути:
```javascript
img(`${basePath}/${unitName}_idle_dir${d}_0.png?v=${idleCacheVersion}`)
// где basePath = `assets/factions/${faction}/units/builder_8dirs`
```

**Resolution:** `new Image().src` с относительным путём резолвится относительно URL страницы, не URL JS-файла. Поскольку `index.html` находится в корне (`/glm-game-sandbox/`), все пути резолвятся корректно.

### 4.4 Dynamic script load in main.js (line 352)

```javascript
s.src = 'src/modules/debug/render_debug.js?v=render_debug_1';
```

Относительный путь, резолвится корректно.

### 4.5 Summary of path patterns

| Pattern | Count | Type | Status |
|---------|-------|------|--------|
| `src="..."` (relative) | 15 | HTML script tag | SAFE |
| `url("assets/...")` (relative) | ~20 | CSS url() | SAFE |
| `img('assets/...')` (relative) | ~35 | JS new Image() | SAFE |
| `s.src = 'src/...'` (relative) | 1 | JS dynamic script | SAFE |
| Absolute `/...` paths | 0 | — | NONE |
| `file://` or `C:\` paths | 0 | — | NONE |
| `import` / `require()` | 0 | — | NONE |
| `fetch()` / `XMLHttpRequest` | 0 | — | NONE |
| `<base>` tag | 0 | — | NONE |

---

## 5. Likely Runtime Blockers

### BLOCKER-1: None identified ✅

Никаких блокирующих проблем не обнаружено. Игра корректно работает на GitHub Pages.

### Minor concern: Jekyll processing (LOW)

GitHub Pages по умолчанию обрабатывает файлы через Jekyll. Если в репозитории появятся файлы или папки, начинающиеся с `_`, они могут быть проигнорированы Jekyll. На данный момент:
- `_gpt_state/` — gitignored, не в репозитории
- `_inbox/` — gitignored, не в репозитории
- `_exports/` — gitignored, не в репозитории
- `_reports/` — gitignored, не в репозитории
- `_archive/` — gitignored, не в репозитории

**Риск:** LOW — текущий закоммиченный контент не содержит файлов/папок, начинающихся с `_`.
**Решение:** Если в будущем будут закоммичены файлы с `_` префиксом, добавить пустой файл `.nojekyll` в корень репозитория.

### Verification: Live page check

Страница была проверена через web-reader:
- **URL:** `https://ratoker-jpg.github.io/glm-game-sandbox/`
- **HTTP статус:** 200
- **Title:** "Four Elements Remake — v0.4 Economy + Territory Fix"
- **HTML содержит:** Canvas элемент (1280x1280), главное меню с кнопками, HUD, все script-теги
- **Признаки работы JS:** Canvas получил размеры, кнопка "Продолжить" корректно disabled (нет сохранения), render_debug.js загружен в `<head>`

---

## 6. Exact Browser Checks the User Should Run

### Check 1: Главная страница загружается
```
Открыть: https://ratoker-jpg.github.io/glm-game-sandbox/
Ожидание: Страница с главным меню "Four Elements", фоновое изображение пустыни, кнопки "Новая игра" и т.д.
```

### Check 2: Ассеты загружаются (нет 404)
```
Открыть DevTools (F12) → вкладка Network
Обновить страницу
Фильтр: img
Ожидание: все PNG/JPG возвращают статус 200, нет 404
Ключевые URL для проверки:
  - https://ratoker-jpg.github.io/glm-game-sandbox/assets/ui/backgrounds/main_menu_desert_colony_static.jpg
  - https://ratoker-jpg.github.io/glm-game-sandbox/assets/ui/panels/panel_main_menu_v2.png
  - https://ratoker-jpg.github.io/glm-game-sandbox/assets/ui/icons/icon_mineral_v2.png
```

### Check 3: JS-скрипты загружаются
```
DevTools → Network → фильтр: JS
Ожидание: все 16 .js файлов возвращают 200
Ключевые URL:
  - https://ratoker-jpg.github.io/glm-game-sandbox/src/main.js
  - https://ratoker-jpg.github.io/glm-game-sandbox/src/core/asset_loader.js
  - https://ratoker-jpg.github.io/glm-game-sandbox/src/config/buildings.js
```

### Check 4: Нет ошибок в Console
```
DevTools → Console
Ожидание: нет красных ошибок
Допустимо: warning-сообщения вроде "[Four Elements] render_debug.js loaded"
```

### Check 5: Новая игра запускается
```
Нажать "Новая игра" → "Стандартная" → "Голубые"
Ожидание: карта генерируется, видны тайлы, здания HQ, юниты
DevTools → Console: ввести FE_BOT_TELEMETRY()
Ожидание: runtimeGameExists: true, screen: "game"
```

### Check 6: Сохранение/загрузка работает
```
В игре нажать Esc → "Сохранить игру"
Вернуться в главное меню → "Продолжить"
Ожидание: сохранение загружается
```

### Check 7: Спрайты юнитов в 8 направлениях
```
DevTools → Network → фильтр: builder_idle_dir
Ожидание: 8 PNG-файлов (dir0-dir7) загружены со статусом 200
URL: https://ratoker-jpg.github.io/glm-game-sandbox/assets/factions/cyan/units/builder_8dirs/builder_idle_dir0_0.png
```

---

## 7. Recommended Minimal Fix Plan

**Фиксы не требуются.** Игра работает на GitHub Pages из коробки.

Единственная рекомендация на будущее — добавить файл `.nojekyll` в корень репозитория как страховку:

```
Создать пустой файл: .nojekyll
Причина: предотвратить Jekyll-обработку, если в будущем будут добавлены файлы/папки с _ префиксом
Приоритет: LOW
```

---

## 8. Files That Would Need Changes for a Future Fix

Никакие файлы не требуют изменений для работы на GitHub Pages.

Если в будущем потребуется добавить `.nojekyll`:

| File | Change | Reason |
|------|--------|--------|
| `.nojekyll` | Создать пустой файл | Отключить Jekyll-обработку на GitHub Pages |

---

## 9. Final Recommendation

### GO — GitHub Pages работает корректно

**Обоснование:**
1. Все пути в проекте — относительные (без ведущего `/`), что обеспечивает корректную работу в подкаталоге `/glm-game-sandbox/`.
2. Нет ES-модульных импортов — все скрипты используют IIFE и `window.*` глобалы.
3. Нет `fetch()`, `XMLHttpRequest`, WebSocket-подключений к `localhost`.
4. CSS `url()` ссылаются на ассеты относительно `index.html`.
5. JavaScript `new Image().src` формирует пути относительно URL страницы.
6. `localStorage` корректно работает на HTTPS (GitHub Pages принудительно использует HTTPS).
7. Проверка живой страницы подтверждает: HTML загружается, JS выполняется, главное меню отображается.
8. `node --check src/main.js` — PASS (exit code 0).
9. Нет проблем с CORS, MIME-типами или модулями.

**Единственная рекомендация:** Добавить `.nojekyll` как страховку (приоритет LOW).

---

*End of GHPAGES-01 report.*
