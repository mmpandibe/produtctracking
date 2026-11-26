# Security Risk Assessment

| | |
|---|---|
| Document ID | NPRO-SRA-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Method | Asset → threat → vulnerability → existing controls → likelihood × impact (1–5) → treatment |

## 1. Assets
A1 ticket and product data · A2 client data and contacts · A3 employee data (attendance, leave incl. sickness, productivity) ·
A4 credentials and sessions · A5 automation rules and configuration · A6 availability of the service · A7 source code and builds.

## 2. Risk register

| ID | Asset | Threat / scenario | Existing controls | L | I | Score | Treatment |
|---|---|---|---|---|---|---|---|
| SR-01 | A1–A3 | Broken access control: user reads or edits data outside their scope | Server-side scope on every read; per-record authorisation on writes; tests | 2 | 5 | 10 | Pen test; keep refusal tests for every new write path |
| SR-02 | A4 | Credential stuffing / brute force | Lockout, strong passwords, generic errors | 3 | 4 | 12 | Rate limiting (18d); SSO + MFA |
| SR-03 | A4 | CSRF on state-changing requests | SameSite=Strict + XSRF token | 1 | 4 | 4 | Accept |
| SR-04 | A1 | XSS via ticket text / comments | Angular escaping; no `innerHTML` with user data | 2 | 4 | 8 | CSP header (18d) |
| SR-05 | A3 | Over-collection / misuse of employee monitoring data | Role scope (own time only for devs / testers; managers their people) | 3 | 5 | 15 | DPIA, minimisation, retention, employee notice |
| SR-06 | A4 | Session loss / forged cookies if Data Protection keys mismanaged | Default key ring | 3 | 3 | 9 | Persist and protect keys (18d) |
| SR-07 | A1–A4 | Demo features enabled in production | Config defaults off | 2 | 5 | 10 | Readiness checklist check; startup warning |
| SR-08 | A6 | Single server failure / ransomware | Backups (planned) | 2 | 4 | 8 | DR plan, off-site immutable backups |
| SR-09 | A7 | Vulnerable dependency | Monthly scans (0 today) | 3 | 3 | 9 | Patch timelines |
| SR-10 | A1–A3 | Database theft (backup or disk) | — | 2 | 5 | 10 | TDE / encrypted volumes and backups |
| SR-11 | A5 | Malicious automation rule (mass reassign / escalate) | Only admins / product managers create rules; run log | 2 | 3 | 6 | Accept; review run log |
| SR-12 | A2–A3 | Third-party font CDN leaks visitor IPs | — | 3 | 2 | 6 | Self-host font |

## 3. Summary
Highest: SR-05 (privacy of employee data), SR-02 (sign-in attacks), SR-01 / SR-07 / SR-10. All have planned treatments before
go-live (see Project Plan week 3 and Step 18d). Residual risk to be accepted by the information security officer.
