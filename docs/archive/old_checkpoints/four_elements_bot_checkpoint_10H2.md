---
> ⚠️ ARCHIVED / NOT SOURCE OF TRUTH
>
> Этот документ сохранён только как исторический контекст.
> Не использовать как актуальную инструкцию для GPT/GLM/Codex.
> Актуальный порядок чтения: docs/project/AI_READ_FIRST.md.
>
> Причина архивации: STALE — чекпоинт бота, перекрыт более полным
> four_elements_bot_checkpoint_10I2_codex_sprint.md.
> Архивирован: DOCS-CLEANUP-01, 2026-05-10.
---


# Four Elements Remake — Bot checkpoint 10H2

**Patch:** `PATCH-10H2B-DOCS-BOT-VISION-SCOUTING-RETREAT-CHECKPOINT`  
**Date:** 2026-05-09  
**Type:** docs-sync checkpoint  
**Status:** applied checkpoint after Codex sprint bot AI chain  
**Acceptance note:** `10F1/10G1/10H1` are applied. Final acceptance depends on manual smoke results.

---

## 0. Why this is 10H2B

The first docs patch attempt `PATCH-10H2-DOCS-BOT-VISION-SCOUTING-RETREAT-CHECKPOINT` failed safely.

Reason:

```text
It expected exact main.js marker:
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
```

But Codex's `10G1` patch is present through helper/function markers and telemetry fields:

```text
FE_10G1_chooseKnowledgeScoutTarget
FE_10G1_knownEntries
targetSource
lastKnowledgeScoutPoint
knowledgeScoutIssuedCount
```

`10H2B` uses robust feature checks instead of one brittle exact marker.

---

## 1. Applied patch chain

Recent applied bot chain:

```text
PATCH-10F1-VISION-DRIVEN-TARGET-SELECTION
PATCH-10G1-SCOUTING-KNOWLEDGE-UPGRADE
PATCH-10H1-RETREAT-AND-DEFENSE-UPGRADE
```

Base chain already present:

```text
PATCH-10C1-ENEMY-SCOUTING-MVP-LIGHT
PATCH-10D1-ENEMY-UNIT-AUTOPILOT-GUARD-PATROL
PATCH-10E1-STRENGTH-ESTIMATE-BEFORE-ATTACK
PATCH-10E1B-STRENGTH-GATE-EARLY-HOOK
PATCH-10E1C2-CACHEBUST-AND-CONSOLE-TELEMETRY-HELPER
```

---

## 2. PATCH-10F1 — Vision-driven target selection

Goal:

```text
Enemy attack target selection should not use exact hidden player HQ / full-map hidden targets.
```

Applied behavior:

```text
visible target -> direct attack allowed
high-confidence known memory target -> direct attack allowed by policy
assumed / last-seen point -> scout/move hint only, not direct attack target
nothing safe -> no direct attack target; defend/scout-compatible fallback
```

Runtime telemetry:

```js
window.FE_CORE.game.enemyTargetingMvp
```

Important fields:

```text
status
source: visible / known / assumed / none / blocked_hidden
targetType
targetId
visibleNow
confidence
blockedHiddenTargetCount
lastDecisionReason
attackAllowedByVision
```

---

## 3. PATCH-10G1 — Scouting knowledge upgrade

Goal:

```text
Scouting should use enemy knowledge / last-seen data before falling back to static map probe points.
```

Applied behavior:

```text
if fresh/confident knowledge exists -> scout that point
if stale lastSeen exists -> scout that area
if no knowledge -> fallback to 10C1 map_probe points
if enemy has only 1 tank -> no scout
if tank is busy with attack/defend/strength-wait -> do not steal it as scout
```

Safety:

```text
hidden player HQ knowledge entries are excluded from scout targeting
knowledge points are scout move points, not attack target objects
10F1 attack selection was not modified by 10G1
```

Runtime telemetry:

```js
window.FE_CORE.game.enemyScoutingMvp
```

New/important fields:

```text
targetSource: knowledge / last_seen / map_probe / none
targetConfidence
targetReason
lastKnowledgeScoutPoint
knowledgeScoutIssuedCount
fallbackScoutIssuedCount
```

---

## 4. PATCH-10H1 — Retreat + defense upgrade

Goal:

```text
Enemy should not fight to death when attack becomes bad, and HQ defense should use available tanks more strongly.
```

Applied behavior:

```text
separate FE_10H1_updateEnemyRetreatAndDefenseMvp layer
no native full retreat phase rewrite
reuses regroup / return-home behavior
can start retreat when attack becomes unfavorable
sets retreat cooldown before next attack
can pull available tanks into HQ defense on local threat
preserves scouts unless HQ threat is serious
```

Runtime telemetry:

```js
window.FE_CORE.game.enemyRetreatMvp
```

Important fields:

```text
status
phase
retreatActive
retreatReason
lastRetreatAt
retreatCooldownUntil
retreatIssuedCount
defendAllIssuedCount
localThreatCount
enemyTankCount
playerThreatEstimate
skippedScoutCount
skippedBusyCount
```

---

## 5. Correct runtime checks

Use:

```js
FE_BOT_TELEMETRY()
window.FE_CORE.game.enemyScoutingMvp
window.FE_CORE.game.enemyAutopilotMvp
window.FE_CORE.game.enemyStrengthEstimateMvp
window.FE_CORE.game.enemyTargetingMvp
window.FE_CORE.game.enemyRetreatMvp
```

Do **not** use:

```js
game.enemyStrengthEstimateMvp
```

Reason:

```text
global game may resolve to <canvas id="game">, not runtime state
runtime state is exposed through window.FE_CORE.game
```

---

## 6. Required manual smoke before final acceptance

### 6.1. 10F1 smoke

```text
Case A: player tank near enemy vision/HQ
Expected:
- enemyTargetingMvp.source = visible
- enemyTargetingMvp.attackAllowedByVision = true
- enemy may attack if strength gate allows

Case B: player hidden/far
Expected:
- no direct hidden HQ attack
- enemyTargetingMvp.source = none or assumed
- attackAllowedByVision = false
```

### 6.2. 10G1 smoke

```text
Case A: enemy has 2+ tanks, no player knowledge
Expected:
- enemyScoutingMvp.targetSource = map_probe

Case B: enemy sees player, then player leaves
Expected:
- next scout target uses knowledge or last_seen
- lastKnowledgeScoutPoint updates

Case C: enemy has only 1 tank
Expected:
- status = waiting_for_second_tank
```

### 6.3. 10H1 smoke

```text
Case A: player near enemy HQ
Expected:
- enemyRetreatMvp.localThreatCount > 0
- status = hq_defense_issued or hq_defense_waiting
- available enemy tanks defend HQ

Case B: enemy attacks and loses strength/tank
Expected:
- retreatActive = true or status indicates retreat/cooldown
- retreatReason populated
- tanks return toward HQ/safe point
- attack cooldown blocks immediate repeated attack
```

### 6.4. Regression smoke

```text
enemy economy still runs
enemy production still runs
player controls still work
victory/defeat still work
no console errors
node --check still passes
```

---

## 7. Risk notes

Most likely behavior risks:

```text
10F1 may make enemy too passive if knowledge is empty.
10G1 may overuse last_seen if confidence thresholds are too permissive.
10H1 may hold retreat cooldown too long or trigger HQ defense too often.
```

Fix route:

```text
If 10F1 too passive -> PATCH-10F1B targeting fallback tuning.
If 10G1 scout odd -> PATCH-10G1B scout target tuning.
If 10H1 too defensive -> PATCH-10H1B retreat/defense threshold tuning.
```

---

## 8. Next route options

After manual smoke, choose one:

### Option A — If 10F1/10G1/10H1 work

```text
PATCH-10I1-EASY-BOT-BEHAVIOR-PROFILE
```

Goal:

```text
Add behavior-based difficulty profile starting with Easy/Normal baseline.
No resource cheats.
```

### Option B — If behavior works but needs safety coverage

```text
PATCH-TEST-01-BOT-AI-SMOKE-PLAYWRIGHT
```

Goal:

```text
Add lightweight Playwright smoke tests / console telemetry checks for bot AI.
```

### Option C — If GLM work should be reused

```text
PATCH-GLM-HOTFIX-SPLIT-AUDIT
```

Goal:

```text
Split GLM HOTFIX-01 into safe transfer candidates:
spawn-in-front
factoryMaxQueue knob
stale target cleanup
enemy start energy
enemy territory audit-only
```

### Option D — If smoke finds bugs

```text
PATCH-10F1B / PATCH-10G1B / PATCH-10H1B
```

Goal:

```text
Fix the specific failing behavior before adding new features.
```

---

## 9. Docs cadence

This checkpoint records the Codex sprint AI behavior chain and resets docs cadence.

Next docs patch candidate:

```text
PATCH-10I2-DOCS-DIFFICULTY-OR-SPRINT-CLOSEOUT
```

or, if sprint ends:

```text
PATCH-10E5-DOCS-CODEX-SPRINT-CLOSEOUT
```

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
