@echo off
chcp 65001 >nul
cd /d "%~dp0"

for %%D in (
  "assets\factions\green\units\builder_8dirs"
  "assets\factions\cyan\units\builder_8dirs"
  "assets\factions\yellow\units\builder_8dirs"
  "assets\factions\purple\units\builder_8dirs"
) do (
  if exist %%~D (
    echo [CHECK] %%~D
    py tools\assets\validate_unit_sprites.py %%~D
    echo.
  ) else (
    echo [WARN] Folder not found: %%~D
    echo.
  )
)

pause
