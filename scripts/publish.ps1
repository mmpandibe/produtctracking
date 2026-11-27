<#
.SYNOPSIS
  Step 18d: builds the nPro IIS package - the Angular app inside the .NET API's wwwroot - as one folder and one zip.

.EXAMPLE
  .\scripts\publish.ps1                # -> publish\nPro\ and publish\nPro-<yyyyMMdd-HHmm>.zip
  .\scripts\publish.ps1 -SkipTests     # skip the test runs

  Copy the zip to the server, unzip it into the IIS site folder (e.g. D:\nPro\site) and recycle the app pool.
  Settings that differ per server (connection string, key / file folders) go in environment variables or
  appsettings.Production.json on the server - never in this package. See docs/05-deployment/deployment-plan.md.
#>
param(
  [string]$Output = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\publish')),
  [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
try {
  if (-not $SkipTests) {
    Write-Host '== Frontend tests' -ForegroundColor Cyan
    npx.cmd ng test --watch=false
    if ($LASTEXITCODE -ne 0) { throw 'Frontend tests failed' }
    Write-Host '== Server tests' -ForegroundColor Cyan
    Push-Location (Join-Path $root 'server')
    try {
      dotnet test --nologo
      if ($LASTEXITCODE -ne 0) { throw 'Server tests failed' }
    }
    finally { Pop-Location }
  }

  Write-Host '== Angular production build' -ForegroundColor Cyan
  npx.cmd ng build --configuration production
  if ($LASTEXITCODE -ne 0) { throw 'Angular build failed' }

  $site = Join-Path $Output 'nPro'
  if (Test-Path $site) { Remove-Item -Recurse -Force $site }

  Write-Host '== .NET publish (Release, framework-dependent, IIS in-process)' -ForegroundColor Cyan
  # From the server folder, so server/global.json picks the pinned .NET 10 SDK
  Push-Location (Join-Path $root 'server')
  try {
    dotnet publish src/Npro.Api -c Release -o $site --nologo
    if ($LASTEXITCODE -ne 0) { throw 'dotnet publish failed' }
  }
  finally { Pop-Location }

  # The development settings (local database, demo password, demo switcher) never ship
  Remove-Item -Force -ErrorAction SilentlyContinue (Join-Path $site 'appsettings.Development.json')

  Write-Host '== Copy the Angular app into wwwroot' -ForegroundColor Cyan
  $www = Join-Path $site 'wwwroot'
  New-Item -ItemType Directory -Force $www | Out-Null
  Copy-Item -Recurse -Force (Join-Path $root 'dist\npro\browser\*') $www

  $zip = Join-Path $Output ("nPro-{0}.zip" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
  Compress-Archive -Path (Join-Path $site '*') -DestinationPath $zip -Force
  Write-Host "Package: $zip" -ForegroundColor Green

  # Deployment kit for the server: SQL scripts (database, schema, login, checks) and the IIS set-up / release scripts
  $kit = Join-Path $Output ("nPro-{0}-deploy-kit.zip" -f (Get-Date -Format 'yyyyMMdd-HHmm'))
  Compress-Archive -Path (Join-Path $root 'deploy\*') -DestinationPath $kit -Force
  Write-Host "Deploy kit: $kit" -ForegroundColor Green
  Write-Host 'First install on a new database:  Npro.Api.exe create-admin --name "Full Name" --email you@company.com --employee-id EMP-001'
}
finally {
  Pop-Location
}
