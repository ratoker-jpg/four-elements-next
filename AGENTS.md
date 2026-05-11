# AGENTS.md - GLM Sandbox Rules

This repository is a GLM sandbox copy of the browser RTS project. It is not the production project and must be treated as an isolated test repository.

Sandbox path:

```text
C:\Users\Den\Desktop\GLM_test\glm_game_sandbox
```

Production path that must not be touched:

```text
C:\Users\Den\Desktop\four elements\four_elements_core_base
```

Core rules:

1. For **Fast lane** tasks (docs, prompts, .nojekyll, text-only HTML): commit and push directly to `sandbox/main`. No PR required.
2. For **Review lane** tasks (src/main.js, src/core, src/config, assets, gameplay, economy, combat, pathfinding, save/load, multi-file code, anything risky): create a feature branch and a PR. Do not push directly to `sandbox/main`.
3. Keep diffs minimal and reversible.
4. Do not rewrite architecture unless explicitly requested.
5. Do not modify gameplay code unless the task explicitly requires it.
6. Do not modify assets unless explicitly requested.
7. Do not sync anything to `FourElements_WORK_MIRROR`.
8. Do not run Google Drive sync helpers from this sandbox.
9. Do not touch the production folder.
10. If the task is ambiguous, stop and ask before changing files.
11. **Patch documentation**: GLM does NOT update PATCH_REPORT.txt (frozen) or roadmap files. After PR merge, GPT creates `docs/patches/{TASK_ID}.md`, updates `docs/patches/INDEX.md`, and updates roadmap files with ✅ + PR number.
12. **For code/gameplay/bot tasks, always use the two-phase workflow from `docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md`: Phase 1 = audit/plan only; Phase 2 = implementation only after explicit user confirmation "Делай".**
13. **Do not over-split related low-risk changes into many tiny patches. Prefer Medium patches when 2-3 changes share one gameplay meaning, one smoke test, and nearby code. Do not combine movement/pathfinding/combat/brain/economy into one risky patch.**
14. **After implementation**, GLM outputs CODE_SUMMARY in chat (5 fields: Branch, PR, SHA, Files, Checks). Full details go into PR description, not into chat.
15. **GLM Exchange**: for GPT/GLM handoff, use fixed files in `docs/glm_exchange/`. Do not create per-task subfolders. Current exchange files are fully overwritten for each task; only `SESSION_LOG.md` keeps the latest 5 handoffs.

Working expectations:

1. Prefer infrastructure, tooling, docs, and guardrail changes over broad refactors.
2. Avoid touching `src/main.js` unless the task explicitly requires it.
3. If `src/main.js` must be touched, explain why first and keep the edit as small as possible.
4. Always list changed files and checks that were run (in PR description and CODE_SUMMARY).
5. Prefer reversible renames, guards, or isolated config updates over deletions.
6. Before implementation, read and follow `docs/project/GLM_PATCH_WORKFLOW_RULES_20260511.md` for patch size selection, two-phase workflow, and audit requirements.
7. When using `docs/glm_exchange/`, write results to the exact requested file and stop after the requested phase. Do not continue from Phase 1 to Phase 2 without explicit user command.

GLM / GPT responsibility split:

| Responsibility | GLM | GPT |
|---------------|-----|-----|
| Code implementation | ✅ | ❌ |
| node --check | ✅ | ❌ |
| Branch + commit + push + PR | ✅ | ❌ |
| PR description (full) | ✅ | ❌ |
| CODE_SUMMARY in chat | ✅ | ❌ |
| `docs/patches/{TASK_ID}.md` | ❌ | ✅ (after PR merge) |
| `docs/patches/INDEX.md` update | ❌ | ✅ (after PR merge) |
| Roadmap updates (✅ + PR#) | ❌ | ✅ (after PR merge) |
| AI_READ_FIRST.md update | ❌ | ✅ (if rules/SoT changed) |
| `docs/glm_exchange/PROMPT_TO_GLM.md` | ❌ | ✅ |
| `docs/glm_exchange/AUDIT_FROM_GLM.md` | ✅ | ❌ |
| `docs/glm_exchange/GPT_REVIEW.md` | ❌ | ✅ |
| `docs/glm_exchange/PHASE2_COMMAND.md` | ❌ | ✅ |
| `docs/glm_exchange/CODE_SUMMARY.md` | ✅ | ❌ |
| `docs/glm_exchange/PR_REVIEW.md` | ❌ | ✅ |

Git and review workflow:

1. Use `sandbox/main` as the protected sandbox baseline branch.
2. **Fast lane**: for docs, prompts, .nojekyll, text-only HTML — commit and push directly to `sandbox/main`. No PR.
3. **Review lane**: for src/main.js, src/core, src/config, assets, gameplay, economy, combat, pathfinding, save/load, multi-file code, anything risky — create a feature branch and a PR.
4. Review staged changes before commit.
5. Never treat this sandbox as the source of truth for the production project.
