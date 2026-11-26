# Change Request (CR) Document

| | |
|---|---|
| Document ID | NPRO-CR-001 |
| Version | 1.0 · 27 Nov 2026 |

## 1. Process
1. Requester raises a CR (form below) — in nPro once deployed (ticket type "request" on product "nPro").
2. Product owner assesses value, effort, risk, privacy / security impact.
3. Decision: approve / reject / defer; approved CRs get a target release.
4. Implement → test → release notes → close.

## 2. CR form

| Field | |
|---|---|
| CR number / title | |
| Requested by / date | |
| Description and reason | |
| Affected modules / requirements | |
| Priority (Must / Should / Could) | |
| Impact: effort, schedule, cost | |
| Impact: security / privacy / accessibility | |
| Impact: data model / migration | |
| Decision / approver / date | |
| Target release | |

## 3. CR log (requests implemented during development)

| CR | Title | Requested | Impact | Decision | Delivered |
|---|---|---|---|---|---|
| CR-001 | Re-plan roadmap for internal divisions / teams, vendors and clients (Steps 11–18) | 26 Nov 2026 | Large: new modules, roles | Approved | Steps 11–18c |
| CR-002 | Backend on .NET 10 + MS SQL, hosted on AWS Windows / IIS (changed from .NET 11) | 26 Nov 2026 | Architecture | Approved | 18a–18c |
| CR-003 | Redesign login; employee ID for in-house employees; remove phone from person form | 26 Nov 2026 | Data model (migration), UI | Approved | `88a0606` |
| CR-004 | WCAG 2.2 AA compliance | 26 Nov 2026 | All screens | Approved | `88a0606` |
| CR-005 | Product list: smaller cards, more per row | 27 Nov 2026 | UI | Approved | `1cd0b22` |
| CR-006 | Project documentation set (73 documents) | 27 Nov 2026 | Docs | Approved | this set |
