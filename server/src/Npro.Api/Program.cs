using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Api;
using Npro.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// ---------- Database (MS SQL Server) ----------
// Development: .\SQLEXPRESS with Windows auth (appsettings.Development.json).
// Production on AWS: set ConnectionStrings__Npro from AWS Secrets Manager / Parameter Store — never commit it.
builder.Services.AddDbContext<NproDbContext>(o =>
    o.UseSqlServer(builder.Configuration.GetConnectionString("Npro"), sql => sql.EnableRetryOnFailure()));

// ---------- Sign-in: ASP.NET Core Identity with a same-site cookie ----------
builder.Services.AddAuthentication(IdentityConstants.ApplicationScheme).AddIdentityCookies();
builder.Services.AddIdentityCore<IdentityUser>(o =>
    {
        o.User.RequireUniqueEmail = true;
        o.Password.RequiredLength = 10;
        o.Password.RequireNonAlphanumeric = false;
        o.Lockout.MaxFailedAccessAttempts = 5;
        o.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
    })
    .AddEntityFrameworkStores<NproDbContext>()
    .AddSignInManager();
builder.Services.ConfigureApplicationCookie(o =>
{
    o.Cookie.Name = "npro.auth";
    o.Cookie.HttpOnly = true;
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = true;
    // An API answers 401 / 403 instead of redirecting to a login page
    o.Events.OnRedirectToLogin = ctx => { ctx.Response.StatusCode = StatusCodes.Status401Unauthorized; return Task.CompletedTask; };
    o.Events.OnRedirectToAccessDenied = ctx => { ctx.Response.StatusCode = StatusCodes.Status403Forbidden; return Task.CompletedTask; };
});
builder.Services.AddAuthorization();

// XSRF: cookie sign-in needs a second proof on every write. Reads get a readable XSRF-TOKEN cookie; Angular-style clients
// send it back in the X-XSRF-TOKEN header, which another site cannot do.
builder.Services.AddAntiforgery(o =>
{
    o.HeaderName = "X-XSRF-TOKEN";
    o.Cookie.Name = "npro.af";
    o.Cookie.SameSite = SameSiteMode.Strict;
    o.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<RequestAccess>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    // Same JSON shape as the Angular model: camelCase, optional fields left out when empty
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

var app = builder.Build();

// ---------- Schema + demo data ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<NproDbContext>();
    await DbInitializer.InitialiseAsync(
        db,
        scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>(),
        app.Logger,
        useMigrations: db.Database.IsSqlServer(),
        demoPassword: app.Configuration["Seed:DemoPassword"],
        now: DateTimeOffset.Now);
}

app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<XsrfMiddleware>();

app.MapNproApi();
// Unknown /api/... paths are a 404, not the Angular page
app.MapFallback("/api/{**rest}", () => Results.NotFound());

// IIS: the Angular build is published into wwwroot and served by the same site (no CORS needed)
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("{*path:nonfile}", "index.html");

app.Run();

/// <summary>Visible to the integration tests (WebApplicationFactory)</summary>
public partial class Program;
