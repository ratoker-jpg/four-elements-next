# Four Elements Remake — Enemy Bot Roadmap, merged with GLM

**Patch:** `PATCH-10C2-DOCS-MERGED-GLM-BOT-ROADMAP`  
**Date:** 2026-05-09  
**Type:** docs-only roadmap checkpoint  
**Status:** active planning layer after `PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT`

---

## 0. Decision

The GLM roadmap is useful, but it does **not** replace the existing Four Elements roadmap/regламент.

Accepted decision:

```text
Use GLM as a product-behavior layer.
Keep current patch discipline, docs cadence, no-omniscience policy, no artificial shortcuts, and Codex routing rules.
```

Why:

- GLM correctly identifies that the bot must become visibly smarter faster.
- GLM's `UNIT AUTOPILOT`, `STRENGTH ESTIMATE`, `VISION-DRIVEN DECISIONS`, `RETREAT`, and `DIFFICULTY PROFILES` are useful directions.
- GLM's rule "no audit/docs-only in combat chain" is rejected as a hard rule because this project already depends on checkpoints to avoid context loss.
- GLM's "first make bot smart, then remove omniscience" is risky if implemented literally. New bot logic should use `visible / known / assumed`, not exact hidden full-state targets.

---

## 1. Current bot state

### Working baseline

```text
Phase bot:        defend -> prepare_attack -> attack -> regroup
Enemy economy:    harvesters -> raw minerals -> separator -> energy + purple elements
Enemy production: builder -> units_factory -> light_tank
Vision shell:     PATCH-10B runtime enemy vision/memory shell exists
Scouting MVP:     PATCH-10C1 light scouting layer installed
```

### Current `PATCH-10C1` state

`PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT` installed:

```text
enemy has 2+ combat scout candidates
-> keep at least one tank for defense
-> send one free tank toward rotating scout points
-> scout points: center, likely opposite corner, edge-mid points
-> do not use exact hidden player HQ as target
-> store runtime telemetry in game.enemyScoutingMvp
```

Manual acceptance/smoke may still be required before treating it as fully accepted.

---

## 2. Merged principles

### 2.1. Gameplay patches should be visible

Good rule:

```text
Each enemy-bot gameplay patch should produce a visible behavior improvement.
```

Examples:

- idle enemy tanks patrol instead of standing still;
- bot scouts instead of blindly rushing;
- bot waits for enough army strength before attack;
- bot retreats when weaker;
- bot defends HQ with all available tanks.

### 2.2. Docs/audit patches are still allowed

Rejected GLM hard rule:

```text
No docs-only or audit-only patches in combat chain
```

Project rule remains:

```text
After two accepted successful patches, do a docs-sync checkpoint.
Use read-only audits before risky AI/combat/pathfinding/economy changes.
```

### 2.3. No artificial gameplay shortcuts

Still forbidden:

```text
spawn enemy tanks directly from HQ
spawn production buildings from air
grant hidden resources as difficulty
bypass separator/factory chain
```

### 2.4. Difficulty = behavior, not resources

Still active from `PATCH-09C5`:

```text
Easy/Normal/Hard differ by behavior quality, reaction, scouting, memory, retreat, production discipline.
They do not differ by hidden starting resources.
```

### 2.5. No final omniscience

New decisions should be built around:

```text
visibleNow -> enemy memory -> assumptions -> scouting -> strength estimate -> decision
```

Allowed for MVP:

- approximate opposite-corner guess;
- map center scouting;
- stale memory with confidence;
- debug panels showing full data for the developer.

Forbidden as final behavior:

- exact hidden player HQ target through fog;
- perfect hidden army count;
- perfect reaction to unseen player movement.

---

## 3. New merged bot roadmap

## PATCH-10C1 — Enemy scouting MVP light

**Status:** installed  
**Source:** current project route + GLM scouting idea  
**Goal:** one enemy tank can scout when enemy has 2+ tanks.

Keep as current installed patch. Next step: smoke/stabilize if needed.

---

## PATCH-10D1 — Enemy unit autopilot guard patrol

**Source:** GLM-01 `UNIT AUTOPILOT`  
**Route:** local GPT patch if anchors are simple  
**Priority:** highest next gameplay patch

Goal:

```text
Enemy tanks without active phase/scout/attack order stop standing like posts.
```

Rules:

```text
if unit has phase bot attack order -> do not interfere
if unit has scouting role -> do not interfere
if unit is attacking / attack_approach -> do not interfere
if visible player unit nearby -> attack/defend
if too far from enemy HQ anchor -> return to anchor
if idle near anchor -> patrol lightly around HQ
```

Scope guard:

```text
No economy changes.
No production manager rewrite.
No combat/pathfinding refactor.
No fog/reveal changes.
No UI changes.
```

Smoke:

```text
enemy tanks patrol around HQ
player approaches enemy HQ -> tanks react
player leaves -> tanks return/patrol
scout tank can still scout if assigned by 10C1
```

---

## PATCH-10E1 — Strength estimate before attack

**Source:** GLM-03  
**Route:** GPT local patch if current phase-bot anchors are clear, otherwise Codex/read-only audit first

Goal:

```text
Bot attacks only when it has a plausible chance.
```

Rules:

```text
myArmyScore = count/score enemy combat units
knownPlayerArmyScore = visible + remembered player combat units with confidence
unknown player army baseline = 1
attack allowed if myArmyScore >= knownPlayerArmyScore + threshold
if too weak -> defend / wait for production
```

Scope guard:

```text
Do not change production chain.
Do not change scouting pathing.
Do not use hidden exact player army count.
```

---

## PATCH-10F1 — Vision-driven target selection

**Source:** GLM-04  
**Route:** likely medium risk; consider read-only audit before code patch

Goal:

```text
Phase bot attack target selection stops using exact hidden full game state.
```

Decision order:

```text
1. visible player combat unit / threat
2. known player object from memory if confidence is high enough
3. inferred scout target if nothing is known
4. null -> defend / scout, not direct hidden attack
```

Scope guard:

```text
Debug may inspect full state.
Gameplay decisions should use visible/known/assumed state.
```

---

## PATCH-10G1 — Scouting knowledge upgrade

**Source:** GLM-05 + current PATCH-10C1  
**Route:** GPT/Codex by risk after 10F1

Goal:

```text
Improve current 10C1 scouting so it uses enemy memory/lastSeen instead of only rotating map probe points.
```

Rules:

```text
if lastKnownPlayerPosition exists and confidence > threshold -> scout there
else if no known player info -> scout center/opposite/edge-mid points
scout sees player -> update knowledge
scout should not be sent if enemy has only 1 tank
```

---

## PATCH-10H1 — Retreat + defense upgrade

**Source:** GLM-06  
**Route:** likely medium/high risk; audit first if attack/retreat hooks are unclear

Goal:

```text
Bot stops fighting to death when obviously losing.
```

Rules:

```text
if attack wave loses tank -> recompute strength
if weaker -> retreat/regroup
if player threatens enemy HQ -> all available tanks defend
after retreat -> cooldown before next attack
```

---

## PATCH-10I1 — Easy bot behavior profile

**Source:** GLM-07  
**Route:** docs/config/code depending on config anchors

Goal:

```text
Create first behavior-based difficulty profile: Easy.
```

Initial Easy knobs:

```text
slow reaction
long opening delay
low scouting frequency
high attack threshold
small max tank target
weak retreat logic
```

No resource bonuses.

---

## Later: Production manager wrapper

**Source:** GLM-02  
**Status:** deferred

Reason:

```text
Current enemy economy/build/production chain already works.
Replacing it now risks breaking separator -> factory -> tank production.
```

Later approach:

```text
Do not replace existing 09C/09D/09E functions immediately.
Wrap them behind a manager after bot behavior is playable.
```

Target later:

```text
if no complete separator -> use current separator build route
elif no complete factory -> use current factory build route
elif factory exists -> queue tanks if below target
else wait without spam
```

---

## Later: Group combat + formation

**Source:** GLM-08  
**Status:** deferred

Reason:

```text
Formation/group combat needs stable attack, scouting, strength estimate, and retreat first.
```

Later target:

```text
wait for attack group
move as wave
focus fire
regroup before attack
avoid one-by-one suicide
```

---

## 4. Immediate next route

Current route after this docs patch:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Do not jump to production-manager rewrite before autopilot/strength/vision decisions.

---

## 5. Codex routing

Use GPT local patch when:

```text
small function addition
well-anchored in src/main.js
no pathfinding/combat/economy rewrite
node --check sufficient + manual smoke
```

Use Codex/read-only audit when:

```text
target selection hooks are unclear
retreat touches multiple combat states
vision/memory integration is not locally obvious
production manager would replace existing build chain
formation requires movement/pathing coordination
```

---

## 6. Next patch spec draft

Next patch candidate:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
```

Draft requirements:

```text
1. Find enemy HQ anchor.
2. For each enemy light_tank/tank:
   - skip if _fe10c1Role == 'scout'
   - skip if active attack/approach/phase order exists
   - skip if currently moving to meaningful target
3. If visible/nearby player unit around tank or enemy HQ exists:
   - assign defense/attack using existing safe helper if available
4. If tank is outside leash radius from enemy HQ:
   - silently move back near HQ
5. If idle near HQ:
   - occasionally patrol to a nearby point
6. Store telemetry:
   - game.enemyAutopilotMvp.status
   - patrolIssuedCount
   - returnIssuedCount
   - defendIssuedCount
```

Smoke:

```text
enemy tank no longer stands forever when idle
enemy tank patrols near HQ
enemy tank does not interrupt active scout
enemy tank does not interrupt active attack
enemy tank returns if pulled too far
no player-facing enemy movement toast
```

<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_START -->
## PATCH-10E2 — Bot autopilot + strength checkpoint

Accepted checkpoint after:

```text
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK
PATCH-10E1C2-CACHEBUST-AND-CONSOLE-TELEMETRY-HELPER
```

Accepted:
- free enemy tanks now patrol/guard/return around enemy HQ;
- scout tanks from `10C1` are not overridden;
- weak blind attacks are gated by strength estimate;
- with 1 enemy tank and unknown player army, expected telemetry is `requiredStrength: 2`, `attackAllowed: false`;
- correct runtime check is `FE_BOT_TELEMETRY()` or `window.FE_CORE.game.*`;
- do **not** use `game.enemyStrengthEstimateMvp` because global `game` may be `<canvas id="game">`.

Failed but safely restored:
- `PATCH-10E1C-CACHEBUST-AND-STRENGTH-TELEMETRY-PANEL` failed at `node --check`; runner restored files.
- Accepted replacement: `PATCH-10E1C2`, index-only helper/cache-bust patch.

New checkpoint doc:

```text
docs/project/four_elements_bot_checkpoint_10E2.md
```

Next route:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Docs cadence reset here.
<!-- FE_PATCH_10E2_DOCS_BOT_AUTOPILOT_AND_STRENGTH_CHECKPOINT_END -->

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
