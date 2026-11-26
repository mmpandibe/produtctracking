# API Specification Document

| | |
|---|---|
| Document ID | NPRO-API-001 |
| Version | 1.0 (draft) · 27 Nov 2026 · API as of Step 18c |
| Base URL | Same origin as the app: `https://<host>/api` (dev: `http://localhost:5144/api`, or via the `ng serve` proxy) |
| Format | JSON (camelCase), UTC timestamps `yyyy-MM-ddTHH:mm:ss.fffZ`, null fields omitted |

## 1. Conventions

- **Authentication**: cookie `npro.auth` (HttpOnly, SameSite=Strict, Secure on HTTPS, 8 h sliding) set by `POST /auth/login`.
- **XSRF**: every `GET /api/*` sets a readable `XSRF-TOKEN` cookie; every POST / PUT / PATCH / DELETE must send it in the
  `X-XSRF-TOKEN` header or receives **400**.
- **Errors**: RFC 7807 problem details: `{ "type", "title", "status", "detail" }`.

| Status | Meaning |
|---|---|
| 200 / 204 | OK / no content |
| 400 | Missing XSRF token or invalid input |
| 401 | Not signed in, or wrong credentials |
| 403 | Signed in but not allowed (detail explains) |
| 404 | Unknown resource / unknown `/api` path |
| 409 | Conflict (concurrent change) — reload and retry |
| 423 | Account temporarily locked (5 failed sign-ins → 5 min) |

## 2. Endpoints

### Health
`GET /health` (anonymous) → `{ "status": "ok", "database": "up" | "down" }`

### Authentication
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/login` | `{ "login": "EMP-004" or "jordan@example.com", "password": "…" }` (`email` also accepted) | 200 `{ "id": "u4" }`; 401 "Wrong email, employee ID or password"; 423 locked |
| POST | `/auth/logout` | — | 204 |
| GET | `/auth/me` | — | `{ user, capabilities: string[], scope: { all, productIds, userIds, ownTicketsOnly, ownTimeOnly }, features: { demoSwitcher } }` |
| POST | `/auth/switch/{userId}` | — | 200 (only when `Features:DemoSwitcher` = true; never in production), else 404 |

After login or switch, call `GET /auth/me` once to receive an XSRF token bound to the new identity.

### Read endpoints (signed in)
| Method | Path | Description |
|---|---|---|
| GET | `/organisation` | `{ divisions, teams, vendors, users, clients }` in scope |
| GET | `/products` | Products in scope |
| GET | `/issues?productId=&q=` | Tickets in scope, newest first |
| GET | `/issues/{key}` | One ticket; 404 unknown, 403 not visible |
| GET | `/state` | Full `DataState` in scope + `version` (see §3) |
| GET | `/state/version` | `{ "version": 1764232… }` — moves on every save or timed-rule run |

### Writes
**`POST /sync`**
```json
{ "changes": [
  { "collection": "issues", "op": "upsert", "id": "9b2…", "data": { "id": "9b2…", "key": "WEB-7", "productId": "p1", … } },
  { "collection": "comments", "op": "delete", "id": "c12" }
] }
```
Collections: `users, divisions, teams, vendors, clients, workflows, customFields, slaPolicies, supportLevels` (key `level`),
`products, sprints, roadmaps, issues, comments, attachments, workLogs, timers` (key `userId`), `activities, automations,
automationLog, summaryNotes` (key `key`, data `{key, text}`).

Rules: each change authorised for the signed-in person (Access Control Matrix); batch is all-or-nothing. New tickets get their key
from the server; product `issueCounter` is server-owned; automation runs after saving.

Response 200:
```json
{ "saved": 3, "version": 1764232000123,
  "changes": [ { "collection": "issues", "op": "upsert", "id": "9b2…", "data": { "key": "WEB-8", "assigneeId": "u13", … } },
               { "collection": "automationLog", "op": "upsert", "id": "…", "data": { "ruleName": "…", "outcome": "done" } } ] }
```
403 with `detail` naming the refused change; 409 on conflict.

**`POST /people/{id}/password`** (admins) — `{ "password": "…" }` → 204; 400 with Identity's rule messages (≥ 10 chars, upper,
lower, digit); 403 non-admin; 404 unknown person. Clears any lockout.

## 3. `DataState` shape (from `/state`)
`currentUserId, users, divisions, teams, vendors, products, clients, workflows, issues, workLogs, timers, comments, attachments,
activities, roadmaps, sprints, customFields, automations, automationLog, slaPolicies, supportLevels, summaryNotes, version`.
Field definitions: `src/app/core/models.ts` (identical on the server: `Npro.Domain/Entities.cs`).

## 4. Versioning
Unversioned while the only client is the bundled SPA (deployed together). If third parties integrate, introduce `/api/v1`.
