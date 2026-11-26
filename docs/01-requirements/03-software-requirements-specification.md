# Software Requirement Specification (SRS)

| | |
|---|---|
| Document ID | NPRO-SRS-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Standard | Structure based on ISO/IEC/IEEE 29148 |
| Related | BRD NPRO-BRD-001 · PRD NPRO-PRD-001 · RTM NPRO-RTM-001 |

## 1. Introduction

### 1.1 Purpose
Defines the functional and non-functional requirements of nPro. Requirement IDs (FR-xx, NFR-xx) are used by the user stories,
design, test cases and the traceability matrix.

### 1.2 Definitions
| Term | Meaning |
|---|---|
| Product | A software product being built or supported; tickets belong to one product (key e.g. WEB) |
| Ticket / issue | A unit of work: story, task, bug, epic, request or support |
| Workflow | Ordered statuses with a category (to do, in progress, hold, done) and optional allowed transitions |
| Support level | L1 service desk, L2 product support, L3 engineering |
| SLA clock | Response or resolution target measured in calendar time from ticket creation |
| Scope | The products and people the signed-in person may see (computed per role) |
| Server mode / offline demo | With the API: data on SQL Server. Without: demo data in browser storage |

### 1.3 System overview
Angular 22 single-page application served by an ASP.NET Core (.NET 10) API under IIS, data in MS SQL Server via EF Core.
See the HLD (NPRO-HLD-001).

## 2. User classes

Eight roles (see Access Control Matrix NPRO-ACM-001). Capabilities: organisation, products, roadmaps, sprints, tickets, time,
reports, summary.

| Role | Capabilities | Sees |
|---|---|---|
| Admin | all | everything |
| Division head | products, roadmaps, sprints, tickets, time, reports, summary | products of divisions they head + their products; division people + reports |
| Assistant manager | same as division head | own products; people in teams they manage + reports |
| Business analyst | roadmaps, sprints, tickets, time, reports | assigned products |
| Tech lead | sprints, tickets, time, reports | assigned products |
| Developer, Tester | tickets, time | assigned products; only their own time |
| Production user | tickets | products of their client; only tickets they raised or their client's |

## 3. Functional requirements

| ID | Requirement | Priority |
|---|---|---|
| **FR-01** | Products: create, edit, archive, delete (admin / division head); key, name, version, lifecycle, lead, division, members, clients, colour, GitHub / website links; card and list views with ticket stats | Must |
| **FR-02** | Tickets: create / edit with type, priority, status, assignee, reporter, client, parent, sprint, story points, labels, start / due dates, estimate, progress, benefits, round, custom fields, support level; filters, sort and inline status change in the list | Must |
| **FR-03** | Ticket detail: description, child tickets, comments, attachments, time logs by activity, history of every change | Must |
| **FR-04** | Kanban board: columns from the workflow, drag-and-drop or "Move" menu, respects allowed transitions, quick create | Must |
| **FR-05** | Backlog & sprints: backlog ordering, create / start / complete sprints, move unfinished work, story points, velocity | Must |
| **FR-06** | Roadmaps: per product, dates, status, sprints, % complete, benefits | Must |
| **FR-07** | Time tracking: weekly timesheet per person / team, log time by activity, start / stop timer (one per person) | Must |
| **FR-08** | Clients: contacts, linked products, client users, archive | Must |
| **FR-09** | Reports: KPIs, created vs resolved, product-wise and client-wise, month-wise hours (person × client), burndown, velocity, workload, cycle time; CSV export | Must |
| **FR-10** | CXO summary: weekly / monthly period, roadmap summary, hours client × product, KPIs vs previous period, highlights, leadership comments; print / PDF, CSV, copy | Must |
| **FR-11** | Workflows & custom fields: statuses (rename, colour, category, reorder, delete with replacement), transition rules, per-product workflow; custom fields (text, number, date, select, checkbox; required; per product or all) | Should |
| **FR-12** | Organisation: divisions (head), teams (assistant manager), people (type internal / vendor / client, role, team, reports-to, products, **employee ID required and unique for internal people**), vendors, roles matrix; deactivate / delete with history rules | Must |
| **FR-13** | Role-based access: every list scoped to the signed-in person; menu and routes guarded; production users get "My Requests" | Must |
| **FR-14** | Support desk: L1–L3 levels with a team each, SLA targets per level × priority, response / resolution clocks (running, at risk ≤ 25 %, breached, met), escalation, queues, SLA report (30 days) | Must |
| **FR-15** | Gantt: per-product rows (roadmaps → sprints → tickets) with zoom levels, drag / resize / arrow keys to reschedule (role-checked); roadmap timeline across products | Must |
| **FR-16** | Attendance & hours: weekly punches, late / short days, missed punches, sick / casual leave (half day), corrections (regularisation) with manager approval, productive vs logged vs attended hours | Must |
| **FR-17** | Integrations: connector per external system (sample / company system via backend), employee ID mapping, late-after and full-day rules | Should |
| **FR-18** | Dashboards: "My day" (my tickets, my hours, leave, support SLAs) and "My team" (attendance today, hours per person, workload, sprints, SLA, approvals); global search (tickets, products, people, clients, pages; "/" or Ctrl+K) | Must |
| **FR-19** | Automation: rules per product or all products with triggers (created, status / assignee / priority changed, comment added, SLA at risk / breached, due date passed), conditions, actions (set status, assign, assign in turn, unassign, priority, label, comment, escalate); run log; executed on the server; timed rules every minute | Should |
| **FR-20** | Authentication: sign in with work email or (internal people) employee ID and password; lockout after 5 failures for 5 minutes; sign out; admins set passwords; demo "sign in as" only in development | Must |
| **FR-21** | Server data: everything the person may see loaded at sign-in; changes saved through the API with role checks, all-or-nothing; server assigns ticket numbers; live updates within 30 s | Must |
| **FR-22** | Offline demo: without a server the app runs on browser storage with demo data | Could |

## 4. Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| **NFR-01** | Accessibility | WCAG 2.2 AA; 0 axe violations on all screens at 1366 px and 320 px |
| **NFR-02** | Security | HttpOnly SameSite=Strict auth cookie; XSRF token on every write; server-side authorisation of every change; password hashing (ASP.NET Identity); lockout; secrets outside source code |
| **NFR-03** | Performance | API p95 < 500 ms for read endpoints with 50 concurrent users; UI interactions respond < 200 ms |
| **NFR-04** | Availability | 99.5 % during business hours (single site); RPO 1 h (hourly log backups), RTO 4 h (see DR plan) |
| **NFR-05** | Responsive layout | 320 px to wide desktop; no horizontal scrolling; no scroll areas inside the page |
| **NFR-06** | Browser support | Current Chrome, Edge, Firefox, Safari (desktop and mobile) |
| **NFR-07** | Maintainability | Typed code (TypeScript strict, C# nullable); automated tests run on every change; documented standards |
| **NFR-08** | Data integrity | Transactions for every save batch; unique ticket keys; workflow rules enforced on server-side automation |
| **NFR-09** | Privacy | Personal data minimised; retention periods applied; DPIA for attendance / productivity data |
| **NFR-10** | Hosting | IIS (in-process ASP.NET Core Module) on Windows Server; MS SQL Server |
| **NFR-11** | Auditability | History of every ticket change; automation run log; who did what and when |
| **NFR-12** | Usability | Compact UI, consistent patterns, help text on forms, clear errors |

## 5. External interfaces

| Interface | Description |
|---|---|
| UI | Browser (HTML5, Angular). |
| REST API | JSON over HTTPS, see API Specification NPRO-API-001. |
| Database | MS SQL Server via EF Core migrations. |
| Productivity tracker | Adapter `ProductivitySource` (sample now; backend proxy later). |
| Attendance / leave system | Adapter `AttendanceSource` (sample now; backend proxy later). |
| File storage | Attachment bytes: browser IndexedDB today; server disk / S3 in Step 18d. |

## 6. Constraints

.NET 10, Angular 22, SQL Server, IIS on AWS Windows; one IIS worker process; no AWS access or external API details available yet.

## 7. Acceptance

A requirement is accepted when its test cases (Test Cases NPRO-TC-001) pass and, for user-facing requirements, UAT signs it off.
