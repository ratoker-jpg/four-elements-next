# ARCH-LAB-01A — Playwright E2E smoke baseline

**Дата:** 2026-05-12
**Тип:** Test infrastructure / docs-only
**Статус:** PR pending review
**Риск:** Very low — no gameplay code touched

---

## Problem

Перед крупными lab-ветками (ARCH-LAB-01–07) нужен автоматический baseline-тест, который верифицирует playable-состояние игры. Без E2E smoke каждый merge-back milestone требует ручного smoke-теста в браузере, что замедляет разработку и увеличивает риск незамеченного breakage.

Существующие Playwright тесты (`tests/smoke.spec.js`, `tests/menu_flow.spec.js`, `tests/new_game_standard_flow.spec.js`) используют хрупкие координатные клики (640, 262) и не проверяют enemy bot. Тесты `bot-ai-smoke.spec.js` и `bot-ai-behavior-scenario.spec.js` проверяют bot telemetry, но не являются baseline smoke.

Сервер в `playwright.config.js` использует `py -m http.server 8010` — это Windows-специфичная команда (`py` вместо `python`), которая не работает на Linux/CI.

## What changed

1. Создан `tests/e2e/static_server.cjs` — кроссплатформенный Node static file server (zero deps, http + fs + path built-ins). Заменяет `py -m http.server` для CI и Linux.

2. Создан `tests/e2e/basic_smoke.spec.js` — минимальный E2E smoke baseline, который проходит полный playable flow:
   - boot → page loads
   - canvas visible
   - main menu active (`#mainMenu.active`)
   - navigate: Новая игра → Стандартная → Зелёные → game starts
   - game state via `window.FE_CORE.game`
   - enemy bot state check
   - no critical JS errors

3. Обновлён `playwright.config.js` — webServer переключён на Node static server, увеличен timeout до 90s.

4. Обновлён `package.json` — добавлены `scripts.test:e2e` и `scripts.test:e2e:headed`.

## Files changed

| File | Action | Lines |
|------|--------|-------|
| `tests/e2e/static_server.cjs` | new | ~100 |
| `tests/e2e/basic_smoke.spec.js` | new | ~190 |
| `playwright.config.js` | modified | ~30 |
| `package.json` | modified | ~8 |

## Smoke scenario

```
1. Open http://127.0.0.1:8010/index.html
2. Wait for page load (domcontentloaded)
3. Canvas #game visible
4. #mainMenu.active visible
5. Click [data-action="new"] (Новая игра)
6. Click [data-map-size="standard"] (Стандартная)
7. Click [data-faction="green"] (Зелёные)
8. Wait for window.FE_CORE.game.screen === 'game'
9. Check window.FE_CORE.game._enemyBotState exists
10. No uncaught/page/critical console errors
```

## How to run

```bash
# Full E2E suite (all tests including existing ones)
npm run test:e2e

# Headed mode (visible browser)
npm run test:e2e:headed

# Only the new smoke baseline
npx playwright test tests/e2e/basic_smoke.spec.js

# Syntax check only (no browser needed)
node --check tests/e2e/static_server.cjs
node --check tests/e2e/basic_smoke.spec.js
node --check playwright.config.js
```

## Console error policy

Тест fail только на:
- Uncaught exception (pageerror)
- SyntaxError / ReferenceError / TypeError
- "Uncaught" / "Error:" в console.error

Не fail на:
- Обычные warnings/logs
- favicon.ico 404 (documented benign)
- DevTools messages (documented benign)

Известные benign errors:
- `favicon.ico` 404 — браузер автоматически запрашивает favicon, которого нет в проекте
- DevTools-related console messages — нормальны в headless Chromium

## Checks

- `node --check tests/e2e/static_server.cjs` — PASS
- `node --check tests/e2e/basic_smoke.spec.js` — PASS
- `node --check playwright.config.js` — PASS
- Browser run: UNVERIFIED (no browser in GLM environment)

## What was NOT touched

- `src/main.js` — not touched
- `src/ai/*` — not touched
- `src/config/*` — not touched
- `index.html` — not touched
- `src/core/*` — not touched
- `src/modules/*` — not touched
- `src/ui/*` — not touched
- `assets/*` — not touched
- Existing test files (`tests/smoke.spec.js`, `tests/menu_flow.spec.js`, etc.) — not touched
- `package-lock.json` — not touched (no new dependencies)

## Known limitations

1. Тест не может быть запущен в GLM окружении (нет браузера). QA status: UNVERIFIED. Требуется ручной запуск `npm run test:e2e` на машине с установленным Playwright.

2. Выбор фракции — захардкожен "Зелёные" (`data-faction="green"`). Если UI изменится, селекторы нужно обновить. Однако data-* атрибуты стабильны и меняются редко.

3. Если игра не создаст `window.FE_CORE.game` за 30 секунд (например, на очень медленной машине), шаг navigateToSkirmish упадёт в timeout. Время можно увеличить в playwright.config.js.

4. Существующие тесты (`tests/smoke.spec.js` и др.) по-прежнему используют `py -m http.server` в своих запусках. Если запускать полный suite через `npm run test:e2e`, все тесты будут использовать новый Node server.

5. Тест не проверяет точный визуал, координаты, баланс, AI behavior, экономику — по дизайн-требованию.

## Next recommended arch

ARCH-LAB-01 — skeleton + unit_controller archive/deprecate (первый шаг roadmap, ~400 lines reduction from main.js)
