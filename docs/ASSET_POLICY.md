# Asset Policy

## Core rule

Assets must be imported only through scoped tasks/PRs.

Do not copy entire asset folders blindly. Each asset import should explain:

- source;
- permission/licensing status;
- target game use;
- exact files added;
- whether the asset is source material, candidate material, or product-ready runtime material.

Legacy runtime code must not be copied into Four Elements Next.

## Asset candidate gate

AI-generated, external-service-generated, manually edited, and imported raw assets are candidate-stage by default.

Do not write candidates directly into production runtime paths such as:

- `public/assets/factions/`
- `public/assets/tiles/`
- `public/assets/environment/`
- `public/assets/ui/`

Production asset integration is allowed only after the candidate passes the relevant gates:

1. source and license status recorded;
2. cleanup completed;
3. alpha/chroma background verified;
4. bbox, padding, crop, and fixed canvas checked;
5. ground anchor / visual anchor checked;
6. naming and expected frame count checked;
7. manifest or `index.json` added when applicable;
8. contact sheet or QA report created for review when applicable;
9. asset preview sandbox or in-game preview checked;
10. manual approval for production use.

For current buildings, the asset preview sandbox remains the preferred QA tool before production integration.

## Accepted building assets — closed block

The building asset block is accepted after:

- PR #51 — replaced production building PNGs for all 4 factions;
- PR #52 — tuned building render profiles and placement offsets.

Do not change these without a separate scoped decision:

- production building PNGs;
- building sprite profiles;
- `containFit` math;
- alpha-bounds logic;
- building render math;
- accepted offsets from `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`.

Expected production building files per faction:

- `hq_t1.png`
- `hq_t2.png`
- `hq_t3.png`
- `separator.png`
- `raw_storage.png`
- `matter_storage.png`
- `power_plant.png`
- `units_factory.png`
- `command_relay.png`

## Sandbox source

The Sandbox repository remains a civil/reference source:

- `ratoker-jpg/glm-game-sandbox`
- `assets/` directory

Allowed Sandbox use:

- terrain tiles;
- environment decor;
- resource node sprites;
- selected civil assets when the relevant systems are implemented.

Civil units may reuse Sandbox assets later:

- Builder;
- Harvester.

These should be copied only when the related civil systems are implemented.

## NEXT visual baseline assets

Allowed for visual baseline tasks:

- terrain tiles;
- environment decor;
- resource node sprites;
- already accepted faction building sprites.

Do not copy all Sandbox assets blindly in visual baseline tasks.

## Sandbox combat assets

Sandbox combat unit assets are not final Next product assets.

Do not reuse these Sandbox combat assets as final product units:

- `light_tank`;
- `heavy_tank`;
- `bomber`;
- `scout`.

Future combat units should use the Four Elements Next Hull + Weapon model.

## ProTanki asset source

The ProTanki archive is an approved source for future combat and animation assets.

Permission is documented in:

- `docs/assets/PROTANKI_ASSET_PERMISSION.md`

The permission covers:

- 3D models;
- textures;
- VFX/effects;
- derivative images and sprites;
- derivative materials based on the provided assets;
- public GitHub repository use;
- web version use;
- modification and free use;
- no required attribution.

## ProTanki asset handling

The ProTanki archive may be used as source material, but should not be imported into the runtime project blindly.

Recommended workflow:

1. Inventory the archive before importing anything.
2. Identify hulls, turrets/weapons, textures, lightmaps, and VFX separately.
3. Use `.3ds` files as source models in Blender or a similar tool.
4. Use `*_lightmap.jpg` and texture files as material inputs, not as standalone game sprites.
5. Render/adapt game-ready PNG sprites for the Four Elements Next isometric RTS style.
6. Commit only scoped runtime assets required by the current milestone.
7. Keep heavy raw source packs outside the runtime asset tree unless a build pipeline explicitly requires them.
8. Pass the same cleanup, normalization, anchor, manifest, and preview gates as other candidate assets.

## External AI / asset services

External tools such as ComfyUI workflows, Qwen-Image experiments, SpriteCook, MCP asset services, or similar generators are optional candidate sources only.

Allowed scope:

- UI icons;
- props;
- map decor;
- VFX candidates;
- style experiments;
- reference iterations;
- concept art.

Restricted scope:

- production combat units;
- production tanks with body/turret split;
- 16/32 direction unit sheets;
- gameplay-critical building replacements;
- production sprites without anchor/index metadata.

External output must be treated as candidate-stage until it passes the production gates above.

## Future combat direction

Future combat design:

- Hull + Weapon;
- body/hull and turret/weapon as separate visual layers where rotation is required;
- Tier 1, 2, 3 technology progression;
- M0, M1, M2, M3 unit upgrade levels;
- separate hull stats: HP, speed, control cost, size/role;
- separate weapon stats: range, damage, cooldown, projectile/VFX, targeting constraints.

Combat assets should be prepared for this model, not inherited as monolithic old unit sprites.

## Animation direction

For animated combat units, prefer model-driven output:

- hull/body rendered separately where needed;
- turret/weapon rendered separately when rotation is required;
- projectile/VFX exported as separate spritesheets;
- consistent isometric camera, scale, anchor, and 8/16/32-direction framing where relevant;
- source `.3ds` files and materials should be converted through a repeatable Blender pipeline.

This allows future turret rotation, weapon-specific firing animations, and consistent unit variants without redrawing every frame manually.

## Recommended future asset pipeline

The preferred long-term pipeline is:

```text
raw source / candidate
→ cleanup
→ sprite normalization
→ anchor validation
→ direction / frame validation
→ index.json or manifest
→ QA report / contact sheet
→ asset preview / in-game preview
→ production integration
```

Recommended future tooling candidates:

- `tools/assets/normalize_sprite.py`
- `tools/assets/build_atlas.py`
- `tools/assets/validate_asset_manifest.py`
- `assets/_raw/ai_candidates/`
- `assets/_normalized/`
- `assets/_atlases/`
- `assets/_metadata/`

These are recommendations, not current runtime requirements until implemented in a scoped tooling PR.
