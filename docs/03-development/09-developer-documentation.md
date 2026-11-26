# Developer Documentation

| | |
|---|---|
| Document ID | NPRO-DEV-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Also read | `HANDOFF.md` (detailed working context), `server/README.md`, `ACCESSIBILITY.md` |

## 1. Prerequisites (Windows)
- Node.js 24 + npm (use **`npm.cmd` / `npx.cmd`** in PowerShell when script execution blocks `npm.ps1`)
- .NET SDK 10.0.404 (pinned by `server/global.json`; SDK 11 may also be installed)
- SQL Server Express (`.\SQLEXPRESS`, Windows authentication)
- Git; optional: SQL Server Management Studio, Microsoft Edge / Chrome (for the a11y scan)

## 2. First run
```powershell
git clone https://github.com/mmpandibe/produtctracking.git
```
```powershell
cd produtctracking; npm.cmd install
```
```powershell
dotnet tool restore --tool-manifest server/dotnet-tools.json
```
Start the API (creates and seeds the `Npro` database on first run):
```powershell
dotnet run --project server/src/Npro.Api --launch-profile http
```
Start the app (proxy sends `/api` to port 5144):
```powershell
npm.cmd start
```
Open http://localhost:4200 and sign in with a demo employee ID (EMP-001 = admin) and the demo password from
`server/src/Npro.Api/appsettings.Development.json` (`Seed:DemoPassword`). Without the API the app runs the offline demo.

## 3. Everyday commands
| Task | Command |
|---|---|
| Build UI | `npx.cmd ng build` |
| UI tests | `npx.cmd ng test --watch=false` |
| API tests | `dotnet test server` |
| Accessibility scan (app running) | `npm.cmd run a11y` · `npm.cmd run a11y:mobile` (set `A11Y_BASE` if not port 4200) |
| New migration | `dotnet ef migrations add <Name> -p server/src/Npro.Infrastructure -s server/src/Npro.Api -o Migrations` |
| Reset local database | drop database `Npro` in SSMS; next API start recreates and seeds it |
| Reset offline demo | clear site data (localStorage `npro-data`, `npro-ext-sample`, `npro-integrations`) |

## 4. How a feature flows
UI component → `DataStore` method (immutable update) → (server mode) `diffState` → `POST /api/sync` → `Sync.cs` authorisation per
collection → save → `RuleEngine` → response `changes` → `applyChanges`. Reads come from the snapshot (`GET /api/state`).

## 5. Adding things
| You add | Also update |
|---|---|
| A field on an entity | `models.ts`, `Entities.cs`, `NproDbContext` config, migration, seed (both), forms, tests |
| A new collection | `DataState`, `state-diff.ts` COLLECTIONS, `Sync.cs` Apply + Snapshot, ACM, tests |
| A screen | `pages/<name>`, `layout/nav.ts` (with `access`), `app.routes.ts` SCREENS, a11y scan PAGES list |
| An automation action | `core/automation.ts` (UI meta), `DataStore.applyAction` (offline), `RuleEngine.ApplyAsync` (server), `rule-meta.ts` |

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| Blank page after installing a package | Stop the dev server, delete `.angular/cache`, restart |
| Login page loops / 400 on save | XSRF cookie missing — reload; check the proxy is used (same origin) |
| `dotnet` builds with SDK 11 | Run from the repo so `server/global.json` applies |
| Port 4200 busy | The dev server picks another port; pass `A11Y_BASE` to the scan |
| API exe locked during tests | Stop the running API before `dotnet test` |
