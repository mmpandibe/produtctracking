<#
.SYNOPSIS
  One-time set-up of nPro on a Windows Server 2022 / 2025 machine with IIS (run as Administrator on the AWS instance).

.DESCRIPTION
  1. Installs the IIS role and features nPro needs (Application Initialization for the always-running timers).
  2. Checks the ASP.NET Core 10 Hosting Bundle is installed (stops with the download link if not).
  3. Creates the folders: site, Data Protection keys, attachment files, logs, release backups.
  4. Creates the "nPro" application pool (No Managed Code, AlwaysRunning, no idle time-out) and the site (preload on).
  5. Grants the app pool identity only the rights it needs on each folder.
  6. Stores the production settings as app pool environment variables (kept in applicationHost.config, readable by
     administrators only) - the connection string never goes into the package or source control.

  Safe to run again: existing items are updated, not duplicated.

.EXAMPLE
  # Behind an AWS Application Load Balancer that terminates HTTPS (site listens on HTTP 80):
  .\setup-iis.ps1 -ConnectionString 'Server=sql01;Database=Npro;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=False' -BehindLoadBalancer

.EXAMPLE
  # IIS terminates HTTPS itself (certificate already imported into LocalMachine\My):
  .\setup-iis.ps1 -ConnectionString '...' -HostName npro.company.com -CertificateThumbprint 'AB12...'
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)] [string]$ConnectionString,
  [string]$Root = 'D:\nPro',
  [string]$SiteName = 'nPro',
  [string]$AppPoolName = 'nPro',
  [string]$HostName = '',
  [int]$HttpPort = 80,
  [string]$CertificateThumbprint = '',
  [switch]$BehindLoadBalancer,
  # true = the app applies schema changes itself (its SQL login then needs db_ddladmin); default: run deploy\sql\02-schema.sql
  [switch]$MigrateOnStartup
)

$ErrorActionPreference = 'Stop'
function Step($text) { Write-Host "== $text" -ForegroundColor Cyan }

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw 'Run this script in an elevated PowerShell (Run as Administrator).'
}

Step 'IIS role and features'
$features = 'Web-Server', 'Web-Default-Doc', 'Web-Static-Content', 'Web-Http-Errors', 'Web-Http-Logging', 'Web-Stat-Compression',
  'Web-Dyn-Compression', 'Web-Filtering', 'Web-AppInit', 'Web-Mgmt-Console', 'Web-Scripting-Tools'
$result = Install-WindowsFeature -Name $features
if ($result.RestartNeeded -eq 'Yes') { Write-Warning 'Windows needs a restart to finish installing IIS. Restart, then run this script again.'; return }

Step 'ASP.NET Core Hosting Bundle'
if (-not (Test-Path "$env:windir\System32\inetsrv\aspnetcorev2.dll")) {
  throw 'The ASP.NET Core Module is missing. Install the ASP.NET Core 10 Hosting Bundle (https://dotnet.microsoft.com/download/dotnet/10.0 -> "Hosting Bundle"), run iisreset, then run this script again.'
}
$runtimes = & dotnet --list-runtimes 2>$null
if (-not ($runtimes -match '^Microsoft\.AspNetCore\.App 10\.')) { throw 'ASP.NET Core 10 runtime not found (dotnet --list-runtimes). Install the .NET 10 Hosting Bundle.' }

Import-Module WebAdministration

Step "Folders under $Root"
$site = Join-Path $Root 'site'
$folders = @{ site = $site; keys = (Join-Path $Root 'keys'); files = (Join-Path $Root 'files'); logs = (Join-Path $Root 'logs'); releases = (Join-Path $Root 'releases') }
foreach ($f in $folders.Values) { New-Item -ItemType Directory -Force $f | Out-Null }
if (-not (Test-Path (Join-Path $site 'index.html'))) {
  Set-Content -Path (Join-Path $site 'app_offline.htm') -Value '<!doctype html><title>nPro</title><p>nPro is being installed.</p>' -Encoding utf8
}

Step "Application pool $AppPoolName"
if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) { New-WebAppPool -Name $AppPoolName | Out-Null }
$pool = "IIS:\AppPools\$AppPoolName"
Set-ItemProperty $pool -Name managedRuntimeVersion -Value ''               # No Managed Code (ASP.NET Core runs in-process)
Set-ItemProperty $pool -Name startMode -Value 'AlwaysRunning'              # timed automation, retention job
Set-ItemProperty $pool -Name processModel.idleTimeout -Value '00:00:00'
Set-ItemProperty $pool -Name processModel.identityType -Value 'ApplicationPoolIdentity'
Set-ItemProperty $pool -Name processModel.loadUserProfile -Value $true
Set-ItemProperty $pool -Name recycling.periodicRestart.time -Value '00:00:00'   # no forced 29-hour recycle
Set-ItemProperty $pool -Name enable32BitAppOnWin64 -Value $false

Step "Site $SiteName"
if (-not (Get-Website -Name $SiteName)) {
  New-Website -Name $SiteName -PhysicalPath $site -ApplicationPool $AppPoolName -Port $HttpPort -HostHeader $HostName | Out-Null
}
Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $site
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $AppPoolName
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationDefaults.preloadEnabled -Value $true
if ($CertificateThumbprint) {
  if (-not (Get-WebBinding -Name $SiteName -Protocol https)) { New-WebBinding -Name $SiteName -Protocol https -Port 443 -HostHeader $HostName -SslFlags 1 }
  $binding = Get-WebBinding -Name $SiteName -Protocol https
  $binding.AddSslCertificate($CertificateThumbprint, 'My')
}
# The default site would compete for port 80
if ((Get-Website -Name 'Default Web Site') -and $HttpPort -eq 80 -and -not $HostName) { Stop-Website -Name 'Default Web Site' -ErrorAction SilentlyContinue }

Step 'Folder permissions'
$identity = "IIS APPPOOL\$AppPoolName"
& icacls $folders.site /grant "${identity}:(OI)(CI)RX" /T /Q | Out-Null
& icacls $folders.files /grant "${identity}:(OI)(CI)M" /Q | Out-Null
& icacls $folders.logs /grant "${identity}:(OI)(CI)M" /Q | Out-Null
# Keys: only SYSTEM, Administrators and the app pool (no inherited rights)
& icacls $folders.keys /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' "${identity}:(OI)(CI)M" /Q | Out-Null

Step 'Production settings (app pool environment variables)'
$appcmd = "$env:windir\System32\inetsrv\appcmd.exe"
$settings = [ordered]@{
  ASPNETCORE_ENVIRONMENT           = 'Production'
  ConnectionStrings__Npro          = $ConnectionString
  Database__MigrateOnStartup       = $(if ($MigrateOnStartup) { 'true' } else { 'false' })
  DataProtection__KeysPath         = $folders.keys
  Storage__Disk__Root              = $folders.files
  Hosting__TrustForwardedHeaders   = $(if ($BehindLoadBalancer) { 'true' } else { 'false' })
  Hosting__HttpsRedirect           = $(if ($CertificateThumbprint) { 'true' } else { 'false' })
}
foreach ($name in $settings.Keys) {
  # Remove then add, so re-running updates the value
  & $appcmd set config -section:system.applicationHost/applicationPools "/-[name='$AppPoolName'].environmentVariables.[name='$name']" /commit:apphost 2>$null | Out-Null
  & $appcmd set config -section:system.applicationHost/applicationPools "/+[name='$AppPoolName'].environmentVariables.[name='$name',value='$($settings[$name])']" /commit:apphost | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not set $name on the app pool" }
}

Step 'Done'
Write-Host "Site folder:  $($folders.site)"
Write-Host "App pool:     $AppPoolName (identity $identity)"
Write-Host 'Next: give the app pool access to SQL Server (deploy\sql\03-app-login.sql), then deploy a package with deploy\deploy-release.ps1.'
