# Four Elements Remake — GLM useful findings for WORK

**Patch:** `PATCH-10E6-DOCS-GLM-USEFUL-FINDINGS-AND-NEXT-PATCH-QUEUE`  
**Date:** 2026-05-09  
**Type:** docs-only planning checkpoint  
**Status:** active reference for extracting useful GLM ideas safely  
**Rule:** GLM remains experimental. WORK remains canonical.

---

## 1. Decision

GLM_TESTS is useful as a fast experimental branch, but it is not safe as a direct source of WORK code.

Current rule:

```text
Take ideas from GLM.
Do not copy GLM patches wholesale.
Every transfer must become a small WORK patch with audit, node --check, smoke, rollback.
```

Reason:

```text
GLM moves fast, but GLM-08 confirmed the risk:
- scout unit was added across many subsystems;
- movement is broken;
- enemy territory became visible through fog;
- production/economy also regressed in GLM branch according to user observation.
```

---

## 2. Useful GLM findings already covered in WORK

| GLM idea | WORK equivalent |
|---|---|
| Autopilot / idle tank patrol | `PATCH-10D1` |
| Strength estimate | `PATCH-10E1 / 10E1B / 10E1C2` |
| Vision-driven decisions | `PATCH-10F1` |
| Scouting by knowledge / lastSeen | `PATCH-10G1` |
| Retreat + HQ defense | `PATCH-10H1` |
| Difficulty through behavior | `PATCH-10I1` |

No code transfer needed for those areas unless we are tuning.

---

## 3. Useful GLM candidates not yet in WORK

Potential candidates:

```text
SCOUT-01 — Dedicated scout unit shell
FACTORY-01 — Spawn units in front of units_factory
PROD-01 — factoryMaxQueue knob/audit
FOG-01 — territory visibility under fog audit
ECON-01 — production/economy regression audit
TEST-03 — stronger bot behavior scenario tests
```

These are candidates, not approved code changes.

---

## 4. Scout unit extraction policy

GLM-08 Scout Unit MVP is high risk and must not be transferred as-is.

### 4.1. What can be reused later

Safe ideas:

```text
scout as separate unit type
scout cost = 1 faction element
scout production time = 12s
scout speed = 1.55
scout vision radius = 7
scout HP = 15
scout attack = 0
scout uses builder sprite/profile as temporary MVP
scout is attackable by tanks
player factory can produce scout
```

### 4.2. What must NOT be reused as-is

Do not copy directly:

```text
GLM08_RunScoutAI
GLM08_TryProduceScout
GLM07 economy brain scout hooks
main update loop scout movement integration
auto-production of scout by bot
large multi-subsystem GLM-08 main.js changes
```

Reason:

```text
GLM-08 touched production, AI, rendering, combat, UI and movement in one patch.
Scout movement is broken in GLM.
Production/economy also regressed in GLM branch.
```

---

## 5. Safe scout patch sequence for WORK

If scout unit is added later, do it strictly in stages:

### PATCH-SCOUT-01-UNIT-SHELL

Allowed:

```text
add scout to config/units
add scout sprite profile using builder as temporary visual
add isScout helper
add scout vision radius
make scout attackable target
optionally expose player factory button if low-risk
```

Forbidden:

```text
no bot auto-production
no scout AI
no economy brain integration
no production manager rewrite
no movement/pathfinding rewrite
```

### PATCH-SCOUT-02-MANUAL-MOVEMENT-AUDIT

Goal:

```text
verify scout can receive and execute the same movement path as builder/light_tank
```

Allowed:

```text
read-only audit first
small movement hook only if safe
```

Forbidden:

```text
no AI
no production economy hooks
no pathfinding rewrite
```

### PATCH-SCOUT-03-PLAYER-PRODUCTION

Goal:

```text
player factory can produce scout safely
```

Allowed:

```text
factory button
queue integration
cost check
spawn point
```

Forbidden:

```text
no bot auto-production
no GLM08 AI
```

### PATCH-SCOUT-04-BOT-SCOUT-AI

Only after `SCOUT-01..03` are accepted.

Allowed:

```text
simple scout move target using existing 10G1 knowledge points
no attack
return home if threatened
telemetry
```

Forbidden:

```text
no economy brain rewrite
no scout spam
no multi-subsystem patch
```

---

## 6. Factory / production candidates

### FACTORY-01 — spawn-in-front

Useful GLM idea:

```text
spawn units in front of units_factory instead of behind/blocked cells
```

Workflow:

```text
read-only audit first
identify current factory spawn logic
find if spawned units can be blocked
make one small patch only for units_factory spawn position
no economy/AI changes
```

Do not combine with scout/economy/queue changes.

### PROD-01 — factoryMaxQueue knob

Useful GLM idea:

```text
factoryMaxQueue should be a knob/config instead of hardcoded 1
```

Workflow:

```text
audit current queue cap
if hardcoded, make a local knob
do not change production manager logic
do not change costs/times
```

Do not combine with economy brain.

---

## 7. Fog / territory candidate

GLM exposed an important bug category:

```text
enemy territory visible through fog
```

For WORK this should become an audit candidate, not an immediate code change.

### FOG-01 — territory visibility audit

Goal:

```text
Check whether enemy territory overlays are rendered only when tile is visible/discovered.
```

Scope:

```text
read-only audit first
inspect territory render layer
inspect fog render order
inspect visible/discovered checks
```

Patch only if bug exists in WORK.

---

## 8. Production regression policy

User observed GLM branch regression:

```text
tanks do not build
nothing is produced
```

For WORK, this becomes a warning:

```text
never transfer GLM economy/production code directly
never combine economy brain + unit addition + production queue changes
production fixes require audit first
```

If WORK production breaks, next step must be:

```text
PATCH-PROD-REGRESSION-READONLY-AUDIT
```

No new features while production is broken.

---

## 9. Next safe patch queue for WORK

Recommended order after current Codex sprint stabilization:

### P0 — Stability

```text
Run:
cmd /c npx playwright test "tests/bot-ai-smoke.spec.js" "tests/bot-ai-behavior-scenario.spec.js"

Manual playtest normal/easy for 10-15 minutes.
```

If failures:

```text
PATCH-10F1B / 10G1B / 10H1B / 10I1B / TEST-02B
```

### P1 — GLM split audit

```text
PATCH-GLM-01-HOTFIX-SPLIT-AUDIT
```

Goal:

```text
Split GLM HOTFIX ideas into safe candidates:
- spawn-in-front
- factoryMaxQueue
- stale target cleanup
- enemy start energy audit only
- territory under fog audit only
```

### P1 — Scout shell audit/patch

```text
PATCH-SCOUT-01-UNIT-SHELL
```

Only if bot stabilization is clean.

### P2 — Factory spawn / queue

```text
PATCH-FACTORY-01-SPAWN-IN-FRONT
PATCH-PROD-01-FACTORY-MAX-QUEUE-KNOB
```

Only one at a time.

### P3 — Economy brain

```text
ECONOMY BRAIN remains deferred.
```

Do not start economy brain until bot behavior and production are stable.

---

## 10. Hard transfer rules from GLM to WORK

Allowed:

```text
small idea extraction
read-only audit
one subsystem per patch
one purpose per patch
node --check
Playwright smoke if tests affected
manual smoke
rollback
docs checkpoint after 2-3 accepted patches
```

Forbidden:

```text
copy full GLM main.js
copy GLM08 as one patch
copy GLM07 economy brain as one patch
merge GLM -> WORK
touch production + economy + AI + movement in one patch
patch with high risk unless audit-only
```

---

## 11. Current status label

Current WORK status:

```text
Bot AI MVP Layering -> Bot AI Stabilization
```

Do not start scout unit / economy brain until:

```text
bot AI tests pass
normal/easy manual playtest is acceptable
no production regression exists in WORK
```

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
