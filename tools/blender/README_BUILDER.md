# Builder Export Pipeline

This pipeline renders the builder from the current Blender scene into 8dir sprite files for all 4 factions.

How it works:

- renders 4 unique directions: `0, 2, 4, 6`
- duplicates them to fill the game's 8dir folder structure
- applies faction palettes for `green`, `cyan`, `yellow`, and `purple`
- writes PNGs into `_inbox/generated_assets/sprite_renders_builder_bright_v2/<faction>/`
- mirrors the same idle PNGs into `assets/factions/<faction>/units/builder_8dirs/`
- writes a `manifest.txt` in the staging root and in each faction folder

Run options:

```bat
tools\blender\render_builder_idle_8dirs.bat
```

If you have the builder open in Blender already, you can also:

1. Open `tools/blender/render_builder_idle_8dirs.py` in the Scripting workspace.
2. Press `Run Script`.

Relevant mapping reference:

- `window.FE_BUILDER_DIR_MAP = [0, 0, 0, 2, 4, 4, 6, 6]`
- `window.FE_BUILDER_FORCE_DIR = null`

Notes:

- The script keeps the geometry, rig, canvas, and naming conventions intact.
- The live game folders are intentionally idle-only while `FE_BUILDER_USE_MOVE_FRAMES = false`.
- Old `builder_move_*` assets were backed up before cleanup.
- It does not overwrite the old staging folder `sprite_renders_builder`.
- The live game assets use the same filenames in `assets/factions/<faction>/units/builder_8dirs/`.
- If you want to inspect what changed, open `_inbox/generated_assets/sprite_renders_builder_bright_v2/manifest.txt` or the per-faction `manifest.txt` files.
