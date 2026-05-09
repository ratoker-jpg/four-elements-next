@echo off
chcp 65001 >nul
cd /d "%~dp0"
setlocal EnableExtensions EnableDelayedExpansion

set "FOUND_8DIRS=0"

for %%F in (green cyan yellow purple) do (
  if exist "assets\factions\%%F\units\harvester_8dirs" (
    set "FOUND_8DIRS=1"
    echo [CHECK] assets\factions\%%F\units\harvester_8dirs
    py tools\assets\validate_unit_sprites.py "assets\factions\%%F\units\harvester_8dirs"
    echo.
  ) else (
    if exist "assets\factions\%%F\units\harvester.png" (
      echo [WARN] 8dir folder missing for %%F, but harvester.png exists.
    ) else (
      echo [WARN] No harvester assets found for %%F.
    )
    echo.
  )
)

if "!FOUND_8DIRS!"=="0" (
  echo [WARN] No harvester_8dirs folders were found in this project.
)

pause
