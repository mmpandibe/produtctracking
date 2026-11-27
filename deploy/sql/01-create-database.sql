/*
  nPro — step 1 of 4: create the database.
  Run as a sysadmin (or a login with CREATE DATABASE) with sqlcmd (or SSMS in SQLCMD mode, defining the variables first):

    sqlcmd -S <server> -E -b -i 01-create-database.sql -v DbName="Npro" DataPath="default" LogPath="default"

  DataPath / LogPath: a folder (e.g. D:\SQLData) or "default" for the instance's default folders.
  Safe to run again: creates nothing that exists and never disconnects a live system.
*/
:on error exit
SET NOCOUNT ON;

IF DB_ID(N'$(DbName)') IS NULL
BEGIN
    DECLARE @data nvarchar(400) = N'$(DataPath)', @log nvarchar(400) = N'$(LogPath)', @sql nvarchar(max);
    IF @data = N'default' SET @data = CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400));
    IF @log = N'default' SET @log = CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400));
    IF RIGHT(@data, 1) <> N'\' SET @data += N'\';
    IF RIGHT(@log, 1) <> N'\' SET @log += N'\';

    SET @sql = N'CREATE DATABASE ' + QUOTENAME(N'$(DbName)') + N'
        ON PRIMARY (NAME = N''$(DbName)'', FILENAME = N''' + @data + N'$(DbName).mdf'', SIZE = 256MB, FILEGROWTH = 128MB)
        LOG ON (NAME = N''$(DbName)_log'', FILENAME = N''' + @log + N'$(DbName)_log.ldf'', SIZE = 128MB, FILEGROWTH = 128MB)
        COLLATE SQL_Latin1_General_CP1_CI_AS;';
    BEGIN TRY
        EXEC (@sql);
    END TRY
    BEGIN CATCH
        THROW;
    END CATCH
    PRINT 'Created database $(DbName)';
END
ELSE
    PRINT 'Database $(DbName) already exists';
GO

-- FULL recovery: hourly log backups give the 1-hour recovery point in the Backup and Restore Procedure.
-- SQL Express (engine edition 4) has no SQL Agent: SIMPLE recovery plus scheduled full backups instead.
IF CAST(SERVERPROPERTY('EngineEdition') AS int) <> 4
    ALTER DATABASE [$(DbName)] SET RECOVERY FULL;
ELSE
    ALTER DATABASE [$(DbName)] SET RECOVERY SIMPLE;

-- Readers don't block writers (the API polls and reads snapshots while people save).
-- Only changed when off, so running this script again never disconnects a live system.
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'$(DbName)' AND is_read_committed_snapshot_on = 1)
    ALTER DATABASE [$(DbName)] SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'$(DbName)' AND snapshot_isolation_state = 1)
    ALTER DATABASE [$(DbName)] SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE [$(DbName)] SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE [$(DbName)] SET AUTO_UPDATE_STATISTICS_ASYNC ON;
GO

PRINT 'Step 1 done: next run 02-schema.sql against $(DbName)';
