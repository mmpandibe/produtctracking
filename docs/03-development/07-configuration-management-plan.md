# Configuration Management Plan

| | |
|---|---|
| Document ID | NPRO-CMP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Configuration items (CIs)

| CI | Location | Control |
|---|---|---|
| Source code (UI, API, tests, scripts) | GitHub `main` | Git history, reviews, tags |
| Database schema | EF Core migrations (`server/src/Npro.Infrastructure/Migrations`) | Versioned with code; applied at start-up |
| Dependencies | `package.json` + `package-lock.json`; `.csproj` (pinned 10.0.15); `global.json` (SDK 10.0.404); `dotnet-tools.json` | Lock files committed |
| Application settings | `appsettings.json` (defaults, no secrets), `appsettings.Development.json` (local only) | Committed |
| Environment settings / secrets | IIS / OS environment variables; later AWS Secrets Manager | **Not** in Git; recorded in the Environment Configuration Document (names only) |
| Infrastructure | IIS site / app pool settings, AWS resources | Deployment Plan + Infrastructure document; scripted where possible |
| Documentation | `docs/`, `HANDOFF.md`, `ROADMAP.md`, `ACCESSIBILITY.md`, `server/README.md` | Versioned with code |

## 2. Baselines
- Development baseline: every commit on `main`.
- Release baseline: Git tag `vX.Y.Z` + release notes + migration list + build artefact (zip of the publish folder) stored with the
  release.

## 3. Change control
Changes come from a Change Request (CR) or a user story; approved by the product owner; implemented on a branch / commit; tested;
recorded in release notes. Emergency fixes follow the Patch Management Document.

## 4. Configuration keys (application)

| Key | Purpose | Default | Production |
|---|---|---|---|
| `ConnectionStrings:Npro` | SQL Server connection | empty | from environment (`ConnectionStrings__Npro`) |
| `Seed:DemoPassword` | Seed demo data + accounts into an empty database | empty | **empty** |
| `Features:DemoSwitcher` | "Sign in as" demo switcher | false | **false** |
| `Automation:TimedRules` | Background timed rules | true | true |
| `Logging:LogLevel:*` | Log levels | Information / Warning | Information |

## 5. Status accounting and audits
Release notes list commits, migrations and configuration changes. A configuration audit (settings, versions, migration level)
is part of the Production Readiness Checklist.
