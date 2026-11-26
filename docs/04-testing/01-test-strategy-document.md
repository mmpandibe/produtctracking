# Test Strategy Document

| | |
|---|---|
| Document ID | NPRO-TST-STRAT-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Objectives
Show that nPro meets the SRS (functional and non-functional), that access rules cannot be bypassed, and that changes don't break
existing behaviour.

## 2. Test levels

| Level | What | Tool | Owner | When |
|---|---|---|---|---|
| Unit | Store methods, calculations (reports, SLA, timeline, search, diff / merge, colour contrast) | Vitest (`src/app/app.spec.ts`) | Developers | Every change |
| Integration (API) | Endpoints with a real pipeline: auth, XSRF, scope, sync authorisation, numbering, automation, timed rules | xUnit + WebApplicationFactory + SQLite in-memory | Developers | Every backend change |
| Accessibility | WCAG 2.0 / 2.1 / 2.2 A + AA rules on 30 screens / dialogs + login, desktop and 320 px; reflow | axe-core in headless Edge (`scripts/a11y-scan.cjs`) | Developers / QA | Every UI change |
| System / functional | End-to-end flows in a browser with the API and SQL Server | Manual (Test Cases NPRO-TC-001); automation candidate: Playwright | QA | Each step, before release |
| Regression | Full automated suites + smoke test cases | Vitest, xUnit, a11y scan, smoke checklist | QA | Before every release |
| Performance | Response times and throughput of read and write endpoints | Local baseline script; load tool (k6 / JMeter) for the target environment | QA / IT | Before go-live |
| Security | Authorisation, XSRF, session, input handling, dependencies; external pen test | xUnit refusal tests, dependency scanners, OWASP ZAP, pen test | Security | Before go-live, then yearly |
| UAT | Business acceptance by role representatives | Manual scenarios (UAT Sign-off) | Product owner | Before go-live |

## 3. Approach
- **Risk-based**: highest depth on access control, data integrity (sync, numbering), SLA calculations and personal data.
- **Shift-left**: every requirement gets tests in the same step it is built.
- **Same rules twice**: access scope and SLA logic exist in TypeScript and C#; both sides are tested.

## 4. Environments and data
Development (local SQL Express, demo seed), Test / UAT (production-like, demo seed or masked data). Production data is never
used for testing.

## 5. Entry / exit criteria
- Entry: build green, feature complete for the step, test cases written.
- Exit (release): 100 % automated tests pass; a11y scan 0 violations; no open critical / high defects; performance targets met in
  the target environment; security findings critical / high fixed; UAT signed off.

## 6. Defect management
Severity: Critical (data loss, security breach, system down), High (main function broken, no workaround), Medium (workaround
exists), Low (cosmetic). Tracked in the Defect / Bug Tracking Report (later in nPro itself).

## 7. Metrics
Pass rate, defects by severity / module, escape rate (found after release), automated test count, a11y violations.
