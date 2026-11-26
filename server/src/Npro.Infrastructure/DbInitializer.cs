using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Npro.Infrastructure;

/// <summary>Brings the database schema up to date and, when asked, fills an empty database with the demo organisation.</summary>
public static class DbInitializer
{
    /// <param name="useMigrations">SQL Server: apply EF migrations. Tests (SQLite): create the schema directly.</param>
    /// <param name="demoPassword">When set, an empty database gets the demo data and every demo person can sign in with this password.</param>
    public static async Task InitialiseAsync(NproDbContext db, UserManager<IdentityUser> users, ILogger logger, bool useMigrations, string? demoPassword, DateTimeOffset now)
    {
        if (useMigrations) await db.Database.MigrateAsync();
        else await db.Database.EnsureCreatedAsync();

        if (string.IsNullOrEmpty(demoPassword) || await db.People.AnyAsync()) return;

        var d = DemoData.Build(now);
        db.People.AddRange(d.Users);
        db.Divisions.AddRange(d.Divisions);
        db.Teams.AddRange(d.Teams);
        db.Vendors.AddRange(d.Vendors);
        db.Clients.AddRange(d.Clients);
        db.Workflows.AddRange(d.Workflows);
        db.Products.AddRange(d.Products);
        db.Issues.AddRange(d.Issues);
        db.WorkLogs.AddRange(d.WorkLogs);
        db.Comments.AddRange(d.Comments);
        db.Activities.AddRange(d.Activities);
        db.Roadmaps.AddRange(d.Roadmaps);
        db.Sprints.AddRange(d.Sprints);
        db.CustomFields.AddRange(d.CustomFields);
        db.AutomationRules.AddRange(d.AutomationRules);
        db.SlaPolicies.AddRange(d.SlaPolicies);
        db.SupportLevels.AddRange(d.SupportLevels);
        await db.SaveChangesAsync();

        // A sign-in account per person; the Identity user id is the nPro person id
        foreach (var p in d.Users)
        {
            var account = new IdentityUser { Id = p.Id, UserName = p.Email, Email = p.Email, EmailConfirmed = true };
            var result = await users.CreateAsync(account, demoPassword);
            if (!result.Succeeded) throw new InvalidOperationException($"Could not create the demo account for {p.Email}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
        }
        logger.LogInformation("Seeded the demo organisation ({People} people, {Issues} tickets)", d.Users.Count, d.Issues.Count);
    }
}
