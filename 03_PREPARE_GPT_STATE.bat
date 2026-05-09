@echo off
chcp 65001 >nul
cd /d "%~dp0"

py tools\prepare_gpt_state.py
if errorlevel 1 (
  echo [ERROR] Failed to prepare _gpt_state files.
  pause
  exit /b 1
)

echo.
echo [OK] _gpt_state files refreshed.
echo.
pause
exit /b 0
