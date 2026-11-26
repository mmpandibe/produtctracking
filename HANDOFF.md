# nPro — Session handoff (as of 2026-11-26, after Step 18c)

Read this first in a new session. Also see `ROADMAP.md` (step list) — this file is the working context.

## What nPro is
A Jira-style product ticket tracker built **step by step, screen by screen**, with extras the user asked for:
product- and client-wise reports, start/end times, time tracking, weekly/monthly CXO summary, custom fields & workflows,
automation, customer portal + SLAs.

## Stack & how to run
- **Angular 22.3** (standalone components, signals, zoneless, `@if/@for`, Reactive Forms), TypeScript, **Tailwind CSS 4**,
  `lucide` icons (via our own `shared/icon.ts`; brand icons like GitHub don't exist), **@angular/cdk** drag-drop, Vitest.
- Frontend only (Phase A). All data in **localStorage** key `npro-data` via `core/data-store.ts` (`STORAGE_VERSION = 11`;
  v10 data is upgraded by `migrateV10`, v9 by `migrateV9` then `migrateV10` (`core/migrate.ts`); older versions reset to seed data — prefer adding defaults
  in `load()` for non-breaking new fields, like `summaryNotes`, and write a migration for breaking ones).
  Attachment bytes live in **IndexedDB** (`core/file-store.ts`).
- User's PowerShell blocks `npm.ps1` → always tell them **`npm.cmd start` / `npm.cmd test` / `npm.cmd run build`**, `npx.cmd …`.
- Dev server config `.claude/launch.json` name **`npro-dev`** (port 4200). If a blank page appears after installing a package:
  stop server, delete `.angular\cache`, restart.
- No git repo yet (created with `--skip-git`). Don't commit unless asked.

## Conventions / user preferences (important)
- Build each step, then **verify in the browser** (desktop 1366px + mobile preset), run `npx ng build` and `npx ng test --watch=false`.
- **No inner scrollbars** — only the browser window scrolls (tables use `table-fixed` + responsive hidden columns; phones get cards).
- Theme: **light frosted-blue glass** (Inter font, 14px root size = compact), brand `#1677ff`, text token `ink`
  (`text-ink/60`, `border-ink/10`), classes in `src/styles.css`: `glass`, `glass-strong`, `glass-hover`, `input`, `label`,
  `section-title`, `btn-primary|secondary|danger`, `icon-btn`, `chip`/`chip-on`/`chip-off`, `tag`, `pill` (outlined, colour via inline `color`).
- User wants **small fonts, dense rows, less padding**.
- **Accessibility: WCAG 2.2 AA is required** (user request, 2026-11-26; see ACCESSIBILITY.md). Secondary text ≥ text-ink/70, brand is
  #0b5fd9, data colours used as text/icons go through the readable pipe (shared/readable.ts), no opacity fading of content
  (.muted-row), icon buttons need aria-label and ≥ 24 px targets (px — root font is 14 px), every drag needs a click/key
  alternative (shared/move-menu.ts), dialogs via app-modal (focus trap built in). Check with npm.cmd run a11y / a11y:mobile
  (scripts/a11y-scan.cjs: axe-core in headless Edge, 30 screens + dialogs, exit 1 on problems).
- Page titles: `<app-page-header heading="…">actions</app-page-header>` (shell no longer renders titles).
- Angular gotchas hit before: `<select [value]>` with `@for` options doesn't select → use `[selected]` on options;
  two inputs on one FormControl don't sync; `@let` names can shadow methods; whitespace between inline elements is stripped
  (use `ml-1` instead of a space); Tailwind v4 can't `@apply` custom classes.
- Shell edits with long inline `node -e` scripts often break on quotes → write a `.cjs` script to the scratchpad and run it.
- Charts follow the dataviz skill: palette in `core/reports.ts` (`SERIES`, `NEUTRAL`, `CATEGORY_COLORS`), components
  `shared/charts/line-chart.ts` (crosshair tooltip) and `bar-chart.ts` (horizontal stacked / vertical grouped, value labels).

## Data model (core/models.ts)
**User** (role = 8 roles in `core/roles.ts`, kind internal/vendor/client, title, phone, teamId, managerId = reports to,
vendorId, clientId, inactive), **Division** (name, description, headId, color), **Team** (divisionId, name, managerId =
assistant manager), **Vendor** (company + contact), Product (key, version, lifecycle, lead, **divisionId, memberIds**, clientIds, workflowId, color, **githubUrl, websiteUrl**), Client (contact
name/email/phone, slaTier, notes, archived), Workflow (statuses with id/name/**category todo|in_progress|hold|done**/color,
transitions map — empty = any move), Issue (key, productId, type incl. **support**, status, priority, assignee, reporter,
client, sprint, **parentId**, storyPoints, labels, **startDate**, startAt/endAt (auto stamps), dueDate, estimateMinutes,
**progress %**, **estimatedBenefits, achievedBenefits, round**, rank (board order), customFields), WorkLog (minutes,
**activity**: analysis/design/development/testing/meeting(Demo/Meeting)/documentation, note, fromTimer), RunningTimer,
Comment, Attachment, Activity (history), **Roadmap** (productId, name, description, start/due, status
planned/in_progress/on_hold/completed/cancelled, completedAt, achievedBenefits; sprints link via `sprint.roadmapId`),
Sprint (state planned/active/closed, committed/completedPoints), CustomFieldDef (name, type, options, required, productId = one product or all), AutomationRule
+ AutomationRun log (Step 17), SlaPolicy (15 = 3 levels × 5 priorities), summaryNotes (CXO comments per period).

Default workflow statuses: New → Development In Progress → Testing → Ready for UAT → UAT In Progress → Ready for QA →
QA In Progress → Ready for Live → Live (done), Hold (hold), Closed (done).

## Done (Steps 1–9 + follow-ups)
1. Shell (collapsible sidebar, global search (Step 16), running-timer pill), Products (cards/list, stats, links).
2. Tickets list (dense grid, one filter bar incl. status dropdown, search right, Sprint/Due/Round/Done columns, inline status).
   Create/Edit dialog (wide, 2 columns): parent, sprint, start date, assignee (reporter auto), round, benefits,
   % complete (edit), tabs Log hours / Files / Comments (`pages/tickets/panels/*`).
3. Ticket detail page `/tickets/:key` (benefits, children, comments/log hours/files/history tabs, details, dates & hours by activity).
4. Kanban board (CDK drag-drop, rank, empty columns collapse, filters, quick create).
5. Backlog & Sprints: **Roadmaps panel** (create/edit/delete, % from points, sprints, benefits), sprints (create/start/complete,
   move unfinished), backlog drag-drop, inline story points, velocity, completed sprints.
6. Time tracking: weekly timesheet (person or team), log-time dialog, summaries, entries list, global timer.
7. Clients: client CRUD + product links (the SLA targets matrix moved to the Support Desk in Step 13).
8. Reports: KPIs, created vs resolved, product-wise & client-wise (CSV), **month-wise hours person × client (share of
   person/client, CSV)**, burndown, velocity, workload, cycle time.
9. CXO summary (weekly/monthly): **Section 1 roadmap summary**, **Section 2 hours client × product**, KPIs vs previous period,
   auto highlights, product/client tables, active sprints on-track, attention lists, team effort, leadership comments;
   Print/Save PDF (print styles), CSV, copy as text.
10. Workflows & Fields `/workflows` (`pages/workflows/`): workflow chips + New workflow (copy; statuses keep the same ids so
   tickets map 1:1), statuses list (CDK drag-reorder, colour picker, inline name, category select, ticket count, delete with
   replacement-status dialog), Products card (switch workflow → `assignWorkflow` maps missing statuses by category),
   Transition rules (Restrict toggle; matrix on md+, toggle chips on phones). Custom fields tab (table + `field-form.ts`
   modal; deleting a field strips values; changing its type clears values). Ticket dialog renders the product's fields
   (`cfValues` signal, required validation) and the detail page lists them under Details. Status selects in the tickets
   list, ticket page and edit dialog use `store.allowedStatuses(issue)`.
   **Transition semantics:** `transitions: {}` = rules off; otherwise each status's list is exact (`[]` = no moves out),
   a status without an entry may go anywhere (`canTransition`). Seed (fresh data only) has 2 demo fields: Environment
   (all products, dropdown) and Customer reference (ANL, text).
11. Organisation `/organisation` (`pages/organisation/`): tabs Structure (division cards → team cards with members, add
   people to a team, remove, "Not in a team" list), People (filters type / role / division / deactivated, table, row menu
   edit / deactivate / delete), Vendors (cards with staff + products), Roles (capability matrix from `core/roles.ts`
   `ROLE_CAPABILITIES` + `can(role, cap)`; cards on phones). Forms: `person-form.ts` (type internal/vendor/client,
   role, team grouped by division, reports-to, products it works on), `org-forms.ts` (DivisionForm, TeamForm, VendorForm).
   Store: divisions/teams/vendors/activeUsers signals, `createUser/updateUser` (unique email, vendor/client company
   required, no reporting loops, client users forced to production_user and no team), `setUserActive`, `deleteUser`
   (only without tickets / time / comments / led products), `setUserProducts`, `reportsOf` (direct + indirect),
   `userDivision`, `divisionMembers`, `userProducts`, team and division CRUD (division delete refused while it has
   teams or products; vendor delete refused while it has staff), `addTeamMembers` (sets manager if none).
   Product form has Division + Members; ticket assignee list = active staff only (no production / client users);
   deleting a client deactivates its users; Clients list shows the client's user count. Sidebar shows the role label.
   Seed: 12 people (admin Alex u1, division heads Priya u2 / Ravi u5, AMs Meera u6 / Tom u7, BA Lena u8, TL Sam u3, dev
   Jordan u4, tester Chris u9, vendor dev Vikram u10 (Nimbus Dev Labs v1), client user Dana u11 (Acme), internal
   production user Neha u12); divisions d1 Digital Products (teams t1 Web & Mobile, t2 Quality Assurance), d2 Enterprise
   Solutions (t3 Analytics). Defaults agreed with the user: one team per person, one head per division, one AM per team,
   vendors see only assigned products, production users see their own / their client's tickets, L1–L3 replace SLA tiers.

12. Roles & access (UI-only until Phase B). **Store scoping:** `store.access()` computes the signed-in person's
   productIds / userIds (admin = all; division head = products of divisions they head + their products, people of the
   division + reports; assistant manager = own products (lead/member) + people in teams they manage + reports; others =
   own products; client production users = products their client uses). The public lists `products / issues / sprints /
   roadmaps / users / activeUsers / clients / workLogs` are **scoped**, so every page filters automatically;
   `allUsers` / `allClients` / `userById` / `this.state()` ignore scope (store internals never use the scoped lists).
   Production users see only tickets they reported or their client's; developers / testers / production users see only
   their own time. Checks: `canDo(cap, productId?)`, `canEditIssue` (staff only), `canDeleteIssue` (products cap),
   `canRemoveProduct` (admin / head of the product's division), `issueKeyExists`, `switchUser`. Capabilities in
   `core/roles.ts` now include `time` and `summary` (CXO). **Menu + routes:** each `NAV_ITEMS` entry has `access`
   (capability / 'staff' / 'all'); shell hides items and empty sections; `core/access-guard.ts` guards every menu route
   and redirects to `homeFor(role)` (production users → `/my-requests`, others → `/products`); '' redirects there too.
   **Switcher:** click the person block at the bottom of the sidebar → "Sign in as" popover grouped by role (active
   people only) → lands on that role's home. **Gated UI:** create / edit / archive / delete product, ticket menu edit /
   delete, ticket page (edit, delete, timer, status select, child tickets, Log hours tab; "You don't have access" for
   hidden tickets; breadcrumb goes to My Requests for production users), backlog (roadmap and sprint buttons, drag
   disabled without the sprints capability), time page person list. **My Requests** `/my-requests`
   (`pages/requests/`): stage counts (Received / In progress / On hold / Done by status category), Open / Done / All,
   "Everything raised for <client>" (on by default for client users), list → ticket page; `request-form.ts` raises
   request / bug / support tickets (reporter = me, client = my client; custom fields are not asked).

13. Support desk `/support` (`pages/support/`): **client SLA tiers were removed** (Client has no slaTier; Clients page,
   client form, product form, Reports and CXO no longer show tiers; CXO highlight now lists breached support tickets).
   Model: `Issue.supportLevel` ('l1'|'l2'|'l3') + `Issue.firstResponseAt`, `SlaPolicy.level`, `DataState.supportLevels`
   (name, description, teamId per level). `core/sla.ts`: `SUPPORT_LEVELS`, `slaClock(start, target, stoppedAt, now)`
   (running / at_risk ≤25% left / breached / met), `clockLabel`, `formatDuration`, colours. Store: `slaOf(issue, now)`
   (calendar time from createdAt with the CURRENT level's targets; response stops at firstResponseAt or resolution;
   resolution stops when status category is done → endAt), `isResolved`, `escalate(id, reason)` (next level, clears
   assignee, comment + 'escalated' activity), `supportLevel(level)`, `updateSupportLevel`, `slaFor/setSlaPolicy(level,…)`.
   Auto level: `createIssue` puts support / request tickets and anything a production user raises on L1 (`supportLevel:
   null` forces none). firstResponseAt is stamped by a staff comment (not reporter, not production user) or a status move
   out of "todo". Page tabs: Queues (KPI tiles, level tabs with counts, product / Mine / Breached-or-at-risk / Show resolved
   / search, table on md+ and cards on phones, Take + Escalate dialog; clocks tick every 30 s), SLA report (last 30 days by
   level / product / client: met %, avg times, breached now), Levels & targets (admins: level name / handles / team, 15
   targets editor with reset — moved from the old Clients SLA tab, `sla-settings.ts`). Ticket page shows a Support SLA card
   (both clocks + Escalate); ticket form has a Support level select (support / request default to L1). Clients list has a
   Support column (open support tickets, breached). Seed: Service Desk team t4 with Ana Costa u13 (tester, support engineer,
   member of all products); demo support tickets ANL-1 (L1, breached), ANL-2 (L2), WEB-4 (L1, replied), MOB-3 (L1, at risk),
   WEB-5 (L2, resolved in time). Not done: pausing clocks on hold, business hours, notifications.

14. Gantt & Roadmap `/gantt` (`pages/gantt/`). `core/timeline.ts`: zooms (2 weeks / 6 weeks / quarter / 6 months = fixed day
   counts stretched to the width, so **no horizontal scrolling**), `rangeAround` (Monday start), `shiftRange`, `barFor` (% left /
   width + clip flags), `pointFor`, `ticksFor`, `weekendsFor`, `packLanes`, `shiftIso`. **Product Gantt** tab: rows roadmap →
   its sprints → their tickets, then "Sprints without a roadmap" and "Backlog tickets with dates"; collapsible groups; bars
   with % done fill (roadmap = `roadmapProgress`, sprint = points, ticket = progress); a ticket without its own dates uses its
   sprint's (dashed, faint); ticket span = startDate ?? startAt ?? createdAt → dueDate ?? endAt. **Drag** a bar to move it, its
   edges to resize (pointer events on window, snapped to days; arrow keys move by a day, Shift+arrows the end); saves via
   `store.reschedule(kind, id, start, end)` which checks roles (roadmaps / sprints capability, `canEditIssue`), refuses end <
   start and completed sprints. Off-window items show a "‹ date" / "date ›" chip that jumps to them; header labels thin out by
   width (ResizeObserver). **All roadmaps** tab: one row per visible product, roadmaps packed into lanes, status colour, % done,
   "Late" badge, click → that product's Gantt. Query params `?tab=roadmap`, `?product=<id>`. Not done: dependencies between
   tickets, critical path, baselines.

15. External systems (Step 15). **Adapters** in `core/external.ts`: `ProductivitySource` (days → active / productive / idle
   minutes per employee per day) and `AttendanceSource` (days with status present / missed_punch / absent / leave / half_day /
   weekend, punch in/out, late flag; leave requests sick/casual with half day; regularisation requests; balances; applyLeave,
   requestRegularisation, decide, cancel). People are matched by **employee id = work email** unless an admin sets a code.
   `core/external-sample.ts`: deterministic generator (seeded by employee+date), requests stored in localStorage
   `npro-ext-sample` (seeded once: Jordan sick last week + pending correction, Chris casual today, Vikram pending leave next
   week, Lena half day, Ana approved correction); productivity follows attendance; `BackendProxySource` throws "needs the
   nPro backend (Step 18)". `core/external-store.ts` (`ExternalStore`, config in localStorage `npro-integrations`: mode per
   connector, endpoint, last sync / error, employeeCodes, lateAfter, dayMinutes) loads both systems for all tracked staff
   (active, not client / production users) and pages show `visibleUsers` (developers / testers: only themselves; others: their
   scope). `canApprove` = admin, or the person reports to me (never yourself). `clock` is a test hook.
   **Attendance & Hours** `/attendance` (Work menu, all staff; `?tab=productivity|requests`): week grid (punches, late in amber,
   short days amber, missed punch → "fix" for yourself, leave, pending leave / correction, corrected ✓, week total), day tiles,
   phones = day chips + list; Productivity tab (stacked bar productive / other active / idle with attended + logged-in-nPro
   markers, flags "Logged > productive" / "Under-logged"); Leave & corrections (balances, To approve / Mine / Everyone,
   approve / reject / withdraw). Dialogs in `request-dialogs.ts` (LeaveForm, CorrectionForm). **Integrations** `/integrations`
   (admin): connector cards (Sample data / Company system via backend, endpoint, sync status), employee ids, attendance rules
   (late after, full day hours), reset sample data. Dashboards (Step 16) should read `ExternalStore`.

16. Dashboard `/dashboard` (`pages/dashboard/`) — now the **home page for all staff** (`homeFor`; production users still
   land on My Requests). Header greets the person; **My day / My team** toggle (team view only when the person can see other
   tracked people; default team for admin / division head / assistant manager). **My day:** tiles (my open, overdue, due in 7
   days, logged this week with 40h bar, attended, productive), My tickets (assigned, not done; overdue first, then due date,
   then priority; → `/tickets?assignee=me`), My hours this week (vertical grouped bar chart attended / productive / logged per
   day; weekends only with data; "logged less than productive" nudge), My support tickets (SLA state), Today (punch in /
   working so far / leave; missed punches → Correct my hours dialog), My leave (balances, pending + upcoming, Apply → LeaveForm).
   **My team:** tiles (people, in today, on leave, not in yet, SLA breached, waiting for approval), Hours this week per person
   (three thin bars), Workload (open tickets per person stacked by status category via `app-bar-chart` horizontal, overdue
   names, unassigned link), Active sprints (points done vs time elapsed marker, "behind" when work% + 15 < time%), Today (on
   leave / not in yet / late, coming up 2 weeks), Support SLA (breached / at risk). On phones the Today card comes first.
   **Global search** (`layout/global-search.ts` + `core/search.ts` `searchAll` / `matchScore`): top bar combobox, "/" or
   Ctrl+K focuses, ↑ ↓ Enter Esc; groups Tickets (key match ×2, open first) / Products / People / Clients / Go to (menu pages
   the role may open); production users only get their tickets + pages. Results link to the ticket, or `/tickets` with
   `?product= / ?assignee= / ?client=`; footer "All tickets matching" → `/tickets?q=`. Tickets page now also takes
   `?assignee=` and `?q=` query params.

17. Automation `/automation` (`pages/automation/`, menu access = `products` capability: admin, division heads, assistant
   managers). **Model** (`core/models.ts`): `AutomationRule` { productId? (none = all products, admins only), name, enabled,
   trigger {type, value?}, conditions [{field, op is/is_not, value ('' = empty)}], actions [{type, value}], runCount, lastRunAt,
   rrIndex, firedFor } and `DataState.automationLog` (`AutomationRun`, newest first, capped at 300). Triggers: issue_created,
   status_changed (optional target status), assignee_changed, priority_changed, comment_added (people only), and **timed**
   sla_at_risk / sla_breached / due_passed (`store.runTimedRules(now)`, called by the shell on start and every minute, once
   per ticket per rule via `firedFor`; edits that change the trigger reset it). Conditions: type, priority, status, status
   group, support level, client, assignee, label, raised by (staff / production). Actions: set status (**respects
   `canTransition`**; a blocked move is "Skipped: … isn't allowed by the workflow" and the run is "partial"), assign, assign in
   turn within a team (prefers team members on the product, alphabetical, `rrIndex`), unassign, set priority, add label, add
   comment, escalate. **Engine** (in `DataStore`): `createIssue` / `updateIssue` / `addComment` call `fireRules`; `runRule`
   checks conditions, runs actions as the **Automation** actor (`AUTOMATION_ID`; `userById` returns `AUTOMATION_USER`, so
   history and comments show "Automation"; its comments don't stop SLA response clocks), logs a "ran rule" activity first,
   then a run entry. Loop guard: `ruleChain` (a rule never re-runs within its own chain) and `MAX_CHAIN` = 5. Rights:
   `canManageRule(productId)` (admin any; others need the products capability on that product); `store.automations` /
   `automationLog` are scoped. `withDefaults()` in `load()` adds `automationLog` and, once, the 4 demo rules
   (`ruleTemplates` in `core/automation.ts`; only "Escalate breached L1 support tickets" is on). **Page:** tiles (rules, on,
   runs 24 h, runs with skipped actions), Rules (cards: on/off switch, WHEN / IF / THEN, product, runs → log, edit /
   duplicate / delete), templates, Run log (filter by rule, clear for admins). `rule-form.ts`: name, applies to, WHEN
   (status target), IF rows, THEN rows (value pickers per field / action from `rule-meta.ts`), "Reads as" sentence,
   enabled. Not done: scheduled (cron) triggers, notifications/e-mail actions, conditions with OR.

Tests: 74 passing (`src/app/app.spec.ts`).

## Roadmap re-planned on 2026-11-26 (user's new requirements)
The user plans to use nPro for internal teams, vendor teams and clients. The old Steps 11–14 were replaced by the list below;
see ROADMAP.md for the full table. The menu placeholders in `layout/nav.ts` already match these numbers. The old
"Customer portal" item was dropped: production users get "My requests" in Step 12.

- **11 Organisation setup** ✅ (see Done above)
- **12 Roles & access** ✅ (see Done above): a "signed in as" switcher, scoped visibility (division head = own division; assistant manager =
  own products + people reporting to them), a permission matrix (create roadmap / sprint / ticket / report), and a
  production-user "My requests" view. This is UI-only until Phase B checks roles on the server.
- **13 Support desk L1/L2/L3 + SLA** ✅ (see Done above): support level on tickets, a team per level, SLA targets per level ×
  priority, clocks, breach flags, escalation, queues. The existing tier-based `SlaPolicy` needs reconciling with levels.
- **14 Gantt & roadmap** ✅ (see Done above)
- **15 External systems** ✅ (see Done above): productivity hours from the laptop tracker and attendance (punch in/out,
  sick/casual leave, regularisation) behind an adapter; sample data in Phase A.
- **16 Developer & manager dashboards + global search** ✅ (see Done above)
- **17 Automation rules** ✅ (see Done above)
- **18 Backend (Phase B)** ← NEXT

Step 18 notes (Phase B backend) — **stack decided by the user on 2026-11-26: .NET 10 (LTS, supported to Nov 2028) C# backend, MS SQL database, hosted
on AWS Windows servers under IIS.** Plan (each part verified end to end before the next):
- **18a Foundation ✅ (done 2026-11-26, see `server/README.md`):** `server/` solution — `Npro.Api` (ASP.NET Core Web API), `Npro.Domain` (entities + rules ported from
  `core/roles.ts`, `sla.ts`, `automation.ts`), `Npro.Infrastructure` (EF Core SQL Server, migrations, seed = today's demo
  data), `Npro.Tests` (xUnit). Auth with ASP.NET Core Identity (cookie, same origin), roles + access scope enforced in queries
  (mirror `store.access()` / `canDo` / `canManageRule`). IIS: in-process hosting, `web.config`, Angular build served from
  the same site (no CORS). Connection strings / keys from AWS Secrets Manager or Parameter Store, never in the repo.
- **18b Core data ✅ (done 2026-11-26):** organisation, products, clients, workflows, tickets, comments, history via REST; Angular `DataStore`
  switches from localStorage to HttpClient behind the same method names (signals updated from responses).
- **18c Work features ✅ (done 2026-11-26, rules part):** sprints, roadmaps, time logs / timers, support SLA, reports / CXO queries, automation engine
  server-side; timed rules in a hosted background service (IIS app pool must be AlwaysRunning + preload enabled, or the
  job moves to a Windows service).
- **18d Files, integrations, deploy:** attachments to S3 (AWSSDK.S3), productivity / attendance proxy (`BackendProxySource`
  on the client), publish profile + IIS deployment steps, health check.
18a as built: `server/Npro.sln` with `global.json` pinning SDK 10.0.404 (SDK 11 is also installed), packages pinned to 10.0.15,
local tool `dotnet-ef` (`server/dotnet-tools.json`). Entities use string ids and the same lower_snake string values as the
frontend (no C# enums); JSON = camelCase with nulls omitted. `NproDbContext : IdentityDbContext<IdentityUser>` — the nPro
person table is `People` (DbSet `People`, because Identity owns `Users`); Identity user Id == person id. JSON columns:
workflow statuses, automation trigger / conditions / actions (owned `ToJson`), `Transitions` and `CustomFields` (value
converter + comparer), string lists (EF primitive collections). No FK constraints yet (ids are indexed; add FKs when
writes arrive in 18b). Migration `Initial`; on start `DbInitializer` migrates (SQL Server) or `EnsureCreated` (SQLite in
tests) and seeds `DemoData` (port of `seed.ts`, relative dates) + an Identity account per person when
`Seed:DemoPassword` is set (Development config only). Endpoints in `Endpoints.cs`: health, auth login / logout / me /
switch (demo switcher behind `Features:DemoSwitcher`), organisation, products, issues list + by key (403 when hidden);
`RequestAccess` computes `AccessScope.For(me, org)` once per request; `RequirePerson` filter → 401. Cookie `npro.auth`
HttpOnly + SameSite=Strict; API returns 401/403 instead of redirects. Unknown `/api/*` → 404; everything else falls back
to `wwwroot/index.html` (Angular). Dev run: `.claude/launch.json` config **npro-api** (port 5144), DB `Npro` on
`.\SQLEXPRESS` (Windows auth, created and seeded). Tests: `dotnet test server` — 9 passing (API on in-memory SQLite via
`ApiFactory`, domain rules). SQLite can't ORDER BY DateTimeOffset, so list endpoints sort after loading.
18b as built — **change-sync design** (keeps every screen and store method unchanged):
- **Start-up** (`core/session.ts`, `provideAppInitializer`): `GET /api/auth/me` → 200: `GET /api/state` → `store.hydrate()`,
  mode `remote`; 401 → mode `signed_out` → `/login` (`pages/login/login-page.ts`, routes guarded by `signedIn` /
  `signedOut`); no backend (network error, 404, HTML, dev-proxy 502-504; `isNoBackend` in `core/api.ts`) → mode `local` =
  the old localStorage demo (unit tests and `ng serve` without the API stay on it). `core/api.ts` = fetch wrapper
  (same-origin cookie, `X-XSRF-TOKEN` from the `XSRF-TOKEN` cookie, ApiError with the server's problem detail).
- **DataStore remote mode:** `remote` signal; the save effect calls `queueSync` instead of writing localStorage;
  `diffState(prev, next)` (`core/state-diff.ts`) finds changed records by **object identity** (the store updates
  immutably) per collection (key `id`, timers `userId`, supportLevels `level`, summaryNotes entries) → upserts first, deletes
  last in reverse order; batches are sent in order (`syncChain`) to `POST /api/sync`; on any error `syncError` is set (red
  banner in the shell) and `reloadFromServer()` restores the server's version. `flushSync()` before sign-out / switch.
  Rules don't fire in production users' sessions in remote mode, and timed rules run only in an admin's session.
- **Server** (`server/src/Npro.Api/Sync.cs`): `GET /api/state` = DataState-shaped snapshot (directory data for staff;
  production users get a reduced directory: themselves + people on their tickets, own client, visible products; work data
  always scoped: tickets via `AccessScope.CanSee`, comments / attachments / activities of visible tickets, work logs by scope
  / own time, own timer, sprints / roadmaps of visible products, rules + run log, summary notes only with the summary
  capability). `POST /api/sync` `{ changes: [{ collection, op: upsert|delete, id, data }] }`: per collection authorisation
  mirroring the UI (organisation setup = admin; products: create = products cap, edit = products cap on it, a ticket creator
  may bump only `issueCounter`, delete = admin / division head; issues: create = tickets cap on the product, production users
  must be the reporter, edit = staff with tickets cap on old + new product, anyone who sees it may change only
  updatedAt / firstResponseAt, delete = products cap; comments / attachments / activities as yourself (or `automation`) on
  visible tickets; work logs own or managed people; timers own; roadmaps / sprints by capability; rules `canManageRule` but
  run counters by any staff; run log insert by staff, clear by admin). One transaction through the SQL Server execution
  strategy; any refusal → 403 and nothing saved; DB conflicts (e.g. duplicate ticket key) → 409. People inserts create an
  Identity account without a password; `POST /api/people/{id}/password` (admins) sets one (no UI yet).
- **XSRF** (`XsrfMiddleware.cs`): every GET under /api refreshes a readable `XSRF-TOKEN` cookie bound to the signed-in
  identity; every write must send `X-XSRF-TOKEN` or gets 400. Antiforgery cookie `npro.af`, auth cookie `npro.auth`.
- **Dev:** `proxy.conf.json` (+ `angular.json` serve.options.proxyConfig) sends /api to http://localhost:5144; run
  **npro-api** and **npro-dev** from `.claude/launch.json`. Verified end to end: login (wrong / right password), dashboard
  from SQL Server, a comment saved and still there after reload (not in localStorage), switcher to a client user, sign out,
  API stopped → local demo.
- **Tests:** server 15 (`SyncTests`: snapshot shape + scope, developer creates a ticket but can't rename a product, batch
  rollback, client users comment but can't edit / impersonate / see hidden tickets, XSRF required, admin adds a person and
  sets a password); Angular 75 (diffState test).
- **Still in the browser until 18c:** ticket numbering (server only enforces the unique key), automation engine and timed
  rules, SLA / activity bookkeeping. Attachments: metadata syncs, file bytes still only in the uploader's IndexedDB (18d).
  Attendance / productivity still on sample data (18d). The snapshot loads everything visible (add paging if data grows).
**After 18b (2026-11-26, user request):** login page redesigned (`pages/login/login-page.ts`: split card — brand panel with
features on md+, compact logo on phones; "Email or employee ID" field whose icon switches mail / id-card; password show / hide
and Caps Lock hint; spinner; help text). **Employee ID** for in-house people: `User.employeeId` (frontend) and
`Npro.Domain.User.EmployeeId` (nvarchar(20), unique filtered index, migration `EmployeeId`, which also backfills the demo
people EMP-001 …); required and unique for kind = internal, stored upper-case, cleared for vendor / client people (store
`cleanUser` + server sync check); the person form shows it instead of Phone (phone is no longer asked; old values stay in the
data); the People list shows it and its search + global search match it; demo seed u1 → EMP-001 … u13 → EMP-013 (vendor /
client users have none; `withDefaults` backfills old local data). **Sign-in accepts email or employee ID**
(`POST /api/auth/login { login, password }`, `email` still accepted; employee IDs only match internal people, any letter case;
error "Wrong email, employee ID or password"). Attendance / productivity still match people by email (sample data keys) —
switch `ExternalStore.employeeId` to the HR employee ID when the real systems are wired (18d). Tests: server 15, Angular 76.
**18c as built (2026-11-26):**
- **Ticket numbers on the server:** a ticket insert in `POST /api/sync` gets its key from `NextKeyAsync` (EF `ExecuteUpdate`
  IssueCounter + 1 → row lock until commit, so concurrent creators get different keys); if it differs from the browser's guess
  the issue (and the "created ticket" activity's `to`) is rewritten and returned. The product's `issueCounter` is server-owned:
  incoming values are ignored.
- **Automation on the server:** `Npro.Infrastructure/Rules/RuleEngine.cs` (port of the DataStore engine: same triggers,
  conditions, actions, round-robin, escalate, workflow-checked set-status with "Skipped: …" in the run log, `automation` actor,
  loop guard chain + max 5, run log capped at 300) and `Rules/Sla.cs` (port of sla.ts clocks). The sync batch records events
  (issue_created, status / assignee / priority changed, comment_added by people) and fires them after saving, in the same
  transaction. **Timed rules:** `TimedRulesService` (BackgroundService, every minute; `Automation:TimedRules` = false turns it off;
  tests call `TimedRulesService.RunOnceAsync`). IIS: app pool Start mode = AlwaysRunning + site Preload enabled.
- **Changes back to the browser:** `ChangeCollector` gathers everything the server changed; `POST /api/sync` now answers
  `{ saved, version, changes: [{ collection, op, id, data }] }`; the store merges them with `applyChanges` (`core/state-diff.ts`)
  into both the shown state and the sync baseline (so they're not sent back).
- **Live updates:** `ChangeFeed` (singleton version, starts at the clock; bumped by every sync and timed run);
  `GET /api/state/version`; `/api/state` includes `version`; the store polls every 30 s (tab visible, nothing pending) and
  reloads when it moved. (One IIS worker; a web farm would keep the version in the DB / a cache.)
- **Browser engine off in server mode:** `fireRules` / `runTimedRules` return early when `remote()`; the shell's timer runs
  rules only in the offline demo.
- **Dates:** API JSON writes timestamps as UTC `…Z` (`UtcDateConverter`) like `toISOString()`, because the app sorts some lists
  by comparing these strings.
- **Set password UI:** Organisation › People row menu › "Set password" (admins, server mode) → `password-form.ts` (10+ chars,
  upper, lower, digit; repeat) → `POST /api/people/{id}/password`; adding a person in server mode reminds you to set one.
- Verified end to end on SQL Express: signed in as EMP-001, switched on the round-robin rule, raised a support ticket → the server
  numbered it (WEB-6) and assigned it to Ana Costa; history showed "Automation ran rule … / updated assignee"; then deleted the test
  ticket and switched the rule off again. Tests: server 20 (ServerRulesTests: key race + activity rename, round-robin on the server,
  workflow-blocked set-status logged as partial, timed escalation once per ticket, version moves); Angular 79. a11y scan clean.
- **Still in the browser:** history entries for people's own edits (validated on the server: must be recorded as yourself),
  firstResponseAt / work-date stamping on people's edits, reports / CXO calculations (from the synced data).
**Next (18d):** attachments to S3 (bytes still only in the uploader's IndexedDB), the productivity / attendance proxy with
real API keys on the server, IIS publish profile + deployment steps + health check.
