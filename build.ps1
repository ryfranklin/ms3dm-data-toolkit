# MS3DM Workbench — Windows desktop build
#
# Produces a zip at `dist/ms3dm-workbench-windows-x64.zip` ready to ship.
#
# Requirements on the build machine:
#   - Python 3.11+ on PATH
#   - Node.js 18+ on PATH
#   - Microsoft ODBC Driver 18 for SQL Server installed (so PyInstaller can
#     bundle the pyodbc binary). End users also need the driver installed.
#
# Usage (PowerShell):
#   .\build.ps1
#
# To skip the (slow) frontend build when you've only changed Python:
#   .\build.ps1 -SkipFrontend

param(
    [switch]$SkipFrontend,
    [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RepoRoot

Write-Host "==> Repo root: $RepoRoot" -ForegroundColor Cyan

# ----- Frontend -----
if (-not $SkipFrontend) {
    Write-Host "==> Building frontend..." -ForegroundColor Cyan
    Push-Location frontend
    try {
        if (-not $SkipInstall) { npm install }
        npm run build
    } finally {
        Pop-Location
    }
} else {
    Write-Host "==> Skipping frontend build (--SkipFrontend)" -ForegroundColor Yellow
}

if (-not (Test-Path frontend\dist\index.html)) {
    throw "Frontend build missing — expected frontend/dist/index.html"
}

# ----- Backend Python deps + PyInstaller -----
Write-Host "==> Setting up Python virtualenv..." -ForegroundColor Cyan
Push-Location backend
try {
    if (-not (Test-Path .venv)) {
        python -m venv .venv
    }
    & .\.venv\Scripts\Activate.ps1

    if (-not $SkipInstall) {
        python -m pip install --upgrade pip
        python -m pip install -r requirements.txt
        python -m pip install pyinstaller==6.6.0
    }

    Write-Host "==> Running PyInstaller..." -ForegroundColor Cyan
    if (Test-Path build) { Remove-Item build -Recurse -Force }
    if (Test-Path dist)  { Remove-Item dist  -Recurse -Force }
    pyinstaller ms3dm_workbench.spec --clean --noconfirm
} finally {
    if (Test-Path Function:\deactivate) { deactivate }
    Pop-Location
}

if (-not (Test-Path backend\dist\ms3dm-workbench\ms3dm-workbench.exe)) {
    throw "PyInstaller didn't produce ms3dm-workbench.exe — check the output above"
}

# ----- Zip the bundle -----
Write-Host "==> Packaging zip..." -ForegroundColor Cyan
$OutDir = Join-Path $RepoRoot 'dist'
if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
$ZipPath = Join-Path $OutDir 'ms3dm-workbench-windows-x64.zip'
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Compress-Archive `
    -Path (Join-Path $RepoRoot 'backend\dist\ms3dm-workbench\*') `
    -DestinationPath $ZipPath

$ZipMB = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 1)
Write-Host ""
Write-Host "==> Done." -ForegroundColor Green
Write-Host "    Output: $ZipPath ($ZipMB MB)"
Write-Host ""
Write-Host "End-user install:"
Write-Host "  1. Install Microsoft ODBC Driver 18 for SQL Server"
Write-Host "  2. Extract the zip anywhere"
Write-Host "  3. Run ms3dm-workbench.exe — browser opens automatically"
