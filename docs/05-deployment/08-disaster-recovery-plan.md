# Disaster Recovery Plan

| | |
|---|---|
| Document ID | NPRO-DRP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |
| Objectives | **RPO 1 hour** (with hourly log backups; 24 h if only daily backups) · **RTO 4 hours** |

## 1. Scenarios

| Scenario | Impact | Recovery |
|---|---|---|
| App server lost (EC2 failure, corruption) | Service down | Rebuild from AMI / script, deploy last package, point ALB |
| Database server lost / corrupted | Service down, possible data loss | Restore latest full + log backups to a new instance; update connection string |
| Bad release / data corruption by a bug | Wrong data | Rollback Plan; point-in-time restore to a copy and repair |
| Region / AZ outage | Service down | Restore backups (copied to a second region) in another AZ / region |
| Ransomware / compromise | Integrity, confidentiality | Isolate, rebuild clean servers, restore backups taken before the compromise, rotate all secrets, incident process |

## 2. Prerequisites
- Daily full + hourly log backups, copied to separate storage (S3 with versioning / another region when AWS is available).
- Server build documented (Infrastructure, Deployment Plan); ideally an AMI or script.
- Release packages and configuration records retained.
- Contact list and escalation path (Incident Management).

## 3. Recovery procedure (database loss example)
1. Declare a disaster (delivery head / IT lead); inform users.
2. Provision SQL Server (same version); restore the last full backup `WITH NORECOVERY`, then log backups, last `WITH RECOVERY`.
3. Run `DBCC CHECKDB`; verify row counts of key tables against the last known values.
4. Update `ConnectionStrings__Npro`; recycle the app pool; smoke test.
5. Announce recovery and any data window lost; record the incident.

## 4. Testing
DR test twice a year (restore to a separate instance, timed against the RTO); results recorded here.

| Date | Scenario tested | RTO achieved | Issues |
|---|---|---|---|
| | | | |
