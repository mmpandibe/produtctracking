# nPro backend (Step 18 · Phase B)

ASP.NET Core Web API on **.NET 10 (LTS)** with **MS SQL Server** through EF Core, hosted on **AWS Windows / IIS**.
The Angular app (repo root) keeps its screens; in Step 18b its `DataStore` switches from localStorage to this API.

## Projects

| Project | What it holds |
|---|---|
| `src/Npro.Domain` | Entities (twin of `src/app/core/models.ts`), roles + capabilities (`roles.ts`), `AccessScope` (port of `DataStore.access()`), workflow transition rules |
| `src/Npro.Infrastructure` | `NproDbContext` (EF Core, SQL Server, Identity tables), migrations, `DemoData` (port of `seed.ts`), `DbInitializer` |
| `src/Npro.Api` | `Program.cs` (DB, Identity cookie sign-in, JSON shape, static Angular files), `Endpoints.cs`, `Access.cs` (per-request scope) |
| `tests/Npro.Tests` | xUnit: API tests on in-memory SQLite (`ApiFactory`) + domain tests |

## Run locally

With the Angular app: run the API, then `npm.cmd start` in the repo root — `proxy.conf.json` forwards `/api` to port 5144 and the app shows a login page. Without the API the app runs the offline demo on browser storage.


Needs the .NET 10 SDK (pinned in `global.json`) and SQL Server Express (`.\SQLEXPRESS`, Windows authentication).

```powershell
dotnet run --project server/src/Npro.Api --launch-profile http
```

On start the API applies migrations to the `Npro` database and, when it is empty, seeds the demo organisation.
Every demo person signs in with their email and the demo password in `src/Npro.Api/appsettings.Development.json`
(`Seed:DemoPassword`, development only). API: <http://localhost:5144/api/health>.

```powershell
dotnet test server
```

New migration after changing entities:

```powershell
dotnet ef migrations add <Name> -p server/src/Npro.Infrastructure -s server/src/Npro.Api -o Migrations
```

## API (18a + 18b)

Every write (POST) must send the `X-XSRF-TOKEN` header with the value of the `XSRF-TOKEN` cookie, which any GET under /api sets.

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | open; database, file storage and timed rules up/down (503 when the database is down) |
| POST | `/api/auth/login` | `{ email, password }` → `npro.auth` cookie (HttpOnly, SameSite=Strict, 8 h sliding); 5 wrong tries lock for 5 min |
| POST | `/api/auth/logout` | |
| GET | `/api/auth/me` | person, capabilities, access scope |
| POST | `/api/auth/switch/{userId}` | demo "Sign in as"; only when `Features:DemoSwitcher` is true (never in production) |
| GET | `/api/organisation` | divisions, teams, vendors, people + clients the person may see |
| GET | `/api/products` | products in scope |
| GET | `/api/issues?productId=&q=` | tickets in scope (production users: own + their client's) |
| GET | `/api/issues/{key}` | 404 unknown, 403 not allowed |
| GET | `/api/state` | 18b: everything the person may see, in the frontend's DataState shape |
| POST | `/api/sync` | 18b: `{ changes: [{ collection, op: upsert or delete, id, data }] }` — each change checked against role + scope, all-or-nothing (403 refused, 409 conflict). 18c: the server then numbers new tickets and runs automation; the answer is `{ saved, version, changes }` with everything it changed |
| POST | `/api/people/{id}/password` | 18b: admins set a person's password |
| POST | `/api/attachments` | 18d: multipart upload (id, issueId, file ≤ 10 MB) |
| GET | `/api/attachments/{id}/content` | 18d: download (ticket access checked) |
| GET | `/api/attendance?from&to` | 18d: attendance, productivity, leave, corrections, balances for the people you can see |
| POST | `/api/attendance/leave`, `/regularisation`, `/{kind}/{id}/decide`, `/{kind}/{id}/cancel` | 18d: requests and approvals |
| GET | `/api/state/version` | 18c: data version (moves on every save and timed rule run); the app polls it every 30 s |

JSON uses the frontend's shape: camelCase, the same lower_snake values (`division_head`, `in_progress`), empty optional
fields left out.

## Configuration

| Key | Development | Production (AWS) |
|---|---|---|
| `ConnectionStrings:Npro` | `.\SQLEXPRESS`, Windows auth | from AWS Secrets Manager / Parameter Store as env var `ConnectionStrings__Npro` |
| `Seed:DemoPassword` | set → demo data | **empty** (no demo data) |
| `Features:DemoSwitcher` | `true` | `false` |
| `DataProtection:KeysPath` | (not set) | `D:/nPro/keys` |
| `Storage:Disk:Root` | `App_Data/files` | `D:/nPro/files` |

More 18d keys (rate limits, forwarded headers, attendance provider) are listed in
`docs/05-deployment/06-environment-configuration-document.md`.

## IIS deployment (Step 18d; full steps in `docs/05-deployment/01-deployment-plan.md`)

1. Install the **ASP.NET Core 10 Hosting Bundle** on the Windows server.
2. Run `.\scripts\publish.ps1` from the repository root: it tests, builds Angular, publishes the API with the Angular app in
   `wwwroot` and zips it into `publish\`. On a fresh database create the first admin with
   `Npro.Api.exe create-admin --name "Full Name" --email you@company.com --employee-id EMP-001`.
3. App pool: *No Managed Code*; for the timed automation rules (background service, every minute) set
   **Start mode = AlwaysRunning** and **Preload enabled = true** on the site, or IIS stops them when idle.
   (`Automation:TimedRules` = false switches the timer off.)
4. Give the app pool identity access to SQL Server (or use a SQL login in the secret connection string).
