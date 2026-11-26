# Project Plan

| | |
|---|---|
| Document ID | NPRO-PLAN-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Owner | [Project manager] |

## 1. Objectives
Deliver nPro to production on AWS Windows / IIS with SQL Server, meeting the BRD objectives (BO-1 … BO-7).

## 2. Approach
Incremental delivery, one screen or capability per step, each verified in the browser (desktop and phone), by automated tests
(`ng test`, `dotnet test`) and, since 26 Nov 2026, by the accessibility scan. Phase A built the full UI on browser storage;
Phase B (Step 18) adds the .NET backend.

## 3. Work breakdown and status

| Step | Deliverable | Status |
|---|---|---|
| 1–3 | Shell, Products, Tickets list, ticket dialog, ticket detail | ✅ Done |
| 4–6 | Board, Backlog & Sprints (+ roadmaps), Time tracking | ✅ Done |
| 7–10 | Clients, Reports, CXO summary, Workflows & custom fields | ✅ Done |
| 11–13 | Organisation, Roles & access, Support desk L1–L3 + SLA | ✅ Done |
| 14–17 | Gantt & roadmap, Attendance & productivity (sample), Dashboards & search, Automation | ✅ Done |
| 18a | .NET 10 API, SQL Server schema, sign-in, server-side access, read API | ✅ Done |
| 18b | Login page, change sync with role checks, XSRF | ✅ Done |
| — | Login redesign, employee ID, WCAG 2.2 AA pass, product grid | ✅ Done |
| 18c | Server ticket numbers, server automation + timed rules, live updates, set password | ✅ Done |
| 18d | File storage (server disk, S3 later), server-side attendance / productivity adapter, IIS deployment kit, production config, first-admin setup | ⏳ Next |
| 19 | Test hardening: screen-reader pass, load test, penetration test, UAT | Planned |
| 20 | Production deployment, hypercare (2 weeks) | Planned |

## 4. Timeline (proposed, from approval of this plan)

| Week | Activity |
|---|---|
| 1–2 | Step 18d; production SQL Server edition decided; AWS environment prepared (when access is available) |
| 3 | Security testing (OWASP ASVS L2 checklist, pen test), load test, screen-reader pass; fix findings |
| 4 | UAT with representatives of each role (incl. one vendor and one client user) |
| 5 | Production deployment, data set-up (organisation, products), training |
| 6–7 | Hypercare, then hand-over to support (Software Maintenance Plan) |

## 5. Roles (RACI summary)

| Activity | Product owner | Project manager | Developers | QA | IT / infra | Security / DPO |
|---|---|---|---|---|---|---|
| Requirements | A | R | C | C | C | C |
| Build & unit tests | C | I | R/A | C | I | I |
| Testing & UAT | A | R | C | R | I | C |
| Deployment | C | A | R | C | R | I |
| Privacy / security sign-off | C | I | C | C | C | R/A |

## 6. Dependencies
- AWS account and Windows servers (blocked: no access yet).
- API documentation for the laptop productivity tracker and HR / attendance system (blocked: not available).
- Decision on production SQL Server edition and backups.

## 7. Communication
Weekly status to stakeholders (CXO summary format), demo at the end of each step, risks reviewed weekly (Risk Assessment).

## 8. Quality gates
Build green; all automated tests pass; accessibility scan 0 violations; code review checklist complete; no open critical / high
security findings before production.
