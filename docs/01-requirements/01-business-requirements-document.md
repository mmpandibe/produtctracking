# Business Requirement Document (BRD)

| | |
|---|---|
| Product | nPro — product delivery, support and time tracking |
| Document ID | NPRO-BRD-001 |
| Version | 1.0 (draft) |
| Date | 27 Nov 2026 |
| Status | Draft for review |
| Owner | [Product owner] |
| Approvers | [Head of delivery], [IT / infrastructure lead], [Information security officer] |

## 1. Purpose

This document records **why** nPro is being built and **what the business needs from it**, independent of technology. It is the
source for the PRD (product scope), the SRS (detailed requirements) and the Requirement Traceability Matrix.

## 2. Background and problem statement

The organisation builds and supports several software products for clients, using internal teams organised by division and team,
plus external vendor teams. Today the work is spread across separate tools and spreadsheets:

- Ticket tracking does not reflect the internal structure (division → team → people) or vendor staff.
- Support requests (L1 / L2 / L3) have no consistent SLA measurement or escalation path.
- Roadmaps, sprints and dates live in slide decks and spreadsheets; there is no single Gantt view per product.
- Hours logged against work cannot be compared with attendance (punch in / out, leave) or laptop productivity data.
- Management summaries for leadership (weekly / monthly) are assembled by hand.
- Production users and clients have no self-service way to raise tickets and follow their status.

## 3. Business objectives

| ID | Objective | Measure of success |
|---|---|---|
| BO-1 | One system of record for product delivery and support | All active products, tickets, sprints and roadmaps tracked in nPro within 3 months of go-live |
| BO-2 | Measurable support quality | SLA response / resolution met % reported per level, product and client; breaches visible the same day |
| BO-3 | Transparent planning | Every product has a roadmap and sprint plan visible on a Gantt timeline |
| BO-4 | Effort visibility | Logged vs productive vs attended hours visible per person and team each week |
| BO-5 | Less manual reporting | Weekly and monthly CXO summary produced from live data in minutes, not hours |
| BO-6 | Controlled access | People see only the products, people and data their role allows; checked by the server |
| BO-7 | Inclusive product | WCAG 2.2 AA conformance for all screens |

## 4. Stakeholders

| Stakeholder | Interest |
|---|---|
| Leadership (CXO) | Weekly / monthly summaries, roadmap status, risks |
| Division heads | Their division's products and people, full rights on those products |
| Assistant managers | Their products and the people reporting to them |
| Business analysts | Roadmaps, sprints, tickets and reports on assigned products |
| Tech leads | Sprints, tickets, reports |
| Developers and testers | Their tickets, time logging, leave and attendance |
| Production users (internal) and client users | Raise tickets, follow status |
| Vendor companies and their staff | Work on assigned products only |
| Support desk (L1 / L2 / L3) | Queues, SLA clocks, escalation |
| IT / infrastructure | Hosting on AWS Windows / IIS, MS SQL Server, backups |
| Information security / data protection | Access control, personal data, retention |
| HR | Attendance, leave and productivity data (external systems) |

## 5. Business requirements

| ID | Business requirement | Priority |
|---|---|---|
| BR-01 | Track products, tickets, boards, backlogs, sprints and roadmaps in one tool for internal, vendor and client users | Must |
| BR-02 | Configure the organisation: divisions, teams, members, vendors, clients and their users | Must |
| BR-03 | Role-based access for 8 roles (admin, division head, assistant manager, business analyst, tech lead, developer, tester, production user) with scoped visibility | Must |
| BR-04 | Support desk with L1 / L2 / L3 levels, SLA targets, clocks, breach flags and escalation | Must |
| BR-05 | Gantt chart per product and a roadmap timeline across products | Must |
| BR-06 | Time tracking, plus productive hours (laptop tracker) and attendance (punches, sick / casual leave, regularisation) from external systems, shown on developer and manager dashboards | Must |
| BR-07 | Product-wise and client-wise reports and a weekly / monthly CXO summary that can be exported | Must |
| BR-08 | Configurable workflows (statuses, allowed transitions) and custom fields | Should |
| BR-09 | Automation of routine ticket handling ("when X, if Y, then Z") | Should |
| BR-10 | Hosting on AWS Windows servers under IIS, with MS SQL Server and a .NET backend | Must |
| BR-11 | Accessibility: WCAG 2.2 Level AA | Must |
| BR-12 | Real sign-in (email or employee ID), server-side authorisation, protection of personal data | Must |

## 6. Scope

**In scope:** web application (desktop and mobile browsers), .NET API, SQL Server database, demo / offline mode, integration
adapters for the laptop productivity tracker and the attendance / leave system, deployment to IIS.

**Out of scope (this release):** native mobile apps, e-mail / chat notifications, billing or invoicing, single sign-on
(planned), file storage on S3 (planned, needs AWS access), live connection to the HR and tracker APIs (needs their API details).

## 7. Assumptions and constraints

- Hosting: AWS Windows Server with IIS; database MS SQL Server; backend .NET 10 (LTS, supported to Nov 2028).
- External productivity / attendance APIs are not yet specified; the product ships with sample-data adapters until they are.
- One IIS worker process per site in the first release (the live-update version counter is in memory).
- Users have current Chrome, Edge, Firefox or Safari.

## 8. Business risks (summary)

See the Risk Assessment Document (NPRO-RISK-001). Main risks: unknown external API contracts, employee-monitoring data and
privacy obligations, single-server hosting, and adoption by vendor and client users.

## 9. Approval

| Role | Name | Signature | Date |
|---|---|---|---|
| Product owner | | | |
| Head of delivery | | | |
| IT / infrastructure lead | | | |
| Information security officer | | | |
