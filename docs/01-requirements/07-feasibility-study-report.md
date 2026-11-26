# Feasibility Study Report

| | |
|---|---|
| Document ID | NPRO-FEAS-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Summary
Building nPro in-house is **feasible**. The full user interface and the backend foundation already run in development; the
remaining work (Step 18d, testing, deployment) uses the organisation's standard platform (AWS Windows / IIS, SQL Server, .NET).
Two external dependencies — AWS access and the HR / tracker API details — affect timing, not feasibility.

## 2. Options considered

| Option | Pros | Cons | Verdict |
|---|---|---|---|
| A. Buy a SaaS tracker (e.g. a commercial issue tracker) + add-ons | Fast start | No division / vendor / client scoping as required, add-on cost per user, attendance / productivity integration and CXO summary need custom work, data outside the organisation | Rejected |
| B. Build nPro in-house on the standard platform | Fits the organisation model, roles and reports exactly; data stays in-house; one tool | Build and maintenance effort | **Selected** |
| C. Low-code platform | Quick forms | Weak for Gantt, drag-and-drop, SLA clocks, accessibility control | Rejected |

## 3. Technical feasibility
- **Proven stack**: Angular 22 + TypeScript (UI), ASP.NET Core on .NET 10 LTS (API), EF Core + SQL Server (data), IIS hosting.
- **Prototype evidence**: 17 screens built and verified; backend with sign-in, server-side access control, change sync, server
  automation; 79 Angular and 20 server tests passing; accessibility scan 0 violations.
- **Measured performance** (local baseline): read endpoints answer in 16–90 ms median; full snapshot 21 KB in ~89 ms median.
- **Risks**: in-memory change version needs a shared store for a web farm; Data Protection keys must be persisted on IIS;
  SQL Server Express limits for production.

## 4. Operational feasibility
- Runs on existing Windows / IIS skills; deployment is a folder copy plus IIS settings.
- Users need no installation (browser). Accessible and responsive for phones.

## 5. Economic feasibility (indicative)
- Licences: .NET, Angular and the npm / NuGet components are free (MIT / Apache). Costs are hosting (Windows EC2, SQL Server
  licence or RDS) and effort.
- Avoided cost: per-user SaaS licences for internal, vendor and client users, and manual report preparation time.

## 6. Legal / compliance feasibility
- Attendance, leave (incl. sick leave) and laptop productivity data are personal data, some sensitive; a DPIA is required
  before go-live (NPRO-DPIA-001).
- WCAG 2.2 AA is met in automated testing; a manual assistive-technology check remains.

## 7. Schedule feasibility
Remaining work ≈ 5–7 weeks after AWS access (see Project Plan).

## 8. Recommendation
Proceed with Option B; prioritise obtaining AWS access, the production SQL Server decision and the HR / tracker API details.
