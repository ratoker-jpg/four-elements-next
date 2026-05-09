@echo off
cd /d "%~dp0..\.."

if not exist "_inbox\generated_assets" mkdir "_inbox\generated_assets"

if defined BLENDER_EXE (
  "%BLENDER_EXE%" --background --python "tools\blender\render_separator.py"
  goto :eof
)

where blender >nul 2>nul
if not errorlevel 1 (
  blender --background --python "tools\blender\render_separator.py"
  goto :eof
)

for %%B in (
  "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 5.0\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 4.3\blender.exe"
  "C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"
  "C:\Program Files\Blender Foundation\Blender\blender.exe"
  "D:\Games\Steam\steamapps\common\Blender\blender.exe"
  "C:\Program Files (x86)\Steam\steamapps\common\Blender\blender.exe"
) do (
  if exist %%~B (
    %%~B --background --python "tools\blender\render_separator.py"
    goto :eof
  )
)

echo Blender executable was not found.
echo.
echo If Blender is open, you can still run this manually:
echo 1. In Blender: Scripting tab
echo 2. Open tools\blender\render_separator.py
echo 3. Press Run Script
echo.
echo Or set BLENDER_EXE to your blender.exe path.
pause
