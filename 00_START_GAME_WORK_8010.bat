@echo off
cd /d "%~dp0"

start "Four Elements Server" cmd /k "py -m http.server 8010"

timeout /t 1 /nobreak >nul

start "" "http://localhost:8010/index.html"
