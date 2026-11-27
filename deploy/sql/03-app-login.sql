/*
  nPro — step 3 of 4: the login the web application uses (least privilege).
  Run as a sysadmin after 02-schema.sql. Pass the values as environment variables (sqlcmd reads them as scripting
  variables; "-v" can't carry a name with a space and a backslash such as IIS APPPOOL\nPro). Pick ONE mode:

  A) Windows authentication (recommended) — the IIS application pool identity:
       SQL Server on the web server:  IIS APPPOOL\nPro   (create the IIS app pool first: setup-iis.ps1)
       separate SQL Server (domain):  DOMAIN\WEBSERVER$ (computer account) or a gMSA DOMAIN\svc-npro$
     PowerShell:
       $env:DbName = 'Npro'; $env:LoginName = 'IIS APPPOOL\nPro'; $env:AuthMode = 'windows'; $env:Password = 'none'; $env:AllowDdl = 'no'
       sqlcmd -S <server> -E -b -i 03-app-login.sql

  B) SQL authentication (no domain, e.g. Amazon RDS for SQL Server):
       $env:DbName = 'Npro'; $env:LoginName = 'npro_app'; $env:AuthMode = 'sql'; $env:AllowDdl = 'no'
       $env:Password = Read-Host 'Password for npro_app'
       sqlcmd -S <server> -E -b -i 03-app-login.sql; Remove-Item Env:Password
     The password then goes only into the server's connection string (environment variable) — never into source control.

  Rights: read + write data only; the app runs with Database__MigrateOnStartup=false and an admin applies 02-schema.sql for
  each release. AllowDdl="yes" lets the app change the schema itself at start-up instead.
  Safe to run again.
*/
:on error exit
SET NOCOUNT ON;
USE [master];
GO

IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'$(LoginName)')
BEGIN
    DECLARE @sql nvarchar(max);
    IF N'$(AuthMode)' = N'windows'
        SET @sql = N'CREATE LOGIN ' + QUOTENAME(N'$(LoginName)') + N' FROM WINDOWS WITH DEFAULT_DATABASE = ' + QUOTENAME(N'$(DbName)');
    ELSE IF N'$(AuthMode)' = N'sql'
    BEGIN
        IF LEN(N'$(Password)') < 12 THROW 50001, 'Give the SQL login a password of at least 12 characters (-v Password=...)', 1;
        SET @sql = N'CREATE LOGIN ' + QUOTENAME(N'$(LoginName)') + N' WITH PASSWORD = N''' + REPLACE(N'$(Password)', N'''', N'''''')
                 + N''', DEFAULT_DATABASE = ' + QUOTENAME(N'$(DbName)') + N', CHECK_POLICY = ON, CHECK_EXPIRATION = OFF';
    END
    ELSE THROW 50002, 'AuthMode must be windows or sql', 1;
    BEGIN TRY
        EXEC (@sql);
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
    PRINT 'Created login $(LoginName)';
END
ELSE
    PRINT 'Login $(LoginName) already exists';
GO

USE [$(DbName)];
GO
IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'npro_app')
BEGIN
    DECLARE @sql nvarchar(max) = N'CREATE USER [npro_app] FOR LOGIN ' + QUOTENAME(N'$(LoginName)') + N' WITH DEFAULT_SCHEMA = [dbo]';
    EXEC (@sql);
    PRINT 'Created database user npro_app';
END
GO

ALTER ROLE [db_datareader] ADD MEMBER [npro_app];
ALTER ROLE [db_datawriter] ADD MEMBER [npro_app];
IF N'$(AllowDdl)' = N'yes'
BEGIN
    ALTER ROLE [db_ddladmin] ADD MEMBER [npro_app];
    PRINT 'npro_app may also change the schema (Database:MigrateOnStartup can stay true)';
END
GO

PRINT 'Step 3 done: npro_app can read and write nPro data. Next: 04-verify.sql';
