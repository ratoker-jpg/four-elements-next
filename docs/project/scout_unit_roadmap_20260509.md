# Four Elements Remake — Dedicated Scout Unit Roadmap

**Patch:** `PATCH-10E7-DOCS-SCOUT-UNIT-ROADMAP-PRIORITY`  
**Date:** 2026-05-09  
**Type:** docs-only roadmap update  
**Status:** scout unit promoted to active priority  
**Source note:** user manually confirmed that the GLM scout currently moves. Earlier docs described GLM scout movement as broken; this is now corrected as a current user-verified observation.

---

## 1. Decision

Dedicated scout unit is now a priority for WORK.

Reason:

```text
Using a slow light_tank as scout is mechanically weak and visually unclear.
A dedicated scout unit creates a clear reconnaissance role:
fast, fragile, wide vision, no heavy combat value.
```

Target player/bot loop:

```text
factory produces scout
scout explores
scout reveals enemy development
bot stores knowledge from scout vision
bot uses scout/intel before committing tanks
if enemy has weak defense / few tanks, bot can decide to attack
```

---

## 2. GLM scout status correction

Previous GLM audit treated scout movement as broken. User has now manually checked GLM and confirmed:

```text
GLM scout movement works now.
```

However, GLM implementation remains MVP-style:

```text
uses builder visual as temporary scout
speed is boosted roughly 2.5x
vision radius is increased
scout is conceptually useful but visually not final
```

WORK conclusion:

```text
Scout mechanic is valid.
GLM code is still not transferred as-is.
WORK needs its own clean staged scout implementation.
```

---

## 3. Target scout identity

### Role

```text
Reconnaissance unit.
Fast information-gathering vehicle.
Fragile.
No meaningful combat role.
Used by player and bot.
```

### Visual

Target asset direction:

```text
small 4-wheeled scout buggy
green faction first
simple faction-colored panels for easy recolor to cyan/yellow/purple
clear front side
front sensor / camera module
small top scanner / antenna / radar
no crane
no mining tool
no heavy weapon
lighter than tank and harvester
```

### Temporary fallback

If final asset is not ready, fallback is allowed only as a short development step:

```text
temporary builder sprite/profile can be used for unit shell testing
but final WORK scout should use its own scout asset
```

---

## 4. Target gameplay stats

Initial design targets:

```text
type: scout
cost: 1 faction element
production time: 12 sec
speed: faster than builder and light_tank
vision radius: 6-7 cells
HP: low, around 15-25
attack: 0
combat role: none
limit: no hard player limit initially; bot soft cap 1-2 scouts
```

Balance principle:

```text
Scout gives information, not direct combat power.
```

---

## 5. Safe WORK implementation sequence

Do not add scout as one big GLM-style patch.

### ASSET-SCOUT-00 — concept and asset pipeline

Goal:

```text
Create dedicated scout visual asset before or alongside unit shell.
```

Steps:

```text
1. Generate clean green scout buggy concept.
2. Build 3D model from concept.
3. Render 8 directions in Blender using existing unit render pipeline.
4. Export PNGs per faction:
   assets/factions/<faction>/units/scout_8dirs/
5. Keep faction panels easy to recolor.
```

Output examples:

```text
scout_idle_dir0_0.png ... scout_idle_dir7_0.png
optional scout_move_dir*_*.png later
```

Acceptance:

```text
same camera/framing as builder/harvester/light_tank
transparent background
clean ground contact
readable front direction
no floating
```

---

### PATCH-SCOUT-01-UNIT-SHELL

Goal:

```text
Add scout type safely without bot AI.
```

Allowed:

```text
add scout unit config
add scout sprite profile / temporary fallback
add isScout helper
add scout vision radius
make scout selectable
make scout visible in unit info
make scout attackable by tanks if combat code needs target filtering
```

Forbidden:

```text
no bot auto-production
no GLM08_RunScoutAI
no economy brain
no production manager rewrite
no movement/pathfinding rewrite
```

Risk:

```text
medium if src/main.js + config touched
must remain one-purpose patch
```

Manual smoke:

```text
game boots
existing units still work
no console errors
if scout can be spawned by debug/helper, it renders and selects
```

---

### PATCH-SCOUT-02-PLAYER-FACTORY-PRODUCTION

Goal:

```text
Player can produce scout from units_factory.
```

Allowed:

```text
factory button/menu entry
cost check
production queue entry
spawn via existing factory flow
unit info display
```

Forbidden:

```text
no bot scout production
no scouting AI
no economy brain
no factory queue redesign
```

Manual smoke:

```text
build/select units_factory
queue scout
resources are spent correctly
scout spawns
factory still produces existing units
```

---

### PATCH-SCOUT-03-MANUAL-MOVEMENT-VISION-SMOKE

Goal:

```text
Scout moves manually and reveals more area than tank.
```

Allowed:

```text
reuse existing unit movement path
verify right-click movement
verify vision radius
update smoke/manual checklist
```

Forbidden:

```text
no bot AI yet
no pathfinding rewrite unless movement fails and audit proves exact small fix
```

Manual smoke:

```text
select scout
right-click map
scout moves
scout does not idle-bob
scout reveals radius 6-7
scout can be killed by tank
```

---

### PATCH-SCOUT-04-BOT-SCOUTING-USES-SCOUT-INSTEAD-OF-TANK

Goal:

```text
Bot uses scout unit for scouting instead of light_tank when a scout exists.
```

Allowed:

```text
10G1 scouting target logic can prefer scout over tank
scout can receive scout move target
light_tank remains fallback if no scout exists
telemetry records scout/scoutFallback
```

Forbidden:

```text
no bot auto-production in this patch
no economy brain
no attack logic rewrite
```

Telemetry:

```js
window.FE_CORE.game.enemyScoutingMvp
```

Add/record fields if safe:

```text
scoutUnitId
scoutUnitType
usedDedicatedScout
fallbackToTank
```

Manual smoke:

```text
enemy scout exists
bot sends scout to knowledge/map_probe point
enemy tank remains near HQ/attack group
```

---

### PATCH-SCOUT-05-BOT-SCOUT-PRODUCTION

Goal:

```text
Bot can produce 1-2 scouts safely.
```

Allowed:

```text
use existing factory production flow
soft cap 1-2 scouts
do not block tank production
telemetry for scout production attempt
```

Forbidden:

```text
no direct queue manipulation
no GLM07 economy brain import
no replacing tank production manager
no spending elements before queue availability is confirmed
```

Safety rule:

```text
Scout production must never starve tank production.
If elements are scarce or queue is occupied, scout production waits.
```

Manual smoke:

```text
bot still builds tanks
bot produces at most 1-2 scouts
bot scout moves
production does not deadlock
```

---

### PATCH-SCOUT-06-BOT-INTEL-LOOP

Goal:

```text
Bot uses scout-gathered information to choose whether to attack or keep scouting/defending.
```

Allowed:

```text
knowledge update from scout vision
enemyTargetingMvp can read existing known/visible objects
bot can decide attack if player has weak local defense / few tanks
```

Forbidden:

```text
no omniscient exact hidden HQ attack
no direct assumed-base attack target
no resource cheats
```

Expected behavior:

```text
scout sees player economy/army
bot stores knowledge
if player appears weak, attack may be allowed
if unknown/strong, bot scouts or defends
```

---

## 6. Asset generation prompt baseline

Use this prompt for scout visual concept:

```text
Create a stylized 3D concept render of a compact scout buggy for the green faction in the visual style of Four Elements, a mobile-friendly isometric RTS game.

The vehicle must be a small fast 4-wheeled reconnaissance unit, clearly lighter and more agile than a tank, and clearly different from a builder or harvester. It should look like a dedicated scout vehicle.

Visual style:
- stylized 3D RTS unit concept
- clean toy-like industrial design
- simple readable silhouette
- soft bevels and rounded forms
- mobile RTS readability
- same universe as Four Elements builder and harvester
- compact proportions
- slightly cute but functional and mechanical

Design requirements:
- 4 wheels only
- light buggy-like body
- green faction as the main color accent
- secondary materials: dark gray chassis, light cream or light gray structural panels
- faction-colored panels should be easy to recolor later for other factions
- recognizable front side for clear movement direction in gameplay
- front sensor block or camera module
- top radar dish, scanner, or antenna
- communicates speed, scouting, vision, reconnaissance
- no heavy weaponry
- no cargo modules
- no construction arm
- no mining tools

Presentation:
- single vehicle only
- 3/4 front-side view
- slightly elevated angle
- centered composition
- pure white or very light neutral background
- no environment
- no text
- no UI
- clean studio lighting
- full vehicle visible with comfortable margins
```

Negative prompt:

```text
no tank tracks, no crane arm, no mining tools, no cargo bed, no heavy cannon, no large weapons, no camouflage, no dirt background, no environment, no text, no UI, no multiple vehicles, no character driver, no overcomplicated details, no photorealism
```

---

## 7. Relationship with current bot AI

Current bot AI chain remains valid:

```text
10F1 vision-driven target selection
10G1 knowledge scouting
10H1 retreat/HQ defense
10I1 behavior difficulty profile
TEST-01C / TEST-02 smoke tests
```

Scout should enhance this chain, not replace it.

Integration principle:

```text
Dedicated scout becomes the preferred unit for scouting.
Light tank remains fallback scout only if no scout exists.
Tank remains combat unit, not primary recon unit.
```

---

## 8. What not to import from GLM

Do not import:

```text
GLM08_RunScoutAI
GLM08_TryProduceScout
GLM07 economy brain scout hooks
direct factory queue manipulation
large mixed scout/economy/AI/rendering/combat patch
```

Reason:

```text
Even if current GLM scout movement works, GLM implementation is still too broad for WORK transfer.
WORK implementation must be staged and testable.
```

---

## 9. Next recommended action

Recommended immediate next action:

```text
ASSET-SCOUT-00 — finalize scout visual concept / 3D model / render plan
```

Then:

```text
PATCH-SCOUT-01-UNIT-SHELL
```

Do not start bot scout AI before player scout shell + production + movement are accepted.

---

## 10. Manual validation checklist for scout milestone

```text
Scout asset:
- visible front direction
- green faction panels easy to recolor
- no builder crane/mining cargo
- compact buggy silhouette
- transparent PNG
- same render framing as other units

Scout unit shell:
- game boots
- scout type exists
- scout can render/select
- scout has low HP
- scout has high vision
- scout has no attack

Player production:
- units_factory can queue scout
- cost is correct
- scout spawns in valid cell
- existing unit production still works

Movement/vision:
- scout moves by right-click
- scout does not idle-bob
- scout reveals larger radius than light_tank
- scout can be attacked/killed

Bot scouting:
- bot uses scout for scouting when available
- tanks remain for defense/attack
- bot telemetry shows dedicated scout usage
- bot does not attack hidden HQ directly
```
