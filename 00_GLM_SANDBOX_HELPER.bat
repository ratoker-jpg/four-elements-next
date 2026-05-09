@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =========================================================
REM GLM Game Sandbox Helper
REM Place this BAT in the repository root:
REM C:\Users\Den\Desktop\GLM_test\glm_game_sandbox
REM
REM Safe actions only:
REM - does NOT commit
REM - does NOT push
REM - does NOT merge
REM - does NOT run Google Drive sync
REM =========================================================

cd /d "%~dp0"

set "REPO_URL=https://github.com/ratoker-jpg/glm-game-sandbox"
set "PAGES_URL=https://ratoker-jpg.github.io/glm-game-sandbox/"
set "BASE_BRANCH=sandbox/main"

:MENU
cls
echo =========================================================
echo GLM GAME SANDBOX HELPER
echo Current folder:
echo %CD%
echo =========================================================
echo.
echo 1 - Sync local sandbox/main from GitHub
echo 2 - Show git status
echo 3 - Run JS syntax check: node --check src/main.js
echo 4 - Safe full check: sync + status + node check
echo 5 - Open GitHub Pages live game
echo 6 - Open GitHub repository
echo 7 - Open Pull Requests
echo 8 - Show last 5 git commits
echo 0 - Exit
echo.
set /p "choice=Choose option: "

if "%choice%"=="1" goto SYNC
if "%choice%"=="2" goto STATUS
if "%choice%"=="3" goto NODECHECK
if "%choice%"=="4" goto FULLCHECK
if "%choice%"=="5" goto OPENPAGES
if "%choice%"=="6" goto OPENREPO
if "%choice%"=="7" goto OPENPRS
if "%choice%"=="8" goto LOG
if "%choice%"=="0" goto END

echo.
echo Unknown option.
pause
goto MENU

:CHECK_GIT
git --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: git not found in PATH.
  echo Install Git for Windows or open this from Git Bash/PowerShell with git available.
  pause
  goto MENU
)
if not exist ".git" (
  echo ERROR: .git folder not found.
  echo This BAT must be placed in the repository root.
  pause
  goto MENU
)
exit /b 0

:SYNC
call :CHECK_GIT
echo.
echo Fetching origin...
git fetch origin
if errorlevel 1 goto GIT_ERROR

echo.
echo Checking out %BASE_BRANCH%...
git checkout %BASE_BRANCH%
if errorlevel 1 goto GIT_ERROR

echo.
echo Pulling latest changes with --ff-only...
git pull --ff-only
if errorlevel 1 goto GIT_ERROR

echo.
echo Current git status:
git status
echo.
pause
goto MENU

:STATUS
call :CHECK_GIT
echo.
git status
echo.
pause
goto MENU

:NODECHECK
node --version >nul 2>&1
if errorlevel 1 (
  echo ERROR: node not found in PATH.
  echo Install Node.js or use a terminal where node is available.
  pause
  goto MENU
)

if not exist "src\main.js" (
  echo ERROR: src\main.js not found.
  echo This BAT must be run from the repository root.
  pause
  goto MENU
)

echo.
echo Running: node --check src/main.js
node --check src/main.js
if errorlevel 1 (
  echo.
  echo FAIL: node syntax check failed.
  pause
  goto MENU
)

echo.
echo PASS: node syntax check passed.
pause
goto MENU

:FULLCHECK
call :CHECK_GIT
echo.
echo === Step 1/3: sync %BASE_BRANCH% ===
git fetch origin
if errorlevel 1 goto GIT_ERROR
git checkout %BASE_BRANCH%
if errorlevel 1 goto GIT_ERROR
git pull --ff-only
if errorlevel 1 goto GIT_ERROR

echo.
echo === Step 2/3: git status ===
git status

echo.
echo === Step 3/3: node --check src/main.js ===
node --version >nul 2>&1
if errorlevel 1 (
  echo WARNING: node not found in PATH. Skipping node check.
  pause
  goto MENU
)

node --check src/main.js
if errorlevel 1 (
  echo.
  echo FAIL: node syntax check failed.
  pause
  goto MENU
)

echo.
echo PASS: full safe check completed.
pause
goto MENU

:OPENPAGES
echo Opening GitHub Pages:
echo %PAGES_URL%
start "" "%PAGES_URL%"
goto MENU

:OPENREPO
echo Opening repository:
echo %REPO_URL%
start "" "%REPO_URL%"
goto MENU

:OPENPRS
echo Opening pull requests:
echo %REPO_URL%/pulls
start "" "%REPO_URL%/pulls"
goto MENU

:LOG
call :CHECK_GIT
echo.
git log --oneline -5
echo.
pause
goto MENU

:GIT_ERROR
echo.
echo ERROR: Git command failed.
echo Read the message above. Do not continue if there are conflicts.
pause
goto MENU

:END
endlocal
exit /b 0
