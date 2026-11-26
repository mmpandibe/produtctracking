# Low-Level Design (LLD)

| | |
|---|---|
| Document ID | NPRO-LLD-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Related | HLD · Technical Design Specifications NPRO-TDS-001 · API Specification NPRO-API-001 |

## 1. Frontend (`src/app`)

| Folder / file | Contents |
|---|---|
| `core/models.ts` | Domain types (User, Division, Team, Vendor, Client, Workflow, Product, Issue, WorkLog, Comment, Attachment, Activity, Roadmap, Sprint, CustomFieldDef, AutomationRule, AutomationRun, SlaPolicy, SupportLevelConfig, DataState) |
| `core/data-store.ts` | `DataStore` (root service, Angular signals). Holds `DataState`; computed scoped lists (`products`, `issues`, `users`, …) filtered by `access()`; all mutating methods (createIssue, updateIssue, moveIssue, escalate, createRule, …); local automation engine (offline demo only); remote mode (`hydrate`, `queueSync`, `applyServerChanges`, polling) |
| `core/state-diff.ts` | `diffState(prev, next)` → changed records by object identity; `applyChanges(state, changes)` → merge server changes |
| `core/api.ts` | `api()` fetch wrapper: same-origin cookie, `X-XSRF-TOKEN` header, `ApiError` |
| `core/session.ts` | Start-up mode (local / signed_out / remote), login, logout, switch |
| `core/roles.ts` | Roles, capabilities, `can()` |
| `core/sla.ts`, `core/timeline.ts`, `core/reports.ts` | SLA clocks; Gantt date maths; report calculations |
| `core/automation.ts` | Rule metadata, condition matching, templates |
| `core/external*.ts` | Attendance / productivity adapter interfaces, sample adapters, `ExternalStore` |
| `core/search.ts` | Global search scoring |
| `layout/` | Shell (sidebar, top bar, skip link), nav items + access, global search |
| `pages/*` | One folder per screen (products, tickets, board, backlog, time, clients, reports, cxo, workflows, organisation, requests, support, gantt, attendance, integrations, dashboard, automation, login) |
| `shared/` | Icon, Avatar, Modal (focus trap), PageHeader, charts, ReadablePipe (contrast), MoveMenu (drag alternative) |

### 1.1 Access scope (client copy; server copy identical)
`access()` returns `{all, productIds, userIds, ownTicketsOnly, ownTimeOnly}`:
admin → all; division head → products of headed divisions + own, people of those divisions + reports; assistant manager → own
products, people in managed teams + reports; client production user → products of their client; staff also see everyone on
their visible products. Production users: own / client tickets only. Developers, testers, production users: own time only.

### 1.2 Sync algorithm
1. Store updates are immutable → unchanged records keep the same object.
2. Effect on `state` → `diffState(synced, current)` → upserts (parents first: organisation, products, sprints, roadmaps, issues,
   comments, …) then deletes (reverse order).
3. Batches are queued and sent in order; on success merge `changes`, keep `version`; on error set `syncError`, reload snapshot.

## 2. Backend (`server/`)

| Project | Key types |
|---|---|
| `Npro.Domain` | Entities (same fields as `models.ts`), `Roles`, `UserKinds`, `Capabilities`, `AccessScope.For(me, org)`, `Workflow.CanTransition` |
| `Npro.Infrastructure` | `NproDbContext : IdentityDbContext<IdentityUser>`; `DemoData`; `DbInitializer`; `Rules/RuleEngine`, `Rules/Sla`, `Rules/ChangeCollector`; migrations |
| `Npro.Api` | `Program.cs` (services, middleware), `Endpoints.cs` (health, auth, read), `Sync.cs` (state, sync, version, password), `Access.cs` (`RequestAccess`, `RequirePerson`), `XsrfMiddleware`, `ChangeFeed` + `TimedRulesService`, `UtcDateConverter` |

### 2.1 `POST /api/sync` processing
```
begin transaction (through the SQL execution strategy)
for each change in order:
  load stored record (FindAsync) → old copy
  deserialize incoming → next (key must equal change.id)
  authorise(old, next) per collection (see Access Control Matrix)
    issues insert: NextKeyAsync (UPDATE counter+1; row lock) → rename if guessed key differs; event issue_created
    issues update: key kept; events status / assignee / priority changed
    products: issueCounter kept from store
    comments by people: event comment_added
  add / copy values / remove; SaveChanges
run RuleEngine.FireAsync for each event (same transaction)
SaveChanges; commit; ChangeFeed.Bump()
return { saved, version, changes }
any refusal → rollback, 403; DbUpdateException → rollback, 409
```

### 2.2 Rule engine
`FireAsync(trigger, issueId, value)` → enabled rules matching trigger, product, not in current chain (max depth 5) →
`RunRuleAsync`: check conditions → "ran rule" activity → apply actions (set status checks `CanTransition`; assign; round-robin by
team with `RrIndex`; unassign; priority; label; comment as `automation`; escalate L1→L2→L3) → run log (cap 300) and counters.
`UpdateIssueAsync` mirrors the client's bookkeeping (start / end dates, first response, history) and fires chained triggers.
`RunTimedAsync` checks `sla_breached` / `sla_at_risk` / `due_passed` once per ticket (`FiredFor`).

## 3. Error handling
API: RFC 7807 problem details (`title`, `detail`, `status`); 401 unauthenticated, 403 refused, 404 unknown, 409 conflict, 423 locked
out, 400 XSRF / validation. UI: inline form errors (`role="alert"`), toasts (`role="status"`), sync banner.
