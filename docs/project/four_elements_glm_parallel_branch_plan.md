# Four Elements Remake — GLM parallel branch plan

**Patch:** `PATCH-10E3-DOCS-GLM-PARALLEL-BRANCH-PLAN`  
**Date:** 2026-05-09  
**Type:** docs-only planning checkpoint  
**Status:** active reference plan for using `ratoker-jpg/GLM_TESTS` safely

---

## 1. Decision

GLM GitHub repo is treated as a **parallel experimental branch**, not as the canonical WORK source.

```text
Canonical stable branch: local WORK folder + Google Drive mirror
Experimental branch:    GitHub repo ratoker-jpg/GLM_TESTS
```

GLM work can be reused only as:

```text
roadmap reference
algorithm reference
small isolated functions after diff audit
```

GLM work must **not** be copied wholesale into WORK.

---

## 2. What GLM claims is done

From uploaded GLM files:

```text
GLM-01 Unit Autopilot
GLM-02 Production Manager
GLM-03 Strength Estimate
GLM-04 Vision-Driven Decisions
GLM-05 Scouting
GLM-06 Retreat + Defense Upgrade
```

Important: this is based on GLM roadmap/context files, not a code diff audit.

Current limitation:

```text
No GLM commit diff / patch files have been inspected yet.
Therefore we cannot safely import GLM code.
```

---

## 3. Mapping GLM to WORK roadmap

| GLM item | Meaning | WORK status / decision |
|---|---|---|
| `GLM-01 Unit Autopilot` | idle tanks patrol/react/leash | Already covered by `PATCH-10D1`; no import needed |
| `GLM-02 Production Manager` | separator -> factory -> tanks pipeline | Defer; high risk to current economy/production |
| `GLM-03 Strength Estimate` | attack only when stronger | Already covered by `PATCH-10E1/10E1B/10E1C2`; no import needed |
| `GLM-04 Vision-Driven Decisions` | target selection by visible/known data | Use as reference for `PATCH-10F1` |
| `GLM-05 Scouting` | scout last known/center; do not scout at 1 tank | Use as reference for `PATCH-10G1` |
| `GLM-06 Retreat + Defense` | retreat on losses; all tanks defend HQ | Use as reference for `PATCH-10H1` |
| `GLM-07 Economy Brain` | storage/harvester/power/resource planning | Defer until combat behavior is stable |
| `GLM-08 Difficulty Profiles` | Easy/Normal/Hard behavior profiles | Later, after retreat/target/scouting stable |
| `GLM-09 Group Combat + Formation` | wave attack/focus fire/formation | Later, after retreat + target selection stable |

---

## 4. Next canonical route

Current WORK route remains:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

### Immediate next patch

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
```

Use GLM-04 as behavior reference, but do not copy blindly.

Target behavior:

```text
1. Prefer visible local player threat.
2. Then use enemy memory knownUnits/knownBuildings if confidence is high enough.
3. Then use assumed/scout target.
4. If no visible/known/assumed target exists -> defend/scout instead of attacking exact hidden targets.
```

---

## 5. Required GLM inputs before code reuse

Before importing any GLM code, request these small files from GLM repo:

```powershell
git show 79fe871 > GLM-04-VISION-DRIVEN.patch
git show 3056b96 > GLM-05-SCOUTING.patch
git show d5b91a0 > GLM-06-RETREAT-DEFENSE.patch
git show 86941e3 > GLM-02-PRODUCTION-MANAGER.patch
```

Minimum for next WORK patch:

```text
GLM-04-VISION-DRIVEN.patch
```

Optional later:

```text
GLM-05-SCOUTING.patch
GLM-06-RETREAT-DEFENSE.patch
```

`GLM-02-PRODUCTION-MANAGER.patch` is audit-only for now.

---

## 6. Transfer rules

Allowed:

```text
copy small helper idea after manual review
adapt algorithm names to WORK naming
wrap behavior behind current phase bot
use runtime telemetry for verification
keep patch size small
```

Forbidden:

```text
replace full src/main.js
replace updateEnemyBot wholesale
replace economy/production manager without audit
copy hidden-resource or exact-hidden-target behavior
copy GitHub branch state directly into WORK
skip node --check
skip manual smoke
```

---

## 7. 10F1 draft spec with GLM-04 reference

Patch name:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
```

Goal:

```text
Bot attack target selection stops using exact hidden full-map player objects.
```

Safe MVP behavior:

```text
visible player tank near enemy unit/HQ -> valid target
known remembered player object with confidence > threshold -> valid target
lastKnownPlayerPosition -> scout/move target, not direct attack target
nothing known -> defend or scout
```

Do not change:

```text
economy
production
pathfinding
combat damage model
player controls
victory/defeat
assets
```

Telemetry:

```text
game.enemyTargetingMvp.status
game.enemyTargetingMvp.source
game.enemyTargetingMvp.targetType
game.enemyTargetingMvp.confidence
```

Correct runtime check:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyTargetingMvp
```

---

## 8. Risk assessment

Low risk:

```text
docs update
telemetry-only target source reporting
small target-picking helper that does not overwrite existing orders
```

Medium risk:

```text
changing phase bot target lookup
changing attack target object references
using remembered stale objects
```

High risk:

```text
production manager rewrite
economy brain
formation/group pathing
global combat/pathfinding refactor
```

---

## 9. Operating rule

If GLM result looks better than WORK result:

```text
Do not replace WORK.
First inspect diff.
Then port one isolated behavior.
Then smoke-test.
Then docs-sync.
```

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

<!-- FE_PATCH_10E6_DOCS_GLM_USEFUL_FINDINGS_AND_NEXT_PATCH_QUEUE_START -->
## PATCH-10E6 — GLM useful findings + next patch queue

Reviewed latest GLM context / roadmap / GLM-08 Scout Unit MVP report.

Decision:

```text
GLM_TESTS remains experimental.
WORK remains canonical.
GLM ideas can be reused only as small audited extraction patches.
No direct GLM -> WORK transfer.
```

Useful GLM candidates:
- dedicated scout unit shell;
- spawn units in front of factory;
- factoryMaxQueue knob;
- territory under fog audit;
- production regression audit;
- scenario tests.

Do NOT transfer as-is:
- GLM-08 Scout Unit MVP;
- GLM08_RunScoutAI;
- GLM08_TryProduceScout;
- GLM07 economy brain hooks;
- large multi-subsystem main.js changes.

Reason:
- GLM-08 is high risk;
- scout movement is broken in GLM;
- enemy territory is visible under fog in GLM;
- user observed production/economy regression in GLM branch.

New reference doc:

```text
docs/project/glm_useful_findings_for_work_20260509.md
```

Next safe WORK queue:
1. run bot tests + manual playtest;
2. if stable, `PATCH-GLM-01-HOTFIX-SPLIT-AUDIT`;
3. then maybe `PATCH-SCOUT-01-UNIT-SHELL`;
4. factory spawn / queue as separate patches;
5. economy brain stays deferred.
<!-- FE_PATCH_10E6_DOCS_GLM_USEFUL_FINDINGS_AND_NEXT_PATCH_QUEUE_END -->

<!-- FE_PATCH_10E7_DOCS_SCOUT_UNIT_ROADMAP_PRIORITY_START -->
## PATCH-10E7 — Scout unit roadmap priority

User manually confirmed: GLM scout movement currently works. Earlier GLM audit uncertainty about stuck scout is now corrected.

Decision:

```text
Dedicated scout unit is now an active WORK priority.
```

Why:
- using a slow light_tank as scout is visually/mechanically weak;
- scout gives clear recon role: fast, fragile, wide vision, no combat value;
- bot should scout with scout, gather knowledge, then decide whether to attack.

GLM scout remains MVP/reference only:
- uses builder visual;
- boosted speed;
- bigger vision;
- useful mechanic, not final asset/code for WORK.

New staged WORK plan:

```text
ASSET-SCOUT-00 — concept/model/render pipeline
PATCH-SCOUT-01 — unit shell
PATCH-SCOUT-02 — player factory production
PATCH-SCOUT-03 — manual movement + vision smoke
PATCH-SCOUT-04 — bot uses scout instead of tank for scouting
PATCH-SCOUT-05 — bot scout production
PATCH-SCOUT-06 — bot intel loop
```

Do not import GLM08 scout AI / GLM07 economy hooks / direct queue manipulation as-is.

New reference doc:

```text
docs/project/scout_unit_roadmap_20260509.md
```
<!-- FE_PATCH_10E7_DOCS_SCOUT_UNIT_ROADMAP_PRIORITY_END -->
