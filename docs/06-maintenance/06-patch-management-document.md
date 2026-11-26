# Patch Management Document

| | |
|---|---|
| Document ID | NPRO-PATCH-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Scope
Application dependencies (npm, NuGet), .NET runtime / Hosting Bundle, SQL Server cumulative updates, Windows Server / IIS updates,
nPro application patches.

## 2. Sources of patches
GitHub / npm advisories (`npm audit`), NuGet vulnerability data (`dotnet list package --vulnerable`), Microsoft Patch Tuesday and
.NET servicing releases (monthly), SQL Server CU releases, Angular releases.

## 3. Timelines

| Severity (CVSS) | Example | Apply within |
|---|---|---|
| Critical (9.0+) or actively exploited | Remote code execution in a runtime package | 72 hours (emergency patch) |
| High (7.0–8.9) | Auth bypass in a dependency | 14 days |
| Medium (4.0–6.9) | Information disclosure | 30 days (monthly window) |
| Low | — | Next planned release |

## 4. Procedure
1. Identify (monthly scan or advisory) and assess applicability.
2. Update in a branch: `npm update` / version bump; `.csproj` version bump; for .NET servicing install the new Hosting Bundle on
   servers.
3. Build, run all automated tests and the a11y scan; regression smoke in Test.
4. Release as a patch version (Release Management), Deployment Plan, Rollback Plan ready.
5. Record in the patch log.

Windows / SQL Server: AWS Systems Manager Patch Manager in a monthly window after testing in Test / UAT; app pool recycles are
expected (requires persisted Data Protection keys to avoid sign-outs).

## 5. Patch log

| Date | Component | From → to | Reason | Release |
|---|---|---|---|---|
| | | | | |
