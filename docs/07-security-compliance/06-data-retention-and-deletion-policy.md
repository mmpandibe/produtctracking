# Data Retention and Deletion Policy

| | |
|---|---|
| Document ID | NPRO-DRD-001 |
| Version | 1.0 (draft — periods to be confirmed by Legal / DPO) · 27 Nov 2026 |

## 1. Retention schedule

| Data | Retention | After retention | Mechanism |
|---|---|---|---|
| Active user accounts | While active | — | — |
| Deactivated users | 2 years after deactivation | Anonymise name / email / employee ID ("Former user <id>"), remove the sign-in account and their leave / correction requests; keep work records | Daily `RetentionService` |
| Tickets, comments, history, attachments | Product lifetime + 5 years | Delete or archive with the product | Admin deletes product; archive export |
| Time logs | 7 years (billing / audit evidence) | Delete | Daily `RetentionService` |
| Leave and correction requests (attendance) | 13 months after the last day covered | Delete | Daily `RetentionService` |
| Attendance / productivity cache (if introduced) | 13 months | Delete | Scheduled job |
| Automation run log | Latest 300 runs | Rolling deletion | Built in (`LogLimit`) |
| Application / security logs | 12 months | Delete | Log store lifecycle |
| Database backups | 35 days (daily), 12 months (monthly) | Expire | Backup tooling |
| Offline demo data (browser) | Until the user clears site data | — | User |

## 2. Deletion methods
- Application deletes use the API (history rules: people with tickets / time can only be deactivated, not deleted).
- Anonymisation replaces direct identifiers; aggregates remain.
- Backups expire naturally; restored backups re-apply deletions recorded in the deletion log.
- Storage media disposed via the cloud provider's secure deletion; on-premises disks wiped (NIST 800-88).

## 3. Legal holds
Retention may be extended for a legal hold approved by Legal; recorded with reason and end date.

## 4. Requests for erasure
Handled by the DPO within one month; where records must be kept (e.g. time logs for billing), restrict processing and anonymise
where possible.

## 5. Implementation
The daily `RetentionService` (API) applies the periods above; settings `Retention:Enabled`, `Retention:LegalHold` (true pauses
all deletion), `Retention:DeactivatedUserYears`, `Retention:TimeLogYears`, `Retention:AttendanceMonths`. Each run is logged as
security event 1401 with counts. People deactivated before this release start their 2-year period on the release date.
