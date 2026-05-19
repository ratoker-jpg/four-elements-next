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

## 6. Next gameplay changes after building asset checkpoint

These are NOT part of the building asset checkpoint and should be implemented as separate PRs.

### BUILDING-PLACEMENT-01 — enforce one-tile gap between buildings

Goal:
- Buildings must not be placed directly adjacent to each other.
- New buildings should require a one-tile empty buffer around their footprint.

Rule:
- A building footprint is blocked.
- The one-tile perimeter around the footprint is also reserved for spacing.
- Another building may not occupy or overlap that reserved spacing.

Important:
- This should apply to auto-placement logic.
- This should not change visual sprite profiles.
- This should not change building PNG assets.
- This should not change construction-site visuals unless needed for debug only.

### START-STATE-01 — simplify player starting state

Goal:
- Remove all extra starting buildings.
- Player starts only with HQ/base.

Desired initial player units:
- 2 harvesters.
- 1 builder.
- 1 combat unit later, when combat unit exists.

Current note:
- The combat unit does not exist yet / is not ready yet, so do not add it now.
- For the immediate implementation, start with:
  - HQ/base only as building;
  - 2 harvesters;
  - 1 builder.

Important:
- Do not remove resource nodes.
- Do not change building assets.
- Do not change render profiles.
- Do not change economy balance unless required by tests.

## 7. Recommended next PR order

1. `BUILDING-PLACEMENT-01` — one-tile building spacing.
2. `START-STATE-01` — HQ-only start with 2 harvesters + 1 builder.
3. Later: add first combat unit to starting state after combat unit is implemented and visually ready.

Keep these as gameplay/system PRs, not asset PRs.
