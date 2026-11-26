# Backup and Restore Procedure

| | |
|---|---|
| Document ID | NPRO-BKP-001 |
| Version | 1.0 (draft) · 27 Nov 2026 |

## 1. What is backed up

| Item | Method | Frequency | Retention |
|---|---|---|---|
| SQL Server database `Npro` (FULL recovery model) | Full backup | Daily 01:00 | 35 days |
| | Transaction log backup | Hourly | 7 days |
| | Monthly full copy | Monthly | 12 months |
| Attachment files `D:\nPro\files` (18d; S3 later with versioning) | File backup / snapshot | Daily | 35 days |
| Data Protection keys `D:\nPro\keys` | File backup | Daily (encrypted) | 35 days |
| IIS site config + `web.config` | Export with the release | Each change | Last 10 versions |
| Release packages | Stored with the release | Each release | All versions |

Backups are copied off the server (S3 bucket with versioning / another region once AWS is available) and encrypted.
On RDS: automated backups with point-in-time restore (35 days) replace the SQL Agent jobs.

## 2. Backup commands (SQL Server on EC2)
```sql
ALTER DATABASE Npro SET RECOVERY FULL;
BACKUP DATABASE Npro TO DISK = N'E:\Backup\Npro_full_20261127.bak' WITH COMPRESSION, CHECKSUM, INIT;
BACKUP LOG Npro TO DISK = N'E:\Backup\Npro_log_20261127_1300.trn' WITH COMPRESSION, CHECKSUM, INIT;
-- before a deployment:
BACKUP DATABASE Npro TO DISK = N'E:\Backup\Npro_predeploy_v1_0_1.bak' WITH COPY_ONLY, COMPRESSION, CHECKSUM;
```
Schedule with SQL Server Agent (Standard edition) or Windows Task Scheduler + `sqlcmd` (Express has no Agent).

## 3. Restore (point in time)
```sql
RESTORE DATABASE Npro FROM DISK = N'E:\Backup\Npro_full_20261127.bak' WITH NORECOVERY, REPLACE;
RESTORE LOG Npro FROM DISK = N'E:\Backup\Npro_log_20261127_1300.trn' WITH NORECOVERY;
RESTORE LOG Npro FROM DISK = N'E:\Backup\Npro_log_20261127_1400.trn' WITH STOPAT = '2026-11-27T13:45:00', RECOVERY;
DBCC CHECKDB (Npro) WITH NO_INFOMSGS;
```
Then: put `app_offline.htm`, update the connection string if the server changed, remove `app_offline.htm`, smoke test.
The Identity tables are in the same database, so sign-in accounts are restored with the data.

## 4. Restore test
Monthly: restore last night's backup to a test instance, run `DBCC CHECKDB`, compare row counts (People, Products, Issues,
Activities), record the duration in the log below.

| Date | Backup restored | Duration | CHECKDB | Verified by |
|---|---|---|---|---|
| | | | | |
