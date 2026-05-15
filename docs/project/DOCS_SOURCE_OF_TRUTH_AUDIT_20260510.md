# DOCS-AUDIT-01 — Аудит source-of-truth и устаревших документов

**Дата:** 2026-05-10
**Тип:** Аудит документов (Fast lane, docs-only)
**Ветка:** sandbox/main
**Основание:** DOCS-AUDIT-01

---

## 1. Краткий итог

В проекте `glm-game-sandbox` накопилось **26+ документов** (файлы .md, .txt, .docx), включая корневые README, AGENTS, промпты, роадмапы, чекпоинты, аудит-отчёты и архив. Многие из них создавались в разные фазы проекта (Codex sprint, GLM sandbox setup, production era) и содержат частично пересекающуюся, устаревшую или прямо опасную информацию, способную ввести будущую AI-сессию в заблуждение.

**Ключевые находки:**

1. **6 CANONICAL документов** — актуальные, непротиворечивые, единственный source of truth для своей области.
2. **8 ACTIVE документов** — рабочие, но требуют понимания контекста; могут содержать встроенные чекпоинты из production-эры.
3. **7 REFERENCE документов** — исторически полезные, но не являются source of truth; содержат устаревшие детали.
4. **4 STALE / DANGEROUS_OLD документа** — содержат информацию, способную активно ввести в заблуждение (старые формулы сепаратора, старые пути, устаревшие порты, устаревшие маркеры main.js).
5. **4 ARCHIVE_CANDIDATE документа** — по смыслу уже в архиве или должны быть перемещены в `docs/project/archive/`.
6. **5 DUPLICATE_OR_OVERLAP групп** — документы с существенным пересечением контента, где основной документ поглощает второстепенный.

**Главный риск:** Будущая AI-сессия может прочитать `памятка.txt` (с устаревшей формулой сепаратора 20→10+1 вместо актуальной 15→10+1) или `NEW_CHAT_START_PROMPT.md` (с production-путями и зеркалом Google Drive) и принять устаревшие данные за source of truth.

---

## 2. Рекомендованный порядок чтения для AI-сессии

| Приоритет | Файл | Зачем читать | Что ожидать |
|-----------|------|-------------|-------------|
| 1 | `AGENTS.md` | Правила sandbox (Fast/Review lane, запрещённые действия) | Актуальные правила, базовый контекст |
| 2 | `README_GLM_SANDBOX.md` | Описание sandbox, workflow, два lane | Актуальное описание среды |
| 3 | `README.md` | Краткое описание проекта, live demo, пути | Актуальное, но минимальное |
| 4 | `docs/project/REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md` | Текущее состояние рефакторинга main.js | Актуальный чекпоинт спринта |
| 5 | `docs/project/GLM_ROADMAP_20260510.md` | Перспективный план развития (Phase 0-4) | Рекомендованный, не утверждённый |
| 6 | `docs/project/scout_unit_roadmap_20260509.md` | Статус scout unit (player done, bot pending) | Актуальный, следующий PATCH-SCOUT-04 |
| 7 | `docs/project/four_elements_bot_roadmap_merged_glm.md` | Актуальный роадмап бота (10D1→10I1) | Актуальный, содержит inline-чекпоинты |
| 8 | `PATCH_REPORT.txt` | Хронология всех патчей | Актуальный, длинный |
| 9 | `docs/prompts/PROMPT_NEW_CHAT_GLM_FOUR_ELEMENTS_SANDBOX.txt` | Промпт для новой GLM-сессии | Актуальный |

---

## 3. Canonical / Active документы

### CANONICAL (единственный source of truth для своей области)

| Файл | Область | Почему canonical | Обновлён |
|------|---------|------------------|----------|
| `AGENTS.md` | Правила sandbox | Определяет Fast/Review lane, запрещённые действия, обязательства по PATCH_REPORT. Все AI-сессии обязаны следовать | 2026-05-10 |
| `README_GLM_SANDBOX.md` | Описание sandbox | Полное описание sandbox, workflow, GLM разрешения/запреты | 2026-05-10 |
| `PATCH_REPORT.txt` | Хронология патчей | Единственный полный журнал всех изменений в sandbox. Каждая задача добавляет запись | 2026-05-10 |
| `docs/project/REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md` | Рефакторинг main.js | Итоговый чекпоинт спринта (5 кандидатов DONE), текущее состояние main.js: 11 358 строк | 2026-05-10 |
| `docs/project/scout_unit_roadmap_20260509.md` | Scout unit | Полный статус scout (player done, bot pending), следующий шаг PATCH-SCOUT-04 | 2026-05-09 |
| `src/main.js` (код) | Игровая логика | Единственный runtime source of truth. 11 358 строк после рефактор-спринта | 2026-05-10 |

### ACTIVE (рабочие документы, актуальные, но с контекстом)

| Файл | Область | Примечания | Обновлён |
|------|---------|------------|----------|
| `README.md` | Описание проекта | Краткий, содержит live demo ссылку. Ссылается на README_GLM_SANDBOX.md и AGENTS.md | 2026-05-10 |
| `docs/project/GLM_ROADMAP_20260510.md` | План развития | Рекомендованный, не утверждённый ТЗ. Phase 0-4, 34 патча. Полезен для приоритизации | 2026-05-10 |
| `docs/project/GLM_STRATEGY_REVIEW_20260510.md` | Стратегический аудит | Comprehensive обзор (17 секций). Актуален, но содержит оценки, не директивы | 2026-05-10 |
| `docs/project/GLM_FUTURE_VISION_HYPOTHESES_20260510.md` | Гипотезы развития | Авторский обзор GLM, не ТЗ. Полезен для идей, но не обязателен к исполнению | 2026-05-10 |
| `docs/project/four_elements_bot_roadmap_merged_glm.md` | Роадмап бота | Актуальный merged-роадмап (10D1→10I1). Содержит накопленные inline-чекпоинты | 2026-05-10 |
| `docs/project/four_elements_glm_parallel_branch_plan.md` | GLM-ветка | Документирует решение о параллельной GLM-ветке. Содержит позже добавленные чекпоинты | 2026-05-09 |
| `docs/prompts/PROMPT_NEW_CHAT_GLM_FOUR_ELEMENTS_SANDBOX.txt` | Промпт GLM | Активный промпт для новых GLM-сессий в sandbox | 2026-05-10 |
| `docs/prompts/PROMPT_NEW_CHAT_GPT_FOUR_ELEMENTS_GLM_FIRST.txt` | Промпт GPT | Активный промпт для GPT-сессий (GLM-first workflow) | 2026-05-10 |

---

## 4. Reference документы

| Файл | Область | Почему reference, не canonical | Обновлён |
|------|---------|-------------------------------|----------|
| `docs/project/REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md` | Аудит main.js | Все 5 кандидатов уже DONE (REF-MAIN-GLM-02→06). Полезен как historical record и как шаблон для будущих extraction-кандидатов | 2026-05-10 |
| `docs/project/MAIN_REFACTOR_CODEX_HANDOFF_20260510.md` | План рефакторинга | Подробный аудит main.js для Codex, но Codex REFACTOR-MAIN-01/02 НЕ принят. Используется только как lessons/reference | 2026-05-10 |
| `docs/project/glm_useful_findings_for_work_20260509.md` | GLM-находки | Записывает, какие GLM-идеи уже покрыты в WORK. Полезен для контекста, но не является планом действий | 2026-05-09 |
| `docs/project/codex_sprint_closeout_20260509.md` | Codex sprint | Итоги Codex sprint (10F1, 10G1, 10H1, 10I1). Полезен для понимания, что делал Codex | 2026-05-09 |
| `docs/project/four_elements_bot_checkpoint_10I2_codex_sprint.md` | Чекпоинт бота | Самый полный чекпоинт бота, но частично перекрыт later-чекпоинтами | 2026-05-09 |
| `docs/project/ashen_crown_ai_audit_for_four_elements.md` | AI-аудит Ashen Crown | Аудит чужого проекта для архитектурных идей. Принципы уже интегрированы в 08A→08B | 2026-05-08 |
| `docs/project/GHPAGES_AUDIT_REPORT.md` | GitHub Pages | Аудит GHPAGES-01, подтверждает работоспособность. `.nojekyll` добавлен в GHPAGES-02 | 2026-05-09 |

---

## 5. Stale / Dangerous old документы

| Файл | Проблема | Опасность |
|------|----------|-----------|
| `docs/project/NEW_CHAT_START_PROMPT.md` | Содержит **production-пути** (`C:\Users\Den\Desktop\four elements\four_elements_core_base`), Google Drive mirror ссылки, устаревшие чекпоинты (PATCH-08B3), устаревшие роадмапы, отсутствует sandbox-контекст | **ВЫСОКАЯ** — AI-сессия может принять production-пути за sandbox-пути и начать работу в неправильной папке. Содержит формулы экономики, которые могут быть устаревшими |
| `docs/project/памятка.txt` | Содержит **устаревшую формулу сепаратора** (20→10+1 вместо актуальной 15→10+1), старые production-пути (v03), старый порт (8000 вместо 8010), устаревший план рефакторинга main.js | **ВЫСОКАЯ** — устаревшая формула сепаратора может привести к неверным решениям по экономике. Production-пути вводят в заблуждение |
| `THIS_IS_WORK_PROJECT.txt` | Маркер production-проекта (не sandbox). Перечисляет устаревшие маркеры main.js (FE_LT_04A, 04B1 — ранние combat-патчи), не упоминает bot/scout/economy патчи | **СРЕДНЯЯ** — может создать путаницу: это sandbox, а не WORK. Маркеры устарели |
| `docs/project/four_elements_bot_checkpoint_10E2.md` | Ранний чекпоинт (10D1, 10E1). Частично перекрыт 10H2 и 10I2 чекпоинтами. Содержит inline-чекпоинты 10E3→10E5, которые дублируют `four_elements_glm_parallel_branch_plan.md` | **НИЗКАЯ-СРЕДНЯЯ** — не опасен, но создаёт путаницу: какой чекпоинт актуальный? |

---

## 6. Archive кандидаты

| Файл | Причина для архива | Текущее расположение |
|------|--------------------|-----------------------|
| `docs/project/archive/four_elements_workflow_reglament_v5_20260506.md` | Уже в архиве. Устаревшая v5 регламента (ссылается на v03 WORK folder, порт 8000) | `docs/project/archive/` ✅ |
| `docs/project/codex_limit_sprint_20260509_20260510.md` | Sprint window истёк (9-10 мая 2026). Временный документ, более не актуален | `docs/project/` — предложить перемещение в `archive/` |
| `docs/project/four_elements_bot_checkpoint_10H2.md` | Перекрыт более полным `four_elements_bot_checkpoint_10I2_codex_sprint.md`. Inline-чекпоинты дублируют другие документы | `docs/project/` — предложить перемещение в `archive/` |
| `docs/project/four_elements_bot_checkpoint_10E2.md` | Перекрыт 10H2 и 10I2. Самый ранний из трёх чекпоинтов бота | `docs/project/` — предложить перемещение в `archive/` |
| `docs/project/four_elements_patch_roadmap_actual.docx` | Бинарный формат (.docx), невозможно прочитать в CLI. Вероятно, устарел относительно .md-версии | `docs/project/` — предложить перемещение в `archive/` |
| `docs/project/patch_08a_bot_behavior_mvp_audit.md` | Аудит PATCH-08A, уже выполнен и принят (08B тоже выполнен). Историческая ценность, не actionable | `docs/project/` — предложить перемещение в `archive/` |
| `docs/project/PLAYWRIGHT_VISUAL_SCENARIOS.md` | Короткий справочник по Playwright-командам. Информация тривиальна и доступна в самом BAT-файле | `docs/project/` — низкий приоритет архива |
| `docs/project/playwright_codegen_routes.md` | Короткий справочник по Playwright codegen. Аналогично — тривиальная информация | `docs/project/` — низкий приоритет архива |

---

## 7. Duplicate / Overlap документы

| Группа | Основной документ | Дублирующий | Пересечение | Рекомендация |
|--------|-------------------|-------------|-------------|--------------|
| **Регламент + роадмап** | `four_elements_workflow_reglament.md` | `four_elements_patch_roadmap_actual.md` | Оба содержат inline-чекпоинты 09B0→10E7, информацию о текущем состоянии бота, economy chain, rejected routes | Regламент — canonical для workflow, роадмап — canonical для patch-последовательности. Но inline-чекпоинты дублируются. Рекомендация: вынести чекпоинты в отдельный файл `docs/project/CHECKPOINTS.md` |
| **Бот-чекпоинты** | `four_elements_bot_checkpoint_10I2_codex_sprint.md` | `four_elements_bot_checkpoint_10H2.md`, `four_elements_bot_checkpoint_10E2.md` | Все три содержат частично пересекающиеся чекпоинты. 10I2 — самый полный | 10E2 и 10H2 → archive. 10I2 оставить как актуальный |
| **Рефакторинг main.js** | `REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md` | `REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md`, `MAIN_REFACTOR_CODEX_HANDOFF_20260510.md` | Все три описывают рефакторинг main.js. 07 — итоговый чекпоинт, 01 — исторический аудит (все DONE), Codex handoff — lessons from failed Codex attempt | 07 — canonical. 01 и Codex handoff — reference. Не дублировать |
| **GLM-планирование** | `four_elements_glm_parallel_branch_plan.md` | `GLM_SESSION_CONTEXT.md` | Оба описывают GLM-ветку, mapping GLM→WORK, текущий роадмап бота | GLM_SESSION_CONTEXT — краткая выжимка, parallel_branch_plan — полный документ. Оставить оба, но SESSION_CONTEXT должен ссылаться на parallel_branch_plan |
| **Промпты** | `PROMPT_NEW_CHAT_GLM_FOUR_ELEMENTS_SANDBOX.txt` | `PROMPT_NEW_CHAT_GPT_FOUR_ELEMENTS_GLM_FIRST.txt` | Оба определяют Fast/Review lane, правила, merge checklist. GLM-промпт — для GLM-агента, GPT-промпт — для GPT-сессий | Оба актуальны, но для разных аудиторий. Поддерживать синхронность при обновлениях |

---

## 8. Предлагаемая структура документов

### Текущее состояние (26+ файлов, частичный хаос)

```
docs/
  codex/                          # Codex ярлык
  prompts/                        # 2 промпта (актуальны)
  project/
    NEW_CHAT_START_PROMPT.md      # ⚠️ DANGEROUS_OLD — production-пути
    памятка.txt                   # ⚠️ DANGEROUS_OLD — устаревшие формулы
    four_elements_workflow_reglament.md   # ACTIVE, но содержит 1400 строк inline-чекпоинтов
    four_elements_patch_roadmap_actual.md # ACTIVE, но дублирует чекпоинты регламента
    four_elements_patch_roadmap_actual.docx # ARCHIVE_CANDIDATE
    ... (ещё ~18 файлов)
    archive/
      four_elements_workflow_reglament_v5_20260506.md  # Уже в архиве
```

### Предлагаемая структура (после DOCS-CLEANUP-01)

```
docs/
  codex/                          # Без изменений
  prompts/                        # Без изменений (2 актуальных промпта)
  project/
    # === CANONICAL (читать первыми) ===
    AGENTS.md -> ../../AGENTS.md  # Символическая ссылка или дублирование не нужно — файл в корне
    # NOTE: AGENTS.md, README_GLM_SANDBOX.md, README.md — в корне repo
    
    # === АКТИВНЫЕ РОАДМАПЫ ===
    GLM_ROADMAP_20260510.md                      # Перспективный план
    scout_unit_roadmap_20260509.md                # Scout unit
    four_elements_bot_roadmap_merged_glm.md       # Bot AI roadmap
    four_elements_workflow_reglament.md            # Workflow регламент (canonical для workflow)
    four_elements_patch_roadmap_actual.md          # Patch roadmap (canonical для последовательности)
    
    # === АКТИВНЫЕ ЧЕКПОИНТЫ ===
    REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md # Рефакторинг main.js
    four_elements_bot_checkpoint_10I2_codex_sprint.md # Bot (актуальный)
    
    # === СТРАТЕГИЧЕСКИЕ ОБЗОРЫ ===
    GLM_STRATEGY_REVIEW_20260510.md
    GLM_FUTURE_VISION_HYPOTHESES_20260510.md
    four_elements_glm_parallel_branch_plan.md
    
    # === REFERENCE ===
    REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md
    MAIN_REFACTOR_CODEX_HANDOFF_20260510.md
    glm_useful_findings_for_work_20260509.md
    codex_sprint_closeout_20260509.md
    ashen_crown_ai_audit_for_four_elements.md
    GHPAGES_AUDIT_REPORT.md
    
    # === ПРЕДУПРЕЖДЕНИЯ (старые, опасные документы) ===
    # DOCS-CLEANUP-01 должен добавить WARNING-заголовок или переместить в archive/
    
    # === ARCHIVE ===
    archive/
      four_elements_workflow_reglament_v5_20260506.md  # Уже здесь
      codex_limit_sprint_20260509_20260510.md          # Переместить
      four_elements_bot_checkpoint_10E2.md              # Переместить
      four_elements_bot_checkpoint_10H2.md              # Переместить
      four_elements_patch_roadmap_actual.docx            # Переместить
      patch_08a_bot_behavior_mvp_audit.md                # Переместить
      NEW_CHAT_START_PROMPT.md                           # Переместить (DANGEROUS_OLD)
      памятка.txt                                        # Переместить (DANGEROUS_OLD)
      THIS_IS_WORK_PROJECT.txt -> ../../archive/         # Переместить из корня
```

### Ключевые изменения

1. **DANGEROUS_OLD документы** (`NEW_CHAT_START_PROMPT.md`, `памятка.txt`) → перемещены в `archive/` с WARNING-заголовком в начале файла.
2. **Устаревшие чекпоинты бота** (10E2, 10H2) → перемещены в `archive/`, оставлен только 10I2.
3. **Истёкший sprint-документ** (`codex_limit_sprint_20260509_20260510.md`) → перемещён в `archive/`.
4. **Бинарный .docx** → перемещён в `archive/`.
5. **Завершённый аудит** (`patch_08a_bot_behavior_mvp_audit.md`) → перемещён в `archive/`.
6. **`THIS_IS_WORK_PROJECT.txt`** → перемещён из корня в `archive/` (это production-маркер, не sandbox).

---

## 9. Рекомендованная следующая задача: DOCS-CLEANUP-01

### Описание

Выполнить физическую реорганизацию документов в соответствии с данным аудитом. Это docs-only задача, не затрагивающая код.

### Скоуп

| Действие | Файлы | Lane |
|----------|-------|------|
| Переместить в `archive/` | `NEW_CHAT_START_PROMPT.md`, `памятка.txt`, `codex_limit_sprint_20260509_20260510.md`, `four_elements_bot_checkpoint_10E2.md`, `four_elements_bot_checkpoint_10H2.md`, `four_elements_patch_roadmap_actual.docx`, `patch_08a_bot_behavior_mvp_audit.md` | Fast |
| Переместить из корня в `archive/` | `THIS_IS_WORK_PROJECT.txt` | Fast |
| Добавить WARNING-заголовок | Файлы, перемещённые в `archive/` с пометкой DANGEROUS_OLD | Fast |
| Обновить ссылки | Проверить, что ни один активный документ не ссылается на перемещённые файлы по старым путям | Fast |
| Обновить PATCH_REPORT.txt | Запись DOCS-CLEANUP-01 | Fast |

### Что НЕ делать в DOCS-CLEANUP-01

- Не удалять файлы — только перемещать в `archive/`
- Не изменять содержание документов (кроме WARNING-заголовков)
- Не трогать код, ассеты, index.html
- Не создавать новые документы (кроме WARNING-заголовков)
- Не объединять регламент и роадмап — это отдельная задача

### Риск

- **НИЗКИЙ** — перемещение файлов не влияет на runtime игры
- **МИНИМАЛЬНЫЙ** риск сломанных ссылок — нужно проверить перекрёстные ссылки между документами
- **ОТКАТ** тривиален — `git revert` восстанавливает все перемещения

### Проверки

- `node --check src/main.js` — PASS (smoke only, код не менялся)
- `git diff --name-only` — только перемещённые файлы и PATCH_REPORT.txt
- Ручная проверка: ни один активный документ не ссылается на перемещённые файлы

---

## Приложение А. Полная классификация всех документов

| # | Файл | Класс | Область | Обоснование |
|---|------|-------|---------|-------------|
| 1 | `AGENTS.md` | CANONICAL | Правила sandbox | Единственный source of truth для Fast/Review lane |
| 2 | `README.md` | CANONICAL | Описание проекта | Краткое описание + live demo |
| 3 | `README_GLM_SANDBOX.md` | CANONICAL | Описание sandbox | Полное описание sandbox workflow |
| 4 | `PATCH_REPORT.txt` | CANONICAL | Хронология патчей | Полный журнал изменений |
| 5 | `docs/project/REF_MAIN_GLM_07_REFACTOR_SPRINT_CHECKPOINT.md` | CANONICAL | Рефакторинг | Итоговый чекпоинт спринта |
| 6 | `docs/project/scout_unit_roadmap_20260509.md` | CANONICAL | Scout unit | Полный статус scout |
| 7 | `docs/project/GLM_ROADMAP_20260510.md` | ACTIVE | План развития | Рекомендованный роадмап |
| 8 | `docs/project/GLM_STRATEGY_REVIEW_20260510.md` | ACTIVE | Стратегический аудит | Comprehensive обзор |
| 9 | `docs/project/GLM_FUTURE_VISION_HYPOTHESES_20260510.md` | ACTIVE | Гипотезы | Авторский обзор будущего |
| 10 | `docs/project/four_elements_bot_roadmap_merged_glm.md` | ACTIVE | Bot roadmap | Merged bot roadmap |
| 11 | `docs/project/four_elements_glm_parallel_branch_plan.md` | ACTIVE | GLM-ветка | Решение о параллельной ветке |
| 12 | `docs/project/four_elements_workflow_reglament.md` | ACTIVE | Workflow регламент | Canonical для workflow, но длинный |
| 13 | `docs/project/four_elements_patch_roadmap_actual.md` | ACTIVE | Patch roadmap | Canonical для последовательности |
| 14 | `docs/prompts/PROMPT_NEW_CHAT_GLM_FOUR_ELEMENTS_SANDBOX.txt` | ACTIVE | GLM промпт | Активный промпт |
| 15 | `docs/prompts/PROMPT_NEW_CHAT_GPT_FOUR_ELEMENTS_GLM_FIRST.txt` | ACTIVE | GPT промпт | Активный промпт |
| 16 | `docs/project/REF_MAIN_GLM_01_MICRO_REFACTOR_CANDIDATES.md` | REFERENCE | Аудит main.js | Исторический, все DONE |
| 17 | `docs/project/MAIN_REFACTOR_CODEX_HANDOFF_20260510.md` | REFERENCE | Codex handoff | Lessons from failed Codex attempt |
| 18 | `docs/project/glm_useful_findings_for_work_20260509.md` | REFERENCE | GLM-находки | Контекст, не план действий |
| 19 | `docs/project/codex_sprint_closeout_20260509.md` | REFERENCE | Codex sprint | Итоги спринта |
| 20 | `docs/project/four_elements_bot_checkpoint_10I2_codex_sprint.md` | REFERENCE | Bot чекпоинт | Самый полный, но reference |
| 21 | `docs/project/ashen_crown_ai_audit_for_four_elements.md` | REFERENCE | AI-аудит | Принципы уже интегрированы |
| 22 | `docs/project/GHPAGES_AUDIT_REPORT.md` | REFERENCE | GitHub Pages | Аудит, .nojekyll добавлен |
| 23 | `docs/project/NEW_CHAT_START_PROMPT.md` | DANGEROUS_OLD | Production промпт | Production-пути, устаревшие данные |
| 24 | `docs/project/памятка.txt` | DANGEROUS_OLD | Памятка | Устаревшая формула сепаратора, production-пути |
| 25 | `THIS_IS_WORK_PROJECT.txt` | DANGEROUS_OLD | Маркер | Production-маркер, не sandbox |
| 26 | `docs/project/four_elements_bot_checkpoint_10E2.md` | STALE | Bot чекпоинт | Перекрыт 10I2 |
| 27 | `docs/project/four_elements_bot_checkpoint_10H2.md` | STALE | Bot чекпоинт | Перекрыт 10I2 |
| 28 | `docs/project/codex_limit_sprint_20260509_20260510.md` | ARCHIVE_CANDIDATE | Codex sprint | Sprint window истёк |
| 29 | `docs/project/four_elements_patch_roadmap_actual.docx` | ARCHIVE_CANDIDATE | Roadmap (.docx) | Бинарный, вероятно устарел |
| 30 | `docs/project/patch_08a_bot_behavior_mvp_audit.md` | ARCHIVE_CANDIDATE | Аудит 08A | Завершён, не actionable |
| 31 | `docs/project/archive/four_elements_workflow_reglament_v5_20260506.md` | ARCHIVE | Регламент v5 | Уже в архиве |
| 32 | `docs/project/PLAYWRIGHT_VISUAL_SCENARIOS.md` | ARCHIVE_CANDIDATE | Playwright | Тривиальная информация |
| 33 | `docs/project/playwright_codegen_routes.md` | ARCHIVE_CANDIDATE | Playwright codegen | Тривиальная информация |
| 34 | `docs/project/project_structure.md` | STALE | Структура проекта | Частично устарел (старые BAT-имена) |
| 35 | `docs/project/reglament_local_tools_addendum.md` | STALE | Инструменты | Частично устарел (старые BAT-имена) |
| 36 | `docs/project/last_update.txt` | REFERENCE | Timestamp | `PATCH-10E7-DOCS-SCOUT-UNIT-ROADMAP-PRIORITY, 2026-05-09` |
| 37 | `docs/codex/Open_Codex_Chat.lnk` | ARCHIVE_CANDIDATE | Codex ярлык | Windows ярлык, не нужен в sandbox |
