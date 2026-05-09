@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =========================================================
REM Four Elements - patch runner + JS checker
REM Run this BAT from the project root:
REM C:\Users\Den\Desktop\four elements\four_elements_core_base
REM
REM Default patch name:
REM   patch.py
REM
REM Usage options:
REM   1) Put your patch script in project root as patch.py
REM      then double-click this BAT.
REM
REM   2) Or run:
REM      02_RUN_PATCH_AND_CHECK.bat patch_some_name.py
REM
REM   3) Or drag a Python patch file onto this BAT.
REM =========================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo [Four Elements] Patch runner
echo Root: "%ROOT%"
echo.

if not exist "%ROOT%\src\" (
  echo [ERROR] src folder not found.
  echo Put this BAT into the project root and run it from there.
  pause
  exit /b 1
)

if not exist "%ROOT%\index.html" (
  echo [ERROR] index.html not found.
  echo Put this BAT into the project root and run it from there.
  pause
  exit /b 1
)

set "PATCH=%~1"

if "%PATCH%"=="" (
  set "PATCH=%ROOT%\patch.py"
) else (
  if not exist "%PATCH%" (
    if exist "%ROOT%\%PATCH%" set "PATCH=%ROOT%\%PATCH%"
  )
)

if not exist "%PATCH%" (
  echo [ERROR] Patch file not found:
  echo "%PATCH%"
  echo.
  echo Expected default:
  echo "%ROOT%\patch.py"
  echo.
  echo Options:
  echo - Rename your Python patch to patch.py
  echo - Or run: 02_RUN_PATCH_AND_CHECK.bat patch_some_name.py
  echo - Or drag the .py patch file onto this BAT
  pause
  exit /b 1
)

echo [INFO] Patch file:
echo "%PATCH%"
echo.

echo [STEP 1/2] Running Python patch...
pushd "%ROOT%" >nul
py "%PATCH%"
set "PATCH_EXIT=%ERRORLEVEL%"
popd >nul

if not "%PATCH_EXIT%"=="0" (
  echo.
  echo [ERROR] Python patch failed with exit code %PATCH_EXIT%.
  echo JS checks skipped.
  pause
  exit /b %PATCH_EXIT%
)

echo.
echo [OK] Python patch completed.
echo.

echo [STEP 2/2] Running node --check...
set "CHECK_FAILED=0"

if exist "%ROOT%\src\config\runtime_flags.js" (
  echo.
  echo $ node --check src\config\runtime_flags.js
  pushd "%ROOT%" >nul
  node --check src\config\runtime_flags.js
  if errorlevel 1 set "CHECK_FAILED=1"
  popd >nul
) else (
  echo [WARN] Missing src\config\runtime_flags.js, skipped.
)

if exist "%ROOT%\src\main.js" (
  echo.
  echo $ node --check src\main.js
  pushd "%ROOT%" >nul
  node --check src\main.js
  if errorlevel 1 set "CHECK_FAILED=1"
  popd >nul
) else (
  echo [WARN] Missing src\main.js, skipped.
)

echo.

if "%CHECK_FAILED%"=="1" (
  echo [ERROR] One or more node --check commands failed.
  echo Check the output above. Backup should be inside the project backup folder.
  pause
  exit /b 1
)

echo [OK] Patch applied and JS checks passed.
echo.
pause
exit /b 0

