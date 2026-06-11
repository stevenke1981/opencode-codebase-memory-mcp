param(
  [switch]$SkipDownload,
  [switch]$UseExisting
)
$ErrorActionPreference = "Stop"

$GlobalConfig = Join-Path $env:USERPROFILE ".config"
$InstallDir = Join-Path $GlobalConfig "opencode-codebase-memory-mcp"
$Repo = "https://github.com/stevenke1981/opencode-codebase-memory-mcp.git"

Write-Host "opencode-codebase-memory-mcp global installer" -ForegroundColor Cyan
Write-Host "Install dir: $InstallDir" -ForegroundColor DarkGray

if (-not (Test-Path (Join-Path $InstallDir ".git"))) {
  if (Test-Path $PSScriptRoot\.git) {
    Write-Host "Seeding global install dir from current repo..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
    robocopy $PSScriptRoot $InstallDir /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
  } else {
    Write-Host "Cloning to $InstallDir ..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $GlobalConfig | Out-Null
    git clone $Repo $InstallDir
  }
} elseif ($PSScriptRoot -ne $InstallDir) {
  Write-Host "Updating $InstallDir ..." -ForegroundColor Yellow
  Push-Location $InstallDir
  git pull --ff-only
  Pop-Location
}

Set-Location $InstallDir
$args = @("scripts/install-global.mjs")
if ($SkipDownload) { $args += "--skip-download" }
if ($UseExisting) { $args += "--use-existing" }
node @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`nDone! Restart OpenCode." -ForegroundColor Green
Write-Host "Verify: node scripts/doctor.mjs" -ForegroundColor White