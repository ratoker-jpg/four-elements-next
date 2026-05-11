# GLM PATCH WORKFLOW RULES — двухшаговый режим и размер патчей

**Дата:** 2026-05-11
**Тип:** workflow / guardrails
**Lane:** Fast
**Назначение:** зафиксировать правила постановки задач GLM, чтобы не закапываться в слишком мелких патчах и не запускать рискованные правки без предварительного аудита.

---

## 1. Главный принцип

GLM работает не в режиме «сразу делай», а в двухшаговом режиме:

```text
Фаза 1 — анализ / аудит / план
Фаза 2 — реализация патча только после явного подтверждения пользователя
```

Нельзя начинать кодовые изменения сразу после получения задачи, если задача относится к gameplay/code/AI/logic.

---

## 2. Обязательный старт каждого GLM-промпта

Каждый промпт для GLM по проекту должен начинаться с блока:

```text
Перед началом:
1. Прочитай AGENTS.md.
2. Прочитай docs/project/AI_READ_FIRST.md.
3. Прочитай docs/patches/INDEX.md (последние 5-10 патчей для контекста).
4. Для задач по боту/скауту дополнительно прочитай последние DOCS_SYNC_* checkpoint-файлы.
5. Работай строго в двух фазах:
   - Фаза 1: аудит, root cause, точки изменения, риски, expected touched files, что НЕ трогаешь.
   - Фаза 2: реализация только после моего явного сообщения «Делай».
```

Если GLM не сделал Фазу 1, задачу считать поставленной неправильно и не принимать патч.

---

## 3. Что должна содержать Фаза 1

GLM обязан вернуть анализ до написания кода:

```text
Фаза 1 — Анализ

1. Root cause / цель изменения.
2. Какие функции/файлы будут затронуты.
3. Какие функции/файлы НЕ будут затронуты.
4. Риск: Low / Medium / High.
5. Почему выбран такой размер патча.
6. План реализации по шагам.
7. Telemetry / debug checks, если нужны.
8. Manual test plan.
9. Ожидание подтверждения: «Жду "Делай"».
```

После Фазы 1 пользователь отправляет анализ в GPT-аудит. Только после подтверждения можно писать «Делай».

---

## 4. Размеры патчей

Не нужно дробить всё до микропатчей. Размер выбирается по риску и единству смысла.

### Small patch

Использовать, когда:

- один симптом;
- одна функция или близкий участок;
- низкий риск;
- простой smoke-test;
- легко откатить.

Примеры:

```text
- поправить telemetry
- изменить один cap / один visual offset
- убрать dead branch
```

---

### Medium patch

Использовать по умолчанию для связанных gameplay-правок.

Можно объединять 2–3 low-risk изменения, если они:

- относятся к одному gameplay-смыслу;
- имеют общий manual test;
- трогают близкие функции;
- не смешивают movement/pathfinding/combat/brain в один комбайн;
- не требуют отдельного отката по каждому пункту.

Пример допустимого объединения:

```text
BOT-SCOUT-02A — scout combat interaction + early scout policy

В одном патче:
1. enemy scout targetable / killable by player combat units;
2. scout сам не атакует;
3. enemy early scout soft target = 1;
4. enemy hard cap = 2 остаётся;
5. второй scout разрешён позже.
```

Это один gameplay-смысл: нормализовать scout-поведение в 1v1.

---

### Large patch

Использовать редко и только после отдельного аудита.

Large patch допустим, когда вводится новая полноценная подсистема:

```text
- state machine;
- новый bot brain layer;
- observe/return/cooldown lifecycle;
- difficulty system;
- многофайловая архитектурная правка.
```

Large patch почти всегда Review lane и требует особенно чёткой Фазы 1.

---

## 5. Когда объединять задачи

Объединять можно, если все условия true:

```text
1. Один пользовательский смысл.
2. Один smoke-test.
3. Риск Low или нижний Medium.
4. Изменения рядом в коде.
5. При падении понятно, где искать.
6. Нет смешения разных подсистем.
```

Примеры нормального объединения:

```text
- scout targetable + scout не атакует + enemy second scout later
- difficulty easy/normal/hard config + telemetry display
- wave minimum + no one-tank suicide
```

---

## 6. Когда НЕ объединять задачи

Не объединять, если патч одновременно трогает:

```text
- movement + combat + bot brain;
- pathfinding internals + gameplay decision;
- attack-chain + scout lifecycle;
- economy formulas + battle behavior;
- save/load + gameplay;
- render/fog + AI logic.
```

Также не объединять, если:

```text
- нужна новая state machine;
- высокий риск регрессии;
- тесты разные;
- откат одного пункта должен быть независимым;
- уже было 2 неудачных фикса той же проблемы.
```

После двух неудачных фиксов одной проблемы — остановиться, сделать аудит, сменить подход.

---

## 7. Lane selection

### Fast lane

Можно direct push в `sandbox/main`:

```text
- docs;
- prompts;
- docs/patches/;
- docs/glm_exchange/;
- roadmap/checkpoint;
- текстовые правки без gameplay logic.
```

### Review lane

Обязателен branch + PR:

```text
- src/main.js;
- src/config;
- src/core;
- gameplay;
- bot logic;
- combat;
- pathfinding;
- economy;
- save/load;
- assets;
- многофайловые code changes.
```

Если сомневаешься — Review lane.

---

## 8. GLM output после реализации

### 8.1. PR description (полный)

GLM пишет полный PR description при создании PR. PR description содержит:

```text
- Lane
- Root cause / Problem
- What changed
- What was NOT touched
- Telemetry (новые поля)
- Checks (node --check)
- Manual test plan
- Known risks / next step
```

### 8.2. CODE_SUMMARY (короткий, в чат)

После создания PR GLM выводит в чат только CODE_SUMMARY:

```text
CODE_SUMMARY <TASK_ID>
  Branch: <branch name>
  PR: #<number>
  SHA: <short SHA>
  Files: <changed files, comma-separated>
  Checks: <node --check result>
```

Пример:

```text
CODE_SUMMARY BOT-ATTACK-12A
  Branch: glm/bot-attack-12a-assignable-tank-count
  PR: #50
  SHA: 4ff58d3
  Files: src/main.js
  Checks: node --check PASS
```

GLM НЕ обновляет PATCH_REPORT.txt, roadmap, или docs/patches/.

---

## 9. GPT documentation update (после merge PR)

После merge PR GPT выполняет documentation update (Fast lane):

1. Создать `docs/patches/{TASK_ID}.md` — полный patch report на основе PR diff + PR description.
2. Добавить строку в `docs/patches/INDEX.md`.
3. Обновить roadmap файлы: отметить ✅ + PR number.
4. Обновить `docs/project/AI_READ_FIRST.md` — только если изменились правила или source of truth.

Все эти изменения — Fast lane, direct push в sandbox/main.

---

## 10. Правило для GPT-аудита

Перед командой «Делай» анализ GLM должен быть проверен GPT-аудитом.

GPT-аудит отвечает по структуре:

```text
1. Что в анализе ок.
2. Что вызывает сомнения.
3. Как сделать лучше / что добавить в промпт.
4. Вердикт: можно делать / сузить scope / остановить.
```

Цель: ускоряться через Medium patches, но не терять контроль.

---

## 11. GLM / GPT responsibility split

| Responsibility | GLM | GPT |
|---------------|-----|-----|
| Фаза 1 аудит | ✅ | ❌ |
| Код + node --check | ✅ | ❌ |
| Branch + commit + push + PR | ✅ | ❌ |
| PR description (полный) | ✅ | ❌ |
| CODE_SUMMARY в чат | ✅ | ❌ |
| `docs/patches/{TASK_ID}.md` | ❌ | ✅ |
| `docs/patches/INDEX.md` update | ❌ | ✅ |
| Roadmap updates (✅ + PR#) | ❌ | ✅ |
| AI_READ_FIRST.md update | ❌ | ✅ (только при изменении правил/SoT) |
| `docs/glm_exchange/PROMPT_TO_GLM.md` | ❌ | ✅ |
| `docs/glm_exchange/AUDIT_FROM_GLM.md` | ✅ | ❌ |
| `docs/glm_exchange/GPT_REVIEW.md` | ❌ | ✅ |
| `docs/glm_exchange/PHASE2_COMMAND.md` | ❌ | ✅ |
| `docs/glm_exchange/CODE_SUMMARY.md` | ✅ | ❌ |
| `docs/glm_exchange/PR_REVIEW.md` | ❌ | ✅ |

---

## 12. PATCH_REPORT.txt — заморожен

`PATCH_REPORT.txt` в корне репозитория заморожен (статус: FROZEN / ARCHIVED).
Новые записи туда не добавляются.
Актуальные patch reports: `docs/patches/{TASK_ID}.md`.
Индекс: `docs/patches/INDEX.md`.

---

## 13. GLM Exchange — file-based handoff

Для обмена между GPT и GLM можно использовать фиксированные файлы:

```text
docs/glm_exchange/CURRENT_TASK.md
docs/glm_exchange/PROMPT_TO_GLM.md
docs/glm_exchange/AUDIT_FROM_GLM.md
docs/glm_exchange/GPT_REVIEW.md
docs/glm_exchange/PHASE2_COMMAND.md
docs/glm_exchange/CODE_SUMMARY.md
docs/glm_exchange/PR_REVIEW.md
docs/glm_exchange/SESSION_LOG.md
```

Правила:

```text
1. Не создавать per-task подпапки.
2. Не плодить новые exchange-файлы под каждую задачу.
3. Все current-файлы полностью перезаписываются под текущую задачу.
4. SESSION_LOG.md хранит только последние 5 handoff-записей.
5. Результат Phase 1 GLM пишет только в AUDIT_FROM_GLM.md и ждёт команду «Делай».
6. Если GPT_REVIEW.md не содержит Verdict: APPROVED_FOR_PHASE_2, GLM не пишет код.
7. После Phase 2 GLM пишет CODE_SUMMARY.md и ждёт GPT PR review.
```

Полный сценарий и точные команды лежат в:

```text
docs/glm_exchange/README.md
```

---

## 14. Текущий вывод для bot/scout work

Для дальнейшей работы по боту предпочтительный формат:

```text
60% Medium patches
30% Small hotfixes
10% docs/checkpoints
```

Не закапываться в микропатчи, если 2–3 low-risk задачи образуют один цельный gameplay-блок.

Но не превращать Medium patch в большой комбайн из разных подсистем.
