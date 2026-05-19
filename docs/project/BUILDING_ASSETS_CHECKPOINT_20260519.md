# BUILDING-ASSETS-CHECKPOINT — 2026-05-19

Status: accepted / closed.

This checkpoint freezes the current building asset integration state after ASSET-BUILDINGS-01.

## 1. Accepted PRs

### PR #51 — ASSET-BUILDINGS-01: replace faction building PNGs

Purpose:
- Replace production building PNG assets for all four factions.

Source archive:
- `four_elements_buildings_clean_factions_v03_redbg.zip`

Changed assets:
- 36 PNG files total.
- 4 factions × 9 building PNGs.

Production folders:
- `public/assets/factions/cyan/buildings/`
- `public/assets/factions/green/buildings/`
- `public/assets/factions/yellow/buildings/`
- `public/assets/factions/purple/buildings/`

Expected files per faction:
- `hq_t1.png`
- `hq_t2.png`
- `hq_t3.png`
- `separator.png`
- `raw_storage.png`
- `matter_storage.png`
- `power_plant.png`
- `units_factory.png`
- `command_relay.png`

Scope:
- Asset-only.
- No code changes.
- No package files.
- No dist files.
- No reports/contact sheets committed.

### PR #52 — ASSET-BUILDINGS-01: tune faction building sprite profiles

Purpose:
- Tune production sprite profiles for the new building PNGs.
- Align production rendering with asset-preview values.

Changed files:
- `src/core/constants.ts`
- `src/render/buildings.ts`
- `src/render/debug-overlay.ts`

No PNGs changed in PR #52.

## 2. Accepted building render profile values

| Profile | Final size | groundOffset | screenOffsetX | screenOffsetY |
|---|---:|---:|---:|---:|
| `hq_base` | `200x200` | `2` | `-2` | `-2` |
| `building_separator` | `128x128` | `2` | `-2` | `-2` |
| `building_raw_storage` | `128x128` | `2` | `-2` | `-2` |
| `building_matter_storage` | `128x128` | `2` | `-2` | `-2` |
| `building_power_plant` | `128x128` | `2` | `-2` | `-2` |
| `building_units_factory` | `128x128` | `2` | `-2` | `-2` |
| `building_command_relay` | `65x65` | `2` | `-2` | `-2` |

Interpretation:
- `groundOffset: 2` matches asset-preview `Vertical Offset = 2px`.
- `screenOffsetX: -2`, `screenOffsetY: -2` is a separate screen-space anchor correction.
- Do not confuse vertical offset with screen-space offset.

## 3. Rendering decisions kept unchanged

Do not reopen unless there is clear new evidence:
- `containFit` math remains unchanged.
- Alpha-bounds logic remains unchanged.
- Asset manifest paths remain unchanged.
- Building gameplay/construction logic remains unchanged.
- PNG assets are considered accepted.

## 4. Current manifest expectations

Current game code already references:
- HQ from `assets/factions/<faction>/buildings/hq_t1.png`.
- Buildings from `assets/factions/<faction>/buildings/<building>.png`.

No code rename is needed for current building assets.

## 5. Manual QA acceptance notes

Accepted visual targets:
- 1x1 buildings: `65x65`.
- 2x2 buildings: `128x128`.
- 3x3 HQ: `200x200`.
- `Vertical Offset = 2px`.
- Common visual anchor correction: `-2 / -2` screen pixels.

Asset-preview sandbox remains the preferred QA tool for future candidate assets.

## 6. Post-checkpoint gameplay PRs — completed

These gameplay/system PRs were planned after the building asset checkpoint and are now complete.

### PR #54 — BUILDING-PLACEMENT-01: enforce one-tile gap between buildings

Status: implemented and merged.

Result:
- Auto-placement requires a one-tile empty buffer around building/construction-site footprints.
- New buildings and construction sites do not place directly adjacent to HQ, buildings, or construction sites.
- This is not implemented as a global occupied-set rule for resources/decor/builders.
- Resources/decor/builders still block actual footprint cells, not the spacing perimeter.

Important:
- Building PNG assets were not changed.
- Building render profiles were not changed.
- This was a gameplay/system PR, not an asset PR.

### PR #55 — START-STATE-01: simplify player starting state

Status: implemented and merged.

Result:
- Removed all extra starting buildings.
- Player starts with HQ/base only as building.
- Player starts with:
  - 2 harvesters;
  - 1 builder.
- No starting separator.
- No starting raw-storage.
- No starting power-plant.
- No starting command-relay.
- Harvester delivery falls back to HQ when no raw-storage exists.
- If raw-storage is built later, harvester delivery should prefer it where appropriate.
- `buildOccupiedSet()` now treats buildings and construction sites as full footprint areas, not only origin tiles.

Current starting values after PR #55:
- Buildings: 0 extra buildings beyond HQ/base.
- Builders: 1.
- Harvesters: 2.
- Raw: `0/200`.
- Matter: `100/200`.
- Active faction element: `3/10`.
- Power: net `+2`.
- Control: `3/10`.

## 7. Current next-step note

Do not treat `BUILDING-PLACEMENT-01` or `START-STATE-01` as pending work. They are complete.

Possible future gameplay work must be scoped separately. Examples:

- first combat unit after combat visuals/gameplay are ready;
- civil loop balance tuning;
- map generation improvements;
- asset pipeline tooling;
- combat visual architecture.

Keep future work as separate scoped PRs. Do not reopen the accepted building asset block unless there is clear new evidence and an explicit decision.
