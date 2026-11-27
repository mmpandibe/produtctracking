using System.Globalization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;

namespace Npro.Api;

public sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);

/// <summary>
/// ISO 27001 follow-ups: self-service password change (A.5.17), the access-review export (A.5.18) and the retention job
/// (A.8.10, A.5.34) that applies the Data Retention and Deletion Policy (NPRO-DRD-001).
/// </summary>
public static class Compliance
{
    public static void MapCompliance(this RouteGroupBuilder api)
    {
        // Change your own password. Also how a person with an admin-set password (MustChangePassword) gets into nPro.
        api.MapPost("/auth/password", async (ChangePasswordRequest req, RequestAccess access, UserManager<IdentityUser> users, SignInManager<IdentityUser> signIn, NproDbContext db, SecurityEvents audit) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            var current = req.CurrentPassword ?? "";
            var next = req.NewPassword ?? "";
            if (next.Length == 0) return Results.Problem("Enter a new password", statusCode: 400);
            if (next == current) return Results.Problem("Choose a password different from the current one", statusCode: 400);
            var account = await users.FindByIdAsync(me.Id);
            if (account is null) return Results.Problem("Your account has no password yet. Ask an admin to set one.", statusCode: 400);
            if (!await users.CheckPasswordAsync(account, current))
            {
                await users.AccessFailedAsync(account); // counts towards the lockout like a failed sign-in
                audit.PasswordChangeFailed(me.Id);
                return Results.Problem("Your current password is wrong", statusCode: 400);
            }
            var result = await users.ChangePasswordAsync(account, current, next);
            if (!result.Succeeded) return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)), statusCode: 400);
            await db.People.Where(p => p.Id == me.Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.MustChangePassword, false));
            // The security stamp changed: re-issue this browser's cookie (other sessions end at their next check)
            await signIn.RefreshSignInAsync(account);
            audit.PasswordChanged(me.Id);
            return Results.NoContent();
        }).AddEndpointFilter<RequirePerson>().RequireRateLimiting("login");

        // Quarterly access review (Information Security Policy §2): everyone's role, organisation, scope and sign-in state
        api.MapGet("/access-review", async (RequestAccess access, NproDbContext db, UserManager<IdentityUser> users, SecurityEvents audit) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            if (!Capabilities.Can(me.Role, Capabilities.Organisation)) return Results.Problem("Only admins can run the access review", statusCode: 403);
            var people = await db.People.AsNoTracking().ToListAsync();
            var org = new AccessScope.Org(people, await db.Divisions.AsNoTracking().ToListAsync(), await db.Teams.AsNoTracking().ToListAsync(), await db.Products.AsNoTracking().ToListAsync());
            var products = org.Products.ToDictionary(p => p.Id);
            var teams = org.Teams.ToDictionary(t => t.Id, t => t.Name);
            var vendors = await db.Vendors.AsNoTracking().ToDictionaryAsync(v => v.Id, v => v.Name);
            var clients = await db.Clients.AsNoTracking().ToDictionaryAsync(c => c.Id, c => c.Name);
            var accounts = await users.Users.AsNoTracking().ToDictionaryAsync(a => a.Id);
            var now = DateTimeOffset.Now;
            var rows = people.Where(p => p.AnonymisedAt is null).OrderBy(p => p.Name).Select(p =>
            {
                var scope = AccessScope.For(p, org);
                accounts.TryGetValue(p.Id, out var account);
                return new
                {
                    p.Id, p.Name, p.Email, p.EmployeeId, p.Kind, p.Role,
                    company = p.VendorId is not null ? vendors.GetValueOrDefault(p.VendorId) : p.ClientId is not null ? clients.GetValueOrDefault(p.ClientId) : null,
                    team = p.TeamId is not null ? teams.GetValueOrDefault(p.TeamId) : null,
                    manager = p.ManagerId is not null ? people.FirstOrDefault(m => m.Id == p.ManagerId)?.Name : null,
                    status = p.Inactive ? "deactivated" : "active",
                    products = scope.All ? "All products" : string.Join("; ", scope.ProductIds.Select(id => products.GetValueOrDefault(id)?.Key ?? id).Order()),
                    canSignIn = !p.Inactive && account is not null && account.PasswordHash is not null,
                    p.MustChangePassword,
                    lockedOut = account?.LockoutEnd is { } end && end > now,
                    p.LastSignInAt,
                    p.DeactivatedAt,
                };
            }).ToList();
            audit.AccessReviewExported(me.Id, rows.Count);
            return Results.Json(new { generatedAt = now, generatedBy = me.Id, rows }, Sync.Json);
        }).AddEndpointFilter<RequirePerson>();
    }
}

/// <summary>What the retention job does (configuration <c>Retention:*</c>; periods from NPRO-DRD-001)</summary>
public sealed record RetentionOptions(bool LegalHold, int DeactivatedUserYears, int TimeLogYears, int AttendanceMonths)
{
    public static RetentionOptions From(IConfiguration c) => new(
        c.GetValue("Retention:LegalHold", false),
        c.GetValue("Retention:DeactivatedUserYears", 2),
        c.GetValue("Retention:TimeLogYears", 7),
        c.GetValue("Retention:AttendanceMonths", 13));
}

public sealed record RetentionResult(int PeopleAnonymised, int TimeLogsDeleted, int LeaveRequestsDeleted, int CorrectionsDeleted)
{
    public bool Any => PeopleAnonymised + TimeLogsDeleted + LeaveRequestsDeleted + CorrectionsDeleted > 0;
}

/// <summary>
/// Daily retention job: anonymises people deactivated longer than the retention period (their tickets and time stay, shown
/// as "Former user"), deletes time logs past the billing / audit period and attendance requests past 13 months.
/// <c>Retention:LegalHold</c> = true pauses all deletion; <c>Retention:Enabled</c> = false switches the job off.
/// </summary>
public sealed class RetentionService(IServiceScopeFactory scopes, IConfiguration config, ChangeFeed feed, SecurityEvents audit, ILogger<RetentionService> log) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("Retention:Enabled", true)) return;
        try { await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken); } catch (OperationCanceledException) { return; }
        using var timer = new PeriodicTimer(TimeSpan.FromHours(24));
        do
        {
            try
            {
                var result = await RunOnceAsync(scopes, RetentionOptions.From(config), DateTimeOffset.Now, stoppingToken);
                if (result is null) continue;
                audit.RetentionRan(result);
                if (result.Any) feed.Bump();
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Retention job failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>One pass (also used by tests). Null when a legal hold is on.</summary>
    public static async Task<RetentionResult?> RunOnceAsync(IServiceScopeFactory scopes, RetentionOptions options, DateTimeOffset now, CancellationToken ct = default)
    {
        if (options.LegalHold) return null;
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NproDbContext>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

        // People deactivated longer than the period: replace direct identifiers, remove the sign-in account and HR requests
        var personCutoff = now.AddYears(-options.DeactivatedUserYears);
        var due = (await db.People.Where(p => p.Inactive && p.AnonymisedAt == null && p.DeactivatedAt != null).ToListAsync(ct))
            .Where(p => p.DeactivatedAt < personCutoff).ToList();
        foreach (var p in due)
        {
            var tag = p.Id.Length > 6 ? p.Id[..6] : p.Id;
            p.Name = $"Former user {tag}";
            p.Email = $"former-{p.Id}@deleted.invalid";
            p.EmployeeId = null;
            p.Title = null;
            p.Phone = null;
            p.Color = "#9ca3af";
            p.AnonymisedAt = now;
            var account = await users.FindByIdAsync(p.Id);
            if (account is not null) await users.DeleteAsync(account);
        }
        var anonymisedIds = due.Select(p => p.Id).ToHashSet();

        // Time logs past the retention period (SQLite can't compare DateTimeOffset in SQL, so filter in memory)
        var logCutoff = now.AddYears(-options.TimeLogYears);
        var oldLogs = (await db.WorkLogs.ToListAsync(ct)).Where(w => w.StartedAt < logCutoff).ToList();
        db.WorkLogs.RemoveRange(oldLogs);

        // Attendance requests older than the period (by the last day they cover), and all requests of anonymised people
        var dayCutoff = now.AddMonths(-options.AttendanceMonths).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
        var leaves = await db.LeaveRequests.Where(l => string.Compare(l.To, dayCutoff) < 0 || anonymisedIds.Contains(l.PersonId)).ToListAsync(ct);
        var corrections = await db.RegularisationRequests.Where(r => string.Compare(r.Date, dayCutoff) < 0 || anonymisedIds.Contains(r.PersonId)).ToListAsync(ct);
        db.LeaveRequests.RemoveRange(leaves);
        db.RegularisationRequests.RemoveRange(corrections);

        await db.SaveChangesAsync(ct);
        return new RetentionResult(due.Count, oldLogs.Count, leaves.Count, corrections.Count);
    }
}
