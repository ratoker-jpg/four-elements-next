# Civil Sprite Sheet Spec

## Purpose

This document defines the contract for Builder and Harvester civil unit sprite sheets used by the standalone viewer from CIVIL-ANIM-00.

The goal of the contract is to keep generated art predictable across tools and prompt iterations so the same sheet can be inspected reliably without runtime integration work.

This is a docs-only asset specification. It does not change game runtime, `src/`, gameplay, production systems, or asset manifests.

## PNG Format

- Output format: PNG
- Background: transparent
- No labels, captions, row names, or frame numbers inside the generated image
- No grid, panel borders, or watermark inside the generated image
- Columns represent animation frames
- Rows represent facing directions

## Grid Contract

- Default frame cell size: `128 x 128`
- Direction row count: `8`
- Default row order:
  - `0` east
  - `1` south-east
  - `2` south
  - `3` south-west
  - `4` west
  - `5` north-west
  - `6` north
  - `7` north-east

## Builder Layout

- Block name: Builder
- Idle: `startCol 0`, `frames 1`
- Move: `startCol 1`, `frames 4`
- Build/work: `startCol 5`, `frames 6`
- Total columns: `11`
- Expected sheet size: `1408 x 1024`

## Harvester Layout

- Block name: Harvester
- Idle: `startCol 0`, `frames 1`
- Move: `startCol 1`, `frames 4`
- Load: `startCol 5`, `frames 6`
- Unload: `startCol 11`, `frames 6`
- Total columns: `17`
- Expected sheet size: `2176 x 1024`

## Anchor Rule

- Keep a consistent ground contact point across all frames
- Recommended anchor: around `x=50%`, `y=84%`
- Do not let the unit appear to jump, sink, or drift between frames unless the motion itself requires it

## Scale Rule

- Keep the same unit size in every frame
- Do not use per-frame auto-crop
- Preserve stable framing so each cell stays aligned to the same visual footprint

## Visual Style

- Soft sci-fi RTS
- Readable mobile RTS silhouette
- Hand-painted pixel-art feel
- Warm desert palette
- Cyan/blue accent details
- No photorealism

## Authoring Notes

- Treat each row as one facing direction and each column span as one animation block
- Keep silhouettes readable at small game-view scales
- Favor clean separation between chassis/body mass and tool or cargo details
- Leave transparent padding inside the cell when needed, but keep the anchor and scale rules stable

## Viewer Compatibility Summary

The standalone viewer expects:

- fixed-size cells
- 8 direction rows in the row order above
- animation windows placed at the exact start columns listed above
- transparent PNG sheets without overlays or embedded guide marks

If those rules are followed, the sheet should preview correctly in `tools/sprite-viewer/index.html`.
