$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ProjectRoot

Write-Host ""
Write-Host "Four Elements project:" -ForegroundColor Cyan
Write-Host $ProjectRoot
Write-Host ""
Write-Host "Starting Codex chat..." -ForegroundColor Cyan
Write-Host ""

$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) {
  $codex = Get-Command codex -ErrorAction SilentlyContinue
}

if (-not $codex) {
  Write-Host "Codex CLI was not found in PATH." -ForegroundColor Red
  Write-Host "Install or fix PATH, then run this script again."
  return
}

& $codex.Source

