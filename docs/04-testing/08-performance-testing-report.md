# Performance Testing Report

| | |
|---|---|
| Document ID | NPRO-TST-PERF-001 |
| Version | 1.0 · 27 Nov 2026 |
| Type | **Local baseline** (not a load test on production-like hardware) |

## 1. Setup
- Machine: Windows 11 Pro laptop, 1 processor, 8 GB RAM; API and SQL Server Express on the same machine.
- API: `dotnet run` (Debug build, Kestrel); demo data (13 people, 3 products, ~10 tickets).
- Client: Node.js script, signed in as admin; 5 warm-up calls; then sequential requests and 5 rounds of 20 concurrent requests
  per endpoint. Read endpoints only (no data changed).

## 2. Results (milliseconds)

| Endpoint | Response size | Sequential p50 | Sequential p95 | 20 concurrent p50 | 20 concurrent p95 | Throughput (20 concurrent) |
|---|---|---|---|---|---|---|
| `GET /api/health` | 31 B | 15.6 | 35.0 | 87.2 | 217.4 | 132 req/s |
| `GET /api/auth/me` | 495 B | 22.4 | 38.7 | 59.1 | 105.6 | 230 req/s |
| `GET /api/state/version` | 25 B | 17.7 | 38.2 | 60.7 | 106.0 | 226 req/s |
| `GET /api/state` (full snapshot) | 21.0 KB | 88.7 | 204.5 | 125.3 | 154.5 | 147 req/s |
| `GET /api/issues` | 4.7 KB | 16.2 | 24.2 | 23.4 | 35.1 | 662 req/s |

`/api/health` is slower under concurrency because it opens a database connection to check availability.

## 3. Assessment against NFR-03
All read endpoints meet "p95 < 500 ms" at 20 concurrent requests on development hardware with demo data. This does **not** prove
the target with 50 users and production data volumes.

## 4. Known scaling factors
- `/api/state` loads whole tables and filters in memory: response time grows with data volume (tickets, activities, comments).
  Expect to add paging / server-side filtering and to cap history in the snapshot beyond ~20 000 tickets.
- Each browser polls `/api/state/version` every 30 s (≈ 1.7 req/s for 50 users — negligible); a version change triggers a full
  snapshot reload per open browser.

## 5. Planned load test (target environment)
Tool: k6 or JMeter. Profile: 50 virtual users, 70 % reads (state, version, issues), 30 % sync writes (comments, status changes,
ticket creation), 30 minutes; data set: 20 000 tickets, 200 users. Targets: p95 < 500 ms reads, < 800 ms writes, 0 % errors,
CPU < 70 %. Results to be appended here.
