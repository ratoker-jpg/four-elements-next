@echo off
setlocal EnableExtensions EnableDelayedExpansion

cd /d "%~dp0" 1>nul

echo [Four Elements] Playwright visual scenarios
echo Root: "%CD%"

set "SCENARIO=%~1"
if "%SCENARIO%"=="" (
  set /p "SCENARIO=Scenario [all/victory/defeat/hud]: "
)
if "%SCENARIO%"=="" set "SCENARIO=all"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js is not available in PATH.
  pause
  exit /b 1
)

REM Start local server if port 8010 is not reachable.
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8010/index.html' -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>nul
if errorlevel 1 (
  echo [INFO] Local server on 8010 not detected. Starting it in a separate window...
  start "Four Elements 8010" /min cmd /c "cd /d "%CD%" && py -m http.server 8010"
  timeout /t 3 /nobreak >nul
) else (
  echo [INFO] Local server on 8010 is already running.
)

echo [INFO] Running visual scenario: %SCENARIO%
node tools\visual_scenarios.mjs "%SCENARIO%"
if errorlevel 1 (
  echo [ERROR] Visual scenario failed.
  pause
  exit /b 1
)

echo.
echo [OK] Visual screenshots written to _reports\screenshots\latest
echo.
echo [INFO] Sandbox mode: screenshots stay local only and are not copied to Google Drive mirror.
pause
exit /b 0
