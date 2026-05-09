@echo off
chcp 65001 >nul
cd /d "%~dp0\..\.."

echo [INFO] Make sure the game server is running:
echo        http://127.0.0.1:8010/index.html
echo.
echo [INFO] Starting Playwright codegen...
cmd /c npx.cmd playwright codegen http://127.0.0.1:8010/index.html
echo.
pause
