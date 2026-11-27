<#
.SYNOPSIS
  Step 18d: runs the package from scripts/publish.ps1 on this machine in Production mode, against a separate local test
  database (NproProdTest on .\SQLEXPRESS), so the IIS settings can be checked before a release: no demo data, no demo
  switcher, security headers, rate limits, persisted keys. Open http://localhost:5150.

  First time: create an admin (prompts for the password):
    .\scripts\run-production-local.ps1 -CreateAdmin
#>
param(
  [int]$Port = 5150,
  [switch]$CreateAdmin
)
$ErrorActionPreference = 'Stop'
$site = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\publish\nPro'))
if (-not (Test-Path (Join-Path $site 'Npro.Api.exe'))) { throw 'Run .\scripts\publish.ps1 first' }
$data = Join-Path $env:LOCALAPPDATA 'nPro-prodtest'
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ASPNETCORE_URLS = "http://localhost:$Port"
$env:ConnectionStrings__Npro = 'Server=.\SQLEXPRESS;Database=NproProdTest;Trusted_Connection=True;TrustServerCertificate=True'
$env:DataProtection__KeysPath = Join-Path $data 'keys'
$env:Storage__Disk__Root = Join-Path $data 'files'
Push-Location $site
try {
  if ($CreateAdmin) { .\Npro.Api.exe create-admin --name 'Test Admin' --email admin@example.test --employee-id EMP-900 }
  else { .\Npro.Api.exe }
}
finally { Pop-Location }
