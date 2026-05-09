# Blender Separator Pipeline

This folder contains the first test pipeline for making a 3D source asset for the separator building.

Output target:

- `_inbox/generated_assets/separator_3d_cyan.png`
- `_inbox/generated_assets/separator_3d_cyan.blend`

Run:

```bat
tools\blender\render_separator.bat
```

If Blender is not in `PATH`, set `BLENDER_EXE` first:

```bat
set BLENDER_EXE=C:\Program Files\Blender Foundation\Blender 4.3\blender.exe
tools\blender\render_separator.bat
```

The script does not replace the live game asset. After rendering, inspect the PNG first. If it looks usable, copy it manually or with a later scripted step to:

`assets\factions\cyan\buildings\separator.png`

Current game reference:

- Building footprint: `src/config/buildings.js`, `FE_BUILDING_SIZE.separator = [2,2]`
- Visual profile: `src/config/sprite_profiles.js`, `buildings.separator.size = [128,128]`
- Current source asset: `assets/factions/cyan/buildings/separator.png`
