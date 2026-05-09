# Four Elements Remake — Codex sprint closeout 2026-05-09

**Patch:** `PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT`  
**Date:** 2026-05-09  
**Type:** docs-only sprint closeout / status checkpoint  
**Status:** sprint results recorded  
**Important:** normal Codex-sparing policy resumes after the temporary sprint window.

---

## 1. Why this document exists

A temporary Codex sprint window was opened because available Codex limits were close to refresh/expiration. The sprint was used to accelerate high-value bot AI work while preserving guardrails:

```text
no blind full src/main.js replacement
no direct GLM -> WORK merge
no resource cheats
no hidden omniscient targeting as final behavior
no unbounded refactors
reports/checkpoints required
node --check required
```

This closeout records the result and the current stable direction.

---

## 2. What was completed during the sprint

### 2.1. Enemy bot behavior

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

### 2.2. Bot tests

```text
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-TEST-02-BOT-BEHAVIOR-SCENARIO-SMOKE
```

### 2.3. Docs/checkpoints

```text
PATCH-10H2B-DOCS-BOT-VISION-SCOUTING-RETREAT-CHECKPOINT
PATCH-10I2-DOCS-BOT-DIFFICULTY-AND-CODEX-SPRINT-CHECKPOINT
PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT
```

---

## 3. Current bot stage

Current bot stage:

```text
Bot AI MVP Layering -> Bot AI Stabilization
```

The bot is no longer a passive dummy. It now has layered behavior:

```text
scouting
autopilot / guard patrol
strength estimate
vision-driven target selection
knowledge-based scouting
retreat / HQ defense
behavior difficulty profile
telemetry smoke tests
```

This is still not a full RTS AI. It is a playable MVP opponent foundation.

---

## 4. Current bot capabilities

### 4.1. Scouting

Current behavior:

```text
with 2+ enemy tanks, one tank may scout
if enemy has knowledge / lastSeen point, scout can investigate it
if no knowledge exists, scout falls back to map probe points
if enemy has only 1 tank, scout should not be sent
busy attack/defend/strength-wait tanks should not be stolen for scouting
```

Telemetry:

```js
window.FE_CORE.game.enemyScoutingMvp
```

---

### 4.2. Autopilot / guard patrol

Current behavior:

```text
free enemy tanks patrol near enemy HQ
free tanks react to local player threats
free tanks return toward HQ if they drift too far
scouts and active attack orders are not overridden
```

Telemetry:

```js
window.FE_CORE.game.enemyAutopilotMvp
```

---

### 4.3. Strength estimate

Current behavior:

```text
enemy does not attack blindly with only 1 tank
unknown player army requires at least 2 enemy tanks before attack
known local player tanks require enemy to be stronger
local HQ defense is still allowed even when weaker
```

Telemetry:

```js
window.FE_CORE.game.enemyStrengthEstimateMvp
```

---

### 4.4. Vision-driven target selection

Current behavior:

```text
visible target -> direct attack can be allowed
high-confidence known target -> direct attack can be allowed by policy
assumed / lastSeen point -> scout/move hint only, not direct attack target
nothing safe -> no direct attack target
hidden exact player HQ should not be attacked directly
```

Telemetry:

```js
window.FE_CORE.game.enemyTargetingMvp
```

---

### 4.5. Retreat + HQ defense

Current behavior:

```text
separate retreat/defense layer
can retreat/regroup when attack becomes unfavorable
can defend HQ with available tanks on local threat
uses existing regroup / return-home behavior
sets cooldown before new attack
```

Telemetry:

```js
window.FE_CORE.game.enemyRetreatMvp
```

---

### 4.6. Difficulty profile

Current behavior:

```text
normal = baseline behavior
easy = slower / softer / more conservative behavior
```

Rules:

```text
no resource cheats
no free spawns
no income bonus
no damage / HP / range changes
no production-cost changes
```

Telemetry:

```js
window.FE_CORE.game.enemyDifficultyMvp
```

Manual switch:

```js
window.FE_CORE.game.enemyBotDifficulty = "easy"
```

---

## 5. Current test coverage

### 5.1. Bot telemetry smoke

File:

```text
tests/bot-ai-smoke.spec.js
```

Command:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
```

Purpose:

```text
boot page
enter standard skirmish
check FE_CORE / FE_BOT_TELEMETRY
check enemyScoutingMvp / enemyAutopilotMvp / enemyStrengthEstimateMvp / enemyTargetingMvp / enemyRetreatMvp
fail on critical JS errors
```

### 5.2. Bot behavior scenario smoke

File:

```text
tests/bot-ai-behavior-scenario.spec.js
```

Command:

```bat
cmd /c npx playwright test "tests/bot-ai-behavior-scenario.spec.js"
```

Purpose:

```text
check core bot telemetry
check difficulty default normal
switch difficulty to easy
verify affectsProduction = false
verify targeting invariant for source none/assumed
verify retreat status is not error
fail on critical JS errors
```

### 5.3. Combined command

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js" "tests/bot-ai-behavior-scenario.spec.js"
```

---

## 6. Correct runtime checks

Use:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
window.FE_CORE.game.enemyDifficultyMvp
```

Do not use:

```js
game.enemyStrengthEstimateMvp
```

Reason:

```text
global game may resolve to <canvas id="game">, not runtime state.
runtime state is exposed through window.FE_CORE.game.
```

---

## 7. What is not done yet

The bot still does not have:

```text
full strategic economy brain
adaptive harvester/storage planning
proper group combat / formation
focus fire
advanced tactical micro
full deterministic behavior tests
UI difficulty selector
long-game balance pass
```

GLM work remains reference-only unless diff-audited.

---

## 8. Known risks after sprint

Likely tuning risks:

```text
10F1 can make enemy too passive if knowledge is empty
10G1 can overuse lastSeen points
10H1 can trigger retreat/HQ defense too often
10I1 Easy can become too passive if thresholds are too conservative
Playwright tests can break if menu selectors change
```

Fix route:

```text
PATCH-10F1B targeting fallback tuning
PATCH-10G1B scouting threshold tuning
PATCH-10H1B retreat/defense threshold tuning
PATCH-10I1B easy/normal knob tuning
PATCH-TEST-02B selector/wait tuning
```

---

## 9. Workflow policy after sprint

Temporary sprint exception:

```text
2026-05-09 -> 2026-05-10
Codex may be used more actively during this window.
```

After the window:

```text
Return to normal policy:
local GPT patch first by default.
Codex only for high-risk, multi-file, unclear, or audit-heavy tasks.
```

Codex remains useful for:

```text
read-only audits
multi-file reviews
GLM diff audits
Playwright/test generation
large anchor discovery
risky architecture checks
```

Codex should not be used for:

```text
simple local patches
small docs changes
blind full-file rewrites
direct GLM merges
unbounded refactors
```

---

## 10. Recommended next route

Do not add new major bot features immediately unless smoke is clean.

Recommended order:

```text
1. Run both Playwright bot tests.
2. Play manually 10-15 minutes on normal.
3. Play manually on easy.
4. Record whether bot is too passive / too aggressive / too defensive.
5. Tune with small B-patches if needed.
```

Next likely patch options:

```text
PATCH-10I1B-EASY-NORMAL-KNOB-TUNING
PATCH-TEST-02B-BOT-SCENARIO-SMOKE-TUNING
PATCH-GLM-HOTFIX-SPLIT-AUDIT
PATCH-TEST-03-BOT-COMBAT-SCENARIO-SMOKE
```

Do not start economy brain until current bot behavior is smoke-tested.

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
