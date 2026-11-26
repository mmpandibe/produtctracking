# Requirement Traceability Matrix (RTM)

| | |
|---|---|
| Document ID | NPRO-RTM-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Related | BRD · SRS · User Stories · LLD · Test Cases NPRO-TC-001 |

Columns: business requirement → SRS requirement → user stories → where it is built → test cases (manual IDs from NPRO-TC-001 and
automated suites) → status. Automated suites: **A** = Angular unit tests (`src/app/app.spec.ts`, suite name), **S** = server tests
(`server/tests/Npro.Tests`, class / test).

| BR | FR / NFR | User stories | Built in | Test cases | Automated | Status |
|---|---|---|---|---|---|---|
| BR-01 | FR-01 Products | US-01, US-02 | `pages/products`, `DataStore.createProduct` | TC-FR01-01..03 | A: DataStore; Roadmaps, ticket benefits, product links | Built, tested |
| BR-01 | FR-02 Tickets | US-03, US-04 | `pages/tickets`, `DataStore.createIssue/updateIssue`, `Sync.cs` numbering | TC-FR02-01..04 | A: DataStore tickets; S: ServerRulesTests.Two_people_guessing… | Built, tested |
| BR-01 | FR-03 Ticket detail | US-05 | `ticket-detail`, panels | TC-FR03-01..03 | A: statuses, parents, comments, attachments | Built, tested |
| BR-01 | FR-04 Board | US-06 | `pages/board`, `shared/move-menu` | TC-FR04-01..03 | A: DataStore board moves | Built, tested |
| BR-01 | FR-05 Backlog & sprints | US-07 | `pages/backlog` | TC-FR05-01..02 | A: sprint lifecycle; sprints, time logs, timer | Built, tested |
| BR-01, BR-05 | FR-06 Roadmaps | US-08 | `roadmap-form`, `DataStore.roadmapProgress` | TC-FR06-01 | A: Roadmaps, ticket benefits | Built, tested |
| BR-06 | FR-07 Time | US-10, US-11 | `pages/time` | TC-FR07-01..02 | A: Time tracking helpers; Week helpers | Built, tested |
| BR-02 | FR-08 Clients | — | `pages/clients` | TC-FR08-01 | A: Clients and SLA policies | Built, tested |
| BR-07 | FR-09 Reports | US-28 | `pages/reports`, `core/reports.ts` | TC-FR09-01..02 | A: Report calculations; Month-wise hours matrix | Built, tested |
| BR-07 | FR-10 CXO summary | US-29 | `pages/cxo` | TC-FR10-01 | A: CXO period summary | Built, tested |
| BR-08 | FR-11 Workflows & fields | US-24, US-25 | `pages/workflows` | TC-FR11-01..03 | A: Workflows & custom fields | Built, tested |
| BR-02 | FR-12 Organisation | US-19, US-23 | `pages/organisation` | TC-FR12-01..04 | A: Organisation; Employee IDs; S: SyncTests.Admin_adds_a_person… | Built, tested |
| BR-03 | FR-13 Access | US-20, US-21 | `DataStore.access()`, `AccessScope.cs`, `Sync.cs` | TC-FR13-01..04 | A: Roles & access; S: ApiTests (scope), SyncTests (refusals) | Built, tested |
| BR-04 | FR-14 Support | US-16..18 | `pages/support`, `core/sla.ts`, `Rules/Sla.cs` | TC-FR14-01..03 | A: Support desk & SLA | Built, tested |
| BR-05 | FR-15 Gantt | US-09 | `pages/gantt`, `core/timeline.ts` | TC-FR15-01..02 | A: Gantt & roadmap timeline | Built, tested |
| BR-06 | FR-16 Attendance | US-12..15 | `pages/attendance`, `core/external*.ts` | TC-FR16-01..04 | A: External productivity & attendance | Built (sample data) |
| BR-06 | FR-17 Integrations | — | `pages/integrations` | TC-FR17-01 | A: External productivity & attendance | Built (live APIs pending) |
| BR-06, BR-07 | FR-18 Dashboards & search | US-15, US-30..32 | `pages/dashboard`, `layout/global-search`, `core/search.ts` | TC-FR18-01..03 | A: Global search & home | Built, tested |
| BR-09 | FR-19 Automation | US-26, US-27 | `pages/automation`, `Rules/RuleEngine.cs`, `TimedRulesService` | TC-FR19-01..04 | A: Automation rules; Server-owned rules; S: ServerRulesTests | Built, tested |
| BR-12 | FR-20 Authentication | US-22, US-23 | `pages/login`, `Endpoints.cs` auth | TC-FR20-01..04 | S: ApiTests (login, lockout-safe errors, employee ID) | Built, tested |
| BR-10, BR-12 | FR-21 Server data | US-33 | `core/session.ts`, `state-diff.ts`, `Sync.cs`, `ChangeFeed` | TC-FR21-01..04 | A: Server sync; Server-owned rules; S: SyncTests, ServerRulesTests | Built, tested |
| BR-01 | FR-22 Offline demo | US-34 | `DataStore` local mode | TC-FR22-01 | A: all DataStore suites run in local mode | Built, tested |
| BR-11 | NFR-01 Accessibility | US-35 | `styles.css`, `shared/readable.ts`, `modal.ts`, `move-menu.ts` | TC-NFR01-01..05 | `npm run a11y` / `a11y:mobile` (axe); A: Accessibility helpers | Met (automated); screen-reader pass open |
| BR-12 | NFR-02 Security | — | `Program.cs`, `XsrfMiddleware.cs`, `Sync.cs` | TC-NFR02-01..05 | S: SyncTests.Writes_without_the_xsrf_token…; ApiTests | Met for tested items; pen test open |
| — | NFR-03 Performance | — | — | TC-NFR03-01 | Local baseline (Performance Testing Report) | Baseline only; load test open |
| — | NFR-04 Availability | — | Infrastructure | — | — | Depends on production setup |
| — | NFR-05 Responsive | — | all pages | TC-NFR05-01 | a11y scan overflow check at 320 px | Met |
| — | NFR-07 Maintainability | — | repo | — | 79 + 20 automated tests | Met |
| — | NFR-08 Integrity | — | `Sync.cs` transaction, unique indexes | TC-FR21-03 | S: A_refused_change_rolls_back… | Met |
| — | NFR-09 Privacy | — | — | — | — | Policies drafted; DPIA open |
| BR-10 | NFR-10 Hosting | — | `server/README.md` | — | — | Deployment kit in 18d |
| — | NFR-11 Auditability | US-05 | activities, automation log | TC-FR03-03 | A: DataStore … history | Met |

**Coverage summary:** 22 of 22 functional requirements have at least one automated test; NFR-03 (load), NFR-04 (availability),
NFR-09 (privacy approval) and a manual screen-reader pass are open items tracked in the Project Plan.
