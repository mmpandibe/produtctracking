# Release Notes

| | |
|---|---|
| Document ID | NPRO-RN-001 |
| Version | 1.0 · 27 Nov 2026 |

## Development build 0.9 — 27 Nov 2026 (commit `1cd0b22`, not yet released to production)

### Highlights
- **Complete product workspace**: products, tickets, board, backlog & sprints, roadmaps, time tracking, clients, reports, CXO
  summary, workflows & custom fields.
- **Organisation & roles**: divisions, teams, people with employee IDs, vendors, 8 roles with scoped data; My Requests for client
  and production users.
- **Support desk**: L1 / L2 / L3 queues, SLA clocks, escalation, SLA report and targets.
- **Planning**: Gantt per product with drag-to-reschedule; roadmap timeline across products.
- **People data**: attendance, leave, corrections and productivity (sample data until the HR / tracker APIs are connected).
- **Dashboards & search**: My day / My team; global search ("/" or Ctrl+K).
- **Automation**: when / if / then rules, templates, run log — executed on the server, timed rules every minute.
- **Backend**: .NET 10 API with SQL Server, sign-in by email or employee ID, server-side access checks, live updates, admin
  password set-up.
- **Accessibility**: WCAG 2.2 AA (0 automated violations).

### Changes in this build
| Commit | Change |
|---|---|
| `88a0606` | Initial repository: all screens (Steps 1–17), backend 18a–18b, login redesign, employee IDs, WCAG 2.2 AA pass |
| `9f82ea8` | Step 18c: server ticket numbers, automation and timed rules on the server, live updates, set password |
| `1cd0b22` | Products: compact cards (up to 5 per row); fix for icon + text buttons |

### Database migrations
`Initial`, `EmployeeId` (adds `People.EmployeeId`, unique; backfills demo people).

### Step 18d (not yet committed)
- **Attachments on the server**: uploads go to the API (10 MB limit); files are stored on disk behind a storage interface
  (S3 can be added later); downloads check ticket access and are always served as downloads.
- **Attendance on the server**: the sample adapter runs in the API; leave and correction requests and approvals are stored in
  the database and shared by everyone.
- **IIS kit and hardening**: `scripts/publish.ps1`, `appsettings.Production.json`, `create-admin` command, persisted Data
  Protection keys, security headers (CSP), rate limits, fuller health check, self-hosted Inter font.
- Migration `AttendanceRequests` (tables `LeaveRequests`, `RegularisationRequests`).

### Known limitations
- Attendance / productivity: sample data; live HR / tracker connection needs API details.
- No e-mail notifications, SSO or MFA yet.

### Upgrade notes
Configuration keys: `ConnectionStrings:Npro`, `Seed:DemoPassword` (leave empty in production), `Features:DemoSwitcher` (false),
`Automation:TimedRules` (true). 18d adds `DataProtection:KeysPath`, `Storage:Disk:Root`, `RateLimits:*`, `Hosting:*`,
`Attendance:*` and `Productivity:Provider` (see the Environment Configuration Document). IIS app pool must be AlwaysRunning with Preload for timed rules.
