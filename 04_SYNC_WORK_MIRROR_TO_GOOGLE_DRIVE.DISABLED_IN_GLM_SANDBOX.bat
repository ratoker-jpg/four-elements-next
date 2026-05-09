@echo off
chcp 65001 >nul
setlocal EnableExtensions

REM =========================================================
REM Four Elements - Google Drive WORK mirror sync
REM Run from canonical project root:
REM C:\Users\Den\Desktop\four elements\four_elements_core_base
REM
REM Default mirror path auto-detects:
REM   G:\Мой диск\FourElements_WORK_MIRROR
REM   G:\My Drive\FourElements_WORK_MIRROR
REM
REM Optional explicit path:
REM   04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat "G:\Мой диск\FourElements_WORK_MIRROR"
REM =========================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

if not exist "%ROOT%\src\" (
  echo [ERROR] src folder not found. Run this BAT from project root.
  pause
  exit /b 1
)

if not exist "%ROOT%\index.html" (
  echo [ERROR] index.html not found. Run this BAT from project root.
  pause
  exit /b 1
)

echo.
echo [Four Elements] Google Drive mirror sync
echo Root: "%ROOT%"
echo.

echo [STEP 1/3] Refreshing _gpt_state...
py tools\prepare_gpt_state.py
if errorlevel 1 (
  echo [ERROR] Failed to prepare _gpt_state files.
  pause
  exit /b 1
)

echo.
echo [STEP 2/3] Building GPT context zip...
call "%ROOT%\01_BUILD_GPT_CONTEXT_WORK.bat" /nopause
if errorlevel 1 (
  echo [ERROR] Failed to build GPT context zip.
  pause
  exit /b 1
)

echo.
echo [STEP 3/3] Syncing lightweight mirror...
if "%~1"=="" (
  py tools\sync_work_mirror.py
) else (
  py tools\sync_work_mirror.py "%~1"
)
if errorlevel 1 (
  echo [ERROR] Mirror sync failed.
  pause
  exit /b 1
)

echo.

REM PATCH-INFRA-VISUAL-SCREENSHOTS-HARD-SYNC START
echo.
echo [STEP] Syncing visual screenshots...
py tools\sync_visual_screenshots.py
if errorlevel 1 (
  echo [WARN] Visual screenshots sync failed or skipped.
)
REM PATCH-INFRA-VISUAL-SCREENSHOTS-HARD-SYNC END

echo [OK] Google Drive WORK mirror synced.
echo.
pause
exit /b 0
