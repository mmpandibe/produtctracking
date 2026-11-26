# Risk Assessment Document

| | |
|---|---|
| Document ID | NPRO-RISK-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Review | Weekly during the project, monthly after go-live |

Scoring: Likelihood (L) and Impact (I) 1 (low) – 5 (high); Score = L × I. ≥ 15 high, 8–14 medium, ≤ 7 low.

| ID | Risk | L | I | Score | Mitigation | Owner | Status |
|---|---|---|---|---|---|---|---|
| R-01 | External HR / tracker API details not available, delaying real attendance / productivity data | 4 | 3 | 12 | Adapters with sample data; server adapter interface in 18d so only one class per system is needed later | HR / IT | Open |
| R-02 | No AWS access delays the production environment | 4 | 4 | 16 | Deployment kit and docs ready in 18d; file storage on server disk first; escalate access request | IT | Open |
| R-03 | Employee monitoring and sick-leave data create privacy obligations (GDPR / local law, works council) | 3 | 5 | 15 | DPIA before go-live; data minimisation; role-scoped access; retention policy; employee notice | DPO | Open |
| R-04 | Data Protection keys not persisted on IIS → everyone signed out after an app-pool recycle | 4 | 3 | 12 | Persist keys to a protected folder / registry or DB in production config (18d) | Dev / IT | Open |
| R-05 | SQL Server Express limits (10 GB, no TDE, limited memory) in production | 3 | 3 | 9 | Use SQL Server Standard or RDS; storage-level encryption | IT | Open |
| R-06 | Single IIS server: outage stops the service | 2 | 4 | 8 | Backups, DR plan, documented rebuild; later a second node (needs shared version store) | IT | Open |
| R-07 | Live-update version is in memory → wrong with several IIS worker processes | 2 | 2 | 4 | One worker per site (documented); move to DB / cache for a farm | Dev | Accepted |
| R-08 | Low adoption by vendor and client users | 3 | 3 | 9 | My Requests is simple; training; accessible, responsive UI | Product owner | Open |
| R-09 | Business rules partly in the browser (history of people's own edits, report calculations) | 2 | 3 | 6 | Server validates every change; remaining logic moves server-side over time | Dev | Accepted |
| R-10 | Attachments today stay in the uploader's browser | 4 | 3 | 12 | Server file storage in 18d | Dev | Open |
| R-11 | Security weaknesses not yet found by a penetration test | 3 | 4 | 12 | Pen test and OWASP ASVS L2 review before go-live | Security | Open |
| R-12 | Key-person dependency (small team, AI-assisted code) | 3 | 3 | 9 | Documentation (this set), standards, code review, tests | Delivery head | Open |
| R-13 | Web fonts loaded from Google Fonts send users' IP addresses to a third party | 3 | 2 | 6 | Self-host the Inter font | Dev | Open |
| R-14 | Development demo password in the repository | 2 | 2 | 4 | Development-only, empty in production; optionally move to user secrets | Dev | Accepted |

**Top risks:** R-02, R-03, R-01, R-04, R-10, R-11.
