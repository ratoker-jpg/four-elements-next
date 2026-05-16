# NEXT-00 Blueprint

Status: approved baseline after NEXT-00 audit.

## Goal

Build Four Elements Next as a new clean isometric RTS project.

First playable version is a civil sandbox, not a combat game.

## Stack

- TypeScript strict mode
- Vite
- Canvas 2D for world rendering
- HTML overlay for menus and UI
- Vitest for unit tests
- Playwright for E2E tests

## First playable scope

Included:

- product-like main menu
- New Game flow
- faction and map size selection
- isometric desert map
- camera pan and zoom
- Raw gathering
- Matter and Element production
- Power system
- Control system
- Builder and Harvester
- civil buildings

Excluded from first playable:

- combat units
- enemy AI
- fog of war
- territory
- save/load
- multiplayer

## Economy model

Old model `Raw or Minerals -> Energy + Element` is rejected.

New model:

- Raw: gathered from map.
- Matter: construction resource.
- Element: faction resource for units, tech, upgrades.
- Power: building power and upkeep, not currency.
- Control: active unit cap.

Separator formula:

- 15 Raw -> 10 Matter + 1 Element

## Power

Power Plant and Energy Reactor produce Power.
Buildings consume Power.

Power priority:

1. HQ always online.
2. Power producers always online.
3. Command Relay high priority.
4. Separator medium priority.
5. Units Factory medium or low priority.
6. Storage passive.

Death spiral is forbidden. Player must not get stuck without a path to restore Power.

## Control

- HQ gives +10 Control.
- Command Relay gives +5 Control.
- Command Relay consumes 1 Power.
- MVP Control cap is 50.
- Future cap is 100.

Control is checked when production is queued.
Queued units should not become stuck if Control later changes.

## Civil buildings v0.1

- HQ
- Separator
- Storage
- Power Plant
- Units Factory
- Command Relay

Optional later:

- Energy Reactor
- Element Vault

## Civil units v0.1

- Builder
- Harvester

Starting setup:

- HQ
- 1 Builder
- 1 Harvester
- 0 Raw
- 100 Matter
- 3 Element

## Future combat design

Future combat is based on:

- Hull + Weapon
- Base Tier 1, 2, 3
- Unit M-level M0, M1, M2, M3 through experience

Future Tier 1 examples:

Hulls:

- Wasp
- Hornet
- Titan

Weapons:

- Smoky
- Rail

Combat is not part of the civil-first version.
