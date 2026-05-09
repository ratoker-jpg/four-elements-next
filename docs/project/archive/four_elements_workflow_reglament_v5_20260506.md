# Four Elements — Workflow Reglament v5

## 0. Главный принцип
- Не патчить по памяти.
- Сначала брать актуальный контекст проекта.
- Потом делать анализ риска.
- Потом готовить `patch.py` или точное ТЗ для Codex.
- После двух неудачных попыток одним и тем же подходом менять подход: read-only аудит, меньший патч, откат, новый launcher-путь, другой инструмент.

## 1. WORK/QWEN разделение
WORK:
`C:\Users\Den\Desktop\four elements\four_elements_core_base_v03`

QWEN/GitHub:
`C:\Users\Den\Desktop\four elements\four_elements_core_base_repo`

Правило:
- GPT-патчи делать только из WORK.
- QWEN/GitHub использовать только для экспериментов, аудитов и git sync.
- Не смешивать архивы WORK и QWEN.
- Не отправлять архивы из `four_elements_core_base_repo` в GPT patch chat.

## 2. Запуск игры
Актуальный WORK-launcher:
`00_START_GAME_WORK_8010.bat`

Нормативный WORK-адрес:
`http://localhost:8010/index.html`

Нормативный WORK-порт:
`8010`

Правило:
- Старый порт `8000` больше не считать основным для WORK-проекта.
- Если в старых файлах/отчётах встречается `8000`, это устаревшая ссылка.

Примечание:
- По результатам аудита в проекте ещё остались старые упоминания `8000`, включая launcher-слой и старые служебные документы. Этот регламент v5 задаёт актуальную текстовую норму для WORK-контура.

## 3. GPT-контекст
Единственный правильный батник:
`01_BUILD_GPT_CONTEXT_WORK.bat`

Единственный правильный архив:
`_exports\GPT_WORK_SEND_THIS_CONTEXT.zip`

Запрещено отправлять в GPT patch chat:
- `_exports\gpt_context_latest.zip`
- архивы из `C:\Users\Den\Desktop\four elements\four_elements_core_base_repo`
- `_exports\GPT_QWEN_DO_NOT_SEND_TO_PATCH_CHAT.zip`

Правило:
- Для кодовых правок использовать только `GPT_WORK_SEND_THIS_CONTEXT.zip`.
- Старый `gpt_context_latest.zip` считать устаревшим и запрещённым для актуального patch workflow.

## 4. После каждого патча
- Запустить `02_RUN_PATCH_AND_CHECK.bat`.
- Запустить `node --check src/main.js`.
- Сделать ручной тест в игре.
- Затем запустить `01_BUILD_GPT_CONTEXT_WORK.bat`.
- Затем отправить `_exports\GPT_WORK_SEND_THIS_CONTEXT.zip`.

Правило:
- Не пересобирать GPT-контекст до минимальных проверок патча.
- Не отправлять GPT старый архив после новых правок.

## 5. Codex-режимы
Read-only аудит:
- Ничего не менять в коде.
- Читать `src/main.js`, launchers, docs, отчёты.
- Делать `session_summary_*.txt` с якорями, рисками и планом.

Безопасный patch task:
- Делать backup перед изменением.
- Менять только согласованный набор файлов.
- После патча делать `node --check`, потом ручной тест, потом `PATCH_REPORT.txt`.

Откат:
- Сохранять сломанную версию отдельно.
- Восстанавливать только из явного backup.
- Не чинить поверх неудачного патча, если есть clean backup.

Когда использовать Codex вместо GPT `patch.py`:
- Если GPT `patch.py` дважды падает по якорям.
- Если патч визуальный, движковый или зависит от реального update/input flow.
- Если нужен точный read-only аудит большого монолита.
- Если нужен аккуратный откат по backup без догадок.

## 6. Текущий боевой контур light_tank
Подтверждённые рабочие патчи:
- `PATCH-LT-04A` — Light Tank Combat Base
- `PATCH-LT-04B-1` — Drag Selection for Player Light Tanks
- `PATCH-LT-04B-1F` — Selection Ring Fix + Group Move
- `PATCH-LT-04B-2` — Group Attack
- `PATCH-LT-04C-1` — Attack Approach
- `PATCH-LT-04C-2` — Retarget On Kill
- `PATCH-LT-04C-2F` — Enemy Selection Lock
- `PATCH-LT-04C-CLEAN-1` — Remove Duplicate Attack Approach Block
- `PATCH-LT-04C-2H` — Tank Destination Collision Guard

Технически установлен, но требует gameplay-проверки пользователем:
- `PATCH-LT-04C-3B` — Attack-Move Thin Layer

Временный визуальный блок:
- `PATCH-LT-04C-2G / 2G-3` — selection glow / visual selection
- Работает технически, но визуально glow неидеален
- Не считать критичным блокером текущего контура

Отдельное правило:
- Старый `PATCH-LT-04C-3` откатан и больше не использовать.
- `src\main_broken_04c3.js` использовать только для анализа.
- Не копировать из `src\main_broken_04c3.js` в рабочий код.

## 7. Следующие планы
Ближайшие:
- Проверить `04C-3B` в игре.
- Если работает — зафиксировать как подтверждённый патч.
- Потом делать `PATCH-LT-04C-4` — Double Click Select Same Type.
- Потом делать `PATCH-LT-04C-5` — Enemy Faction Visuals.
- К selection glow / grounding можно вернуться позже; это не блокер.

## 8. Что отправлять GPT
Для кодовых правок:
- только `GPT_WORK_SEND_THIS_CONTEXT.zip`

Для визуальных багов:
- `GPT_WORK_SEND_THIS_CONTEXT.zip`
- плюс скрин, видео или браузерная консоль при необходимости

Для отчётов Codex:
- `PATCH_REPORT.txt`
- или `session_summary_*.txt`

Правило:
- Источник истины для GPT patch chat — только WORK-архив.

## 9. Чего не делать
- Не использовать `gpt_context_latest.zip`.
- Не патчить `src/main.js` без актуального WORK-архива.
- Не использовать старый `PATCH-LT-04C-3`.
- Не чинить поверх сломанного патча, если есть clean backup.
- Не использовать QWEN repo как источник истины для GPT patch chat.
- Не смешивать WORK и QWEN launcher/zip контуры.

## Статус документации
- Старый DOCX v3 устарел.
- DOCX-линия v3.1/v4 частично полезна как исторический контекст, но требует замены на v5.
- Актуальная текстовая база регламента теперь:
  `docs/project/four_elements_workflow_reglament_v5_20260506.md`
