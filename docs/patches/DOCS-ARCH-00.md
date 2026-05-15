# DOCS-ARCH-00 — Architecture Migration Workflow

## Problem

Проект Four Elements Remake слишком долго развивался через patch accumulation: много мелких патчей, src/main.js вырос примерно до 15k строк, AI/gameplay-логика наслаивается guard/flag/if-блоками, новые фичи добавляются прямо в main.js вместо профильных систем. Пользователь устал от режима "патч, патч, патч" и хочет перейти к системной разработке.

## What changed

1. Создан `docs/project/ARCHITECTURE_TARGET.md` — целевая архитектура проекта:
   - Почему patch accumulation больше не основной режим (1.1)
   - Новый режим: Architecture Migration Mode (1.2)
   - Роль src/main.js как composition root / wiring layer (1.3)
   - Целевые зоны проекта: src/core/, src/systems/, src/ai/, src/render/, src/input/, src/ui/, src/config/, src/dev/ (1.4)
   - Правило добавления новой gameplay/AI-фичи (1.5)
   - Как добавлять новый юнит через config/profile (1.6)
   - Как добавлять новую AI-логику через decision layer (1.7)
   - Правило после двух неудачных фиксов — architecture audit (1.8)
   - Как принимать architecture PR (1.9)
   - Миграционный план на 8 шагов: DOCS-ARCH-00 → ARCH-MAP-01 → ARCH-CORE-01 → ARCH-AI-01/02/03 → ARCH-SYSTEMS-01+ → ARCH-CLEANUP-* (1.10)

2. Обновлён `AGENTS.md` — добавлен блок Architecture Migration Mode с 5 правилами:
   - Новая крупная логика не идёт напрямую в main.js
   - main.js становится composition/wiring layer
   - Guard/flag/if в updateEnemyBot требует обоснования
   - После 2 неудачных фиксов — только architecture audit
   - Architecture Migration задачи — branch + PR

3. Обновлён `docs/project/AI_READ_FIRST.md`:
   - Добавлен ARCHITECTURE_TARGET.md как приоритет 2 в списке чтения
   - Добавлен принцип Architecture Migration First
   - Добавлен Architecture Migration Gate с 7 вопросами
   - Обновлены ключевые формулы: main.js размер брать из git, не из checkpoints
   - Добавлено правило: текущий статус брать из GitHub, не из старых Google skills

4. Обновлён `docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md`:
   - Добавлен раздел 0: Режим разработки — patch workflow = legacy, architecture migration = default
   - Добавлен раздел 15: Architecture Migration Gate с обязательными вопросами
   - Обновлён формат bot/scout work: 60% Architecture / Medium patches
   - Patch workflow не удалён, а встроен поверх Architecture Migration

## Files changed

- `docs/project/ARCHITECTURE_TARGET.md` — новый файл
- `AGENTS.md` — обновлён
- `docs/project/AI_READ_FIRST.md` — обновлён
- `docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md` — обновлён

## New workflow summary

```text
Мы сохраняем текущий рабочий прототип.
Мы не переписываем игру с нуля.
Мы прекращаем развивать игру через patch accumulation.
Новая крупная логика идёт через системы/модули.
main.js постепенно становится composition root.
Patch mode остаётся только для малых/аварийных фиксов.
Architecture Migration Mode становится default для AI/gameplay/refactor.
```

## What was NOT changed

- src/main.js — не тронут
- src/config/* — не тронут
- src/core/* — не тронут
- index.html — не тронут
- gameplay logic — не тронута
- bot logic — не тронута
- combat / economy / pathfinding — не тронуты
- assets — не тронуты
- save/load — не тронут
- docs/archive/ — не тронут
- Старые документы не удалены и не переименованы

## Checks

- Markdown reviewed: явных битых заголовков не найдено
- Новые ссылки/пути корректны: ARCHITECTURE_TARGET.md существует
- Code/gameplay/assets файлы не изменены
- node --check не нужен — изменены только .md файлы

## Risks

- Правила Architecture Migration Mode могут быть слишком строгими для некоторых текущих задач — допустимо использовать patch mode для thin bridge/wiring с обоснованием
- Миграционный план требует отдельных PR для каждого шага — это может замедлить темп, но повышает стабильность
- Целевая структура директорий — это карта направления, не все директории существуют сейчас

## Next recommended task

ARCH-MAP-01 — актуальная карта main.js и систем
