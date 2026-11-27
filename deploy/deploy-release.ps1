<#
.SYNOPSIS
  Installs an nPro release package (made by scripts\publish.ps1) on the IIS server. Run as Administrator.

.DESCRIPTION
  1. Takes the site offline (app_offline.htm - IIS stops nPro gracefully).
  2. Backs up the current site folder to <Root>\releases\<timestamp> (for the Rollback Plan).
  3. Replaces the site files with the package (settings live in the app pool, so nothing is lost).
  4. Brings the site back and checks GET /api/health.

  Apply deploy\sql\02-schema.sql from the same release BEFORE running this (unless the app migrates on start-up).

.EXAMPLE
  .\deploy-release.ps1 -Package C:\Install\nPro-20261127-1830.zip
.EXAMPLE
  .\deploy-release.ps1 -Rollback      # restores the newest backup
#>
[CmdletBinding()]
param(
  [string]$Package,
  [string]$Root = 'D:\nPro',
  [string]$HealthUrl = 'http://localhost/api/health',
  [switch]$Rollback
)
$ErrorActionPreference = 'Stop'
$site = Join-Path $Root 'site'
$releases = Join-Path $Root 'releases'
$offline = Join-Path $site 'app_offline.htm'

if (-not $Rollback -and -not (Test-Path $Package)) { throw 'Give -Package <path to nPro-*.zip> or -Rollback' }
if ($Rollback) {
  $source = Get-ChildItem $releases -Directory | Sort-Object Name -Descending | Select-Object -First 1
  if (-not $source) { throw "No backups in $releases" }
  Write-Host "Rolling back to $($source.Name)" -ForegroundColor Yellow
}

Write-Host '== Taking nPro offline' -ForegroundColor Cyan
Set-Content -Path $offline -Value '<!doctype html><meta charset="utf-8"><title>nPro</title><p style="font-family:sans-serif">nPro is being updated and will be back in a few minutes.</p>' -Encoding utf8
Start-Sleep -Seconds 5   # let IIS shut the app down and release file locks

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $Rollback -and (Test-Path (Join-Path $site 'Npro.Api.dll'))) {
  Write-Host "== Backing up the current release to releases\$stamp" -ForegroundColor Cyan
  $backup = Join-Path $releases $stamp
  New-Item -ItemType Directory -Force $backup | Out-Null
  Get-ChildItem $site -Exclude 'app_offline.htm' | Copy-Item -Destination $backup -Recurse -Force
}

Write-Host '== Replacing the site files' -ForegroundColor Cyan
Get-ChildItem $site -Exclude 'app_offline.htm' | Remove-Item -Recurse -Force
if ($Rollback) {
  Get-ChildItem $source.FullName | Copy-Item -Destination $site -Recurse -Force
} else {
  Expand-Archive -Path $Package -DestinationPath $site -Force
}
if (-not (Test-Path (Join-Path $site 'Npro.Api.dll'))) { throw 'The site folder has no Npro.Api.dll - wrong package? nPro stays offline.' }
# Development settings must never run in production
Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $site 'appsettings.Development.json')

Write-Host '== Bringing nPro back' -ForegroundColor Cyan
Remove-Item -Force $offline
$ok = $false
for ($i = 0; $i -lt 12 -and -not $ok; $i++) {
  Start-Sleep -Seconds 5
  try {
    $health = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 10
    Write-Host ("Health: status={0} database={1} storage={2} timedRules={3}" -f $health.status, $health.database, $health.storage, $health.timedRules)
    $ok = $health.database -eq 'up'
  } catch { Write-Host "Waiting for nPro to start... ($($_.Exception.Message))" }
}
if (-not $ok) { throw "nPro did not report a healthy database within a minute. Check the Windows Event Log (Application, source 'IIS AspNetCore Module V2' / 'nPro') and $Root\logs. Roll back with: .\deploy-release.ps1 -Rollback" }
Write-Host 'Release installed.' -ForegroundColor Green
