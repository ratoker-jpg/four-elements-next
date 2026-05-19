# Visual Asset Pipeline Spec

Status: design source of truth for future visual asset, sprite, VFX, and combat-unit rendering work.

This document describes the target visual pipeline for Four Elements Next. It is not a claim that every rule is already implemented. Use it to scope future audits, implementation PRs, tools, tests, manual QA, and asset review.

## 1. Goal

Four Elements Next should remain a controlled 2.5D isometric RTS.

The goal is not to migrate to Unity or make the runtime fully 3D. The preferred production model is:

```text
Blender / controlled source models / controlled AI candidates
→ scripted render or cleanup
→ normalized PNG / spritesheet / atlas
→ metadata / index.json
→ layered rendering in the current game engine
```

The game should feel alive without treating every object as one flat static PNG.

## 2. Core principle

A gameplay object is not just one PNG.

A unit, combat effect, building, or map object should be treated as a visual system made of:

- base sprite or body layer;
- optional separate weapon/turret layer;
- shadow layer;
- VFX layers;
- UI overlays;
- metadata describing anchors, directions, mounts, frames, and paths.

For simple static props, one PNG is acceptable. For gameplay-critical units, tanks, weapons, VFX, and animated buildings, a single monolithic PNG is not enough.

## 3. Visual style

Target style:

- 2.5D isometric RTS;
- fixed camera angle;
- soft sci-fi industrial look;
- toy-like readable silhouettes;
- pastel/desert palette;
- clean alpha PNGs;
- no random hard outlines unless explicitly approved;
- no noisy over-detail that breaks RTS readability.

The asset must read clearly at gameplay zoom, not only as a large standalone illustration.

## 4. Why monolithic combat PNGs are not enough

A single PNG can work for a static object, but it fails for combat units.

Bad behavior:

```text
player commands tank backward
→ sprite direction instantly swaps
→ tank starts moving
→ player sees a PNG jump, not a turn
```

Target behavior:

```text
player commands tank backward
→ body rotates toward movement direction
→ tank starts moving after acceptable turn alignment
→ turret can keep aiming independently
```

The same logic applies to shots. A shot should be a sequence of visual events, not one sudden flash baked into the tank sprite.

## 5. Layered tank model

Future combat tanks should use a body/turret/effects model.

Minimum visual layers:

| Layer | Purpose | Example assets |
|---|---|---|
| Shadow | Grounds the unit, prevents floating look | `shadow_soft.png` |
| Body / hull | Main chassis, follows movement direction | `body_dir00.png` ... `body_dir15.png` |
| Turret / weapon | Aims independently from body | `turret_dir00.png` ... `turret_dir31.png` |
| Muzzle flash | Short flash at barrel | `muzzle_flash_00.png` ... `05.png` |
| Projectile | Shell / laser / rocket moving toward target | `shell_projectile.png` |
| Trail | Smoke/energy trail | particle frames or runtime particles |
| Impact | Hit effect on target/ground | `impact_00.png` ... `08.png` |
| Dust | Movement dust / track dust | `track_dust_*.png` |
| UI layer | Selection, HP, status | `selection_ring.png`, HP bar draw code |

Draw order:

1. shadow;
2. body / hull;
3. turret / weapon;
4. muzzle flash / projectile / smoke / impact;
5. selection / HP / status UI.

## 6. Body and turret angles

Combat vehicles should have independent angles.

Conceptual runtime state:

```ts
interface TankVisualState {
  bodyAngle: number;        // where the hull points / movement direction
  turretAngle: number;      // where the turret points / attack direction
  bodyTurnRate: number;
  turretTurnRate: number;
  visualState: 'idle' | 'turning' | 'moving' | 'aiming' | 'firing' | 'destroyed';
}
```

Each frame:

```ts
const bodyDir = angleToDirection(tank.bodyAngle, bodyDirCount);
const turretDir = angleToDirection(tank.turretAngle, turretDirCount);

draw(bodySprites[bodyDir]);
draw(turretSprites[turretDir]);
```

Target direction counts:

| Component | MVP | Target | Reason |
|---|---:|---:|---|
| Body / hull | 8 dirs | 16 dirs | Big shape, slower rotation |
| Turret / weapon | 16 dirs | 32 dirs | Aiming is more visible |
| Muzzle flash | 8 dirs or universal | 16 dirs | Short-lived effect |
| Projectile | runtime rotate or 16 dirs | runtime rotate or 16 dirs | Small visual footprint |
| VFX | 8–12 frames | 12–24 frames | Short, readable, not heavy |

Do not use 4 directions for combat vehicles unless it is a throwaway prototype.

## 7. Tank turning states

Target body movement model:

| State | Behavior | Visual result |
|---|---|---|
| `idle` | Body and turret keep current angles | no bobbing, no floating |
| `turning` | Body rotates toward movement target | real turn before movement |
| `moving` | Unit moves after acceptable body alignment | believable mass |
| `aiming` | Turret rotates toward target independently | can move and aim separately |
| `firing` | Recoil/flash/projectile/impact sequence | readable attack |
| `destroyed` | Wreck/death visual | persistent aftermath or fade |

Example behavior:

```ts
const targetAngle = getAngle(tank.x, tank.y, waypoint.x, waypoint.y);
const diff = angleDiff(tank.bodyAngle, targetAngle);

if (Math.abs(diff) > TURN_EPSILON) {
  tank.visualState = 'turning';
  tank.bodyAngle = rotateTowards(tank.bodyAngle, targetAngle, tank.bodyTurnRate);
  tank.speed = 0;
} else {
  tank.visualState = 'moving';
  tank.speed = tank.maxSpeed;
}
```

Rule for reverse movement:

- For MVP, do not let tanks instantly drive backward for long-distance commands.
- Prefer normal body turn before movement.
- A short slow reverse can be considered later as a separate explicit mechanic.

## 8. Turret behavior during movement

The turret does not have to match body direction.

If the tank has an attack target:

```ts
tank.turretTargetAngle = getAngle(tank.x, tank.y, enemy.x, enemy.y);
```

If there is no target:

```ts
tank.turretTargetAngle = tank.bodyAngle;
```

Then:

```ts
tank.turretAngle = rotateTowards(
  tank.turretAngle,
  tank.turretTargetAngle,
  tank.turretTurnRate,
);
```

Open design choices for future combat tuning:

- wait until turret is aligned before firing;
- allow firing with accuracy penalty;
- use different turret turn rates by weapon;
- make heavy weapons slower and more readable.

## 9. Turret mount and muzzle point

A turret must not be drawn approximately at the center.

The body needs a turret mount.

Basic metadata:

```ts
const tankVisualProfile = {
  bodyAnchor: { x: 0.5, y: 0.78 },
  turretMount: { x: 0, y: -24 },
};
```

If the body roof visibly shifts between directions, use per-body-direction mount:

```ts
const turretMountByBodyDir = {
  0: { x: 0, y: -24 },
  1: { x: 2, y: -25 },
  2: { x: 0, y: -26 },
};
```

Muzzle points are separate from turret mount.

```ts
const muzzlePointByTurretDir = {
  0: { x: 28, y: -10 },
  1: { x: 24, y: 0 },
  2: { x: 0, y: 14 },
};
```

Projectile start:

```ts
projectile.start = tank.position + turretMount + muzzlePoint;
```

## 10. Shot sequence

A shot should be a visual sequence.

| Step | Event | Required data |
|---|---|---|
| 1 | Aim | `turretAngle`, `turretTargetAngle` |
| 2 | Recoil | recoil timer, recoil offset |
| 3 | Flash | `muzzlePointByTurretDir` |
| 4 | Projectile | start, target, speed, visual type |
| 5 | Trail | smoke/energy particle settings |
| 6 | Impact | impact animation, target position |
| 7 | Cooldown | fire cooldown, recovery timer |

Do not bake projectile/impact/smoke into the base tank PNG.

## 11. Recommended combat asset structure

Suggested future structure:

```text
public/assets/factions/green/units/light_tank/
  index.json
  body/
    body_dir00.png
    body_dir01.png
    ...
    body_dir15.png
  turret/
    turret_dir00.png
    turret_dir01.png
    ...
    turret_dir31.png
  effects/
    muzzle_flash_00.png
    muzzle_flash_01.png

public/assets/effects/
  muzzle_flash/
  projectiles/
  impacts/
  dust/
  explosions/
  wrecks/
```

Important:

- body and turret must be rendered from the same camera;
- scale must match across all directions;
- anchor must be stable;
- transparent canvas size must be consistent;
- do not auto-center each frame independently.

## 12. index.json asset contract

The game should not guess directions, anchors, mounts, muzzle points, or frame counts.

A complex asset should carry metadata.

Example:

```json
{
  "id": "light_tank",
  "type": "unit",
  "frameSize": [192, 192],
  "anchor": { "x": 0.5, "y": 0.78 },
  "body": {
    "dirs": 16,
    "path": "body/body_dir{dir}.png"
  },
  "turret": {
    "dirs": 32,
    "path": "turret/turret_dir{dir}.png",
    "mount": { "x": 0, "y": -24 }
  },
  "weapon": {
    "muzzleLength": 28,
    "muzzlePointByDir": {
      "0": { "x": 28, "y": -10 },
      "1": { "x": 24, "y": 0 }
    }
  },
  "effects": {
    "muzzleFlash": {
      "frames": 6,
      "path": "effects/muzzle_flash_{frame}.png"
    }
  }
}
```

Future schemas may differ. The important rule is that metadata must be explicit and reviewable.

## 13. Anchor specs

Anchor images/specs are technical references, not just moodboards.

Each major asset type should have an anchor spec:

- `unit_anchor_spec`;
- `building_anchor_spec`;
- `effect_anchor_spec`;
- `tile_anchor_spec`.

Example unit anchor spec:

```yaml
unit_anchor_spec:
  camera_angle: fixed_isometric
  frame_size: 160x160 / 192x192
  ground_contact: fixed bottom-center point
  object_scale: stable across directions
  shadow_style: soft RTS shadow
  alpha_rules: transparent PNG preferred
  chroma_rules: red/magenta fallback only for AI outputs
  faction_colors: green/cyan/yellow/purple
  material_style: toy-like industrial sci-fi
  outline: no hard outline unless explicitly approved
```

Ground contact is critical. It affects:

- visual grounding;
- shadows;
- HP bars;
- selection rings;
- click feedback;
- sorting;
- perceived scale.

## 14. Neutral base rule

Base assets must be clean.

Do not bake temporary gameplay effects into base PNGs.

| Asset | Do not include inside base PNG | Correct approach |
|---|---|---|
| Tank body | flash, smoke, projectile, dust, selection, HP, sparks | `body_dirXX.png` + separate VFX/UI |
| Tank turret | muzzle flash, smoke trail, projectile, impact | `turret_dirXX.png` + separate muzzle/impact |
| Building | permanent construction smoke, UI icons, working effect | normal/damaged/destroyed + separate processing glow |
| Tile | fog, territory, combat effects | base tile + overlays |
| Resource | collection UI, HP bars, glow if temporary | resource sprite + optional separate sparkle/glow |

## 15. Sprite normalization pipeline

Manual cleanup is not enough. The project needs repeatable normalization.

Target pipeline:

```text
raw source / candidate
→ alpha/chroma cleanup
→ sprite normalization
→ anchor validation
→ direction validation
→ index.json generation
→ QA report / contact sheet
→ game asset integration
```

A future `normalize_sprites.py` or equivalent should:

1. read alpha PNG or chroma-background image;
2. remove chroma if needed;
3. detect object bbox;
4. check transparent padding;
5. align ground anchor;
6. output fixed canvas: `160x160`, `192x192`, or `256x256`;
7. prevent cropping;
8. validate frame count and naming;
9. generate preview/contact sheet;
10. write QA report;
11. optionally generate `index.json`.

This should reduce recurring issues:

- floating units;
- shifting bbox;
- cropped frames;
- moving HP bars;
- selection ring mismatch;
- inconsistent scale between directions;
- background/chroma artifacts.

## 16. Chroma fallback

Preferred source:

- Blender renders directly to transparent PNG alpha.

Allowed fallback for AI images/video:

- red or magenta chroma background;
- cleanup script removes chroma;
- result is normalized to transparent PNG;
- QA report checks halos and leftover background.

Do not treat checkerboard as valid image background. Checkerboard must be viewer UI only, not pixels in the PNG.

## 17. AI-image and AI-video usage

AI can help with concepts and candidates. It is not the final authority for production assets.

Allowed AI usage:

- concept variants;
- UI icon candidates;
- map props/decor candidates;
- VFX candidate frames;
- building concept iterations;
- style exploration;
- cleanup/inpaint experiments.

Restricted AI usage:

- production tanks with stable body/turret direction sets;
- gameplay-critical building replacements without preview and approval;
- final production assets without normalization;
- AI-video as main movement source for vehicles;
- random community workflows without license/tool audit.

AI-video is useful for:

- explosion;
- impact;
- fire;
- smoke;
- muzzle flash;
- energy beam;
- reactor pulse;
- crystal glow;
- resource sparkle;
- construction smoke.

AI-video is not recommended as the main source for:

- tank movement;
- turret rotation;
- harvester driving;
- builder movement;
- building geometry animation.

## 18. AI-video VFX pipeline

Recommended future VFX experiment:

```text
prompt/reference
→ 80–120 video frames
→ select 8–12 useful frames
→ remove chroma / alpha cleanup
→ normalize frame size and anchor
→ pack sprite sheet
→ generate index.json
→ integrate as short-lived effect
```

Every VFX candidate must remain candidate-stage until accepted.

## 19. Production asset stages

| Stage | Purpose | Output |
|---|---|---|
| raw | store source from Blender, AI, manual edit | not runtime-integrated |
| cleanup | remove background/artifacts | clean PNG/frames |
| normalize | align bbox, canvas, anchor, padding | stable frames |
| validate | check directions, frame count, naming, alpha | QA report |
| index | generate/load metadata | `index.json` / manifest |
| preview | check in asset preview / in-game | manual decision |
| integrate | copy to production path via scoped PR | runtime asset |

Do not skip from raw/candidate directly to production.

## 20. Recommended future folders/files

These are recommended future additions, not current runtime requirements:

```text
tools/assets/normalize_sprite.py
tools/assets/build_atlas.py
tools/assets/validate_asset_manifest.py
assets/_raw/ai_candidates/
assets/_normalized/
assets/_atlases/
assets/_metadata/
```

Recommended manifests:

```text
sprite_manifest.json
atlas_manifest.json
ai_artifacts_manifest.json
```

Manifest should record:

- source;
- prompt/reference;
- model/workflow/tool;
- seed/settings if available;
- license note;
- bbox;
- canvas size;
- anchor;
- frame count;
- direction count;
- status: candidate / rejected / approved;
- production target path if approved.

## 21. Building asset rules

Current accepted building assets are frozen by the building checkpoint.

Do not change without separate scoped decision:

- production building PNGs;
- building sprite profiles;
- contain-fit math;
- alpha-bounds logic;
- accepted offsets.

Future building candidates must use the asset candidate gate before production integration.

Building base PNGs should not include:

- UI icons;
- construction smoke;
- processing glow;
- damage sparks unless it is a dedicated damaged state;
- permanent debug marks.

Future building visual states may include:

- normal;
- under construction;
- active/processing glow;
- damaged;
- destroyed/wreck.

## 22. Map visual asset rules

Map visuals should be layered, matching `docs/gameplay/MAP_GENERATION_SPEC.md`.

Base tile must remain separate from:

- bump overlays;
- decor;
- obstacles;
- resources;
- territory;
- fog;
- combat VFX.

Do not bake territory, fog, or temporary effects into the base sand tile.

## 23. Runtime rendering constraints

For future implementation, keep these architecture rules:

- rendering reads state and draws;
- rendering does not mutate gameplay state;
- gameplay systems own gameplay rules;
- VFX systems may own temporary visual events if added;
- `src/main.ts` remains wiring only;
- no legacy `window.FE_*` globals as production architecture;
- no old sandbox `src/main.js` assumptions.

## 24. QA checklist for complex assets

A complex asset is acceptable if:

- background is transparent or correctly cleaned from chroma;
- no checkerboard pixels exist;
- no white matte / black halo;
- frame size is consistent;
- object bbox is not cropped;
- padding is safe;
- ground anchor is stable;
- scale is stable across directions;
- all expected directions exist;
- body/turret split exists for combat units that need aiming;
- turret mount is defined;
- muzzle point or muzzle length is defined when firing is supported;
- `index.json` or manifest exists when applicable;
- contact sheet is available for review when applicable;
- asset works in preview/in-game scale;
- source/license/status is recorded.

## 25. Suggested future milestones

Recommended staged work:

1. `ASSET-NORM-01` — sprite normalization tool, chroma cleanup, fixed canvas, QA report.
2. `ASSET-INDEX-01` — index.json schema for units/buildings/effects/tiles.
3. `ASSET-QA-01` — asset validation: alpha, bbox, missing frames, naming, anchor, contact sheet.
4. `VFX-AI-01` — AI-video to short VFX spritesheet experiment.
5. `COMBAT-VISUAL-01` — light tank body/turret visual MVP audit.
6. `COMBAT-VISUAL-02` — light tank body/turret implementation after approved audit.

Do not start the tank body/turret system without a Phase 1 audit.

## 26. Non-goals

Do not use this document to justify:

- full Unity migration;
- renderer rewrite without separate architecture approval;
- dumping generated assets directly into production;
- replacing accepted building assets without scoped decision;
- AI-video vehicle movement as production pipeline;
- 4-direction combat tanks as final visual standard;
- mixing combat visual architecture into unrelated civil/economy PRs.

## 27. Related docs

- `docs/ASSET_POLICY.md`
- `docs/ai/AI_TOOLING_AND_SKILLS_POLICY.md`
- `docs/gameplay/MAP_GENERATION_SPEC.md`
- `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`
- `docs/ARCHITECTURE_RULES.md`
- `docs/architecture/NEXT_ARCHITECTURE_OVERVIEW.md`
