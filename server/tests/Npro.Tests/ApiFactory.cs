using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Npro.Infrastructure;

namespace Npro.Tests;

/// <summary>Runs the real API in memory on a private SQLite database seeded with the demo organisation.</summary>
public sealed class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "Test-password-1";
    private readonly SqliteConnection connection = new("DataSource=:memory:");
    /// <summary>Attachment files of this test run (deleted afterwards)</summary>
    public string FilesRoot { get; } = Path.Combine(Path.GetTempPath(), "npro-tests-" + Guid.NewGuid().ToString("N"));

    public ApiFactory() => connection.Open();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureAppConfiguration(c => c.AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["Seed:DemoPassword"] = Password,
            ["Features:DemoSwitcher"] = "true",
            ["ConnectionStrings:Npro"] = "unused",
            ["Automation:TimedRules"] = "false", // tests call TimedRulesService.RunOnceAsync directly
            ["Storage:Disk:Root"] = FilesRoot,
            ["Retention:Enabled"] = "false", // ComplianceTests runs the job directly
            ["RateLimits:LoginPerMinute"] = "10000", // tests sign in often; HardeningTests checks the limit itself
        }));
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<NproDbContext>>();
            services.RemoveAll<IDbContextOptionsConfiguration<NproDbContext>>();
            services.AddDbContext<NproDbContext>(o => o.UseSqlite(connection));
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            connection.Dispose();
            try { if (Directory.Exists(FilesRoot)) Directory.Delete(FilesRoot, recursive: true); } catch (IOException) { }
        }
    }
}
