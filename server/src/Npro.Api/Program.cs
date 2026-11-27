using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Api;
using Npro.Infrastructure;
using Npro.Infrastructure.Files;

var builder = WebApplication.CreateBuilder(args);
var config = builder.Configuration;

// ---------- Database (MS SQL Server) ----------
// Development: .\SQLEXPRESS with Windows auth (appsettings.Development.json).
// Production: set ConnectionStrings__Npro in the server environment / secret store — never commit it.
builder.Services.AddDbContext<NproDbContext>(o =>
    o.UseSqlServer(config.GetConnectionString("Npro"), sql => sql.EnableRetryOnFailure()));

// ---------- Data Protection (protects the sign-in cookie and XSRF tokens) ----------
// Step 18d: keys are kept in a folder so an IIS app-pool recycle or restart doesn't sign everyone out.
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("nPro");
var keysPath = config["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(keysPath))
{
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(keysPath));
    if (OperatingSystem.IsWindows()) dataProtection.ProtectKeysWithDpapi(protectToLocalMachine: true);
}

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

// ---------- Rate limits (Step 18d) ----------
// Sign-in: 10 tries a minute per client address (on top of the per-account lockout). Writes: 300 a minute per person.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.OnRejected = (ctx, _) =>
    {
        ctx.HttpContext.RequestServices.GetRequiredService<SecurityEvents>().RateLimited(ctx.HttpContext.Request.Path);
        return ValueTask.CompletedTask;
    };
    o.AddPolicy("login", ctx => RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = config.GetValue("RateLimits:LoginPerMinute", 10), Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
    o.AddPolicy("writes", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.User.Identity?.Name ?? ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = config.GetValue("RateLimits:WritesPerMinute", 300), Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});

// ---------- Behind a load balancer / reverse proxy ----------
// Hosting:TrustForwardedHeaders = true when the load balancer / proxy sets X-Forwarded-For / -Proto.
builder.Services.Configure<ForwardedHeadersOptions>(o =>
{
    o.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    o.KnownIPNetworks.Clear();
    o.KnownProxies.Clear();
});
builder.Services.AddHsts(o => { o.MaxAge = TimeSpan.FromDays(365); o.IncludeSubDomains = true; });

// ---------- Files (Step 18d) ----------
// Storage:Disk:Root = folder outside the website (production e.g. D:\nPro\files). Default: App_Data\files.
builder.Services.AddSingleton<IFileStore>(sp =>
{
    var root = sp.GetRequiredService<IConfiguration>()["Storage:Disk:Root"];
    return new DiskFileStore(string.IsNullOrWhiteSpace(root) ? Path.Combine(builder.Environment.ContentRootPath, "App_Data", "files") : root);
});

builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<RequestAccess>();
builder.Services.AddSingleton<SecurityEvents>();
// Step 18c: data version for polling browsers + timed automation rules every minute
builder.Services.AddSingleton<ChangeFeed>();
builder.Services.AddSingleton<TimedRulesStatus>();
builder.Services.AddHostedService<TimedRulesService>();
// ISO 27001 A.8.10: daily retention job (Retention:* settings)
builder.Services.AddHostedService<RetentionService>();
builder.Services.AddProblemDetails();
builder.Services.ConfigureHttpJsonOptions(o =>
{
    // Same JSON shape as the Angular model: camelCase, optional fields left out when empty
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    o.SerializerOptions.Converters.Add(new UtcDateConverter());
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
        demoPassword: config["Seed:DemoPassword"],
        now: DateTimeOffset.Now,
        // Production with a least-privilege database login: schema changes come from deploy/sql/02-schema.sql instead
        migrateOnStartup: config.GetValue("Database:MigrateOnStartup", true));
}

// Step 18d: `Npro.Api.exe create-admin …` sets up the first admin of a fresh database, then exits
if (args.Length > 0 && args[0] == "create-admin")
{
    Environment.ExitCode = await AdminCommand.RunAsync(app.Services, args);
    return;
}

if (!app.Environment.IsDevelopment())
{
    if (!string.IsNullOrEmpty(config["Seed:DemoPassword"])) app.Logger.LogWarning("Seed:DemoPassword is set outside Development: demo accounts exist. Clear it for production.");
    if (config.GetValue<bool>("Features:DemoSwitcher")) app.Logger.LogWarning("Features:DemoSwitcher is on outside Development. Turn it off for production.");
    if (string.IsNullOrWhiteSpace(keysPath)) app.Logger.LogWarning("DataProtection:KeysPath is not set: users are signed out whenever the app restarts.");
}

if (config.GetValue<bool>("Hosting:TrustForwardedHeaders")) app.UseForwardedHeaders();
app.UseExceptionHandler();
if (!app.Environment.IsDevelopment()) app.UseHsts();
if (config.GetValue<bool>("Hosting:HttpsRedirect")) app.UseHttpsRedirection();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseStatusCodePages();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();
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
