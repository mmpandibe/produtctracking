# Environment Configuration Document

| | |
|---|---|
| Document ID | NPRO-ENV-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Rule | Secret **values** are never written here — only where they are stored |

## 1. Environments

| Item | Development | Test / UAT | Production |
|---|---|---|---|
| URL | http://localhost:4200 (app), :5144 (API) | [https://npro-uat.<domain>] | [https://npro.<domain>] |
| App host | `ng serve` + `dotnet run` | IIS on Windows Server | IIS on Windows Server 2022 (EC2) |
| Database | `.\SQLEXPRESS`, database `Npro`, Windows auth | SQL Server (smaller instance) | SQL Server 2022 Standard / RDS |
| `ASPNETCORE_ENVIRONMENT` | Development | Staging | Production |
| `ConnectionStrings__Npro` | in `appsettings.Development.json` (no password) | secret store | secret store |
| `Seed__DemoPassword` | set (demo data + accounts) | set or empty (demo or masked data) | **empty** |
| `Features__DemoSwitcher` | true | true or false | **false** |
| `Automation__TimedRules` | true | true | true |
| Data Protection keys | user profile (default) | `D:\nPro\keys` | `D:\nPro\keys` (ACL: app pool only) — `DataProtection:KeysPath` |
| File storage | browser IndexedDB (offline demo) · `App_Data\files` (dev API) | `D:\nPro\files` | `D:\nPro\files` (`Storage:Disk:Root`) → S3 later |
| External HR / tracker | sample adapters | sample adapters | sample until API details exist |
| Logging | console | file / CloudWatch | CloudWatch; Information level |

## 2. Ports and network
| From | To | Port |
|---|---|---|
| Users | Load balancer / IIS | 443 |
| Load balancer | IIS | 80 or 443 |
| IIS | SQL Server | 1433 (TLS) |
| Admins | Server | SSM Session Manager (no open RDP) |

## 3. Versions
.NET 10 runtime (Hosting Bundle 10.x), SQL Server 2022, Windows Server 2022, IIS 10. Client: current Chrome, Edge, Firefox, Safari.

## 4. Change record
| Date | Environment | Change | By |
|---|---|---|---|
| | | | |

## Step 18d settings

| Key | Default | Notes |
|---|---|---|
| `DataProtection:KeysPath` | (none; Production file: `D:/nPro/keys`) | Without it, users are signed out on every restart (a warning is logged) |
| `Storage:Disk:Root` | `App_Data/files` under the app (Production file: `D:/nPro/files`) | Attachment bytes; keys are `yyyy/MM/<id>`, never the file name |
| `RateLimits:LoginPerMinute` | 10 | Per client address; 429 after that (the per-account lockout still applies) |
| `RateLimits:WritesPerMinute` | 300 | Per signed-in person (sync and uploads) |
| `Hosting:TrustForwardedHeaders` | false | true only behind a load balancer that sets X-Forwarded-For / -Proto |
| `Hosting:HttpsRedirect` | false | true when IIS itself terminates TLS (HSTS is always sent outside Development) |
| `Attendance:Provider` / `Productivity:Provider` | `sample` | Server-side sample adapter until the HR / tracker API details exist |
| `Attendance:LateAfter` | `10:00` | Punch-in after this is "late" |
| `Attendance:TimeZone` | server time zone | Windows time zone id, e.g. `India Standard Time` |
| `Retention:Enabled` / `Retention:LegalHold` | true / false | Daily retention job; legal hold pauses all deletion |
| `Retention:DeactivatedUserYears` / `TimeLogYears` / `AttendanceMonths` | 2 / 7 / 13 | Periods from the Data Retention and Deletion Policy |
| `Database:MigrateOnStartup` | true | false in production: the app only checks the schema; an admin runs `deploy/sql/02-schema.sql` |
