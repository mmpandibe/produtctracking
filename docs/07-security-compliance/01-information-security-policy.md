# Information Security Policy — nPro

| | |
|---|---|
| Document ID | NPRO-ISP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Owner | [Information security officer] |
| Applies to | The nPro application, its data, environments and everyone who builds, operates or uses it |
| Alignment | ISO/IEC 27001:2022 Annex A controls (see Statement of Applicability NPRO-ISO-001), OWASP ASVS L2 |

## 1. Principles
Least privilege, need-to-know, defence in depth, secure by default, accountability.

## 2. Policy statements

| # | Area | Requirement |
|---|---|---|
| 1 | Classification | Ticket, client and employee data (attendance, leave, productivity) are **Confidential**; credentials are **Restricted** |
| 2 | Access | Accounts are personal; roles assigned by admins on approval of the line manager; vendor and client accounts limited to assigned products / own company; reviewed quarterly; leavers deactivated on their last day |
| 3 | Authentication | Passwords ≥ 10 chars with upper, lower case and a digit; lockout after 5 failures; no shared accounts; SSO with MFA to be adopted |
| 4 | Administration | Admin role limited to named people; production server access via SSM / jump host with MFA; no direct database edits except through approved change |
| 5 | Secrets | No secrets in source control or tickets; stored in the server environment / secret store; rotated yearly and on staff change |
| 6 | Secure development | Development Standards, Code Review Checklist, automated tests for every authorisation rule, dependency scans monthly |
| 7 | Encryption | TLS 1.2+ in transit; encryption at rest for database and backups (Encryption Standards) |
| 8 | Logging | Security-relevant events logged (sign-in failures, lockouts, refused changes); logs retained 12 months; no passwords / tokens in logs |
| 9 | Vulnerabilities | Managed per the Vulnerability Management Procedure and patch timelines |
| 10 | Incidents | Reported immediately to the service desk; handled per the Incident Management process; breaches assessed for notification within 72 h |
| 11 | Backups and continuity | Per Backup and Restore Procedure, DR and BCP |
| 12 | Suppliers | Third parties assessed before use (Third-Party Vendor Assessment) |
| 13 | Acceptable use | nPro used for business purposes only; no sensitive personal data (health details, passwords) in ticket text or comments |
| 14 | Demo features | Demo data and the "sign in as" switcher are never enabled in production |

## 3. Compliance and exceptions
Exceptions require written approval of the information security officer with an expiry date. Non-compliance may lead to access
removal. Policy reviewed yearly.
