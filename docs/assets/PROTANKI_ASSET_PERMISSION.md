# ProTanki Asset Permission

**Date:** 16 May 2026

## Parties

**Licensor:** ProTanki team

**Licensee:** Denis, developer of the Four Elements Next project

## Permission subject

The ProTanki team confirms that it transferred an asset archive on **16.05.2026** and permits Denis to use, modify, publish, and distribute these materials and derivative assets in the **Four Elements Next** project, including the public GitHub repository and the web version of the game.

## Granted rights

The permission covers:

- 3D models
- textures
- VFX/effects
- derivative images and sprites
- derivative materials based on the provided assets

## Usage terms

- **Term:** perpetual
- **Cost:** free to use
- **Modification:** allowed
- **Distribution:** derivative materials may be distributed
- **Attribution:** not required

## Allowed distribution targets

The permission applies to:

1. The public GitHub repository of Four Elements Next.
2. The web version of Four Elements Next.
3. Other distribution platforms for Four Elements Next.

## Evidence / storage note

This permission was provided in text form via Telegram/email. The original message/export should be preserved outside the public repository as supporting evidence.

## Asset handling policy for Four Elements Next

The archive is an approved asset source, but it should not be copied blindly into the product repository.

Recommended use:

1. Keep the original archive and source files as a controlled source package.
2. Convert or render only the required assets for a scoped gameplay milestone.
3. Commit only optimized product assets needed by the game, unless source files are explicitly required for the build pipeline.
4. Keep generated assets aligned with the Four Elements Next style: isometric, readable at RTS scale, and compatible with the current faction/color system.

## Format notes

Some archive files are not directly game-ready sprites:

- `.3ds` files are source 3D models. Use Blender or another 3D tool to inspect, modify, and render them into game-ready sprites.
- `*_lightmap.jpg` files are usually baked lighting/UV maps. They are not standalone sprites. They make sense together with the matching 3D model and UV layout.
- Detail/color textures may need cleanup, recoloring, resolution normalization, and alpha output before use.
- VFX images should be reviewed and converted into sprite sheets only in a dedicated VFX task.

## Combat design use

For future combat, these assets may be used as a source for the Four Elements Next Hull + Weapon system.

Allowed direction:

- use models/textures/effects as source material;
- render or adapt derivative isometric sprites;
- build new product names and balancing around Four Elements Next mechanics.

Preferred product model:

- hulls define HP, speed, control cost, and role;
- weapons define range, damage type, cooldown, projectile/effect, and role;
- upgrades use M0/M1/M2/M3 levels;
- technology tiers unlock stronger hulls/weapons.

## Current limitation

This permission does not mean that all ProTanki assets should be imported immediately. Asset import must remain scoped by task/PR.

For the current civil stage, the priority remains:

- NEXT-05A: fix civil building footprints to 2x2;
- later: civil building visuals / builder / harvester assets;
- later: combat Hull + Weapon assets.
