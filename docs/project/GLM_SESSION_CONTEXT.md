# GLM_SESSION_CONTEXT — Four Elements merged bot roadmap

**Created by:** `PATCH-10C2-DOCS-MERGED-GLM-BOT-ROADMAP`  
**Date:** 2026-05-09

This file exists only to preserve GLM-derived bot planning context inside the project.

Important:
- GLM roadmap is not the canonical replacement for the project roadmap.
- Canonical merged version is `docs/project/four_elements_bot_roadmap_merged_glm.md`.
- Current next gameplay patch is `PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL`.

Current accepted/maybe-installed bot chain:
```text
09C/09D/09E enemy economy + factory production
10B enemy vision/memory shell
10C1 enemy scouting MVP light
10C2 merged GLM roadmap docs
```

GLM concepts reused:
```text
GLM-01 -> 10D1 autopilot guard patrol
GLM-03 -> 10E1 strength estimate before attack
GLM-04 -> 10F1 vision-driven target selection
GLM-05 -> 10G1 scouting knowledge upgrade
GLM-06 -> 10H1 retreat + defense upgrade
GLM-07 -> 10I1 easy bot behavior profile
```

GLM concepts deferred:
```text
GLM-02 production manager
GLM-08 group combat + formation
```

Hard active rules:
```text
No artificial gameplay shortcuts.
No resource-based difficulty.
No final omniscience.
Keep docs/audit cadence.
Prefer local GPT patch when safe; Codex only when risk is real.
```

<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_GLM_CONTEXT_START -->
## 10E2 checkpoint update

Accepted after merged GLM roadmap:

```text
10D1 autopilot guard patrol -> accepted
10E1 strength estimate before attack -> accepted after 10E1B + 10E1C2 verification
```

Important verification command:

```js
FE_BOT_TELEMETRY()
```

Correct object path:

```js
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyAutopilotMvp
```

Next GLM-derived route:

```text
10F1 vision-driven target selection
10G1 scouting knowledge upgrade
10H1 retreat + defense
10I1 easy behavior profile
```
<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_GLM_CONTEXT_END -->

<!-- FE_PATCH_10E3_DOCS_GLM_PARALLEL_BRANCH_PLAN_START -->
## PATCH-10E3 — GLM parallel branch plan

Reviewed uploaded GLM planning/context files and recorded how to use them safely.

Decision:

```text
GLM_TESTS is a parallel experimental branch.
WORK folder remains canonical stable branch.
GLM output is roadmap/algorithm reference until commit diffs are inspected.
```

Useful GLM references:
- `GLM-04 Vision-Driven Decisions` -> next `PATCH-10F1`;
- `GLM-05 Scouting` -> future `PATCH-10G1`;
- `GLM-06 Retreat + Defense` -> future `PATCH-10H1`.

Already covered in WORK:
- `GLM-01 Unit Autopilot` ~= `PATCH-10D1`;
- `GLM-03 Strength Estimate` ~= `PATCH-10E1/10E1B/10E1C2`.

Deferred:
- `GLM-02 Production Manager` — high risk, audit-only for now;
- `GLM-07 Economy Brain` — later;
- `GLM-08/09 Difficulty/Group Combat` — later.

New reference doc:

```text
docs/project/four_elements_glm_parallel_branch_plan.md
```

Need before code transfer:

```text
GLM-04-VISION-DRIVEN.patch
GLM-05-SCOUTING.patch
GLM-06-RETREAT-DEFENSE.patch
```

Immediate next canonical route remains:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
```
<!-- FE_PATCH_10E3_DOCS_GLM_PARALLEL_BRANCH_PLAN_END -->
