# nPro — Product Ticket Tracking System

A Jira-style ticket tracker with extra features for product/client reporting, time tracking and CXO summaries.

**Phase A: frontend only.** Angular 22 + TypeScript (standalone components, signals, zoneless), Tailwind CSS 4, light frosted-blue glass theme (`glass`, `glass-strong`, `pill`, `section-title` classes in `src/styles.css`, Inter font, 14px base size).
Data is kept in the browser (localStorage) by `DataStore` (`src/app/core/data-store.ts`).
The data model is designed from the start so a backend (API + database) can replace the store later without reshaping data.

Run it: `npm.cmd start` → http://localhost:4200 · Tests: `npm.cmd test` · Build: `npm.cmd run build` (plain `npm` works too if PowerShell scripts are allowed)

## Build order (step by step, screen by screen)

| Step | Screen / feature | What it includes |
|------|------------------|------------------|
| 1 ✅ | **Foundation + Products** | App shell (sidebar, top bar), glass theme, data model, local store, seed data, Products screen (card + list views, summary tiles) + Create/Edit Product |
| 2 ✅ | **Ticket list + Create/Edit ticket** | Ticket list with status chips and filters; Create/Edit dialog with type (incl. Support), parent ticket, start/end time, attachments; comments/remarks when editing |
| 3 ✅ | **Ticket detail** | Full ticket page: description, status transitions, assignee, product, client, **start time / end time**, due date, comments, activity history |
| 4 ✅ | **Kanban board** | Drag-and-drop columns driven by the product's workflow (Angular CDK), card order saved, empty columns collapse, filters by product / sprint / assignee / type, quick-create per column |
| 5 ✅ | **Backlog + Sprints** | Per-product planning: active / planned sprints + backlog with drag & drop, inline story points, create / edit / start / complete / delete sprints, committed vs completed points, velocity |
| 6 ✅ | **Time tracking** | Weekly timesheet per person (click a cell to log), team view, hours by activity / product vs 40h target, entry list, Log time dialog, global running-timer pill in the top bar |
| 7 ✅ | **Clients admin** | Clients with contact person / email / phone, linked products, notes, archive / delete (SLA tiers were replaced by support levels in Step 13) |
| 8 ✅ | **Reports** | Month-wise hours by person × client (share of person / client, CSV), KPI tiles, created-vs-resolved trend, product-wise & client-wise reports (CSV export), sprint burndown, velocity, workload, cycle time (avg / median / p85, histogram, by type); filters: period, product, client |
| 9 ✅ | **CXO summary** | Weekly / monthly executive report: KPIs vs previous period, auto highlights, product & client tables, active sprints (on track / behind), overdue / high-priority / on-hold lists, team effort, saved leadership comments; Print / Save PDF, CSV, copy as text |
| 10 ✅ | **Workflows & custom fields** | Workflow editor (rename / recolour / categorise / drag-reorder / add / delete statuses with ticket migration), new workflows as copies, assign workflows to products (statuses mapped by category), transition-rules matrix with a Restrict toggle enforced on board, tickets list, ticket page and edit dialog; custom fields (text / number / date / dropdown / checkbox, required, all products or one) in the ticket dialog and on the ticket page |
| 11 ✅ | **Organisation setup** | One admin page for divisions → teams → members, users (internal staff, vendor staff, client users), roles (Admin, Division head, Assistant manager, Business analyst, Tech lead, Developer, Tester, Production user), reporting manager, vendor companies, products linked to a division and given product members. Client setup stays on the Clients page, with client users linked to it |
| 12 ✅ | **Roles & access** | "Signed in as" switcher (until real login). Division head sees only their division's products and people, with full rights there. Assistant manager sees their products and the people reporting to them, with full rights there. BA creates roadmaps, sprints, tickets and reports on assigned products. Tech lead creates sprints, tickets and reports. Developer and tester create tickets. Production user gets a simple "My requests" view: raise a ticket and follow its status. Menus, buttons and lists follow the role |
| 13 ✅ | **Support desk: L1 / L2 / L3 + SLA** | Support level on support tickets, a support team per level, SLA targets per level × priority (response and resolution), live SLA clocks, at-risk and breached flags, escalate L1 → L2 → L3 with history, support queues and an SLA report |
| 14 ✅ | **Gantt & roadmap timeline** | Gantt per product (roadmaps → sprints → tickets as bars by start and due date, today line, week / month / quarter zoom, drag to move or resize); a roadmap timeline across all products |
| 15 ✅ | **External systems: productivity & attendance** | Connectors for (a) the laptop tracker's productive hours per person per day and (b) attendance: punch in and out, sick and casual leave, hour regularisation. In Phase A this runs on sample data behind a swappable adapter; the real endpoints are wired in Phase B |
| 16 ✅ | **Developer & manager dashboards + search** | Developer: my tickets, logged vs productive vs attended hours, my leave. Manager: team attendance today, who is on leave, productive vs logged hours per person, workload, SLA breaches. Plus global search |
| 17 ✅ | **Automation rules** | "When X, if Y, then Z" rules (auto-assign, auto-transition, notify) |
| 18 | *(Phase B)* Backend: **.NET 10 LTS (C#) + MS SQL, hosted on AWS Windows / IIS** | ASP.NET Core Web API + EF Core (SQL Server), real login, roles checked on the server, attachments in S3, automation and timed rules on the server, real productivity and attendance APIs (keys kept on the server). Built in parts 18a–18d (**18a ✅** foundation: `server/` solution, SQL Server schema, sign-in, access rules, read API; **18b ✅** login page, app reads from and saves to the API with server-side role checks, XSRF; **18c ✅** ticket numbers, automation and timed rules on the server, live updates between browsers, set-password UI) |

## Code structure

```
src/app/
  core/       models.ts (data types), data-store.ts (signals + localStorage), seed.ts, migrate.ts, roles.ts (roles + capabilities), access-guard.ts, sla.ts (support levels + SLA clocks), timeline.ts (Gantt date maths), external.ts + external-sample.ts + external-store.ts (productivity / attendance adapters), search.ts (global search), automation.ts (rule meta, conditions, templates), utils.ts
  shared/     icon.ts (lucide icons), avatar.ts, modal.ts
  layout/     shell.ts/.html (sidebar + top bar), nav.ts (menu + roadmap step per screen)
  pages/      products/ (Screen 1), tickets/ (Screens 2–3, detail + shared panels), board/ (Screen 4), backlog/ (Screen 5), time/ (Screen 6), clients/ (Screen 7), reports/ (Screen 8), cxo/ (Screen 9), workflows/ (Screen 10), organisation/ (Screen 11), requests/ (My Requests, Step 12), support/ (Screen 13), gantt/ (Screen 14), attendance/ + integrations/ (Step 15), dashboard/ (Step 16), automation/ (Step 17), coming-soon.ts (placeholder for later screens)
```

## Core data model

- **User** — name, email, role (8 roles), kind (internal / vendor / client), team, reporting manager, vendor or client company
- **Division** → **Team** (assistant manager) → members; **Vendor** companies
- **Client** — who the work is for (contacts, products, users)
- **Product** — top-level container: key (e.g. `WEB`), version, lifecycle stage, lead, division, members, linked clients, workflow
- **Workflow** — ordered statuses with colours and categories (todo / in progress / hold / done). Default: New → Development In Progress → Testing → Ready for UAT → UAT In Progress → Ready for QA → QA In Progress → Ready for Live → Live, plus Hold and Closed
- **Issue (ticket)** — key (`WEB-12`), product, type, summary, description, status, priority, assignee, reporter,
  client, sprint, story points, labels, **startAt**, **endAt**, due date, estimate, custom field values
- **WorkLog** — time logged against a ticket
- **Comment** (remarks), **Attachment** (metadata in state, file bytes in IndexedDB via `core/file-store.ts`), **Activity** (history), **Sprint**, **CustomFieldDef**, **AutomationRule**, **SlaPolicy** (targets per support level × priority), **SupportLevelConfig** (name + team per L1 / L2 / L3)
