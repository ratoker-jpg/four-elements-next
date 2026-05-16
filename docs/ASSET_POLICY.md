# Asset Policy

## Source

Sandbox repository is the asset source:

- `ratoker-jpg/glm-game-sandbox`
- `assets/` directory

Assets can be copied into Next, but legacy runtime code must not be copied.

## Civil assets

Civil units may reuse Sandbox assets later:

- Builder
- Harvester

These are not part of NEXT-01.
They should be copied only when the relevant civil systems are implemented.

## NEXT-02 visual baseline assets

Allowed for NEXT-02:

- terrain tiles
- environment decor
- resource node sprites
- faction HQ sprites

Do not copy all assets blindly in NEXT-02.

## Combat assets

Sandbox combat unit assets are not final Next product assets.

Do not reuse as product units:

- light_tank
- heavy_tank
- bomber
- scout

Future combat units will use new assets and design based on Hull + Weapon.

## Future combat direction

Future combat design:

- Hull + Weapon
- Tier 1, 2, 3
- M0, M1, M2, M3 unit upgrade levels

Combat assets should be created for that model, not inherited from Sandbox combat units.
