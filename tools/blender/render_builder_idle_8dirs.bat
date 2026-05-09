@echo off
cd /d "%~dp0..\.."

if not exist "_inbox\generated_assets\sprite_renders_builder_bright_v2" mkdir "_inbox\generated_assets\sprite_renders_builder_bright_v2"

if defined BLENDER_EXE (
  "%BLENDER_EXE%" --background --python "tools\blender\render_builder_idle_8dirs.py"
  goto :eof
)

where blender >nul 2>nul
if not errorlevel 1 (
  blender --background --python "tools\blender\render_builder_idle_8dirs.py"
  goto :eof
)

for %%B in (
  "D:\Games\Steam\steamapps\common\Blender\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
  "C:\Program Files\Blender Foundation\Blender\blender.exe"
) do (
  if exist %%~B (
    %%~B --background --python "tools\blender\render_builder_idle_8dirs.py"
    goto :eof
  )
)

echo Blender executable was not found.
echo.
echo Open your builder .blend in Blender, then run:
echo tools\blender\render_builder_idle_8dirs.py
echo from the Scripting tab.
pause
