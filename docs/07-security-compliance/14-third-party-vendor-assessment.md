# Third-Party Vendor Assessment Document

| | |
|---|---|
| Document ID | NPRO-TPVA-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Vendors and services

| Vendor / service | Use in nPro | Data shared | Criticality | Assessment | Status |
|---|---|---|---|---|---|
| Microsoft (.NET, ASP.NET Core, EF Core, SQL Server, Windows Server / IIS) | Platform | None (software); telemetry off in production recommended (`DOTNET_CLI_TELEMETRY_OPTOUT`) | High | Mature vendor, published support lifecycle, security response (MSRC) | Approved |
| Google (Angular framework) | UI framework (open source) | None | High | Open source MIT, active maintenance | Approved |
| Google Fonts (Inter via fonts.googleapis.com) | Web font | **User IP address and browser details on each load** | Low | Privacy concern under GDPR case law; easy to avoid | **Action: self-host the font** |
| npm / NuGet package authors (see Third-Party Component Register) | Libraries | None | Medium | Licences checked (MIT / Apache / ISC); monthly vulnerability scans | Approved with monitoring |
| GitHub (Microsoft) | Source code hosting (`mmpandibe/produtctracking`) | Source code, development demo password | Medium | Enable 2FA for all members, branch protection, secret scanning; confirm the repository visibility is intended | Review |
| AWS (planned) | Hosting, S3, Secrets Manager | All production data | High | ISO 27001 / SOC 2; data region choice; DPA in place via AWS terms | Pending (no access yet) |
| Laptop productivity tracker vendor (unknown) | Productivity data source | Employee activity minutes | High (privacy) | **To assess**: data collected, hosting region, security certifications, API security, DPA, retention | Pending |
| HR / attendance system vendor (unknown) | Attendance, leave | Employee attendance and leave (incl. sickness) | High (privacy) | **To assess** as above | Pending |
| AI coding assistant (development only) | Code and documentation generation | Project code and demo data | Low | No production / client data shared; see AI Model Risk Assessment | Accepted |

## 2. Assessment checklist (for new vendors)
Security certifications (ISO 27001, SOC 2 Type II) · data location and transfers · data processing agreement · encryption in transit
and at rest · access controls and MFA · incident notification terms (≤ 72 h) · sub-processors · retention and deletion at contract end ·
business continuity · financial stability · exit plan / data export.

## 3. Review
Critical vendors yearly; others every two years or on contract change.
