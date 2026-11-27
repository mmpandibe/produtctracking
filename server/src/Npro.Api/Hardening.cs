using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;
using Npro.Infrastructure.Files;

namespace Npro.Api;

/// <summary>
/// Step 18d: security headers for every response. The CSP allows only this origin for scripts, fonts, images and API calls
/// ('unsafe-inline' for styles is needed by Angular's inline critical CSS and style bindings).
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    private const string Csp =
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; " +
        "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'";

    public Task InvokeAsync(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            var h = ctx.Response.Headers;
            h["Content-Security-Policy"] = Csp;
            h["X-Content-Type-Options"] = "nosniff";
            h["X-Frame-Options"] = "DENY";
            h["Referrer-Policy"] = "same-origin";
            h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()";
            h["Cross-Origin-Opener-Policy"] = "same-origin";
            if (ctx.Request.Path.StartsWithSegments("/api")) h["Cache-Control"] = "no-store";
            return Task.CompletedTask;
        });
        return next(ctx);
    }
}

/// <summary>What the background timer last did (for the health check)</summary>
public sealed class TimedRulesStatus
{
    public DateTimeOffset? LastRunAt { get; set; }
    public string? LastError { get; set; }
}

public static class Health
{
    /// <summary>
    /// <c>GET /api/health</c>: overall status plus each component (database, file storage, timed rules). Anonymous, so it
    /// shows only up / down — no versions, paths or errors. HTTP 503 when the database is down (load balancers drop the node).
    /// </summary>
    public static async Task<IResult> CheckAsync(NproDbContext db, IFileStore files, TimedRulesStatus timed, IConfiguration config)
    {
        var database = await db.Database.CanConnectAsync();
        var storage = await files.IsWritableAsync();
        var timedEnabled = config.GetValue("Automation:TimedRules", true);
        var timedOk = !timedEnabled || timed.LastError is null && (timed.LastRunAt is null || DateTimeOffset.Now - timed.LastRunAt < TimeSpan.FromMinutes(5));
        var status = database && storage && timedOk ? "ok" : database ? "degraded" : "down";
        return Results.Json(new
        {
            status,
            database = database ? "up" : "down",
            storage = storage ? "up" : "down",
            timedRules = !timedEnabled ? "off" : timedOk ? "up" : "late",
        }, statusCode: database ? 200 : 503);
    }
}

/// <summary>
/// Step 18d: first admin for a fresh production database (which has no demo data):
/// <c>Npro.Api.exe create-admin --name "Alex Morgan" --email alex@company.com --employee-id EMP-001</c>.
/// The password is read from the console without echo (or from the NPRO_ADMIN_PASSWORD environment variable for scripts).
/// Running it again for an existing email resets that admin's password.
/// </summary>
public static class AdminCommand
{
    public static async Task<int> RunAsync(IServiceProvider services, string[] args)
    {
        string? Arg(string name) { var i = Array.IndexOf(args, name); return i >= 0 && i + 1 < args.Length ? args[i + 1] : null; }
        var name = Arg("--name");
        var email = Arg("--email")?.Trim().ToLowerInvariant();
        var employeeId = Arg("--employee-id")?.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(employeeId))
        {
            Console.Error.WriteLine("Usage: create-admin --name \"Full Name\" --email name@company.com --employee-id EMP-001");
            return 2;
        }
        var password = Environment.GetEnvironmentVariable("NPRO_ADMIN_PASSWORD") ?? ReadPassword();
        using var scope = services.CreateScope();
        var result = await CreateAsync(scope.ServiceProvider.GetRequiredService<NproDbContext>(), scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>(), name, email, employeeId, password);
        Console.WriteLine(result);
        if (!result.StartsWith("Error", StringComparison.Ordinal))
        {
            var person = await scope.ServiceProvider.GetRequiredService<NproDbContext>().People.AsNoTracking().FirstAsync(p => p.Email == email);
            scope.ServiceProvider.GetRequiredService<SecurityEvents>().AdminCreated(person.Id, result.StartsWith("Password reset", StringComparison.Ordinal));
        }
        return result.StartsWith("Error", StringComparison.Ordinal) ? 1 : 0;
    }

    /// <summary>Creates (or resets) an internal admin with a sign-in account. Returns a message starting with "Error" on failure.</summary>
    public static async Task<string> CreateAsync(NproDbContext db, UserManager<IdentityUser> users, string name, string email, string employeeId, string password)
    {
        var validator = new PasswordValidator<IdentityUser>();
        var check = await validator.ValidateAsync(users, new IdentityUser(), password);
        if (!check.Succeeded) return "Error: " + string.Join(" ", check.Errors.Select(e => e.Description));
        var person = await db.People.FirstOrDefaultAsync(p => p.Email == email);
        if (person is null)
        {
            if (await db.People.AnyAsync(p => p.EmployeeId == employeeId)) return $"Error: employee ID {employeeId} is already used";
            person = new User { Id = Guid.NewGuid().ToString(), Name = name.Trim(), Email = email, EmployeeId = employeeId, Role = Roles.Admin, Kind = UserKinds.Internal, Color = "#f59a7e" };
            db.People.Add(person);
            await db.SaveChangesAsync();
        }
        else if (person.Role != Roles.Admin)
        {
            return $"Error: {email} exists and is not an admin; change their role in the app instead";
        }
        var account = await users.FindByIdAsync(person.Id);
        if (account is null)
        {
            account = new IdentityUser { Id = person.Id, UserName = email, Email = email, EmailConfirmed = true };
            var created = await users.CreateAsync(account, password);
            if (!created.Succeeded) return "Error: " + string.Join(" ", created.Errors.Select(e => e.Description));
            return $"Admin {email} created — sign in with this email or {person.EmployeeId}.";
        }
        if (await users.HasPasswordAsync(account)) await users.RemovePasswordAsync(account);
        var set = await users.AddPasswordAsync(account, password);
        await users.SetLockoutEndDateAsync(account, null);
        return set.Succeeded ? $"Password reset for admin {email}." : "Error: " + string.Join(" ", set.Errors.Select(e => e.Description));
    }

    private static string ReadPassword()
    {
        Console.Write("Password for the admin (min 10 chars, upper, lower, digit): ");
        var chars = new List<char>();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) break;
            if (key.Key == ConsoleKey.Backspace) { if (chars.Count > 0) chars.RemoveAt(chars.Count - 1); continue; }
            chars.Add(key.KeyChar);
        }
        Console.WriteLine();
        return new string(chars.ToArray());
    }
}

/// <summary>
/// ISO 27001 A.8.15: security-relevant events (sign-in, lockout, refused changes, access and privilege changes, rate limits)
/// written to the "Npro.Security" log category with stable event ids. Never logs passwords, tokens or the typed sign-in name
/// of unknown accounts. On Windows / IIS these reach the Windows Event Log (see appsettings.Production.json) and can be
/// shipped to the central log store from there.
/// </summary>
public sealed class SecurityEvents(ILoggerFactory factory, IHttpContextAccessor http)
{
    private readonly ILogger log = factory.CreateLogger("Npro.Security");

    private string Ip => http.HttpContext?.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public void SignedIn(string personId) => log.LogInformation(new EventId(1001, "SignIn"), "Sign-in succeeded for {PersonId} from {Ip}", personId, Ip);
    public void SignInFailed(string? personId, string reason) => log.LogWarning(new EventId(1002, "SignInFailed"), "Sign-in failed for {PersonId} from {Ip}: {Reason}", personId ?? "(unknown account)", Ip, reason);
    public void LockedOut(string personId) => log.LogWarning(new EventId(1003, "LockedOut"), "Account {PersonId} locked out after repeated failures (from {Ip})", personId, Ip);
    public void SignedOut(string? personId) => log.LogInformation(new EventId(1004, "SignOut"), "Signed out {PersonId}", personId ?? "(none)");
    public void Switched(string byPersonId, string toPersonId) => log.LogWarning(new EventId(1005, "DemoSwitch"), "Demo switcher: {By} signed in as {To} from {Ip}", byPersonId, toPersonId, Ip);
    public void PasswordSet(string byPersonId, string personId) => log.LogWarning(new EventId(1101, "PasswordSet"), "Admin {By} set the password of {PersonId}", byPersonId, personId);
    public void AdminCreated(string personId, bool reset) => log.LogWarning(new EventId(1102, "AdminCommand"), reset ? "create-admin reset the password of admin {PersonId}" : "create-admin created admin {PersonId}", personId);
    public void AccessChanged(string byPersonId, string change) => log.LogWarning(new EventId(1103, "AccessChanged"), "{By}: {Change}", byPersonId, change);
    public void Refused(string personId, string what, string reason) => log.LogWarning(new EventId(1201, "Refused"), "Refused {What} for {PersonId} from {Ip}: {Reason}", what, personId, Ip, reason);
    public void RateLimited(string path) => log.LogWarning(new EventId(1202, "RateLimited"), "Rate limit hit on {Path} from {Ip}", path, Ip);
    public void PasswordChanged(string personId) => log.LogInformation(new EventId(1007, "PasswordChanged"), "{PersonId} changed their password from {Ip}", personId, Ip);
    public void PasswordChangeFailed(string personId) => log.LogWarning(new EventId(1008, "PasswordChangeFailed"), "{PersonId} gave a wrong current password when changing it (from {Ip})", personId, Ip);
    public void AccessReviewExported(string byPersonId, int rows) => log.LogInformation(new EventId(1104, "AccessReview"), "{By} exported the access review ({Rows} people)", byPersonId, rows);
    public void RetentionRan(RetentionResult r) => log.LogInformation(new EventId(1401, "Retention"), "Retention job: {People} people anonymised, {Logs} time logs, {Leaves} leave requests, {Corrections} corrections deleted", r.PeopleAnonymised, r.TimeLogsDeleted, r.LeaveRequestsDeleted, r.CorrectionsDeleted);
    public void Decided(string byPersonId, string kind, string id, string decision) => log.LogInformation(new EventId(1301, "RequestDecided"), "{By} {Decision} {Kind} request {Id}", byPersonId, decision, kind, id);
}
