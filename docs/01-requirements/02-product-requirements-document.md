# Product Requirement Document (PRD)

| | |
|---|---|
| Document ID | NPRO-PRD-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Owner | [Product owner] |
| Related | BRD NPRO-BRD-001 · SRS NPRO-SRS-001 · User stories NPRO-US-001 |

## 1. Product vision

nPro is a Jira-style workspace for product delivery and support across **in-house teams, vendor partners and clients**. It joins
tickets, planning, support SLAs, time, attendance and leadership reporting in one compact, accessible web app.

## 2. Personas

| Persona | Goals | Key screens |
|---|---|---|
| **Alex — Admin / head of delivery** | Set up the organisation, see everything, CXO summary | Organisation, Clients, Workflows, Automation, CXO Summary |
| **Priya — Division head** | Health of her division's products and people | Dashboard (My team), Gantt, Reports |
| **Meera — Assistant manager** | Run her teams, approve leave, plan sprints | Dashboard, Backlog & Sprints, Attendance & Hours |
| **Lena — Business analyst** | Roadmaps, sprints, tickets, reports | Backlog, Gantt, Reports |
| **Sam — Tech lead** | Sprints and delivery | Board, Backlog, Reports |
| **Jordan — Developer** | Work on tickets, log time, apply for leave | Dashboard (My day), Board, Time Tracking |
| **Ana — Support engineer (L1)** | Answer support tickets within SLA | Support Desk |
| **Vikram — Vendor developer** | Work on assigned products only | Board, Tickets |
| **Dana — Client user** | Raise tickets and follow them | My Requests |

## 3. Release scope (functional modules)

| Module | Summary | Status |
|---|---|---|
| Products | Cards / list, lifecycle, links, archive, stats | Built |
| Tickets | Dense list with filters; create / edit dialog; detail page with comments, files, time, history | Built |
| Board | Kanban driven by the product workflow; drag or "Move" menu | Built |
| Backlog & Sprints | Backlog, sprints (start / complete), story points, velocity, roadmaps | Built |
| Time Tracking | Weekly timesheet, start / stop timer, log time | Built |
| Clients | Clients, contacts, products, users | Built |
| Reports | KPIs, product / client reports, month-wise hours, burndown, velocity, CSV | Built |
| CXO Summary | Weekly / monthly summary, highlights, PDF / CSV / copy | Built |
| Workflows & Fields | Statuses, transitions, custom fields | Built |
| Organisation | Divisions, teams, people (employee ID), vendors, roles matrix, set password | Built |
| Roles & access | 8 roles, scoped data, "My Requests" for production users | Built (server-enforced) |
| Support Desk | L1–L3 queues, SLA clocks, escalation, SLA report, targets | Built |
| Gantt & Roadmap | Per-product Gantt with drag reschedule; roadmap lanes | Built |
| Attendance & Hours | Punches, leave, corrections, productivity vs logged | Built on sample data |
| Integrations | Connector settings, employee ID mapping, rules | Built (live APIs pending) |
| Dashboard & search | My day / My team; global search | Built |
| Automation | When / if / then rules, templates, run log, timed rules | Built (runs on the server) |
| Sign-in & server | Login by email or employee ID; .NET API; SQL Server | Built (18a–18c) |
| Files on S3, live HR / tracker APIs, IIS deployment kit | Step 18d | Planned |

## 4. Key product principles

1. **Compact, light frosted-glass UI**, small fonts, dense rows; only the browser window scrolls (no inner scrollbars).
2. **Scoped by default**: lists show only what the signed-in role may see; the server enforces the same rules.
3. **Accessible**: WCAG 2.2 AA, keyboard alternatives for every drag action.
4. **Works offline as a demo**: without a server the app runs on browser storage with demo data.

## 5. Success metrics

| Metric | Target (first 3 months) |
|---|---|
| Weekly active users / licensed users | ≥ 80 % |
| Tickets created in nPro vs other tools | ≥ 95 % |
| Support response SLA met (all levels) | ≥ 90 % |
| CXO summary prepared from nPro | Every week |
| Accessibility scan violations (axe, all screens) | 0 |

## 6. Non-goals (this release)

Native apps, e-mail / push notifications, billing, chat, single sign-on, AI features.

## 7. Release plan

Steps 1–17 (screens) and 18a–18c (backend) are complete in development. Remaining: 18d (file storage, live HR / tracker
connection, IIS deployment kit), UAT, production deployment. See the Project Plan (NPRO-PLAN-001).

## 8. Open questions

| # | Question | Owner |
|---|---|---|
| 1 | API details and credentials for the laptop productivity tracker and the HR / attendance system | HR / IT |
| 2 | AWS account, S3 bucket and region for attachments | IT |
| 3 | Single sign-on provider (Entra ID / Google) and timeline | IT |
| 4 | Data retention periods for attendance, productivity and ticket data | Data protection officer |
| 5 | Production SQL Server edition (Express is limited to 10 GB and has no TDE) | IT |
