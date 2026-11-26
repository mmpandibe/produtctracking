# Software Maintenance Plan

| | |
|---|---|
| Document ID | NPRO-MAINT-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Maintenance types

| Type | Examples | Handling |
|---|---|---|
| Corrective | Bugs, incidents | Incident / problem process; patch releases |
| Adaptive | .NET / Angular / SQL Server upgrades, browser changes, new HR / tracker APIs | Planned minor releases |
| Perfective | New features, UX improvements (e.g. compact product grid) | Change Requests, roadmap |
| Preventive | Dependency updates, performance tuning, data clean-up, security hardening | Monthly maintenance window |

## 2. Support model
| Line | Who | Scope |
|---|---|---|
| L1 | Service desk | Account / password resets, how-to questions (User Manual), triage |
| L2 | nPro application support (IT) | Configuration, data fixes, environment, logs |
| L3 | Development team | Code defects, releases |

nPro tickets about nPro itself are tracked in nPro (product "nPro").

## 3. Routine tasks

| Frequency | Task |
|---|---|
| Daily | Check health alerts, backup success, error log summary |
| Weekly | Review automation run log failures, disk space, slow requests |
| Monthly | Dependency scans and updates (`npm audit`, `dotnet list package --outdated --vulnerable`); Windows patches; restore test of one backup |
| Quarterly | Access review (admins, deactivated people), retention clean-up, DR documentation review |
| Yearly | Pen test, DR test (also half-yearly), platform roadmap review (.NET LTS, Angular majors) |

## 4. Platform lifecycle
.NET 10 LTS supported to Nov 2028 → plan upgrade to the next LTS (.NET 12) in 2028. Angular: one major upgrade per year
(supported versions ~18 months). SQL Server 2022: mainstream support to 2028.

## 5. Knowledge retention
This documentation set, `HANDOFF.md`, code comments and tests are the reference; updated with every change.
