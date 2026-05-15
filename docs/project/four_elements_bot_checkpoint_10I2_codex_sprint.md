# Four Elements Remake — Bot checkpoint 10I2 / Codex sprint checkpoint

**Patch:** `PATCH-10I2-DOCS-BOT-DIFFICULTY-AND-CODEX-SPRINT-CHECKPOINT`  
**Date:** 2026-05-09  
**Type:** docs-sync checkpoint  
**Status:** applied checkpoint after Codex sprint bot AI + test + difficulty profile chain  
**Acceptance note:** code patches are applied; final acceptance still depends on local smoke for `10I1` and continued behavior smoke.

---

## 1. Codex sprint chain recorded

Applied during the sprint:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
PATCH-TEST-01C-FIX-BOT-AI-SMOKE-RUNTIME-GAME-WAIT
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Base chain already present:

```text
PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK
PATCH-10E1C2-CACHEBUST-AND-CONSOLE-TELEMETRY-HELPER
PATCH-10H2B-DOCS-BOT-VISION-SCOUTING-RETREAT-CHECKPOINT
```

---

## 2. Current enemy bot behavior layers

### 2.1. Targeting — 10F1

```text
visible target -> direct attack allowed
high-confidence known memory target -> direct attack allowed by policy
assumed / last-seen point -> scout/move hint only, not direct attack
nothing safe -> no direct attack target
```

Telemetry:

```js
window.FE_CORE.game.enemyTargetingMvp
```

Important fields:

```text
status
source
targetType
targetId
visibleNow
confidence
blockedHiddenTargetCount
lastDecisionReason
attackAllowedByVision
```

---

### 2.2. Scouting — 10G1

```text
knowledge / lastSeen scout point first
map_probe fallback second
no scout with only 1 enemy tank
busy attack/defend/strength-wait tanks are not stolen for scouting
hidden player HQ knowledge is excluded from scout target selection
```

Telemetry:

```js
window.FE_CORE.game.enemyScoutingMvp
```

Important fields:

```text
targetSource
targetConfidence
targetReason
lastKnowledgeScoutPoint
knowledgeScoutIssuedCount
fallbackScoutIssuedCount
```

---

### 2.3. Retreat + HQ defense — 10H1

```text
separate retreat/defense layer
uses existing regroup / return-home behavior
can retreat when attack becomes unfavorable
sets cooldown before next attack
can pull available tanks into HQ defense on local threat
preserves scouts unless HQ threat is serious
```

Telemetry:

```js
window.FE_CORE.game.enemyRetreatMvp
```

Important fields:

```text
status
phase
retreatActive
retreatReason
retreatCooldownUntil
retreatIssuedCount
defendAllIssuedCount
localThreatCount
enemyTankCount
playerThreatEstimate
```

---

### 2.4. Playwright smoke — TEST-01C

Test file:

```text
tests/bot-ai-smoke.spec.js
```

Command:

```bat
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
```

Purpose:

```text
checks page load
checks FE_CORE / FE_BOT_TELEMETRY
enters standard skirmish
waits for window.FE_CORE.game.screen === "game"
checks enemyScoutingMvp / enemyAutopilotMvp / enemyStrengthEstimateMvp / enemyTargetingMvp / enemyRetreatMvp
fails on critical JS errors
```

Known Windows note:

```text
Use forward slash in quoted test path:
"tests/bot-ai-smoke.spec.js"
```

---

### 2.5. Difficulty profile — 10I1

Goal:

```text
Add behavior-based difficulty profile without resource cheats.
```

Profiles:

```text
normal = current baseline
easy = slower / softer / more conservative behavior
```

Important: `10I1` does **not** change:

```text
enemy resources
income
production costs
free spawns
damage / HP / range
pathfinding
fog
UI
assets
```

Easy profile adjusts behavior knobs such as:

```text
decision cadence
opening delay
attack threshold
scout frequency
regroup / retreat cooldown
max attack wave size
chase/return behavior
```

Telemetry:

```js
window.FE_CORE.game.enemyDifficultyMvp
```

Important fields:

```text
profile
source
appliedKnobs
lastAppliedAt
affectsScouting
affectsAttack
affectsRetreat
affectsProduction
```

Expected:

```text
affectsProduction = false
default profile = normal
easy can be activated with window.FE_CORE.game.enemyBotDifficulty = "easy"
```

---

## 3. Correct runtime checks

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

Do **not** use:

```js
game.enemyStrengthEstimateMvp
```

Reason:

```text
global game may resolve to <canvas id="game">, not runtime state.
runtime state is exposed through window.FE_CORE.game.
```

---

## 4. Smoke requirements after this checkpoint

### 4.1. Required command smoke

```bat
node --check src\main.js
node --check tests\bot-ai-smoke.spec.js
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js"
```

Expected:

```text
all pass
```

### 4.2. Difficulty smoke

In browser console:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyDifficultyMvp
```

Expected default:

```text
profile = normal
source = runtime_default
affectsProduction = false
```

Switch to easy:

```js
window.FE_CORE.game.enemyBotDifficulty = "easy"
```

Wait a few seconds, then:

```js
window.FE_CORE.game.enemyDifficultyMvp
```

Expected:

```text
profile = easy
source = game.enemyBotDifficulty
affectsProduction = false
```

### 4.3. Behavior smoke

```text
10F1:
- hidden player HQ should not become direct attack target
- visible local player threat can be attacked

10G1:
- no knowledge -> map_probe fallback
- known/lastSeen player position -> knowledge/last_seen scout point
- 1 enemy tank -> no scout

10H1:
- player near enemy HQ -> localThreatCount > 0 and HQ defense status
- bad attack / tank loss -> retreat/cooldown status
```

---

## 5. Risk notes

Most likely issues:

```text
10F1 can make enemy too passive if knowledge is empty.
10G1 can overuse last_seen if confidence thresholds are too permissive.
10H1 can trigger retreat/HQ defense too often.
10I1 can make Easy too passive if maxAttackWaveSize / attackScoreThreshold are too conservative.
Playwright smoke can fail if menu selectors change.
```

Fix route:

```text
PATCH-10F1B targeting fallback tuning
PATCH-10G1B scout target tuning
PATCH-10H1B retreat/defense threshold tuning
PATCH-10I1B difficulty knob tuning
PATCH-TEST-01D smoke selector/wait tuning
```

---

## 6. Codex sprint policy status

Temporary sprint window remains:

```text
2026-05-09 -> 2026-05-10 inclusive
```

During this window:

```text
Codex may still be used more actively for audits / bounded patches / tests.
```

After the window:

```text
Return to normal Codex-sparing policy:
local GPT patch by default,
Codex only for high-risk, multi-file, unclear, or audit-heavy tasks.
```

A closeout patch is still recommended when the sprint ends:

```text
PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT
```

---

## 7. Next route options

### Option A — If smoke is clean

```text
PATCH-10I1B-EASY-KNOB-TUNING
```

Only if Easy feels too passive/aggressive after playtest.

### Option B — If we want stability first

```text
PATCH-TEST-02-BOT-BEHAVIOR-SCENARIO-SMOKE
```

Add scenario tests for:
- hidden player
- visible local threat
- scouting knowledge
- retreat trigger

### Option C — If we want GLM reuse

```text
PATCH-GLM-HOTFIX-SPLIT-AUDIT
```

Audit only. Do not transfer HOTFIX whole.

### Option D — If sprint ends

```text
PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT
```

Record what was done, what passed, what failed, what remains.

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
