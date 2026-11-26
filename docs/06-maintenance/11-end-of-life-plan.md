# End-of-Life (EOL) Plan

| | |
|---|---|
| Document ID | NPRO-EOL-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Component end-of-life watch

| Component | Version | End of support | Action |
|---|---|---|---|
| .NET | 10 LTS | Nov 2028 | Upgrade to the next LTS (.NET 12) during 2028 |
| Angular | 22 | ~18 months after release | Yearly major upgrade |
| SQL Server | 2022 | Mainstream 2028, extended 2033 | Plan upgrade before mainstream end |
| Windows Server | 2022 | Mainstream Oct 2026 (extended Oct 2031) | Security updates continue; plan move to Windows Server 2025 |
| Node.js (build only) | 24 LTS | Apr 2028 | Move to the next LTS |
| lucide, Tailwind, other npm packages | current | — | Monthly review |

## 2. Retiring nPro features
Announce at least one release ahead; provide a data export (CSV) where data would become inaccessible; remove code and data
according to the Data Retention and Deletion Policy.

## 3. Retiring nPro (whole product)
| Phase | Activities | Notice |
|---|---|---|
| Decision | Business case, replacement chosen | — |
| Announce | Inform users, clients and vendors; freeze new features | ≥ 6 months |
| Migrate | Export products, tickets, comments, time, attachments (CSV / JSON / files); import into the replacement; verify counts | 3 months |
| Read-only | nPro set to read-only for reference | 3 months |
| Archive & delete | Final database backup kept per retention policy (encrypted); then secure deletion of databases, files, backups; decommission servers; revoke credentials and certificates | — |
| Close | Sign-off by product owner, IT, data protection officer | — |

## 4. Data handling at end of life
Personal data (people, attendance, leave, productivity) deleted or anonymised unless a legal retention duty applies; evidence of
deletion recorded.
