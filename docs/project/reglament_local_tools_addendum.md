# Reglament Local Tools Addendum

Внутри проекта отдельный DOCX-регламент не обнаружен, поэтому это markdown-дополнение фиксирует локальный служебный контур.

## Codex на минималках

- задача формулируется по актуальному состоянию проекта;
- для кода и рискованных изменений сначала собирается актуальный контекст;
- после изменений обязателен отчёт для GPT;
- сама игра не меняется ради служебных задач.

## GPT-контекст

- launcher: `01_BUILD_GPT_CONTEXT.bat`
- результат: `_exports/gpt_context_latest.zip`
- использовать, когда нужен свежий кодовый контекст проекта для GPT/Codex

## distill_local.py

- путь: `tools/distill_local.py`
- использовать только для длинных diff, search results, build/test logs, stack traces
- не использовать для точных списков PNG, directory listing и прямого чтения файлов под патч

Пример:

```powershell
git diff 2>&1 | py tools\distill_local.py "Return changed files and risky changes."
```

## Playwright

- запуск: `npx.cmd playwright test`
- отчёты: `_reports/playwright`
- использовать для визуальных задач: направления юнитов, grounding, пыль, тени, UI-flow
- не запускать как обязательный шаг для каждой маленькой числовой правки

## Playwright codegen

- launcher: `07_PLAYWRIGHT_CODEGEN.bat`
- инструкция: `docs/project/playwright_codegen_routes.md`
- нужен для быстрой записи маршрутов кликов, а не для постоянных regression suites

## Audit main

- launcher: `04_AUDIT_MAIN.bat`
- script: `tools/audit_main.py`
- report: `_reports/audit/main_audit.txt`
- использовать перед любым рефакторингом или крупным анализом `src/main.js`

## Asset validation

- builder launcher: `05_VALIDATE_BUILDER_ASSETS.bat`
- harvester launcher: `06_VALIDATE_HARVESTER_ASSETS.bat`
- script: `tools/assets/validate_unit_sprites.py`
- reports: `_reports/assets/`
- dependency: Pillow, если нужен реальный PNG-анализ

## Project structure

- reference doc: `docs/project/project_structure.md`
- использовать как быструю карту актуальных папок, launcher-ов и зон риска
