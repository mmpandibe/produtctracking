# Test Execution Report

| | |
|---|---|
| Document ID | NPRO-TST-EXR-001 |
| Version | 1.0 · 27 Nov 2026 |
| Build | commit `1cd0b22` (main) |
| Environment | Development: Windows 11 Pro, 8 GB RAM; SQL Server Express; API `dotnet run` (Debug); app `ng serve`; headless Edge |

## 1. Automated results (27 Nov 2026)

| Suite | Tests | Passed | Failed | Notes |
|---|---|---|---|---|
| Angular unit tests (Vitest, 25 suites) | 79 | 79 | 0 | `npx ng test --watch=false` |
| Server integration + domain tests (xUnit) | 20 | 20 | 0 | `dotnet test server` (ApiTests 6, DomainTests 3, SyncTests 6, ServerRulesTests 5) |
| Accessibility scan, desktop 1366 px | 30 states + login | 31 | 0 | `npm run a11y`: 0 violations |
| Accessibility scan, 320 px | 30 states + login | 31 | 0 | 0 violations, no horizontal scroll |
| Dependency scans | npm + NuGet | — | — | 0 known vulnerabilities |

## 2. Manual test cases (development verification, 26–27 Nov 2026)

Executed in the browser against the local API and SQL Server during development; not yet repeated by an independent QA in a
Test / UAT environment.

| Result | Count | Test cases |
|---|---|---|
| Passed (manual) | 15 of 71 | TC-FR03-01, TC-FR04-02, TC-FR12-02, TC-FR12-03 (adding the person; the sign-in part is covered by a server test), TC-FR18-01..03, TC-FR19-01, TC-FR20-01, TC-FR20-02, TC-FR20-04, TC-FR21-01, TC-FR22-01, TC-NFR01-03, TC-NFR01-04 — plus extra checks: product grid at 1366 / 768 / 375 px, Set password validation, ticket history shows "Automation" |
| Covered only by automated tests | 51 of 71 | All other cases with an "Auto" reference (including the axe scans and the performance baseline) |
| Not run (open) | 5 of 71 | TC-FR02-04, TC-FR20-03 (lockout), TC-FR21-04 (two browsers), TC-NFR01-05 (screen reader), TC-NFR02-05 (cookie flags) |

## 3. Defects
11 defects found and fixed during development, 0 open (Defect / Bug Tracking Report).

## 4. Assessment
Development testing is complete and green. Before release: independent system test in a Test / UAT environment, the five open
cases, performance test on target hardware, security testing and UAT.
