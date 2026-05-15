---
> ⚠️ ARCHIVED / NOT SOURCE OF TRUTH
>
> Этот документ сохранён только как исторический контекст.
> Не использовать как актуальную инструкцию для GPT/GLM/Codex.
> Актуальный порядок чтения: docs/project/AI_READ_FIRST.md.
>
> Причина архивации: STALE — ранний чекпоинт бота (10D1, 10E1).
> Перекрыт более полными чекпоинтами 10H2 и 10I2_codex_sprint.
> Актуальный чекпоинт: four_elements_bot_checkpoint_10I2_codex_sprint.md.
> Архивирован: DOCS-CLEANUP-01, 2026-05-10.
---


# Four Elements Remake — Bot checkpoint 10E2

**Patch:** `PATCH-10E2-DOCS-BOT-AUTOPILOT-AND-STRENGTH-CHECKPOINT`  
**Date:** 2026-05-09  
**Type:** docs-sync checkpoint  
**Status:** accepted checkpoint after enemy autopilot + strength estimate verification

---

## 1. Accepted patch chain

Accepted sequence:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK
PATCH-10E1C2-CACHEBUST-AND-CONSOLE-TELEMETRY-HELPER
```

Important failed attempt:

```text
PATCH-10E1C-CACHEBUST-AND-STRENGTH-TELEMETRY-PANEL
```

`PATCH-10E1C` failed at `node --check` because it inserted telemetry into an unsafe `.innerHTML = ...` continuation in `src/main.js`.  
The patch runner restored `main.js` and `index.html`.  
Accepted replacement is `PATCH-10E1C2`, which does **not** touch `src/main.js`.

---

## 2. Current accepted bot behavior

### PATCH-10D1 — enemy tank autopilot / guard patrol

Accepted behavior:

```text
free enemy tanks patrol lightly around enemy HQ
free enemy tanks react to local player threats near themselves or HQ
free enemy tanks return toward HQ if they drift too far
10C1 scout tanks are not overridden
active attack/approach orders are not overridden
```

Runtime telemetry:

```js
window.FE_CORE.game.enemyAutopilotMvp
```

---

### PATCH-10E1 + 10E1B — strength estimate before attack

Accepted behavior:

```text
enemy does not launch/continue blind attack while too weak
unknown player army requires at least 2 enemy tanks before attack
known local player tanks require enemy to be stronger by +1 tank
local HQ defense is still allowed even when enemy is weaker
10C1 scout units are not interrupted
```

Runtime telemetry:

```js
window.FE_CORE.game.enemyStrengthEstimateMvp
```

Accepted verification example:

```text
myStrength: 1
playerEstimate: 1
requiredStrength: 2
attackAllowed: false
botPhase: defend
strengthReason: need_min_two_tanks...
```

Meaning:

```text
enemy has 1 tank
unknown player army baseline is 1
required enemy strength is 2
attack is correctly blocked
```

---

### PATCH-10E1C2 — telemetry/cache verification helper

Accepted helper:

```js
FE_BOT_TELEMETRY()
```

Correct console checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyScoutingMvp
```

Wrong/ambiguous console check:

```js
game.enemyStrengthEstimateMvp
```

Reason:

```text
index.html contains <canvas id="game">
global game in DevTools can resolve to the canvas element
runtime game state is exposed through window.FE_CORE.game
```

`PATCH-10E1C2` also updated `index.html` cache-bust so the browser reliably loads the latest `src/main.js`.

---

## 3. Current bot route after checkpoint

Next route:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Immediate next patch:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
```

Goal:

```text
Bot target selection should use visible / known / assumed data,
not exact hidden full-map player objects.
```

Expected 10F1 direction:

```text
1. visible local player unit / threat
2. known player object from enemy memory if confidence is high enough
3. scout target / assumed location if nothing is known
4. null -> defend / scout instead of direct hidden attack
```

---

## 4. Active guardrails

Do not break:

```text
enemy economy
enemy production
phase bot defend / prepare_attack / attack / regroup
10C1 scouting
10D1 autopilot
10E1 strength gate
victory/defeat
player tank controls
```

Still forbidden:

```text
hidden resource bonuses as difficulty
direct HQ spawning of enemy army
omniscient exact hidden targets as final behavior
large main.js refactor
pathfinding/combat rewrite without audit
```

Docs cadence:

```text
This checkpoint resets the docs cadence counter.
After the next two accepted successful patches, make another docs-sync patch.
```

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

<!-- FE_PATCH_10E4_DOCS_CODEX_LIMIT_SPRINT_WINDOW_START -->
## PATCH-10E4 — Temporary Codex limit sprint window

Temporary workflow exception:

```text
2026-05-09 -> 2026-05-10 inclusive
```

During this window, Codex may be used more actively because user limits will refresh/expire and unused capacity would be wasted.

This does **not** remove safety rules.

Allowed during sprint:
- read-only audits;
- multi-file code reviews;
- risky bot logic analysis;
- GLM diff audits;
- bounded code patches if explicitly routed to Codex;
- Playwright/test planning;
- anchor discovery.

Still forbidden:
- blind full `src/main.js` replacement;
- unbounded refactors;
- direct GLM -> WORK merge;
- patches without reports;
- resource cheats;
- hidden omniscient targeting as final behavior.

Every Codex task must produce:

```text
_inbox/session_summary_<date>_codex_<topic>.txt
```

or a patch report with:
- files changed;
- functions added/modified;
- hook points;
- risk;
- node --check;
- smoke test;
- rollback;
- GPT recommendation.

Sprint doc:

```text
docs/project/codex_limit_sprint_20260509_20260510.md
```

Suggested priority:
1. `PATCH-10F1` target-selection audit/patch;
2. GLM-04 diff audit;
3. GLM HOTFIX split audit;
4. `PATCH-10G1`;
5. `PATCH-10H1`.

After sprint:
- restore normal Codex-sparing policy;
- optionally create `PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT`.
<!-- FE_PATCH_10E4_DOCS_CODEX_LIMIT_SPRINT_WINDOW_END -->

<!-- FE_PATCH_10H2B_DOCS_BOT_VISION_SCOUTING_RETREAT_CHECKPOINT_START -->
## PATCH-10H2B — Bot vision/scouting/retreat checkpoint

Safer replacement for failed `PATCH-10H2`.

Reason for previous failure:

```text
10H2 expected exact marker PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE,
but current 10G1 is present through FE_10G1_* helpers and telemetry fields.
```

Docs checkpoint after Codex sprint bot AI chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
```

Status:
- patches are applied;
- final acceptance depends on manual smoke results.

Runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
```

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10H2.md
```

Next route depends on smoke:
- if OK -> `PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE`;
- if safety coverage needed -> `PATCH-TEST-01-BOT-AI-SMOKE-PLAYWRIGHT`;
- if GLM reuse needed -> `PATCH-GLM-HOTFIX-SPLIT-AUDIT`;
- if bugs found -> `PATCH-10F1B` / `10G1B` / `10H1B`.

Docs cadence reset here.
<!-- FE_PATCH_10H2B_DOCS_BOT_VISION_SCOUTING_RETREAT_CHECKPOINT_END -->

<!-- FE_PATCH_10I2_DOCS_BOT_DIFFICULTY_AND_CODEX_SPRINT_CHECKPOINT_START -->
## PATCH-10I2 — Bot difficulty + Codex sprint checkpoint

Docs checkpoint after sprint chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Current runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
window.FE_CORE.game.enemyDifficultyMvp
```

Playwright smoke command:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
```

`10I1` adds behavior-based profiles:
- `normal` = baseline;
- `easy` = slower/softer/more conservative;
- no resource cheats;
- `affectsProduction = false`.

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10I2_codex_sprint.md
```

Next route depends on smoke:
- if clean -> test scenarios or tuning;
- if Easy feels off -> `PATCH-10I1B`;
- if sprint ends -> `PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT`;
- if GLM reuse needed -> `PATCH-GLM-HOTFIX-SPLIT-AUDIT`.
<!-- FE_PATCH_10I2_DOCS_BOT_DIFFICULTY_AND_CODEX_SPRINT_CHECKPOINT_END -->

<!-- FE_PATCH_10E5_DOCS_CODEX_SPRINT_CLOSEOUT_START -->
## PATCH-10E5 — Codex sprint closeout

Closed / checkpointed the 2026-05-09 Codex sprint.

Recorded completed sprint chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-TEST-02-BOT-BEHAVIOR-SCENARIO-SMOKE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
PATCH-10I2-DOCS-BOT-DIFFICULTY-AND-CODEX-SPRINT-CHECKPOINT
```

Current stage:

```text
Bot AI MVP Layering -> Bot AI Stabilization
```

Current runtime checks:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
window.FE_CORE.game.enemyDifficultyMvp
```

Current bot tests:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
cmd /c npx playwright test "tests/bot-ai-behavior-scenario.spec.js"
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js" "tests/bot-ai-behavior-scenario.spec.js"
```

After sprint window:
- return to normal Codex-sparing policy;
- local GPT patch first by default;
- Codex only for high-risk / multi-file / audit-heavy tasks.

New closeout doc:

```text
docs/project/codex_sprint_closeout_20260509.md
```
<!-- FE_PATCH_10E5_DOCS_CODEX_SPRINT_CLOSEOUT_END -->
