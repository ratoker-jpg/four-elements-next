@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM =========================================================
REM Four Elements - GPT context packer
REM Run this BAT from the project root:
REM C:\Users\Den\Desktop\four elements\four_elements_core_base
REM
REM It creates:
REM   _exports\GPT_WORK_SEND_THIS_CONTEXT.zip
REM =========================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

set "SRC=%ROOT%\src"
set "INDEX=%ROOT%\index.html"
set "DOCS=%ROOT%\docs\project"
set "WORKFLOW=%DOCS%\four_elements_workflow_reglament.md"
set "ROADMAP=%DOCS%\four_elements_patch_roadmap_actual.docx"
set "ROADMAP_MD=%DOCS%\four_elements_patch_roadmap_actual.md"
set "START_PROMPT=%DOCS%\NEW_CHAT_START_PROMPT.md"
set "STATE=%ROOT%\_gpt_state"
set "BACKUP=%ROOT%\backup"
set "TEMP=%ROOT%\_gpt_export_tmp"
set "EXPORTS=%ROOT%\_exports"
set "ZIP=%EXPORTS%\GPT_WORK_SEND_THIS_CONTEXT.zip"

if not exist "%EXPORTS%\" mkdir "%EXPORTS%" >nul 2>&1
if exist "%TEMP%\" rmdir /s /q "%TEMP%"
if exist "%ZIP%" del /f /q "%ZIP%"
mkdir "%TEMP%" >nul 2>&1

xcopy "%SRC%" "%TEMP%\src" /E /I /Y >nul || exit /b 1
copy /Y "%INDEX%" "%TEMP%\index.html" >nul || exit /b 1

if exist "%ROOT%\AGENTS.md" copy /Y "%ROOT%\AGENTS.md" "%TEMP%\AGENTS.md" >nul
if exist "%ROOT%\README.md" copy /Y "%ROOT%\README.md" "%TEMP%\README.md" >nul
if exist "%ROOT%\THIS_IS_WORK_PROJECT.txt" copy /Y "%ROOT%\THIS_IS_WORK_PROJECT.txt" "%TEMP%\THIS_IS_WORK_PROJECT.txt" >nul
if exist "%ROOT%\PATCH_REPORT.txt" copy /Y "%ROOT%\PATCH_REPORT.txt" "%TEMP%\PATCH_REPORT.txt" >nul
if exist "%ROOT%\package.json" copy /Y "%ROOT%\package.json" "%TEMP%\package.json" >nul
if exist "%ROOT%\package-lock.json" copy /Y "%ROOT%\package-lock.json" "%TEMP%\package-lock.json" >nul
if exist "%ROOT%\playwright.config.js" copy /Y "%ROOT%\playwright.config.js" "%TEMP%\playwright.config.js" >nul
if exist "%ROOT%\00_START_GAME_WORK_8010.bat" copy /Y "%ROOT%\00_START_GAME_WORK_8010.bat" "%TEMP%\00_START_GAME_WORK_8010.bat" >nul
if exist "%ROOT%\01_BUILD_GPT_CONTEXT_WORK.bat" copy /Y "%ROOT%\01_BUILD_GPT_CONTEXT_WORK.bat" "%TEMP%\01_BUILD_GPT_CONTEXT_WORK.bat" >nul
if exist "%ROOT%\02_RUN_PATCH_AND_CHECK.bat" copy /Y "%ROOT%\02_RUN_PATCH_AND_CHECK.bat" "%TEMP%\02_RUN_PATCH_AND_CHECK.bat" >nul
if exist "%ROOT%\03_PREPARE_GPT_STATE.bat" copy /Y "%ROOT%\03_PREPARE_GPT_STATE.bat" "%TEMP%\03_PREPARE_GPT_STATE.bat" >nul
if exist "%ROOT%\04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat" copy /Y "%ROOT%\04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat" "%TEMP%\04_SYNC_WORK_MIRROR_TO_GOOGLE_DRIVE.bat" >nul

if exist "%WORKFLOW%" (
  mkdir "%TEMP%\docs\project" >nul 2>&1
  copy /Y "%WORKFLOW%" "%TEMP%\docs\project\four_elements_workflow_reglament.md" >nul
)
if exist "%ROADMAP%" (
  mkdir "%TEMP%\docs\project" >nul 2>&1
  copy /Y "%ROADMAP%" "%TEMP%\docs\project\four_elements_patch_roadmap_actual.docx" >nul
)

if exist "%STATE%\FILETREE.txt" copy /Y "%STATE%\FILETREE.txt" "%TEMP%\FILETREE.txt" >nul
if exist "%STATE%\ASSET_MANIFEST.txt" copy /Y "%STATE%\ASSET_MANIFEST.txt" "%TEMP%\ASSET_MANIFEST.txt" >nul
if exist "%STATE%\BAT_MANIFEST.txt" copy /Y "%STATE%\BAT_MANIFEST.txt" "%TEMP%\BAT_MANIFEST.txt" >nul
if exist "%STATE%\HASHES.txt" copy /Y "%STATE%\HASHES.txt" "%TEMP%\HASHES.txt" >nul
if exist "%STATE%\LAST_SYNC.txt" copy /Y "%STATE%\LAST_SYNC.txt" "%TEMP%\LAST_SYNC.txt" >nul

if exist "%BACKUP%\" (
  mkdir "%TEMP%\patch_reports" >nul 2>&1
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$reports = Get-ChildItem -Path '%BACKUP%' -Filter 'PATCH_REPORT.txt' -Recurse -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 5; $i=1; foreach ($r in $reports) { $dir = Split-Path $r.DirectoryName -Leaf; $safe = ($dir -replace '[^\w\-.]+','_'); $dst = Join-Path '%TEMP%\patch_reports' ('{0:00}_{1}_PATCH_REPORT.txt' -f $i, $safe); Copy-Item $r.FullName $dst -Force; $i++ }"
)

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$exclude = @('\\.git\\','\\node_modules\\','\\test-results\\','\\_gpt_export_tmp\\','\\_inbox\\audit_context_unpack_temp\\','\\_inbox\\audit_gpt_context_unpack_temp\\','\\_inbox\\audit_unique_zip_unpack_temp\\','\\_reports\\playwright\\screenshots\\','\\_inbox\\generated_assets\\'); Get-ChildItem -Path '%ROOT%' -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $p=$_.FullName; -not ($exclude | Where-Object { $p.Contains($_) }) } | ForEach-Object { $_.FullName.Substring('%ROOT%'.Length).TrimStart('\\') } | Sort-Object | Out-File -Encoding UTF8 '%TEMP%\PROJECT_TREE.txt'"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Compress-Archive -Path '%TEMP%\*' -DestinationPath '%ZIP%' -Force"
if errorlevel 1 exit /b 1
rmdir /s /q "%TEMP%"

echo [OK] Created: "%ZIP%"
if /I "%~1"=="/nopause" exit /b 0
pause
exit /b 0
