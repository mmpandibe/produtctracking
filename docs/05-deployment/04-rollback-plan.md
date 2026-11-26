# Rollback Plan

| | |
|---|---|
| Document ID | NPRO-RB-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. Rollback triggers
Within the deployment window or the first 24 hours: health check down > 5 minutes, sign-in failing, data errors, critical defect
without a quick fix, error rate > 5 % of requests. Decision: release manager with product owner (IT may roll back immediately if
the service is down).

## 2. Application rollback (no breaking migration)
1. Place `app_offline.htm` in `D:\nPro\site`.
2. Restore the previous version from `D:\nPro\releases\<previous-version>` (keep the current `web.config` environment settings).
3. Remove `app_offline.htm`; verify `GET /api/health` and the smoke test.
Expected duration: 10 minutes.

## 3. Database rollback
- EF Core migrations in this project are additive; the previous application version usually runs on the newer schema.
- If a migration must be undone: `dotnet ef database update <PreviousMigration>` (uses the migration's `Down`) after a backup, or
- **Restore** the `COPY_ONLY` backup taken before deployment (Backup and Restore Procedure). Data entered since the deployment is
  lost — announce and record it.

## 4. Configuration rollback
Environment settings are versioned in the Environment Configuration record; restore the previous values and recycle the app pool.

## 5. After rollback
Incident record, root-cause analysis, fix and re-test before the next attempt; inform users.
