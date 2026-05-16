# Sprite Viewer

This folder contains a standalone local HTML viewer for previewing Four Elements civil unit sprite sheets such as Builder and Harvester animations.

It is a tools-only utility:

- it does not affect game runtime;
- it does not modify rendering in `src/`;
- it does not integrate sprite sheets into gameplay;
- it does not require any committed sprite assets.

Related docs:

- sprite sheet contract: `docs/assets/CIVIL_SPRITE_SHEET_SPEC.md`
- prompt pack: `tools/sprite-viewer/PROMPTS.md`

## Files

- `index.html` - single-file viewer with plain HTML, CSS, and JavaScript
- `sprite-manifest.json` - optional repository sheet list used by the published GitHub Pages copy

## Published viewer

When the app is built for GitHub Pages, the viewer is copied into the site output and published at:

- `https://ratoker-jpg.github.io/four-elements-next/tools/sprite-viewer/`

The source of truth remains `tools/sprite-viewer/index.html`, so opening the file directly via `file://` still works for local art review.

## How to open locally

1. Open `tools/sprite-viewer/index.html` directly in a browser or via `file://`.
2. Load a primary local `.png` sprite sheet using the file picker or drag and drop.
3. Optionally load a second `.png` into the comparison slot.
4. Adjust frame size, direction row, preset window, anchor, footprint guide, FPS, scale, and background mode as needed.

No build step, package install, or dev server is required for the viewer itself.

When the viewer is opened from the deployed site, it also looks for `sprite-manifest.json` in the same folder. If the manifest has no entries, the UI shows `No repository sheets available.` and the rest of the viewer still works normally.

## What the viewer can inspect

The viewer assumes a grid-based sprite sheet:

- each frame occupies a fixed cell;
- default frame size is `128 x 128`;
- default row count is `8`;
- animation frames advance left to right across columns;
- direction changes advance top to bottom across rows.

Default direction row labels:

1. east
2. south-east
3. south
4. south-west
5. west
6. north-west
7. north
8. north-east

The tool now includes:

- configurable anchor controls with default `x=50%`, `y=84%`;
- a toggleable crosshair and ground point marker;
- anchor pixel readouts for the current frame and sheet position;
- toggleable footprint overlays for `1x1`, `2x2`, and `3x3` visual guides;
- side-by-side primary and secondary comparison views when a second sheet is loaded;
- synced preview and sheet-inspector panels for both sheets;
- optional frame grid and background test surfaces.

Footprint overlays are viewer-only guides. They are meant to help judge grounding and perceived bulk around the anchor point, not to define runtime tile sizes or gameplay footprints.

## Default Four Elements civil unit contract

The viewer includes the current expected civil animation windows and makes switching between them easier through unit and state selectors.

### Builder

- idle: `startCol 0`, `frames 1`
- move: `startCol 1`, `frames 4`
- build/work: `startCol 5`, `frames 6`

### Harvester

- idle: `startCol 0`, `frames 1`
- move: `startCol 1`, `frames 4`
- load: `startCol 5`, `frames 6`
- unload: `startCol 11`, `frames 6`

These presets only configure the viewer UI. They do not connect the sheets to the game.

## Comparison workflow

Use comparison mode when you want to check an older sheet against a regenerated sheet:

1. Load the original PNG as the primary sheet.
2. Load the regenerated PNG as the secondary sheet.
3. Choose the same unit preset, state window, direction row, and anchor values.
4. Watch both previews and both sheet inspectors while the loop advances.

Because both sheets stay locked to the same frame window and anchor guide, vertical drift and grounding changes are much easier to spot.

## Scope reminder

This tool is intentionally isolated under `tools/sprite-viewer/` for art and animation inspection. It is not part of the runtime pipeline and does not change gameplay, units, production systems, or asset manifests.
