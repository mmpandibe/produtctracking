# Technical Design Specifications

| | |
|---|---|
| Document ID | NPRO-TDS-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Related | LLD NPRO-LLD-001 (structure); this document details selected algorithms |

## TDS-1 Ticket numbering (server)
- Key format `<PRODUCT KEY>-<n>`; `Products.IssueCounter` holds the next `n`.
- On a ticket insert inside `/api/sync`: `UPDATE Products SET IssueCounter = IssueCounter + 1 WHERE Id = @p` (EF
  `ExecuteUpdateAsync`), then read the counter; key = `Key-(counter-1)`. The UPDATE takes a row lock until the transaction
  commits, so concurrent creators get different numbers.
- If the browser's guess differs, the issue and its "created ticket" activity are rewritten and returned in `changes`.
- Incoming `issueCounter` values on products are ignored.

## TDS-2 Change sync (client)
- `diffState(prev, next)`: for each collection, map previous records by key; a record whose object reference changed is an
  upsert; a missing key is a delete. Order: organisation → products → sprints → roadmaps → issues → comments → attachments →
  work logs → timers → activities → automations → run log; deletes reversed.
- `applyChanges(state, changes)` replaces whole records (server omits nulls, so a cleared field disappears) and prepends run-log
  entries.
- Baseline (`synced`) and shown state both get server changes, so they are not sent back.

## TDS-3 Access scope
See LLD §1.1; implemented twice (TypeScript `DataStore.access()`, C# `AccessScope.For`) and tested on both sides.

## TDS-4 SLA clocks
`clock(start, targetMinutes, stoppedAt, now)`: due = start + target; stopped → met if stop ≤ due else breached; running → breached
if past due, at risk if ≤ 25 % of the target left, else running. Response stops at the first staff response (status leaves "to
do" or a staff comment); resolution stops when the status category is done. Targets follow the ticket's current level.

## TDS-5 Automation
- Triggers: event (created, status / assignee / priority changed, comment by a person) or timed (SLA at risk / breached, due
  date passed — once per ticket per rule, tracked in `FiredFor`).
- Conditions: all must match (`is` / `is not`; empty value = field empty).
- Actions in order; failures are recorded as "Skipped: reason" and make the run `partial` (all failed → `failed`).
- Loop guard: a rule never runs inside its own chain; chains stop at depth 5.
- Round-robin: active team members on the product (else the whole team), alphabetical, `RrIndex` advances per assignment.

## TDS-6 Live updates
`ChangeFeed.Version` starts at the server's start time in ms and increments on every successful sync and on timed runs with
results. Clients poll `GET /api/state/version` every 30 s while visible and idle; on change they reload `/api/state`.

## TDS-7 Gantt geometry
Fixed day counts per zoom (14 / 42 / 91 / 182) stretched to the track width; `barFor` converts dates to `left` / `width` in %;
drag snaps to whole days; bars narrower than 24 px are not keyboard targets (the row label link is the equivalent control).

## TDS-8 Readable colours
`readableColor(hex)`: darken by 7 % per step until contrast ≥ 4.5:1 against `#e8f1fa` (palest panel); cached per colour.
