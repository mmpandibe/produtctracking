# ISO/IEC 27001:2022 Readiness Assessment and Statement of Applicability (draft)

| | |
|---|---|
| Document ID | NPRO-ISO-001 |
| Version | 1.1 (draft) · 27 Nov 2026 — G-1 (password part), G-2 and G-6 fixed |
| Scope assessed | The nPro application (Angular 22 frontend, .NET 10 API, SQL Server), its code repository, build and deployment kit, and the nPro document set in `docs/` |
| Method | Desk review of code and documents against ISO/IEC 27001:2022 clauses 4–10 and all 93 Annex A controls; evidence from automated tests (35 server, 79 Angular) and a local Production-mode run |
| Assessor | Development team self-assessment — **not** an accredited certification audit |

## 1. What "compliance" means here

ISO/IEC 27001 certifies an **organisation's information security management system (ISMS)**, not a software product. nPro cannot
be "ISO 27001 certified" on its own. What can be assessed is:

1. **Product controls**: does nPro implement the technical controls an ISMS would rely on (access control, authentication,
   logging, cryptography, secure development…)?
2. **ISMS readiness**: does the documentation the organisation needs for clauses 4–10 and the Statement of Applicability exist?

The organisation that runs nPro (people, offices, AWS, suppliers) must operate the ISMS and pass the certification audit; many
controls (physical, HR, supplier) sit there, not in the product.

## 2. Summary

| Area | Result |
|---|---|
| Clauses 4–10 (ISMS) | **Not ready** — policies and a risk assessment exist as drafts; ISMS scope, objectives, internal audit, management review and corrective-action process are missing |
| Annex A — product and documentation (55 controls) | **19 implemented · 35 partial · 1 gap** (5.35 independent review). Fixed in v1.1: 5.18 access rights, 8.10 information deletion; 5.17 improved to partial (MFA open) |
| Annex A — organisational / inherited (38 controls: all of 6.x and 7.x, 7 in 5.x, 9 in 8.x) | Outside the product; the operating organisation covers them (AWS inherits the data-centre part of 7.x) |
| Certification readiness | **Not yet.** Typical path: close the product gaps below, operate the ISMS for ~3 months to produce records, internal audit + management review, then Stage 1 / Stage 2 audit |

**Top product gaps (fix before go-live):**

| # | Control | Gap | Fix |
|---|---|---|---|
| G-1 | 5.17, 8.5 | ✅ **Fixed (v1.1):** self-service password change; admin-set passwords must be replaced before any data is served. **Open:** MFA / SSO | OIDC SSO with MFA (Entra ID / Okta) — MFA at least for admins |
| G-2 | 8.10, 5.34 | ✅ **Fixed (v1.1):** daily `RetentionService` — anonymises people 2 years after deactivation, deletes time logs after 7 years and attendance requests after 13 months; legal-hold switch; every run logged (event 1401) | Confirm the periods with Legal / DPO |
| G-3 | 8.7 | Uploaded attachments are not malware-scanned (they are only ever served as downloads) | Microsoft Defender real-time scanning on `D:\nPro\files` (Windows Server default) + scan-on-upload via AMSI before saving |
| G-4 | 8.24 | Encryption at rest not configured: SQL Server TDE / encrypted volumes, encrypted backups, attachment volume | EBS / BitLocker volume encryption, `BACKUP … WITH ENCRYPTION`, TDE on Standard edition |
| G-5 | 8.15, 5.33 | Security events now logged (this review), but there is no tamper-resistant central store or in-app admin audit view; ticket history can be deleted together with a ticket | Ship Windows Event Log to CloudWatch / SIEM with 12-month retention; admin "Security events" view; soft-delete tickets |
| G-6 | 5.18 | ✅ **Fixed (v1.1):** Organisation → People → **Access review** (admins) downloads a CSV of every person's role, company, team, manager, products in scope, sign-in state, lockout, last sign-in and a "Reviewed" column; export logged (event 1104) | Run quarterly; keep the signed CSV as the record |
| G-7 | 8.4, 8.32 | Repository visibility, branch protection, required reviews and CI not verified / not set up | Private repo, protected `main`, PR reviews, CI running both test suites + dependency scan |

## 3. Clauses 4–10 (ISMS requirements)

| Clause | Requirement | Evidence in `docs/` | Status |
|---|---|---|---|
| 4.1–4.2 | Context, interested parties | Feasibility study, PRD stakeholders | 🟡 partial — no ISMS context / interested-party register |
| 4.3 | ISMS scope | — | ❌ write the scope statement (nPro service, AWS region, teams, locations) |
| 4.4 | ISMS established and maintained | — | ❌ |
| 5.1–5.3 | Leadership, policy, roles | Information Security Policy (draft, owner placeholder) | 🟡 approve the policy; name the ISO / owners |
| 6.1.1–6.1.2 | Risk assessment process | Security Risk Assessment (SR-01…12, L×I) | 🟡 add risk acceptance criteria and owners |
| 6.1.3 | Risk treatment + **Statement of Applicability** | §4 of this document (draft SoA) | 🟡 approve; justify exclusions |
| 6.2 | Security objectives | — | ❌ measurable objectives (e.g. 0 critical vulns > 15 days, 100% quarterly access reviews) |
| 6.3 | Planning of changes | Change Request Document | ✅ |
| 7.1–7.5 | Resources, competence, awareness, communication, documented information | Development standards, user manual; document control tables | 🟡 training records and document approval workflow missing |
| 8.1–8.3 | Operational planning, risk assessment and treatment carried out | SRA, Project Plan | 🟡 treatments partly delivered (Step 18d closed SR-02, SR-04, SR-06, SR-12) |
| 9.1 | Monitoring and measurement | System Monitoring Report (plan) | 🟡 |
| 9.2 | Internal audit | — | ❌ audit programme |
| 9.3 | Management review | — | ❌ |
| 10.1–10.2 | Improvement, nonconformity and corrective action | Problem Management, RCA reports | 🟡 add a corrective-action log |

## 4. Statement of Applicability — Annex A (93 controls)

Legend: ✅ implemented · 🟡 partial · ❌ gap · 🏢 organisational (outside the product) · ☁ inherited from AWS · A = applicable.

### 4.1 Organisational controls (5.1–5.37)

| Control | Status | Evidence / note |
|---|---|---|
| 5.1 Policies for information security | 🟡 | Information Security Policy NPRO-ISP-001 (draft, not approved) |
| 5.2 Information security roles and responsibilities | 🟡 | RACI in Project Plan; ISO owner placeholder |
| 5.3 Segregation of duties | ✅ | 8 roles with scoped capabilities; nobody approves their own leave / correction; only managers above the person or admins decide (`AttendanceEndpoints.CanApprove`) |
| 5.4 Management responsibilities | 🏢 | |
| 5.5 Contact with authorities | 🏢 | Breach notification (72 h) named in policy |
| 5.6 Contact with special interest groups | 🏢 | |
| 5.7 Threat intelligence | 🏢 | Vulnerability Management Procedure covers advisories |
| 5.8 Information security in project management | ✅ | Security requirements in SRS NFRs, risk register, security sections in every design doc |
| 5.9 Inventory of information and assets | 🟡 | Assets A1–A7 (SRA), Personal Data Inventory, Third-Party Component Register; no infrastructure asset list yet |
| 5.10 Acceptable use | 🟡 | Policy §13; needs user acknowledgement |
| 5.11 Return of assets | 🏢 | |
| 5.12 Classification of information | ✅ | Policy §1: Confidential / Restricted |
| 5.13 Labelling of information | 🟡 | Not labelled in the UI or exports; low risk (all nPro data is Confidential) — consider a footer label on CSV / printed reports |
| 5.14 Information transfer | 🟡 | TLS (deployment), attachments only as downloads with access check; CSV exports limited to the person's scope; TLS not yet configured on a server |
| 5.15 Access control | ✅ | Access Control Matrix; server-side checks on every read and write (`AccessScope`, per-record sync authorisation, 30+ refusal tests) |
| 5.16 Identity management | ✅ | One account per person, unique email and employee ID, deactivation blocks the next request immediately (`RequestAccess` returns null for inactive people) |
| 5.17 Authentication information | 🟡 | PBKDF2-SHA512 hashing, 10-char policy, lockout; self-service change (`POST /api/auth/password`, wrong current password counts towards lockout); admin-set passwords flagged `MustChangePassword` and the API refuses data until replaced (`ComplianceTests`); MFA open (G-1) |
| 5.18 Access rights | ✅ | Roles / scope assigned by admins; changes logged (event 1103); access-review CSV export with last sign-in (`GET /api/access-review`, admins only) |
| 5.19 Information security in supplier relationships | 🟡 | Third-Party Vendor Assessment |
| 5.20 Security within supplier agreements | 🏢 | |
| 5.21 ICT supply chain | 🟡 | Component register, 0 known vulnerabilities (npm audit / NuGet), lock files committed; no SBOM |
| 5.22 Supplier service monitoring | 🏢 | |
| 5.23 Cloud services | 🟡 | AWS planned; vendor assessment; no AWS access yet |
| 5.24 Incident management planning | 🟡 | Incident Management Report (process) |
| 5.25 Assessment of events | 🟡 | Severity matrix in incident process; security events now logged with ids |
| 5.26 Response to incidents | 🟡 | Process documented; untested |
| 5.27 Learning from incidents | ✅ | RCA template + one RCA written (24px rule) |
| 5.28 Collection of evidence | 🟡 | Security log + ticket history; no tamper-resistant store (G-5) |
| 5.29 Security during disruption | 🟡 | BCP drafted |
| 5.30 ICT readiness for business continuity | 🟡 | DR Plan, Backup and Restore Procedure (RPO 1 h); not yet implemented or tested |
| 5.31 Legal, statutory, contractual requirements | 🟡 | Privacy policy (GDPR / DPDP); employee-monitoring notice pending |
| 5.32 Intellectual property rights | ✅ | Licence register (MIT / Apache / ISC / OFL) |
| 5.33 Protection of records | 🟡 | History entries can't be changed through the API; but can be deleted with their ticket (G-5) |
| 5.34 Privacy and protection of PII | 🟡 | DPIA, data inventory, role-scoped employee data (developers see only their own time), retention job (G-2 fixed); employee notice and DPIA approval pending |
| 5.35 Independent review | ❌ | Pen test / external audit not done |
| 5.36 Compliance with policies and standards | 🟡 | Readiness checklist; no periodic compliance check yet |
| 5.37 Documented operating procedures | ✅ | Deployment Plan, Rollback, Backup / Restore, DR, Patch Management, `scripts/publish.ps1`, `create-admin` |

### 4.2 People controls (6.1–6.8)

All 🏢 organisational: 6.1 Screening · 6.2 Terms of employment · 6.3 Awareness and training · 6.4 Disciplinary process ·
6.5 Responsibilities after termination (product side ✅: deactivating a person blocks access at once) · 6.6 NDAs (vendor and
client users) · 6.7 Remote working · 6.8 Event reporting (the Support Desk can serve as the reporting channel).

### 4.3 Physical controls (7.1–7.14)

All ☁ inherited from AWS data centres for the servers (7.1–7.6, 7.8, 7.10–7.14) and 🏢 for offices and laptops (7.7 clear
desk / screen, 7.9 assets off-premises). Product support: the sign-in session expires after 8 h of inactivity.

### 4.4 Technological controls (8.1–8.34)

| Control | Status | Evidence / note |
|---|---|---|
| 8.1 User endpoint devices | 🏢 | No data kept in the browser in server mode (only the offline demo uses localStorage / IndexedDB) |
| 8.2 Privileged access rights | 🟡 | Admin role limited by policy; `create-admin` for the first admin; privileged actions logged (1101–1103); no MFA (G-1) |
| 8.3 Information access restriction | ✅ | Product / people scope enforced on the server for every endpoint, incl. attachments and attendance |
| 8.4 Access to source code | 🟡 | GitHub repository; visibility, branch protection and 2FA to be verified (G-7) |
| 8.5 Secure authentication | 🟡 | Generic error messages, lockout (5 tries / 5 min), sign-in rate limit (10/min per address), HttpOnly SameSite=Strict cookie, XSRF tokens; no MFA (G-1) |
| 8.6 Capacity management | 🟡 | Local performance baseline (p95 < 220 ms at 20 concurrent); production sizing pending |
| 8.7 Protection against malware | 🟡 | Uploads stored under random keys, never executed or rendered (octet-stream + nosniff); no scanning (G-3) |
| 8.8 Technical vulnerabilities | 🟡 | Procedure + 0 known vulnerabilities (27 Nov); no automated alerts (Dependabot) yet |
| 8.9 Configuration management | ✅ | Versioned `appsettings.*.json`, `appsettings.Production.json` without secrets, start-up warnings for unsafe settings, repeatable publish script |
| 8.10 Information deletion | ✅ | Daily retention job (`RetentionService`, `Retention:*`), legal hold, logged runs; deleting an attachment deletes its file |
| 8.11 Data masking | ✅ | Not needed for display; employee data is hidden by role scope rather than masked; test data is synthetic |
| 8.12 Data leakage prevention | 🟡 | Exports limited to scope; CSP blocks exfiltration to other origins; no DLP tooling (organisational) |
| 8.13 Information backup | 🟡 | Procedure written (full daily, log every 15 min… RPO 1 h); not implemented |
| 8.14 Redundancy | 🟡 | Single IIS node; Data Protection keys and files on disk (move keys / files to shared storage before adding nodes) |
| 8.15 Logging | 🟡 | **Added in this review:** `SecurityEvents` — sign-in success / failure / lockout, sign-out, demo switch, admin password set, `create-admin`, role / deactivation / organisation changes, refused changes, rate-limit hits, leave decisions; no passwords or unknown login names logged (test `SecurityLogTests`); Windows Event Log in Production. Central retention pending (G-5) |
| 8.16 Monitoring activities | 🟡 | `/api/health` (database, storage, timed rules; 503 when the DB is down); alerting not set up |
| 8.17 Clock synchronisation | ☁ | Amazon Time Sync / Windows time service; timestamps stored with offsets |
| 8.18 Privileged utility programs | 🏢 | |
| 8.19 Software installation on operational systems | 🟡 | Deployment only through the publish package (Deployment Plan) |
| 8.20 Networks security | 🏢 | AWS security groups / ALB (planned) |
| 8.21 Security of network services | 🏢 | |
| 8.22 Segregation of networks | 🏢 | Infrastructure Architecture: app and DB subnets (planned) |
| 8.23 Web filtering | 🏢 | |
| 8.24 Use of cryptography | 🟡 | Passwords PBKDF2-SHA512; cookies / tokens via Data Protection with persisted DPAPI-protected keys; HSTS; at-rest encryption pending (G-4) |
| 8.25 Secure development life cycle | ✅ | Software Development Plan, Development Standards, Code Review Checklist |
| 8.26 Application security requirements | ✅ | SRS NFRs, Security Architecture Document, OWASP ASVS L2 alignment |
| 8.27 Secure architecture and engineering | ✅ | Defence in depth: server-side authorisation, same-origin hosting (no CORS), CSP `default-src 'self'`, server-owned fields (ticket keys, storage keys) |
| 8.28 Secure coding | ✅ | EF Core parameterised queries, Angular output escaping, XSRF, file-name sanitising and path-traversal guard, size limits, input validation on every endpoint |
| 8.29 Security testing | 🟡 | 31 server tests incl. refusal / rate-limit / header / logging tests; a11y scans; dependency scans; pen test / DAST pending |
| 8.30 Outsourced development | 🏢 | Vendor developers use nPro; code contributions governed by the repository rules |
| 8.31 Separation of environments | ✅ | Development (demo data, switcher), Testing (in-memory), Production config (demo off, warnings if on), separate `NproProdTest` database for package checks |
| 8.32 Change management | 🟡 | Change Request Document, git history, migrations reviewed before release; no enforced PR review / CI (G-7) |
| 8.33 Test information | ✅ | Synthetic demo organisation; no production data in tests |
| 8.34 Protection during audit testing | 🏢 | Pen tests against the Test environment (Security Testing Report) |

Count: 5.x — 9 ✅, 20 🟡, 1 ❌, 7 🏢 · 6.x — 8 🏢 · 7.x — 14 ☁ / 🏢 · 8.x — 10 ✅, 15 🟡, 0 ❌, 9 🏢 / ☁ · total 93.

## 5. Changes made during this assessment

| Change | Control | Verified by |
|---|---|---|
| `SecurityEvents` log category `Npro.Security` with stable event ids (1001–1301), wired into sign-in, sign-out, demo switch, admin password set, `create-admin`, people / role changes in sync, refused sync changes, rate-limit rejections and leave / correction decisions | 8.15, 5.25, 5.28 | `SecurityLogTests` (events present, no passwords or unknown login names) |
| Production logging: `Npro.Security` at Information, also to the Windows Event Log | 8.15 | `appsettings.Production.json` |
| v1.1: change-password page and API; `MustChangePassword` on admin-set passwords, enforced by the API (only `/api/auth/*` until changed) | 5.17 | `ComplianceTests`, browser check (forced and voluntary) |
| v1.1: retention job (`Retention:Enabled`, `LegalHold`, `DeactivatedUserYears` 2, `TimeLogYears` 7, `AttendanceMonths` 13); migration `SecurityFollowUps` (People: MustChangePassword, LastSignInAt, DeactivatedAt, AnonymisedAt) | 8.10, 5.34 | `ComplianceTests` |
| v1.1: access-review CSV (Organisation → People) | 5.18 | `ComplianceTests`, browser check |

## 6. Recommended plan

1. **Product (before go-live):** G-5 admin security-events view and soft-delete of tickets; then SSO / MFA (rest of G-1).
   G-2 and G-6 and the password part of G-1 are done (v1.1).
2. **Infrastructure (with AWS access):** G-4 encryption at rest, G-3 Defender on the files folder, central log retention,
   backups and a restore test, alerts on `/api/health`.
3. **Repository:** G-7 private repo, protected `main`, reviews, CI with tests and dependency scanning.
4. **ISMS (organisation):** scope, objectives, approved policy and SoA, risk owners, training records, internal audit,
   management review, then the certification audit.
