# Service Level Agreement (SLA) — nPro Service

| | |
|---|---|
| Document ID | NPRO-SLA-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Parties | IT / nPro application support (provider) and the business units using nPro (customers) |
| Note | This is the SLA **for the nPro service itself**. The L1–L3 SLA targets configured inside nPro for client support are separate (Support Desk › Levels & targets). |

## 1. Service description
nPro web application and API for product delivery, support and time tracking, available to internal staff, vendor staff and
client users via browser.

## 2. Service hours
- Service available: 24 × 7 (best effort outside business hours).
- Supported hours: Monday–Friday 09:00–18:00 local time, excluding public holidays.
- Planned maintenance: announced 3 business days ahead, outside business hours, max 4 hours per month.

## 3. Service levels

| Measure | Target |
|---|---|
| Availability in supported hours (excl. planned maintenance) | ≥ 99.5 % per month |
| Read response time (p95) | < 500 ms |
| Save response time (p95) | < 800 ms |
| Data loss on failure (RPO) | ≤ 1 hour |
| Restore after major failure (RTO) | ≤ 4 hours |

## 4. Incident response (supported hours)

| Priority | Response | Restore / workaround |
|---|---|---|
| P1 — service down / data breach | 15 min | 4 h |
| P2 — major function down | 30 min | 8 business hours |
| P3 — degraded with workaround | 4 business hours | 3 business days |
| P4 — minor / request | 1 business day | Next release / agreed date |

## 5. Customer responsibilities
Report incidents through the service desk with steps and screenshots; manage their users' access requests; take part in UAT for
changes.

## 6. Reporting and review
Monthly service report (System Monitoring Report); quarterly service review; SLA reviewed yearly.

## 7. Exclusions
Outages of third-party systems (HR, tracker, AWS region), customer network or devices, unsupported browsers, misuse.

| Role | Name | Signature | Date |
|---|---|---|---|
| Service owner (IT) | | | |
| Business owner | | | |
