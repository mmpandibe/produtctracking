# Data Protection and Privacy Policy — nPro

| | |
|---|---|
| Document ID | NPRO-DPP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Owner | [Data protection officer] |
| Basis | GDPR / UK GDPR principles and applicable local data-protection law (e.g. India's DPDP Act 2023) — confirm the governing law with Legal |

## 1. Scope
Personal data processed in nPro about employees, vendor staff, client users and client contacts.

## 2. Principles applied

| Principle | How nPro applies it |
|---|---|
| Lawfulness, fairness, transparency | Employees and vendor staff informed (privacy notice) what nPro records: tickets, time, attendance, leave, productivity |
| Purpose limitation | Delivery management, support, workforce planning and reporting — not used for automated decisions about individuals |
| Data minimisation | Only fields needed; phone no longer collected; leave reason is free text — users told not to enter medical details |
| Accuracy | People can request corrections (hours corrections workflow; admins update records) |
| Storage limitation | Data Retention and Deletion Policy |
| Integrity and confidentiality | Role-scoped access, encryption, security controls (Information Security Policy) |
| Accountability | DPIA, Personal Data Inventory, this policy, access reviews |

## 3. Legal bases (to be confirmed by Legal)
- Employee and vendor staff data: performance of the employment / service contract and legitimate interests (managing delivery).
- Attendance and leave: legal obligation / employment contract; **sick leave is health-related data** → special category: only
  the leave type "sick" and dates are stored, no diagnosis.
- Laptop productivity monitoring: legitimate interests, subject to a balancing test in the DPIA and works-council / employee
  consultation where required.
- Client contacts and client users: contract with the client / legitimate interests.

## 4. Data subject rights
Access, rectification, erasure (subject to retention duties), restriction, objection (notably to productivity monitoring),
portability. Requests to [privacy contact]; answered within one month. Admins can export a person's tickets and time (CSV) and
deactivate or delete people without history.

## 5. Sharing and transfers
No sale of data. Processors: hosting (AWS, when used), Microsoft (platform), external HR / tracker providers (inbound data).
Font CDN (Google) to be removed by self-hosting. Transfers outside the country only with appropriate safeguards.

## 6. Breaches
Report suspected breaches immediately; DPO assesses; supervisory authority notified within 72 hours where required; affected
people informed when the risk is high.

## 7. Browser storage and cookies
Server mode: strictly necessary cookies only (`npro.auth` session, `npro.af` / `XSRF-TOKEN` security); a short-lived in-memory copy of
data. Offline demo mode stores demo data in the browser (localStorage, IndexedDB) — not to be used with real data.
