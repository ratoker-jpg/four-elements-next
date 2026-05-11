# GLM Exchange — file-based GPT/GLM handoff

## Purpose

`docs/glm_exchange/` is a temporary working bridge between GPT, the user, and GLM.

It exists to reduce copy/paste and make the two-phase workflow stricter:

```text
GPT writes/updates the prompt file.
GLM reads the prompt file and writes the audit file.
GPT reviews the audit and writes the review/phase2 files.
GLM reads the phase2 command and writes CODE_SUMMARY.
GPT reviews the PR and writes PR_REVIEW.
```

## Important rules

1. Do not create per-task subfolders.
2. Do not create endless per-task exchange files.
3. The current files in this folder are reused and fully overwritten for each task.
4. `SESSION_LOG.md` keeps only the latest 5 task handoffs.
5. These files are not the source of truth for code.

Source of truth order:

```text
1. PR diff
2. PR description
3. docs/patches/{TASK_ID}.md after merge
4. docs/patches/INDEX.md
```

## Files

| File | Owner | Behavior |
|---|---|---|
| `CURRENT_TASK.md` | GPT | overwritten for each task |
| `PROMPT_TO_GLM.md` | GPT | overwritten for each task |
| `AUDIT_FROM_GLM.md` | GLM | overwritten by GLM after Phase 1 |
| `GPT_REVIEW.md` | GPT | overwritten after audit review |
| `PHASE2_COMMAND.md` | GPT | overwritten only if Phase 2 is approved |
| `CODE_SUMMARY.md` | GLM | overwritten after implementation / PR |
| `PR_REVIEW.md` | GPT | overwritten after PR review |
| `SESSION_LOG.md` | GPT | latest 5 task handoffs only |

## Phase 1 command to GLM

Use this exact command when asking GLM to run Phase 1:

```text
Прочитай файл:

docs/glm_exchange/PROMPT_TO_GLM.md

Выполни ТОЛЬКО Phase 1 / Audit only по инструкции из этого файла.

Важно:
- Не редактируй код.
- Не пиши код.
- Не коммить.
- Не пушь.
- Не создавай PR.
- Не пиши результат только в чат.

Результат Phase 1 запиши в файл:

docs/glm_exchange/AUDIT_FROM_GLM.md

Файл AUDIT_FROM_GLM.md нужно ПОЛНОСТЬЮ ПЕРЕЗАПИСАТЬ актуальным аудитом.

В конце файла AUDIT_FROM_GLM.md обязательно напиши:

Жду «Делай».

После записи файла коротко ответь в чат только так:

AUDIT_WRITTEN
File: docs/glm_exchange/AUDIT_FROM_GLM.md
Status: waiting for GPT review / waiting for “Делай”

После этого остановись и жди дальнейшей команды.
```

## Phase 2 command to GLM when GPT approved

Use this exact command only when `GPT_REVIEW.md` says `Verdict: APPROVED_FOR_PHASE_2`:

```text
Прочитай файлы:

docs/glm_exchange/AUDIT_FROM_GLM.md
docs/glm_exchange/GPT_REVIEW.md

Если GPT_REVIEW.md содержит:
Verdict: APPROVED_FOR_PHASE_2

тогда прочитай файл:

docs/glm_exchange/PHASE2_COMMAND.md

и выполни Phase 2 строго по PHASE2_COMMAND.md.

Важно:
- Не расширяй scope.
- Не трогай файлы/системы, указанные как out of scope.
- Создай branch + PR для Review lane.
- Заполни полный PR description.
- Запусти требуемые checks.
- Не обновляй PATCH_REPORT.txt.
- Не обновляй roadmap.
- Не обновляй docs/patches.

После реализации полностью перезапиши файл:

docs/glm_exchange/CODE_SUMMARY.md

Формат:

CODE_SUMMARY <TASK_ID>
Branch:
PR:
SHA:
Files:
Checks:

После записи файла коротко ответь в чат только так:

CODE_SUMMARY_WRITTEN
File: docs/glm_exchange/CODE_SUMMARY.md
PR: #<number>
Status: waiting for GPT PR review
```

## Revision command to GLM when GPT did not approve

Use this exact command when GPT asks to revise the audit:

```text
Прочитай:

docs/glm_exchange/GPT_REVIEW.md

GPT_REVIEW.md не одобрил Phase 2.

Не пиши код.
Не коммить.
Не пушь.
Не создавай PR.

Исправь только аудит:
- учти замечания из GPT_REVIEW.md;
- полностью перезапиши docs/glm_exchange/AUDIT_FROM_GLM.md;
- в конце снова напиши: Жду «Делай».

После записи ответь в чат:

AUDIT_REVISED
File: docs/glm_exchange/AUDIT_FROM_GLM.md
Status: waiting for GPT review
```
