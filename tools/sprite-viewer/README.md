# Sprite Viewer

This folder contains a standalone local HTML viewer for previewing future Four Elements civil unit sprite sheets such as Builder and Harvester animations.

It is a tools-only utility:

- it does not affect game runtime;
- it does not modify rendering in `src/`;
- it does not integrate sprite sheets into gameplay;
- it does not require any committed sprite assets.

## Files

- `index.html` - single-file viewer with plain HTML, CSS, and JavaScript

## How to open locally

1. Open `tools/sprite-viewer/index.html` directly in a browser.
2. Load a local `.png` sprite sheet using the file picker or drag and drop.
3. Adjust frame size, row, FPS, frame range, scale, and background mode as needed.

No build step, package install, or dev server is required for the viewer itself.

## Expected sprite sheet layout

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

The tool also shows:

- current animation frame number;
- current source crop rectangle;
- optional frame grid;
- optional anchor marker;
- a sheet inspector highlighting the active row and current frame.

## Default Four Elements civil unit contract

The viewer includes presets for the current expected civil animation windows.

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

## Scope reminder

This tool is intentionally isolated under `tools/sprite-viewer/` for art and animation inspection. It is not part of the runtime pipeline and does not change gameplay, units, production systems, or asset manifests.
