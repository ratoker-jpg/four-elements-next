# Map Generation and Territory Spec

Status: design source of truth for future map/resource/territory work.

This document describes the target map-generation model for Four Elements Next. It is not a claim that every rule is already implemented. Use it to scope future audits, implementation PRs, tests, and manual QA.

## 1. Goal

The map must feel like a readable 2.5D isometric RTS battlefield, not a random scatter of sprites.

The target world is:

- sandy;
- soft sci-fi / industrial;
- readable at RTS zoom;
- not chessboard-like;
- playable from the first seconds;
- validated for pathfinding;
- rich enough to support expansion, resources, obstacles, territory, and later combat.

The generator should build the map from rules and validation, not from uncontrolled random placement.

## 2. Core principles

1. The map remains logically tile-based.
2. Visual output is layered.
3. Resources are placed by gameplay zones, not pure randomness.
4. Obstacles are clustered and validated.
5. Start zones are protected.
6. The first economy loop must always be possible.
7. The center must be reachable.
8. Territory is a visual/strategic layer, not a hard build blocker.
9. Every generated map must pass validation before being accepted.

## 3. Map layers

A tile can have multiple logical/visual layers.

Target tile model:

```ts
interface GeneratedTile {
  base: 'sand-light' | 'sand' | 'sand-dark';
  variant: number;
  terrainNoise: number;
  bumpOverlay?: 'sand-bump-01' | 'sand-ridge-small';
  decoration?: DecorPlacement;
  obstacle?: ObstaclePlacement;
  resource?: ResourcePlacement;
  territoryOwner?: FactionId | null;
  fogVisible?: boolean;
  passable: boolean;
}
```

Layer responsibilities:

| Layer | Purpose | Examples |
|---|---|---|
| Base tile | Main sand/ground surface | `sand-light`, `sand`, `sand-dark` |
| Variation | Breaks repetition | noise tint, alternate sand sprite |
| Bump overlay | Fake height without 3D terrain | `sand_bump_01` |
| Decor | Visual life, non-critical detail | dry bush, tiny rocks, debris |
| Obstacle | Blocks movement and shapes routes | mountain, volcano, rock cluster |
| Resource | Raw mineral deposits | small/medium/large/infinite |
| Territory | Faction-controlled overlay | cyan/green/yellow/purple plate |
| Fog | Visibility layer | fog overlay |

## 4. Terrain visual rules

The base map must be sandy and soft.

Required:

- multiple sand variants;
- noise-driven tile variation;
- subtle grid, not aggressive grid;
- small bumps and texture variation;
- no high-contrast chessboard pattern;
- no instant full-color territory carpet.

Forbidden:

- all tiles identical;
- harsh alternating light/dark tile pattern;
- territory replacing sand completely;
- territory looking like grass;
- bright acidic color overlays;
- random decor that hides important gameplay objects.

## 5. Generation sequence

Target generation should follow this order:

1. Create base map dimensions from map size.
2. Generate deterministic seed and noise fields.
3. Fill base terrain with sand variants.
4. Reserve player start zone around HQ.
5. Reserve future enemy/AI start zones when multiplayer/AI is added.
6. Clear start zones from obstacles and heavy decor.
7. Place HQ and starting units.
8. Place nearby starter resources.
9. Place mid-map resources by distance rules.
10. Place central infinite mineral deposit.
11. Place obstacle clusters.
12. Place light decor and bump overlays.
13. Build passability map.
14. Validate path from HQ to starter resources.
15. Validate path from start area to map center.
16. Validate that resources do not overlap blocked cells.
17. Validate that obstacle clusters do not trap units.
18. Finalize map data.

## 6. Start zone rules

The player start zone must be safe, open, and economically usable.

Target rules:

- HQ has enough clear surrounding tiles for starting units.
- 2 harvesters and 1 builder have valid spawn positions.
- No mountains/volcanoes inside the immediate start zone.
- No resource/decor/obstacle overlaps with HQ footprint.
- Starter resources are close enough for early harvesting.
- Path from every starting harvester to at least one starter resource must exist.
- Path from starter resources back to HQ must exist.

Suggested start-zone radii:

| Zone | Radius from HQ | Rule |
|---|---:|---|
| Core clear zone | 0–4 tiles | No obstacles, no large decor, no blocked resources |
| Starter economy zone | 4–10 tiles | Many small resources, some medium resources |
| Transition zone | 10–18 tiles | Light obstacles and more varied resources allowed |

Values are tuning defaults, not hard-coded law. Put final values in config when implemented.

## 7. Resource model

Current Next economy uses Raw, Matter, and Elements. Map mineral nodes are the source of Raw.

Target resource types:

| Resource | Purpose | Target behavior |
|---|---|---|
| `mineral_small` | Early economy | quick pickup / low amount |
| `mineral_medium` | Early-mid economy | several harvest cycles / medium amount |
| `mineral_large` | Mid-map contest | more harvest cycles / high amount |
| `mineral_infinite` | Strategic center | never fully depletes or has very high capacity |

Older wording may call these minerals/crystals. In the current Next economy, treat them as Raw mineral deposits unless a later economy spec says otherwise.

## 8. Resource distribution rules

Resources must be distributed by distance from start and center.

### Near player start

Goal: player immediately has something useful to harvest.

Required:

- many small mineral nodes near HQ;
- a small number of medium mineral nodes nearby;
- no large/infinite node directly inside the safe starter zone;
- resources placed so harvesters can reach them without crossing blocked clusters.

Suggested defaults:

```ts
if (distToStart < 8) {
  chanceSmallMineral = 0.08;
  chanceMediumMineral = 0.02;
}
```

### Mid-map

Goal: reward expansion and exploration.

Required:

- medium nodes become more common;
- large nodes begin to appear;
- resources can be near obstacles but not inside them;
- paths must remain valid.

Suggested defaults:

```ts
if (distToCenter < 20) {
  chanceMediumMineral = 0.06;
  chanceLargeMineral = 0.04;
}
```

### Map center

Goal: create a strategic contest point.

Required:

- one central `mineral_infinite` or equivalent central high-value deposit;
- reachable from the start area;
- not fully enclosed by obstacles;
- visible/important enough to guide future conflict.

Suggested rule:

```ts
if (tile near exact center) {
  placeInfiniteMineral();
}
```

## 9. Resource placement constraints

A resource must not:

- overlap HQ;
- overlap buildings or construction sites;
- overlap obstacles;
- overlap heavy decor if decor blocks movement;
- spawn outside map bounds;
- block the only path out of a start zone;
- spawn under fog/territory assumptions that break gameplay tests.

Resource placement should reserve actual footprint cells. If resource sprites are visually larger than one tile, the visual profile must not imply wrong passability.

## 10. Obstacle model

Obstacles are gameplay geometry, not just decoration.

Obstacle examples:

- `mountain_small`;
- `mountain_medium`;
- `mountain_large`;
- `mountain_ridge`;
- `volcano_small`;
- `volcano_medium`;
- `volcano_large`;
- `rock_cluster`.

Obstacle rules:

- block movement according to footprint;
- shape routes and expansion choices;
- must not block start economy;
- must not trap starting units;
- must not isolate the center;
- must not overlap resources or buildings.

Suggested footprints:

| Kind | Example footprint | Notes |
|---|---:|---|
| Small rock/mountain | 1x1 | light blocker/decor |
| Medium mountain/volcano | 2x2 | route shaping |
| Large mountain/volcano | 3x2 or 3x3 | use sparingly |
| Ridge | 3x1 or 4x1 | direction-sensitive blocker |

Footprints must come from config or profile metadata when implemented. Do not infer from sprite size alone.

## 11. Obstacle clustering rules

Obstacles should not be placed as isolated noise everywhere.

Target behavior:

1. Pick cluster centers away from start core zone.
2. Choose cluster theme: mountain, volcano, rock.
3. Place main obstacle.
4. Place 1–5 supporting smaller obstacles around it.
5. Add non-blocking decor nearby.
6. Run local passability check.
7. Reject or thin the cluster if it closes routes.

Map-size scaling:

| Map size | Obstacle density |
|---|---|
| Standard | moderate, enough to break emptiness |
| Large | higher density, more spacing, larger clusters allowed |

## 12. Decor rules

Decor gives life but should not compete with gameplay readability.

Allowed decor:

- dry bushes;
- tiny rocks;
- sand bumps;
- debris;
- small sci-fi scraps later.

Decor must:

- be sparse near start;
- not hide resources;
- not hide units;
- not imply blocked path if it is passable;
- not create visual clutter at RTS zoom.

Example rule:

```ts
if (noise > 0.65) {
  addOverlay('sand-bump');
}

if (noise > 0.75 && random < 0.15) {
  addDecor('rock-small');
}

if (nearStartZone) {
  reduceObstacleChance();
  increaseSmallMineralChance();
}
```

## 13. Territory visual model

Territory is a layer on top of the base sand.

It should read as:

- faction-colored technological plate;
- overlay placed on sand;
- not grass;
- not paint flood;
- not a full terrain replacement.

Territory must not block construction by itself.

Building placement rules should use actual blockers such as HQ, buildings, construction sites, resources, obstacles, and spacing rules. Territory ownership alone is not a build blocker unless a future explicit gameplay decision changes this.

## 14. Territory spread rules

Territory must expand slowly and visibly.

Target behavior:

- one tile per spread step;
- wave-like growth from already owned tiles;
- no instant radius fill;
- no immediate full-color start area;
- max radius from source building: 10 tiles unless config says otherwise.

For a 2x2 building:

- tile 1 colors after roughly 15 seconds;
- tile 2 after another interval;
- tile 3 after another interval;
- tile 4 by roughly 45–60 seconds total;
- after footprint tiles are colored, expansion continues outward as a wave.

This timing is a design target. Final values should be config-driven.

## 15. Territory validation and tests

Tests should cover:

- territory does not fill full radius instantly;
- 2x2 building footprint is colored gradually;
- spread does not exceed max radius;
- territory does not block construction;
- territory overlay does not replace base terrain data;
- territory rendering remains a visual layer.

## 16. Path validation

Every generated map must pass validation before use.

Mandatory validations:

1. Start core zone is not blocked.
2. Starting units have valid spawn cells.
3. At least one small/medium starter resource is reachable.
4. A harvester can reach resource and return to HQ.
5. Map center is reachable from start.
6. Infinite mineral is reachable.
7. No resource overlaps obstacle/building/HQ footprint.
8. No obstacle cluster fully encloses start or center.
9. No construction-site baseline scenario is impossible due to spacing/obstacles.

Recommended validator output:

```ts
interface MapValidationReport {
  ok: boolean;
  seed: string;
  mapSize: string;
  reachableStarterResources: number;
  centerReachable: boolean;
  infiniteReachable: boolean;
  blockedStartTiles: number;
  rejectedClusters: number;
  warnings: string[];
  errors: string[];
}
```

## 17. Tiled / external authoring direction

Tiled JSON can be used as a future authoring/exchange format.

Allowed use:

- manual or semi-manual map prototypes;
- visual review of generated maps;
- rule-based placement experiments;
- exporting map candidates to a format that can be converted for runtime.

Preferred approach:

- keep runtime data model project-controlled;
- build importer/converter only if needed;
- do not make Tiled a hard dependency before a scoped decision;
- custom generator may output Tiled-compatible JSON for review.

## 18. Recommended future tooling

Future scoped tooling PRs may add:

```text
tools/map/generate_rts_map.py
tools/map/validate_rts_map.py
tools/map/export_tiled_json.py
tools/map/render_map_contact_sheet.py
```

Tooling should generate reports, not silently mutate production assets.

Recommended outputs:

- generated map JSON;
- validation report;
- seed list;
- contact sheet / preview image;
- rejected seeds report.

## 19. Manual QA checklist

A generated map is acceptable if:

- map is sandy, soft, and not chessboard-like;
- tile variation is visible but not noisy;
- start zone is clear;
- nearby resources are visible and reachable;
- there are many small starter mineral nodes, not just one or two;
- medium/large resources appear more toward the center;
- central infinite mineral exists and is reachable;
- obstacle clusters make the map more interesting without blocking the game;
- decor adds life without hiding gameplay;
- territory grows slowly and reads as overlay;
- construction is not blocked by territory alone;
- pathfinding does not fail in normal start flow.

## 20. Non-goals

Do not use this spec to justify:

- full Unity migration;
- renderer rewrite;
- random map decoration without path validation;
- territory as hard build blocker;
- instant territory flood;
- imported map formats as mandatory runtime dependency;
- major combat/AI work mixed into mapgen PRs.

## 21. Suggested future PR split

Recommended staged work:

1. `MAPGEN-SPEC-01` — this document and tests plan only.
2. `MAPGEN-VALIDATION-01` — path/resource/center validation helpers.
3. `MAPGEN-RESOURCES-01` — distance-based starter/mid/center resource rules.
4. `MAPGEN-OBSTACLES-01` — obstacle clustering with validation.
5. `MAPGEN-VISUAL-01` — sand variation, bumps, decor layers.
6. `TERRITORY-SPREAD-01` — slow one-tile territory wave.
7. `MAPGEN-TOOLS-01` — optional contact sheets / Tiled export / seed reports.

Each stage should have its own scoped PR. Do not combine all of this into one implementation PR.
