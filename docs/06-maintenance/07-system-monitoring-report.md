# System Monitoring Report

| | |
|---|---|
| Document ID | NPRO-MON-001 |
| Version | 1.0 (template + monitoring design) · 27 Nov 2026 |
| Status | No production data yet; the first monthly report is due one month after go-live |

## 1. What is monitored

| Signal | Source | Threshold / alert |
|---|---|---|
| Availability | ALB / external check of `GET /api/health` every minute | 2 consecutive failures → page on-call |
| Database reachable | `/api/health` → `database: up` | down → P1 |
| Response time | IIS logs / ALB target response time | p95 > 800 ms for 15 min |
| Error rate | HTTP 5xx count | > 1 % of requests for 10 min |
| Sign-in failures / lockouts | Application logs | Spike > 5× normal (possible attack) |
| Sync refusals (403) / conflicts (409) | Application logs | Unusual rise (permission or concurrency issue) |
| Timed automation | Log line "Timed automation rules ran …" / run log | No run in 24 h while rules exist → check app pool |
| CPU / memory / disk | CloudWatch agent | CPU > 80 % 15 min; free disk < 15 % |
| Backups | SQL Agent / RDS events | Any failure → P2 |
| Certificate expiry | ACM / monitoring | 30 days before expiry |

## 2. Monthly report template

| Metric | Target | Actual |
|---|---|---|
| Availability (business hours) | ≥ 99.5 % | |
| p95 response time (reads / writes) | < 500 / 800 ms | |
| 5xx error rate | < 0.5 % | |
| Incidents P1 / P2 / P3 | 0 / 0 / — | |
| Backup success / restore test | 100 % / done | |
| Security: failed sign-in spikes, lockouts | — | |
| Capacity: DB size, disk, CPU peak | — | |
| Actions for next month | | |
