using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;

namespace Npro.Api;

/// <summary><c>Login</c> is a work email or, for in-house employees, an employee ID (<c>Email</c> is accepted too)</summary>
public sealed record LoginRequest(string? Login, string? Email, string Password);

/// <summary>Who is signed in, what their role allows and what they can see (drives the Angular menu and pages)</summary>
public sealed record MeResponse(User User, IReadOnlyList<string> Capabilities, ScopeDto Scope, FeaturesDto Features);

public sealed record FeaturesDto(bool DemoSwitcher);

public sealed record ScopeDto(bool All, IEnumerable<string> ProductIds, IEnumerable<string> UserIds, bool OwnTicketsOnly, bool OwnTimeOnly)
{
    public static ScopeDto From(AccessScope s) => new(s.All, s.ProductIds.Order(), s.UserIds.Order(), s.OwnTicketsOnly, s.OwnTimeOnly);
}

public sealed record OrganisationResponse(List<Division> Divisions, List<Team> Teams, List<Vendor> Vendors, List<User> Users, List<Client> Clients);

/// <summary>Step 18a endpoints: health, sign-in, and read access to the organisation, products and tickets.</summary>
public static class Endpoints
{
    public static void MapNproApi(this WebApplication app)
    {
        var api = app.MapGroup("/api");

        api.MapGet("/health", async (NproDbContext db) => Results.Ok(new { status = "ok", database = await db.Database.CanConnectAsync() ? "up" : "down" }))
            .AllowAnonymous();

        // ---------- Sign-in ----------
        var auth = api.MapGroup("/auth");

        auth.MapPost("/login", async (LoginRequest req, SignInManager<IdentityUser> signIn, NproDbContext db) =>
        {
            var login = (req.Login ?? req.Email ?? "").Trim();
            var byEmployeeId = !login.Contains('@');
            var employeeId = login.ToUpperInvariant();
            var person = byEmployeeId
                ? await db.People.AsNoTracking().FirstOrDefaultAsync(p => p.EmployeeId == employeeId && p.Kind == UserKinds.Internal)
                : await db.People.AsNoTracking().FirstOrDefaultAsync(p => p.Email == login);
            var email = person?.Email ?? login;
            // Same answer for unknown email, wrong password and deactivated people, so accounts can't be probed
            if (person is null || person.Inactive) return Results.Problem("Wrong email, employee ID or password", statusCode: 401);
            var result = await signIn.PasswordSignInAsync(email, req.Password ?? "", isPersistent: false, lockoutOnFailure: true);
            if (result.IsLockedOut) return Results.Problem("Too many attempts. Try again in a few minutes.", statusCode: 423);
            return result.Succeeded ? Results.Ok(new { person.Id }) : Results.Problem("Wrong email, employee ID or password", statusCode: 401);
        }).AllowAnonymous();

        auth.MapPost("/logout", async (SignInManager<IdentityUser> signIn) =>
        {
            await signIn.SignOutAsync();
            return Results.NoContent();
        });

        auth.MapGet("/me", async (RequestAccess access, IConfiguration config) =>
        {
            var a = (await access.GetAsync())!.Value;
            return Results.Ok(new MeResponse(a.Me, Capabilities.Of(a.Me.Role), ScopeDto.From(a.Scope), new FeaturesDto(config.GetValue<bool>("Features:DemoSwitcher"))));
        }).AddEndpointFilter<RequirePerson>();

        // Demo "Sign in as" switcher from Phase A. Off unless Features:DemoSwitcher is true (never in production).
        auth.MapPost("/switch/{userId}", async (string userId, IConfiguration config, SignInManager<IdentityUser> signIn, UserManager<IdentityUser> users, NproDbContext db) =>
        {
            if (!config.GetValue<bool>("Features:DemoSwitcher")) return Results.NotFound();
            var person = await db.People.AsNoTracking().FirstOrDefaultAsync(p => p.Id == userId);
            var account = await users.FindByIdAsync(userId);
            if (person is null || person.Inactive || account is null) return Results.NotFound();
            await signIn.SignInAsync(account, isPersistent: false);
            return Results.Ok(new { person.Id });
        }).AddEndpointFilter<RequirePerson>();

        // ---------- Read: organisation, products, tickets ----------
        var data = api.MapGroup("").AddEndpointFilter<RequirePerson>();

        data.MapGet("/organisation", async (RequestAccess access, NproDbContext db) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            var people = await db.People.AsNoTracking().OrderBy(p => p.Name).ToListAsync();
            var clients = await db.Clients.AsNoTracking().OrderBy(c => c.Name).ToListAsync();
            var products = await db.Products.AsNoTracking().ToListAsync();
            if (!scope.All)
            {
                people = people.Where(p => scope.UserIds.Contains(p.Id)).ToList();
                // Same rule as the UI: client users see their own company, others the clients of their products
                var clientIds = me.ClientId is not null
                    ? new HashSet<string> { me.ClientId }
                    : products.Where(p => scope.ProductIds.Contains(p.Id)).SelectMany(p => p.ClientIds).ToHashSet();
                clients = clients.Where(c => clientIds.Contains(c.Id)).ToList();
            }
            return Results.Ok(new OrganisationResponse(
                await db.Divisions.AsNoTracking().OrderBy(d => d.Name).ToListAsync(),
                await db.Teams.AsNoTracking().OrderBy(t => t.Name).ToListAsync(),
                await db.Vendors.AsNoTracking().OrderBy(v => v.Name).ToListAsync(),
                people,
                clients));
        });

        data.MapGet("/products", async (RequestAccess access, NproDbContext db) =>
        {
            var (_, scope) = (await access.GetAsync())!.Value;
            var products = await db.Products.AsNoTracking().OrderBy(p => p.Name).ToListAsync();
            return Results.Ok(scope.All ? products : products.Where(p => scope.ProductIds.Contains(p.Id)).ToList());
        });

        data.MapGet("/issues", async (string? productId, string? q, RequestAccess access, NproDbContext db) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            var query = db.Issues.AsNoTracking().AsQueryable();
            if (!scope.All)
            {
                var visible = scope.ProductIds.ToList();
                query = query.Where(i => visible.Contains(i.ProductId));
                if (scope.OwnTicketsOnly) query = query.Where(i => i.ReporterId == me.Id || (me.ClientId != null && i.ClientId == me.ClientId));
            }
            if (!string.IsNullOrWhiteSpace(productId)) query = query.Where(i => i.ProductId == productId);
            if (!string.IsNullOrWhiteSpace(q))
            {
                var text = q.Trim();
                query = query.Where(i => i.Key.Contains(text) || i.Summary.Contains(text));
            }
            // Sorted after loading: SQL Server could sort, but SQLite (tests) cannot order by DateTimeOffset
            return Results.Ok((await query.ToListAsync()).OrderByDescending(i => i.UpdatedAt).ToList());
        });

        data.MapGet("/issues/{key}", async (string key, RequestAccess access, NproDbContext db) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            var issue = await db.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Key == key.ToUpper());
            if (issue is null) return Results.NotFound();
            return scope.CanSee(issue, me) ? Results.Ok(issue) : Results.Problem("You don't have access to this ticket", statusCode: 403);
        });

        data.MapSync();
    }
}
