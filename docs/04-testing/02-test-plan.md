# Test Plan — Release 1.0

| | |
|---|---|
| Document ID | NPRO-TST-PLAN-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Release | 1.0 (Steps 1–18d) |

## 1. Scope
In scope: all FR-01 … FR-22 and NFR-01, 02, 03, 05, 08, 11. Out of scope: live HR / tracker APIs (not specified), S3 (no access),
SSO (not built).

## 2. Test items
Angular app build; API (`Npro.Api`) build; database migrations `Initial`, `EmployeeId`; IIS deployment package (18d).

## 3. Schedule

| Activity | Week (see Project Plan) |
|---|---|
| Automated suites + a11y scan on every change | Ongoing |
| System test of all test cases (NPRO-TC-001) in Test / UAT environment | Week 3 |
| Performance test in the target environment | Week 3 |
| Security testing (ZAP, ASVS checklist) + external pen test | Week 3 |
| Screen-reader pass (NVDA + Edge, VoiceOver iOS) | Week 3 |
| UAT | Week 4 |
| Regression + smoke before production | Week 5 |

## 4. Resources
QA engineer (lead), developer support, role representatives for UAT (admin, division head, assistant manager, BA, tech lead,
developer, tester, support engineer, vendor developer, client user), security tester.

## 5. Deliverables
Test cases, execution report, defect report, regression report, performance report, security / vulnerability reports,
accessibility report, UAT sign-off.

## 6. Suspension / resumption
Suspend when the environment is unavailable or a critical defect blocks > 30 % of cases; resume after the fix is deployed and the
smoke test passes.

## 7. Risks
External APIs unavailable (test with sample adapters), no AWS environment yet (test on a Windows VM with IIS + SQL Server),
limited UAT availability (book sessions early).
