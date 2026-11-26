# Access Control Matrix

| | |
|---|---|
| Document ID | NPRO-ACM-001 |
| Version | 1.0 · 27 Nov 2026 |
| Source of truth | `src/app/core/roles.ts` (UI) · `server/src/Npro.Domain/Roles.cs`, `AccessScope.cs`, `server/src/Npro.Api/Sync.cs` (server, enforced) |

## 1. Capabilities by role

| Capability | Admin | Division head | Asst. manager | Business analyst | Tech lead | Developer | Tester | Production user |
|---|---|---|---|---|---|---|---|---|
| Organisation setup (people, teams, clients, workflows, SLA, integrations) | ✅ | — | — | — | — | — | — | — |
| Manage products | ✅ | ✅ own scope | ✅ own scope | — | — | — | — | — |
| Roadmaps | ✅ | ✅ | ✅ | ✅ | — | — | — | — |
| Sprints | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Create / edit tickets | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | raise only (own) |
| Time tracking | ✅ all | ✅ scope | ✅ scope | ✅ scope | ✅ scope | own | own | — |
| Reports | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| CXO summary | ✅ | ✅ | ✅ | — | — | — | — | — |
| Automation rules | ✅ all | ✅ own products | ✅ own products | — | — | — | — | — |
| Approve leave / corrections | ✅ anyone | reports | reports | reports | reports | reports | reports | — |
| Set passwords | ✅ | — | — | — | — | — | — | — |

## 2. Data scope (what each role sees)
Admin: everything. Division head: products of divisions they head + products they lead / are member of; people of those divisions
and their reports. Assistant manager: products they lead / are member of; people in teams they manage and their reports. Others:
products they lead / are member of. Staff also see everyone working on their visible products. Production users: products of their
client; only tickets they reported or their client's; a reduced directory (themselves and people on their tickets).

## 3. Server write rules (`POST /api/sync`)

| Collection | Insert | Update | Delete |
|---|---|---|---|
| users, divisions, teams, vendors, clients, workflows, customFields, slaPolicies, supportLevels | Admin | Admin | Admin (not yourself) |
| products | products capability | products capability on it (ticket creators may only bump the counter, which the server ignores) | Admin or head of the product's division |
| issues | tickets capability on the product; production users must be the reporter; server assigns the key | staff with tickets capability on old + new product; anyone who sees it may change only `updatedAt` / `firstResponseAt` | products capability on the product |
| comments | can see the ticket; author = yourself (or `automation` by the server) | author or admin | author or admin |
| attachments | can see the ticket; uploader = yourself | uploader or ticket editor | uploader or ticket editor |
| activities | as yourself on visible tickets / products | never | products capability |
| workLogs | own, or people you manage (time capability, not own-time-only) | same | same |
| timers | own | own | own |
| roadmaps / sprints | roadmaps / sprints capability on the product | same | same |
| automations | admin, or products capability on the rule's product | same; run counters by any staff | same |
| automationLog | staff | — | admin (clear) |
| summaryNotes | summary capability | same | same |

## 4. Review
Quarterly access review of admins and role assignments; this matrix is updated with every change to the rules above.
