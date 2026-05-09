@echo off
chcp 65001 >nul
cd /d "%~dp0"

py tools\audit_main.py
echo.
echo Report: "%~dp0_reports\audit\main_audit.txt"
echo.
pause
