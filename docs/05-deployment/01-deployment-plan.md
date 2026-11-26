# Deployment Plan

| | |
|---|---|
| Document ID | NPRO-DEP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Target | IIS 10 on Windows Server 2022 (AWS EC2), SQL Server 2022 |
| Note | Step 18d will add a publish script and a first-admin set-up; steps marked ⚠ depend on it |

## 1. Prerequisites (one-time per server)
1. Windows Server 2022 with IIS (Web Server role, incl. *WebSocket Protocol* optional, *Application Initialization*).
2. **ASP.NET Core 10 Hosting Bundle** installed; `iisreset` afterwards.
3. SQL Server 2022 reachable from the app server (TLS); database `Npro` created, or a login allowed to create it.
4. A service identity for the app pool with `db_owner` on `Npro` for the first deployment (migrations), then `db_datareader`,
   `db_datawriter`, `EXECUTE` and DDL only during releases — or run migrations as a separate step (see §4).
5. TLS certificate on the load balancer / IIS binding; HTTP → HTTPS redirect.
6. Folders: `D:\nPro\site` (application), `D:\nPro\keys` (Data Protection keys, ACL: app pool identity only), `D:\nPro\files`
   (attachments, 18d), `D:\nPro\logs`.

## 2. Build the release package
```powershell
npm.cmd ci; npx.cmd ng build --configuration production
```
```powershell
dotnet publish server/src/Npro.Api -c Release -o publish
```
```powershell
Copy-Item -Recurse dist/npro/browser/* publish/wwwroot/
```
Zip `publish` as `npro-<version>.zip`; record the commit hash. ⚠ 18d: one script does all three.

## 3. IIS configuration
| Setting | Value |
|---|---|
| App pool | .NET CLR version: **No Managed Code**; Start mode: **AlwaysRunning**; Idle time-out: 0; one worker process |
| Site | Physical path `D:\nPro\site`; binding HTTPS 443 (or HTTP behind the ALB); **Preload enabled = true** |
| Environment (web.config `<environmentVariables>` or app pool) | `ASPNETCORE_ENVIRONMENT=Production`, `ConnectionStrings__Npro=<from secret store>`; `Seed__DemoPassword` and `Features__DemoSwitcher` **not set** |
| Data Protection | ⚠ persist keys to `D:\nPro\keys` (18d code change) |
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
Additionally: create the first admin account (⚠ 18d set-up command), set up the organisation (divisions, teams, people with
employee IDs, products, SLA targets), import open tickets if needed, train users.

## 6. Timing and communication
Releases outside business hours; expected downtime < 10 minutes; status page / e-mail to users before and after.
