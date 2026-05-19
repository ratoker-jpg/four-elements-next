# RTS Feel / Civil Sandbox Notes — 2026-05-19

Status: supplemental roadmap notes.

This document captures gameplay/visual requirements discussed during manual QA after WORLD-GEN-ARCH-01 PR #59/#60.

Use this together with:

- `docs/project/ROADMAP_CURRENT.md`
- `docs/gameplay/MAP_GENERATION_SPEC.md`
- `docs/visual/VISUAL_ASSET_PIPELINE.md`
- `docs/AI_WORKFLOW_CONTRACT.md`

These notes are not a single implementation task. They are grouped into future arches/phases.

## 1. Fog of war / visibility

Need a classic RTS-style two-layer fog system.

### Fog layers

Target model:

1. **Unexplored fog**
   - dense/black/dark fog;
   - hides terrain, resources, units, buildings, and map content;
   - used for areas never seen by the player.

2. **Explored fog / shroud**
   - lighter dark overlay;
   - terrain remains partially visible;
   - current enemy/unit activity should not be visible unless inside active vision;
   - behaves like classic RTS shroud.

3. **Visible area**
   - no fog overlay;
   - current units/buildings/resources are visible.

### Vision sources

Need to define vision radii by object type.

Known/historical direction from previous sandbox:

- buildings gave around 5–6 tiles of vision;
- territory/claimed tiles may also provide some reveal/vision;
- faction bonuses may modify visibility later.

Target to audit before implementation:

- HQ vision radius;
- normal building vision radius;
- builder vision radius;
- harvester vision radius;
- future combat unit vision radius;
- territory tile reveal radius;
- whether territory gives only explored reveal or active vision.

### Relation to factions

Previous sandbox had faction-specific bonuses. We should recover/reuse the idea, but not blindly copy old code.

Possible direction:

- faction bonuses tied to economy/production/vision/control;
- one faction may have stronger territory vision/reveal;
- bonuses must be config-driven and testable.

This belongs to a future:

```text
FOG-OF-WAR-ARCH-01
```

Suggested stages:

- Stage A — fog state model: unexplored/explored/visible;
- Stage B — vision source calculation from HQ/buildings/units;
- Stage C — render fog overlay;
- Stage D — tests + debug overlay + faction vision hooks.

Do not implement fog inside mapgen. Fog is runtime state.

## 2. Shadows

Current problem:

- buildings and units have little/no consistent shadow;
- objects can look like they float above tiles.

Target:

- all major entities need simple grounded shadows;
- buildings need footprint-aware soft shadows;
- units need smaller dynamic shadows;
- environment objects/resources may need subtle static shadows or better grounding.

Rules:

- shadows should not be baked into base PNGs unless asset explicitly requires it;
- prefer render-layer shadows or separate shadow sprites;
- shadow should help grounding, not create visual noise;
- keep Canvas 2D performance in mind.

This belongs to:

```text
VISUAL-QA-ARCH-01
```

Possible stages:

- Stage A — building shadows;
- Stage B — unit shadows;
- Stage C — environment/resource grounding/shadows;
- Stage D — QA pass at gameplay zoom.

## 3. Dust / movement feedback

Current problem:

- units feel like they slide/fly across the field;
- movement lacks weight;
- there is no readable dust/track feedback.

Target:

- dust appears only while a unit is actually moving;
- no dust while idle;
- no idle bobbing/floating;
- dust should be subtle and cheap.

### Unit dust intensity

Dust should depend on unit body/weight class:

| Class | Examples | Dust target |
|---|---|---|
| light | builder, light scout/future small units | low dust |
| medium | harvester, light tank/future medium unit | medium dust |
| heavy | heavy tank/future large unit | heavier dust |

For current civil loop:

- builder: small/light dust;
- harvester: stronger dust because it is heavier;
- future tanks: dust depends on hull/body class.

This should later connect to the future hull/body model for combat units.

Do not overdo particles. Dust must not cover resources or UI.

This belongs to:

```text
VISUAL-QA-ARCH-01
```

or a smaller:

```text
MOVEMENT-FEEDBACK-01
```

## 4. Harvester interaction distance

Current problem / risk:

- harvesters may interact with HQ/resource nodes from too far away;
- old sandbox had cases where harvesters delivered/gathered across a tile;
- that feels wrong.

Target:

- harvester must drive adjacent/in contact with a resource before gathering;
- harvester must drive adjacent/in contact with HQ/dropoff before unloading;
- no gathering/unloading through a one-tile gap;
- use clear approach cells around resource/building footprints;
- HQ/dropoff can accept delivery from any accessible adjacent side/cell.

For resources:

- 1x1 mineral: harvester must reach an adjacent approach cell or configured contact cell;
- 2x2/3x3 resource: harvester must reach a valid edge/approach cell around footprint;
- `mineral_infinite` is 3x3, so approach cells must be around the 3x3 footprint.

For HQ/buildings:

- delivery should not require all harvesters to queue into one exact tile;
- choose a nearest accessible adjacent cell around the HQ/dropoff footprint.

This belongs to:

```text
PATHFINDING-ARCH-01
```

or:

```text
HARVESTER-INTERACTION-01
```

Do not solve this with fake long-range interaction. It should be contact/adjacency-based.

## 5. Harvester carry/gather indicator

Target:

- player should understand when harvester is gathering;
- player should understand how much resource the harvester carries;
- indicator should be readable but not noisy.

Possible indicators:

- small carry bar above harvester;
- resource icon + amount above harvester;
- short gather progress indicator while mining;
- status text/card in selected unit panel.

Previous sandbox apparently had a clearer indication of gathered resources. Recover the UX idea, not necessarily the exact implementation.

This belongs to:

```text
CIVIL-UX-01
```

or:

```text
HARVESTER-UX-01
```

## 6. Unit production progress indicator

Target:

- when Units Factory produces a unit, player must see production progress;
- show how much time remains or percentage/progress bar;
- production queue should be understandable.

Possible UI:

- production panel progress bar;
- icon + timer inside factory panel;
- small overlay over factory only if not noisy.

This belongs to:

```text
CIVIL-UX-01
```

or:

```text
PRODUCTION-UX-01
```

## 7. Power shortage indicator over buildings

Target:

- if a building is offline because of insufficient Power/Energy, player must see it;
- indicator appears above affected building;
- HUD/panel also communicates the shortage.

Possible visuals:

- small warning icon above building;
- red/yellow lightning icon;
- dimmed building active effect;
- tooltip/status text in selected building panel.

Rules:

- indicator must attach to building screen anchor;
- should not block gameplay visibility;
- should update when power returns.

This belongs to:

```text
CIVIL-UX-01
```

or:

```text
POWER-UX-01
```

## 8. Construction visual / blueprint ghost

Current problem:

- construction site currently feels like a placeholder/platform/cube;
- completed building appears over the placeholder;
- the transition is too abrupt.

Target:

- when builder starts construction, show a translucent/ghost blueprint of the future building;
- footprint/platform can remain, but it should visually communicate what is being built;
- construction progress should be visible;
- builder/building animation should be considered later.

Possible approach:

- render planned building sprite with low alpha during construction;
- render scaffold/platform under it;
- gradually increase opacity/progress;
- add small construction effect later;
- do not replace accepted production building assets.

This belongs to:

```text
CONSTRUCTION-VISUAL-ARCH-01
```

or as a stage under:

```text
CIVIL-UX-01
```

## 9. Hotkeys / command model — later design discussion

Need hotkeys for:

- units;
- buildings;
- construction commands;
- production commands;
- maybe camera/debug toggles.

But do not lock final hotkeys now.

Rule:

- before implementation, explicitly discuss and approve hotkey layout;
- avoid hard-coding random hotkeys without UX decision;
- keep debug hotkeys separate from production hotkeys.

Potential future work:

```text
HOTKEYS-UX-ARCH-01
```

Do not bundle this into mapgen/economy/pathfinding PRs.

## 10. Faction bonuses / faction identity

Need to recover/finalize faction bonuses before bot/combat, but after civil loop is stable enough.

Possible bonus directions from previous project discussions:

- production speed bonus;
- construction speed bonus;
- vision/territory reveal bonus;
- unit or economy bonus.

Rules:

- faction bonuses must be config-driven;
- Random faction inherits selected faction's bonus;
- Random may have an additional starting bonus if design keeps it;
- bonuses must be visible/explainable in faction select UI.

This belongs to:

```text
FACTION-BONUS-ARCH-01
```

Do not silently add balance bonuses without UI and tests.

## 11. Where these notes fit in current roadmap

Recommended insertion into `ROADMAP_CURRENT.md` priority order:

1. `TERRITORY-TUNING-01`
2. `MAPGEN-QA-ARCH-01`
3. `ECONOMY-BASELINE-01`
4. `CIVIL-UX-01`
   - harvester indicators;
   - production progress;
   - power shortage indicators;
   - construction blueprint/progress;
5. `DEV-SANDBOX-ARCH-01`
6. `UI-SHELL-ARCH-01`
7. `PATHFINDING-ARCH-01`
   - real adjacency-based gather/dropoff;
   - movement/click feedback;
8. `VISUAL-QA-ARCH-01`
   - shadows;
   - dust;
   - grounding;
   - no idle bobbing;
9. `FOG-OF-WAR-ARCH-01`
10. `FACTION-BONUS-ARCH-01`
11. `HOTKEYS-UX-ARCH-01`
12. combat visual work later
13. enemy bot later

Possible adjustment:

- `FOG-OF-WAR-ARCH-01` may move before `PATHFINDING-ARCH-01` if map exploration becomes the next target.
- `DEV-SANDBOX-ARCH-01` may move earlier if manual QA becomes too slow.

## 12. Do not implement now without audit/scope

Do not directly implement all notes at once.

These notes are requirements for future scoped work.

Small safe tasks:

- territory tuning;
- UI text fixes;
- debug overlay additions;
- minor constants/config updates.

Big audit tasks:

- fog of war;
- pathfinding/adjacent interactions;
- shadows/dust visual model;
- faction bonuses;
- hotkeys command model;
- construction visual architecture.
