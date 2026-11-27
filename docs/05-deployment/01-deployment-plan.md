# Deployment Plan

| | |
|---|---|
| Document ID | NPRO-DEP-001 |
| Version | 1.1 (draft) · 27 Nov 2026 |
| Target | IIS 10 on Windows Server 2022 (AWS EC2), SQL Server 2022 |
| Note | Step 18d added `scripts/publish.ps1`, `appsettings.Production.json`, persisted keys and the `create-admin` command |

## 1. Prerequisites (one-time per server)
1. Windows Server 2022 with IIS (Web Server role, incl. *WebSocket Protocol* optional, *Application Initialization*).
2. **ASP.NET Core 10 Hosting Bundle** installed; `iisreset` afterwards.
3. SQL Server 2022 reachable from the app server (TLS); database `Npro` created, or a login allowed to create it.
4. A service identity for the app pool with `db_owner` on `Npro` for the first deployment (migrations), then `db_datareader`,
   `db_datawriter`, `EXECUTE` and DDL only during releases — or run migrations as a separate step (see §4).
5. TLS certificate on the load balancer / IIS binding; HTTP → HTTPS redirect.
6. Folders: `D:\nPro\site` (application), `D:\nPro\keys` (Data Protection keys, ACL: app pool identity only), `D:\nPro\files`
   (attachment files, ACL: app pool identity only), `D:\nPro\logs`.

## 2. Build the release package
On a build machine with Node 22, the .NET 10 SDK and a clean checkout (`npm.cmd ci` first):
```powershell
.\scripts\publish.ps1
```
The script runs both test suites, builds Angular for production, publishes the API (Release), copies the Angular app into
`wwwroot`, drops `appsettings.Development.json`, and writes `publish\nPro\` plus `publish\nPro-<yyyyMMdd-HHmm>.zip`. Record the commit hash.

To check the package on the build machine in Production mode (separate local database `NproProdTest`, http://localhost:5150):
```powershell
.\scripts\run-production-local.ps1 -CreateAdmin
```
```powershell
.\scripts\run-production-local.ps1
```

## 3. IIS configuration
| Setting | Value |
|---|---|
| App pool | .NET CLR version: **No Managed Code**; Start mode: **AlwaysRunning**; Idle time-out: 0; one worker process |
| Site | Physical path `D:\nPro\site`; binding HTTPS 443 (or HTTP behind the ALB); **Preload enabled = true** |
| Environment (web.config `<environmentVariables>` or app pool) | `ASPNETCORE_ENVIRONMENT=Production`, `ConnectionStrings__Npro=<from secret store>`; `Seed__DemoPassword` and `Features__DemoSwitcher` **not set** |
| Data Protection | `DataProtection:KeysPath` = `D:/nPro/keys` (default in `appsettings.Production.json`); keys are DPAPI-protected for the machine |
| Files | `Storage:Disk:Root` = `D:/nPro/files` (default in `appsettings.Production.json`) |
| Behind a load balancer | `Hosting__TrustForwardedHeaders=true` only when the ALB / proxy sets `X-Forwarded-For` / `-Proto` and the site is not reachable directly |
| Logs | `stdoutLogEnabled` only for troubleshooting; app logs to `D:\nPro\logs` / CloudWatch |

## 4. Deployment steps (each release)
1. Announce the window; confirm backups ran (Backup and Restore Procedure).
2. Take a database backup (`COPY_ONLY`).
3. Review the migration script: `dotnet ef migrations script <last-applied> --idempotent` and apply it (or let the app apply it at
   start-up for minor releases).
4. Put `app_offline.htm` in `D:\nPro\site` (IIS stops the app gracefully).
5. Back up the current site folder to `D:\nPro\releases\<previous-version>`.
6. Copy the new package contents into `D:\nPro\site` (keep `web.config` environment settings).
7. Remove `app_offline.htm`; the app starts and applies pending migrations.
8. Smoke test (Regression report §4); check `GET /api/health` = up; check logs.
9. Record the deployment (Deployment Sign-off); announce completion.

## 5. First production deployment
Additionally: create the first admin account on the server (prompts for the password; run with the same
`ConnectionStrings__Npro` as the site):
```powershell
D:\nPro\site\Npro.Api.exe create-admin --name "Full Name" --email you@company.com --employee-id EMP-001
```
Running it again for the same email resets that admin's password. Then set up the organisation (divisions, teams, people with
employee IDs, products, SLA targets), import open tickets if needed, train users.

## 6. Timing and communication
Releases outside business hours; expected downtime < 10 minutes; status page / e-mail to users before and after.
