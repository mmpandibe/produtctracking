# Production Readiness Checklist

| | |
|---|---|
| Document ID | NPRO-PRC-001 |
| Version | 1.0 · 27 Nov 2026 |
| Status | Current state assessed for development build `1cd0b22` |

| # | Item | Status |
|---|---|---|
| **Functionality** | | |
| 1 | All release scope built and accepted in UAT | ⏳ UAT pending |
| 2 | No open critical / high defects | ✅ (development) |
| **Quality** | | |
| 3 | Automated tests pass (79 Angular, 30 server) | ✅ |
| 4 | Accessibility scan 0 violations (desktop, 320 px) | ✅ |
| 5 | Screen-reader pass | ⏳ |
| 6 | Load test meets NFR-03 on target hardware | ⏳ (local baseline only) |
| **Security** | | |
| 7 | Dependency scans clean | ✅ (27 Nov) |
| 8 | Pen test / DAST: no open critical / high | ⏳ |
| 9 | Security headers, rate limiting, Data Protection key persistence | ✅ 18d (verified in a local Production run) |
| 10 | Demo seed and demo switcher disabled in production config | ⏳ verify at deployment |
| 11 | Secrets only in the server environment / secret store | ⏳ verify at deployment |
| **Privacy** | | |
| 12 | DPIA approved; employee notice for attendance / productivity data | ⏳ |
| 13 | Retention periods agreed and scheduled | ⏳ |
| **Infrastructure** | | |
| 14 | Production server, SQL Server edition, TLS certificate | ⏳ (no AWS access yet) |
| 15 | IIS app pool AlwaysRunning + Preload | ⏳ |
| 16 | Backups scheduled and a restore tested | ⏳ |
| 17 | Monitoring and alerts (health check, CPU, disk, errors) | ⏳ |
| 18 | Disaster Recovery Plan reviewed | ⏳ |
| **Operations** | | |
| 19 | First admin account and organisation set-up | ✅ `create-admin` command · ⏳ organisation set-up |
| 20 | Support team trained; user manual available | ✅ manual drafted · ⏳ training |
| 21 | Rollback Plan rehearsed | ⏳ |
| 22 | Release notes and communication ready | ✅ draft |

Go-live requires every item ✅ or an approved exception.
