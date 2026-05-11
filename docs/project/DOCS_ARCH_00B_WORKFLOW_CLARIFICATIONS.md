# DOCS-ARCH-00B — Workflow rule clarifications

**Дата:** 2026-05-12  
**Тип:** docs / workflow clarification  
**Статус:** Active clarification  
**Назначение:** снять противоречия после DOCS-ARCH-00 между Fast lane, Architecture Migration Mode и правилами обновления `docs/patches`.

---

## 1. Приоритет правил

Если документы дают разные трактовки workflow, использовать такой порядок:

```text
AGENTS.md
→ docs/project/AI_READ_FIRST.md
→ docs/project/ARCHITECTURE_TARGET.md
→ этот clarification-файл
→ docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md
→ старые roadmap/checkpoint/docs
```

Старые Google Drive skills и production-era документы являются routing/reference, если они противоречат GitHub `sandbox/main`.

---

## 2. Fast lane vs PR

Обычные docs-only задачи остаются Fast lane и могут идти direct push в `sandbox/main`:

```text
README
prompts
docs/glm_exchange
docs/patches для обычного patch report
простые текстовые правки без изменения правил проекта
```

Но docs-only задачи должны идти через branch + PR, если они меняют правила проекта:

```text
AGENTS.md
AI_READ_FIRST.md
ARCHITECTURE_TARGET.md
GLM_PATCH_WORKFLOW_RULES_20260511.md
workflow/lane/architecture rules
source-of-truth rules
```

Короткое правило:

```text
обычные docs → Fast lane direct push
rules/architecture docs → branch + PR
```

---

## 3. Кто обновляет docs/patches

Для code/gameplay/refactor PR:

```text
GLM не обновляет docs/patches.
GPT после merge создаёт docs/patches/{TASK_ID}.md и обновляет INDEX.md.
```

Для docs-only workflow/rules PR:

```text
GLM или GPT может создать/обновить docs/patches, если это явно указано в задаче.
```

Причина: rules-docs PR сам является документационной задачей, поэтому patch report может быть частью того же docs PR.

---

## 4. Patch mode после DOCS-ARCH-00

Patch mode не запрещён полностью. Он разрешён для:

```text
small fix
emergency hotfix
thin bridge/wiring
docs/config микро-правка
```

Но для non-trivial gameplay/AI/refactor default — Architecture Migration Mode.

Если задача повторяет один и тот же симптом после двух фиксов, третий guard/flag patch запрещён. Нужен architecture audit.

---

## 5. Практическое правило для следующих задач

Перед отправкой задачи GLM спросить:

```text
Это обычный small fix или новая логика должна лечь в систему?
```

Если это новая логика, сначала определить system owner.

Если system owner неясен — сначала ARCH-MAP/AUDIT, не code patch.
