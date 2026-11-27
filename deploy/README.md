# nPro deployment kit

Everything needed to install nPro by hand on a Windows Server with IIS and SQL Server. The full step-by-step guide is
**`docs/05-deployment/09-manual-aws-deployment-guide.docx`** (NPRO-DEP-009). `scripts/publish.ps1` zips this folder as
`publish/nPro-<stamp>-deploy-kit.zip` next to the release package.

| File | Run where / as | Purpose |
|---|---|---|
| `sql/01-create-database.sql` | SQL Server, sysadmin | Create the `Npro` database (FULL recovery, read-committed snapshot) |
| `sql/02-schema.sql` | SQL Server, database owner, **every release** | Create / upgrade all tables (idempotent EF Core migrations script) |
| `sql/03-app-login.sql` | SQL Server, sysadmin | Login for the website (app pool identity or SQL login) → user `npro_app`, read/write only |
| `sql/04-verify.sql` | SQL Server | Migrations, tables, settings, app roles, admins |
| `sql/generate-schema.ps1` | Build machine | Regenerate `02-schema.sql` after adding a migration |
| `setup-iis.ps1` | Web server, Administrator, once | IIS role, folders and rights, app pool (AlwaysRunning), site, production settings |
| `deploy-release.ps1` | Web server, Administrator, every release | Offline → backup → unpack → online → health check; `-Rollback` |

Quick order on a new server (PowerShell; sqlcmd reads `$env:` values as scripting variables):

```powershell
$env:DbName = 'Npro'; $env:DataPath = 'default'; $env:LogPath = 'default'; $S = 'localhost'
sqlcmd -S $S -E -b -i sql\01-create-database.sql
sqlcmd -S $S -E -b -I -d Npro -i sql\02-schema.sql
.\setup-iis.ps1 -ConnectionString 'Server=localhost;Database=Npro;Trusted_Connection=True;Encrypt=True;TrustServerCertificate=True'
$env:LoginName = 'IIS APPPOOL\nPro'; $env:AuthMode = 'windows'; $env:Password = 'none'; $env:AllowDdl = 'no'
sqlcmd -S $S -E -b -i sql\03-app-login.sql
sqlcmd -S $S -E -b -W -i sql\04-verify.sql
.\deploy-release.ps1 -Package C:\Install\nPro-<stamp>.zip
```

Then create the first admin from `D:\nPro\site` with `Npro.Api.exe create-admin` (guide section 6.2).

The SQL scripts were tested end to end on SQL Server Express (new database, re-run, least-privilege checks). The IIS scripts
were syntax-checked only; run them first on a test instance.
