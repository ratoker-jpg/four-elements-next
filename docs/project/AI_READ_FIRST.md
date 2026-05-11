# AI_READ_FIRST — Four Elements / GLM sandbox

**Дата создания:** 2026-05-10
**Обновлено:** 2026-05-12 (DOCS-ARCH-00)
**Назначение:** Точка входа для новой AI-сессии. Прочитай этот файл первым.

---

## 1. Что читать первым

Рекомендованный порядок чтения для новой AI-сессии:

| Приоритет | Файл | Зачем читать |
|-----------|------|-------------|
| 1 | `AGENTS.md` | Правила sandbox: Fast/Review lane, Architecture Migration Mode, запрещённые действия |
| 2 | `docs/project/ARCHITECTURE_TARGET.md` | **Целевая архитектура и Architecture Migration Mode** — обязательное чтение перед любой gameplay/AI задачей |
| 3 | `docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md` | Patch workflow (legacy) + Architecture Migration Gate |
| 4 | `README_GLM_SANDBOX.md` | Описание sandbox, workflow, GLM разрешения/запреты |
| 5 | `docs/project/REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md` | История рефакторинга main.js |
| 6 | `docs/project/DOCS_SOURCE_OF_TRUTH_AUDIT_20260510.md` | Классификация всех документов по актуальности |
| 7 | `docs/project/GLM_ROADMAP_20260510.md` | Перспективный план развития (Phase 0-4) |
| 8 | `docs/project/four_elements_bot_roadmap_merged_glm.md` | Актуальный роадмап бота |
| 9 | `docs/prompts/PROMPT_NEW_CHAT_GLM_FOUR_ELEMENTS_SANDBOX.txt` | Промпт для новой GLM-сессии |

---

## 2. Source of truth

| Что | Где | Статус |
|-----|-----|--------|
| Репозиторий | https://github.com/ratoker-jpg/glm-game-sandbox | Единственный source of truth |
| Ветка | `sandbox/main` | Основная ветка проекта |
| GitHub Pages | https://ratoker-jpg.github.io/glm-game-sandbox/ | Актуальная демо-сборка |
| Локальный запуск | `http://localhost:8010/index.html` (подтверждено README_GLM_SANDBOX.md) | Для локальной разработки |
| Codex failed snapshots | `_gpt_state/`, `_inbox/` | НЕ source of truth. Только исторический контекст |
| Production WORK | `C:\Users\Den\Desktop\four elements\four_elements_core_base` | НЕ sandbox. Не использовать как актуальный |
| Production v03 | `four_elements_core_base_v03` | Только fallback/архив |

---

## 3. Что НЕ читать как актуальное

Следующие источники содержат устаревшую или опасную информацию. Не принимать их данные за source of truth:

- **`docs/archive/*`** — все файлы в архиве. Содержат WARNING-заголовки.
- **`docs/archive/dangerous_old/NEW_CHAT_START_PROMPT.md`** — production-пути, Google Drive mirror, устаревшие чекпоинты (PATCH-08B3).
- **`docs/archive/dangerous_old/памятка.txt`** — **устаревшая формула сепаратора** (20->10+1 вместо актуальной 15->10+1), устаревший порт (8000), production-пути v03.
- **`docs/archive/dangerous_old/THIS_IS_WORK_PROJECT.txt`** — маркер production-проекта, не sandbox.
- **Старые промпты** — production-era промпты, не адаптированные для sandbox.
- **Старые Codex sprint-документы** — sprint window истёк, временные документы.
- **Старые чекпоинты бота** (10E2, 10H2) — перекрыты актуальным 10I2.
- **Документы с WARNING-заголовком** — любой файл, начинающийся с блока `> ⚠️ ARCHIVED`.

---

## 4. Текущие правила разработки

### Лейны

| Лейн | Что | Ветка | PR |
|------|-----|-------|-----|
| **Fast lane** | docs, prompts, PATCH_REPORT, текстовые правки без логики | direct push в `sandbox/main` | Не нужен |
| **Review lane** | src/main.js, src/core, src/config, assets, gameplay, экономика, combat, pathfinding, save/load, многофайловые изменения | feature branch от `sandbox/main` | Обязателен |

Если не уверены — default Review lane.

**Architecture Migration Gate**: для non-trivial gameplay/AI/refactor задач — Architecture Migration Mode. Patch mode = только emergency/small fixes или thin bridge/wiring.

### Принципы

- **Architecture Migration First** — для нетривиальных gameplay/AI/refactor задач сначала определить целевую систему, не добавлять очередную patch-chain в main.js. См. `docs/project/ARCHITECTURE_TARGET.md`
- **GLM-first** — GLM является основным AI-ассистентом для sandbox
- **Self-review gate** — перед выполнением задачи оценить риски промпта
- **Module-first** — новые сущности выносить в отдельные модули (window.FE_*), не раздувать main.js
- **Patch workflow = legacy/small-fix** — patch accumulation больше не основной режим для non-trivial работы
- **Отчёты на русском** — все пользовательские отчёты, PATCH_REPORT-записи, audit-документы писать на русском
- **Не удалять файлы** — перемещать в docs/archive/ с WARNING-заголовком
- **Codex failed snapshots НЕ source of truth** — только как lessons/reference

### Architecture Migration Gate

Перед любой gameplay/AI/refactor задачей GLM должен ответить:

1. Какая система владеет поведением?
2. Существует ли эта система?
3. Нужен ли новый модуль?
4. Что должно остаться в main.js только как wiring/bridge?
5. Какой старый код будет заменён?
6. Какой старый код можно удалить позже?
7. Не создаёт ли задача новый patch-chain?

Если задача увеличивает main.js, GLM обязан объяснить, почему это временно и какой follow-up перенесёт код в модуль.

### Ключевые формулы

- Сепаратор: **15 сырых минералов -> 10 энергии + 1 элемент фракции** (НЕ 20->10+1 из архивных документов)
- main.js: текущий размер брать из `git log` / `wc -l`, не из старых checkpoint-значений (устаревают после каждого патча)
- Текущий статус Four Elements брать из GitHub docs/checkpoints/PR reports; старые Google skills считать routing/reference, если они противоречат GitHub

---

## 5. Где смотреть историю

| Что | Где |
|-----|-----|
| Хронология патчей | `PATCH_REPORT.txt` |
| Архивные документы | `docs/archive/` (с WARNING-заголовками) |
| Аудит документов | `docs/project/DOCS_SOURCE_OF_TRUTH_AUDIT_20260510.md` |
| Git history | `git log --oneline sandbox/main` |
