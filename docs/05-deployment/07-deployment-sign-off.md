# Deployment Sign-off

| | |
|---|---|
| Document ID | NPRO-DSO-001 |
| Version | 1.0 (template) |
| Status | To be completed for each production deployment |

| Field | Value |
|---|---|
| Release version / tag | |
| Commit hash | |
| Environment | Production |
| Deployment window (start – end) | |
| Deployed by | |
| Package checksum (SHA-256) | |
| Migrations applied | |
| Database backup reference (pre-deployment) | |

## Verification

| Check | Result | By |
|---|---|---|
| `GET /api/health` = ok / database up | | |
| Sign-in with email and employee ID | | |
| Smoke test (Regression report §4) | | |
| Timed rules running (log line or automation run log) | | |
| No errors in logs for 30 minutes | | |
| Demo switcher returns 404; no demo accounts | | |

## Issues during deployment

| Issue | Action | Status |
|---|---|---|
| | | |

## Decision
☐ Deployment accepted · ☐ Accepted with follow-ups · ☐ Rolled back (see Rollback Plan)

| Role | Name | Signature | Date / time |
|---|---|---|---|
| Release manager | | | |
| IT / infrastructure | | | |
| Product owner | | | |
