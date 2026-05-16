# Asset Policy

## Core rule

Assets must be imported only through scoped tasks/PRs.

Do not copy entire asset folders blindly. Each asset import should explain:

- source;
- permission/licensing status;
- target game use;
- exact files added;
- whether the asset is source material or product-ready runtime material.

Legacy runtime code must not be copied into Four Elements Next.

## Sandbox source

The Sandbox repository remains a civil/reference source:

- `ratoker-jpg/glm-game-sandbox`
- `assets/` directory

Allowed Sandbox use:

- terrain tiles;
- environment decor;
- resource node sprites;
- faction HQ sprites;
- selected civil assets when the relevant systems are implemented.

Civil units may reuse Sandbox assets later:

- Builder;
- Harvester.

These should be copied only when the related civil systems are implemented.

## NEXT-02 visual baseline assets

Allowed for NEXT-02:

- terrain tiles;
- environment decor;
- resource node sprites;
- faction HQ sprites.

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

## Future combat direction

Future combat design:

- Hull + Weapon;
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
- consistent isometric camera, scale, anchor, and 8-direction framing;
- source `.3ds` files and materials should be converted through a repeatable Blender pipeline.

This allows future turret rotation, weapon-specific firing animations, and consistent unit variants without redrawing every frame manually.
