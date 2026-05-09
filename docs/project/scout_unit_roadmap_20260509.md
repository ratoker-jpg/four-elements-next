# Four Elements Remake — Dedicated Scout Unit Roadmap

**Patch:** `PATCH-10E7-DOCS-SCOUT-UNIT-ROADMAP-PRIORITY`  
**Date:** 2026-05-09 / обновлено 2026-05-10  
**Type:** docs-only roadmap update  
**Status:** player-side scout полностью реализован; bot-side scout не начат  

---

## 0. Прогресс (обновлено 2026-05-10)

| # | Патч | Суть | Статус | PR |
|---|---|---|---|---|
| 0 | ASSET-SCOUT-00 | Scout buggy концепт + 8-dir PNG для 4 фракций | ✅ done | — |
| 1 | PATCH-SCOUT-01 | Unit shell: config, sprite profile, asset loader, IIFE lists | ✅ done | PR #6 |
| 1B | PATCH-SCOUT-01B | Dev-spawn: `FE_DEV_SPAWN_UNIT('scout')` | ✅ done | PR #7 |
| 1C | PATCH-SCOUT-01C | Visual: DIR_MAP, offsets, HP bar, selection ring, dust, movement | ✅ done | PR #9 |
| 1D | PATCH-SCOUT-01D | Dir mapping: «едет боком» → правильная ориентация | ✅ done | PR #10 |
| 1E | PATCH-SCOUT-01E | Final visual: hand-calibrated DIR_MAP [3,2,1,0,7,6,5,4], size 84, centering | ✅ done | PR #11 |
| 1F | PATCH-SCOUT-01F | Точная центровка: DIR_OFFSETS +20px Y, -1px X | ✅ done | PR #12 |
| 1G | PATCH-SCOUT-01G | Selection ring поднят (y:-16→-38→-28), scout menu убран | ✅ done | PR #13 |
| 2 | PATCH-SCOUT-02 | Factory production: кнопка, 1 элемент / 18 сек, civilian speed | ✅ done | PR #14 |
| 3 | PATCH-SCOUT-03 | Manual movement + vision smoke | ✅ закрыт в 01C/01G | — |
| 4 | PATCH-SCOUT-04 | Bot использует scout вместо light_tank для разведки | ⬜ не начат | — |
| 5 | PATCH-SCOUT-05 | Bot производит 1–2 scout'а | ⬜ не начат | — |
| 6 | PATCH-SCOUT-06 | Bot intel loop: scout→знания→решение атаковать/защищаться | ⬜ не начат | — |

### Текущий Scout в игре (player-side):

```text
- sprite: scout buggy, 8-dir idle, size 84×84, anchor 0.5/0.75
- DIR_MAP: [3,2,1,0,7,6,5,4] (hand-calibrated)
- DIR_OFFSETS: even {x:-1,y:22}, odd {x:-1,y:21}
- selection ring: {x:0, y:-28, rx:0.88, ry:0.84}
- HP bar: anchorScreenY - 52 * z
- no unit menu (аналог light_tank)
- movement: updateUnitMovement, speed 0.72
- vision: 7 cells
- HP: 70, canAttack: false
- factory production: 1 element / 18 сек / civilian speed
- dust: light vehicle, minimal dust
- dev-spawn: FE_DEV_SPAWN_UNIT('scout')
```

### Следующий шаг:

```text
PATCH-SCOUT-04 — Bot использует scout вместо light_tank для разведки
```

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

## 2. GLM sandbox implementation status

Original GLM audit treated scout movement as broken. User confirmed GLM scout movement works.
GLM sandbox then implemented scout from scratch through PATCH-SCOUT-01 through 01G + 02:

```text
ASSET-SCOUT-00 — scout buggy 8-dir renders, 4 factions
PATCH-SCOUT-01 — unit shell (config, profiles, loader, IIFE integration)
PATCH-SCOUT-01B — dev-spawn helper
PATCH-SCOUT-01C — visual landing, movement, selection ring, HP bar, dust, dir map
PATCH-SCOUT-01D — dir mapping fix (was riding sideways)
PATCH-SCOUT-01E — hand-calibrated DIR_MAP, size 84, centering
PATCH-SCOUT-01F — precise centering (+20px Y, -1px X per direction)
PATCH-SCOUT-01G — selection ring raised, scout menu removed
PATCH-SCOUT-02 — factory production (button, cost 1 element / 18 sec, civilian speed)
```

Player-side scout is now fully functional and testable.

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

### Visual ✅ DONE

Current asset matches the original target:

```text
small 4-wheeled scout buggy          ✅
green faction first                  ✅
simple faction-colored panels        ✅ (4 factions)
clear front side                     ✅
front sensor / camera module         ✅
small top scanner / antenna / radar  ✅
no crane                             ✅
no mining tool                       ✅
no heavy weapon                      ✅
lighter than tank and harvester      ✅
```

---

## 4. Target gameplay stats vs actual

| Parameter | Target (roadmap) | Actual (implemented) | Notes |
|---|---|---|---|
| type | scout | scout | ✅ |
| cost | 1 faction element | 1 faction element | ✅ |
| production time | 12 sec | 18 sec | Увеличено для баланса |
| speed | faster than builder/light_tank | 0.72 (fastest) | ✅ faster than builder 0.62 and tank 0.55 |
| vision radius | 6–7 cells | 7 cells | ✅ |
| HP | 15–25 | 70 | Выше roadmap; можно снизить при балансировке |
| attack | 0 | 0, canAttack:false | ✅ |
| combat role | none | none | ✅ |
| bot soft cap | 1–2 scouts | not implemented yet | ⬜ PATCH-SCOUT-05 |

Balance principle:

```text
Scout gives information, not direct combat power.
```

---

## 5. Safe implementation sequence

### ASSET-SCOUT-00 — concept and asset pipeline ✅ DONE

Goal:

```text
Create dedicated scout visual asset before or alongside unit shell.
```

Completed:

```text
1. Scout buggy concept generated
2. 3D model built from concept
3. 8 directions rendered in Blender
4. PNGs exported per faction:
   assets/factions/<faction>/units/scout_8dirs/
5. Faction panels easy to recolor (green/cyan/yellow/purple)
```

Output:

```text
scout_idle_dir0_0.png ... scout_idle_dir7_0.png (per faction)
```

---

### PATCH-SCOUT-01-UNIT-SHELL ✅ DONE (PR #6)

Goal:

```text
Add scout type safely without bot AI.
```

Completed sub-patches:

```text
PATCH-SCOUT-01  — unit shell: config, sprite profile, asset loader, IIFE lists
PATCH-SCOUT-01B — dev-spawn helper: FE_DEV_SPAWN_UNIT('scout')
PATCH-SCOUT-01C — visual landing, movement, selection ring, HP bar, dust, dir map
PATCH-SCOUT-01D — dir mapping fix (scout was riding sideways)
PATCH-SCOUT-01E — hand-calibrated DIR_MAP [3,2,1,0,7,6,5,4], size 84, centering
PATCH-SCOUT-01F — precise centering: DIR_OFFSETS +20px Y, -1px X
PATCH-SCOUT-01G — selection ring raised (y:-16→-38, manually tuned to -28), scout menu removed
```

Manual smoke — all pass:

```text
✅ game boots
✅ existing units still work
✅ no console errors
✅ scout renders and selects
✅ scout moves by right-click
✅ scout shows selection ring under body
✅ scout shows HP bar
✅ scout does NOT open unit menu (like light_tank)
✅ scout faces correct direction when moving
✅ scout centered in cell
✅ scout dust effect works
✅ FE_DEV_SPAWN_UNIT('scout') works
```

---

### PATCH-SCOUT-02-PLAYER-FACTORY-PRODUCTION ✅ DONE (PR #14)

Goal:

```text
Player can produce scout from units_factory.
```

Completed:

```text
1. Scout added to factory production menu:
   ['builder','harvester','light_tank','scout']
2. Scout added to affordability check:
   factoryCanAffordAnyUnit() includes 'scout'
3. Scout uses civilian production speed:
   productionSpeedForUnit() treats scout like builder/harvester
4. Cost: 1 faction element / 18 sec production time
5. Spawn: findSpawnCellNearBuilding → createUnit (existing flow)
```

Manual smoke — all pass:

```text
✅ build/select units_factory
✅ scout button «Разведчик» visible in factory menu
✅ queue scout
✅ resources are spent correctly (1 element)
✅ scout spawns after 18 sec
✅ factory still produces existing units
✅ disabled button when not enough elements
✅ queue display works (max 2)
```

---

### PATCH-SCOUT-03-MANUAL-MOVEMENT-VISION-SMOKE ✅ CLOSED (covered by 01C/01G)

Goal:

```text
Scout moves manually and reveals more area than tank.
```

This was achieved as part of PATCH-SCOUT-01C (movement) and 01G (no menu = clean selection behavior):

```text
✅ select scout → right-click → scout moves
✅ scout does not idle-bob
✅ scout reveals radius 7 (more than light_tank's 4)
✅ scout can be killed by tank
✅ scout accepts move commands like light_tank
✅ scout does not open menu on click
```

No separate patch needed — functionality already in sandbox/main.

---

### PATCH-SCOUT-04-BOT-SCOUTING-USES-SCOUT-INSTEAD-OF-TANK ⬜ NOT STARTED

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

### PATCH-SCOUT-05-BOT-SCOUT-PRODUCTION ⬜ NOT STARTED

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

### PATCH-SCOUT-06-BOT-INTEL-LOOP ⬜ NOT STARTED

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

Player-side scout is DONE. Next:

```text
PATCH-SCOUT-04 — Bot использует scout вместо light_tank для разведки
```

This depends on the existing bot AI chain (10G1 scouting). Implementation should:
1. Check if enemy scout units exist
2. If yes, assign scouting task to scout instead of light_tank
3. If no scout exists, light_tank remains fallback
4. Add telemetry for scout usage

Do not start PATCH-SCOUT-05 (bot production) before 04 is accepted.
Do not start PATCH-SCOUT-06 (intel loop) before 05 is accepted.

---

## 10. Manual validation checklist for scout milestone

### Player-side ✅ ALL PASS

```text
Scout asset:
✅ visible front direction
✅ green faction panels easy to recolor
✅ no builder crane/mining cargo
✅ compact buggy silhouette
✅ transparent PNG
✅ same render framing as other units

Scout unit shell:
✅ game boots
✅ scout type exists
✅ scout can render/select
✅ scout has HP (currently 70, may be lowered for balance)
✅ scout has high vision (7)
✅ scout has no attack

Player production:
✅ units_factory can queue scout
✅ cost is correct (1 element / 18 sec)
✅ scout spawns in valid cell
✅ existing unit production still works

Movement/vision:
✅ scout moves by right-click
✅ scout does not idle-bob
✅ scout reveals larger radius than light_tank
✅ scout can be attacked/killed
```

### Bot-side ⬜ NOT STARTED

```text
Bot scouting:
⬜ bot uses scout for scouting when available
⬜ tanks remain for defense/attack
⬜ bot telemetry shows dedicated scout usage
⬜ bot does not attack hidden HQ directly

Bot production:
⬜ bot produces 1-2 scouts
⬜ bot does not starve tank production
⬜ production does not deadlock

Bot intel:
⬜ bot uses scout-gathered info for decisions
⬜ bot decides attack/defend based on knowledge
⬜ bot does not use omniscient information
```
