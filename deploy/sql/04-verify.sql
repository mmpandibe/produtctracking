/*
  nPro — step 4 of 4: check the database is ready.
    sqlcmd -S <server> -E -b -i 04-verify.sql -v DbName="Npro"
*/
SET NOCOUNT ON;
USE [$(DbName)];
GO

PRINT '--- Migrations applied (expect Initial, EmployeeId, AttendanceRequests, SecurityFollowUps) ---';
SELECT MigrationId, ProductVersion FROM [__EFMigrationsHistory] ORDER BY MigrationId;

PRINT '--- Tables and rows ---';
SELECT t.name AS [Table], SUM(p.rows) AS [Rows]
FROM sys.tables t JOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0, 1)
GROUP BY t.name ORDER BY t.name;

PRINT '--- Database settings ---';
SELECT name, recovery_model_desc, is_read_committed_snapshot_on, snapshot_isolation_state_desc, collation_name, page_verify_option_desc
FROM sys.databases WHERE name = DB_NAME();

PRINT '--- Application user and roles ---';
SELECT u.name AS [User], r.name AS [Role]
FROM sys.database_role_members m
JOIN sys.database_principals r ON r.principal_id = m.role_principal_id
JOIN sys.database_principals u ON u.principal_id = m.member_principal_id
WHERE u.name = N'npro_app';

PRINT '--- Admins who can sign in (empty on a new database: run Npro.Api.exe create-admin) ---';
SELECT p.Name, p.Email, p.EmployeeId, CASE WHEN a.PasswordHash IS NULL THEN 'no password' ELSE 'ok' END AS [SignIn]
FROM People p LEFT JOIN AspNetUsers a ON a.Id = p.Id
WHERE p.Role = 'admin' AND p.Inactive = 0;
GO
