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

Published viewer:

- GitHub Pages: `https://ratoker-jpg.github.io/four-elements-next/tools/sprite-viewer/`

## Files

- `index.html` - single-file viewer with plain HTML, CSS, and JavaScript
- `sprite-manifest.json` - optional published-sheet list for GitHub Pages deployments

## How to open locally

1. Open `tools/sprite-viewer/index.html` directly in a browser or via `file://`.
2. Load a primary local `.png` sprite sheet using the file picker or drag and drop.
3. Optionally load a second `.png` into the comparison slot.
4. Adjust frame size, direction row, preset window, anchor, footprint guide, FPS, scale, and background mode as needed.

No build step, package install, or dev server is required for the viewer itself.

In local `file://` mode, the repository manifest loader may be unavailable depending on browser security rules. Manual local PNG loading still works and remains the default workflow.

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

- optional repository-sheet loading through `sprite-manifest.json` on the published GitHub Pages copy;
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

## Published path

The project build publishes the viewer to:

- `/four-elements-next/tools/sprite-viewer/` on GitHub Pages
- `dist/tools/sprite-viewer/` in local build output

The canonical editable source stays in `tools/sprite-viewer/`. The Vite build emits the standalone viewer HTML and manifest into the deployable output so the game runtime and `src/` remain untouched.

## Manifest format

The optional manifest file is `tools/sprite-viewer/sprite-manifest.json`.

Current default:

```json
{
  "sheets": []
}
```

Future entries can use this shape:

```json
{
  "sheets": [
    {
      "label": "Builder draft sheet",
      "src": "../../assets/example/path.png"
    }
  ]
}
```

If the manifest is empty, the viewer shows `No repository sheets available.` and continues to work with manual local PNG loading.

## Comparison workflow

Use comparison mode when you want to check an older sheet against a regenerated sheet:

1. Load the original PNG as the primary sheet.
2. Load the regenerated PNG as the secondary sheet.
3. Choose the same unit preset, state window, direction row, and anchor values.
4. Watch both previews and both sheet inspectors while the loop advances.

Because both sheets stay locked to the same frame window and anchor guide, vertical drift and grounding changes are much easier to spot.

## Scope reminder

This tool is intentionally isolated under `tools/sprite-viewer/` for art and animation inspection. It is not part of the runtime pipeline and does not change gameplay, units, production systems, or asset manifests.
