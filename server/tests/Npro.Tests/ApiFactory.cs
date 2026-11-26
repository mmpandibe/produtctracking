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
        if (disposing) connection.Dispose();
    }
}
