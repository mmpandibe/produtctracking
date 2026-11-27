using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Npro.Api;
using Npro.Infrastructure;
using Npro.Infrastructure.Files;

namespace Npro.Tests;

/// <summary>Step 18d: attachment files, attendance on the server, security headers, rate limits and the first-admin command.</summary>
public class Step18dTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    public Step18dTests(ApiFactory factory) => this.factory = factory;

    private async Task<HttpClient> SignIn(string login, string password = ApiFactory.Password)
    {
        var c = factory.CreateDefaultClient(new XsrfHandler(), new CookieContainerHandler());
        await c.GetAsync("/api/health");
        var res = await c.PostAsJsonAsync("/api/auth/login", new { login, password });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        await c.GetAsync("/api/auth/me");
        return c;
    }

    private static Task<HttpResponseMessage> Upload(HttpClient c, string issueId, byte[] bytes, string name = "notes.txt", string? id = null)
    {
        var form = new MultipartFormDataContent();
        if (id is not null) form.Add(new StringContent(id), "id");
        form.Add(new StringContent(issueId), "issueId");
        var file = new ByteArrayContent(bytes);
        file.Headers.ContentType = new MediaTypeHeaderValue("text/plain");
        form.Add(file, "file", name);
        return c.PostAsync("/api/attachments", form);
    }

    private static Task<HttpResponseMessage> Sync(HttpClient c, params object[] changes) => c.PostAsJsonAsync("/api/sync", new { changes });

    private static JsonElement Find(JsonElement state, string collection, string id) =>
        state.GetProperty(collection).EnumerateArray().FirstOrDefault(x => x.GetProperty("id").GetString() == id);

    // ---------- Attachments ----------

    [Fact]
    public async Task Upload_download_and_delete_an_attachment()
    {
        var jordan = await SignIn("jordan@example.com");
        var bytes = "hello from WEB-2"u8.ToArray();
        var res = await Upload(jordan, "i2", bytes, "..\\..\\evil<name>.txt", id: "att-18d-1");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        var body = await res.Content.ReadFromJsonAsync<JsonElement>();
        var changes = body.GetProperty("changes").EnumerateArray().ToList();
        Assert.Equal(["attachments", "activities"], changes.Select(c => c.GetProperty("collection").GetString()!).ToArray());
        var record = changes[0].GetProperty("data");
        Assert.Equal("att-18d-1", record.GetProperty("id").GetString());
        Assert.Equal("evil<name>.txt", record.GetProperty("name").GetString()); // no path parts
        Assert.False(record.TryGetProperty("storageKey", out _)); // server-only

        // The ticket's people can download it; always as a download, never rendered
        var file = await jordan.GetAsync("/api/attachments/att-18d-1/content");
        Assert.Equal(HttpStatusCode.OK, file.StatusCode);
        Assert.Equal(bytes, await file.Content.ReadAsByteArrayAsync());
        Assert.Equal("application/octet-stream", file.Content.Headers.ContentType?.MediaType);
        Assert.Equal("attachment", file.Content.Headers.ContentDisposition?.DispositionType);

        // A vendor developer who only works on Analytics can't see WEB tickets or their files
        var vikram = await SignIn("vikram@nimbus.test");
        Assert.Equal(HttpStatusCode.Forbidden, (await vikram.GetAsync("/api/attachments/att-18d-1/content")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Upload(vikram, "i2", bytes)).StatusCode);

        // Deleting the record through sync removes the stored file once the batch is saved
        var store = factory.Services.GetRequiredService<IFileStore>();
        Assert.True(Directory.EnumerateFiles(factory.FilesRoot, "att-18d-1", SearchOption.AllDirectories).Any());
        var deleted = await Sync(jordan, new { collection = "attachments", op = "delete", id = "att-18d-1" });
        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        Assert.False(Directory.EnumerateFiles(factory.FilesRoot, "att-18d-1", SearchOption.AllDirectories).Any());
        Assert.Equal(HttpStatusCode.NotFound, (await jordan.GetAsync("/api/attachments/att-18d-1/content")).StatusCode);
        Assert.True(await store.IsWritableAsync());
    }

    [Fact]
    public async Task A_client_cannot_point_an_attachment_at_someone_elses_file()
    {
        var jordan = await SignIn("jordan@example.com");
        Assert.Equal(HttpStatusCode.OK, (await Upload(jordan, "i2", "secret"u8.ToArray(), id: "att-18d-2")).StatusCode);
        var key = Directory.EnumerateFiles(factory.FilesRoot, "att-18d-2", SearchOption.AllDirectories).Single();
        var storageKey = Path.GetRelativePath(factory.FilesRoot, key).Replace('\\', '/');

        // A record made through sync with a storageKey of its own gets none: the server owns that field
        var forged = new { id = "att-18d-3", issueId = "i2", name = "copy.txt", size = 6, type = "text/plain", uploadedBy = "u4", storageKey, createdAt = DateTimeOffset.Now };
        Assert.Equal(HttpStatusCode.OK, (await Sync(jordan, new { collection = "attachments", op = "upsert", id = "att-18d-3", data = forged })).StatusCode);
        var res = await jordan.GetAsync("/api/attachments/att-18d-3/content");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);

        // Renaming the real one through sync keeps its file
        var renamed = new { id = "att-18d-2", issueId = "i2", name = "renamed.txt", size = 6, type = "text/plain", uploadedBy = "u4", createdAt = DateTimeOffset.Now };
        Assert.Equal(HttpStatusCode.OK, (await Sync(jordan, new { collection = "attachments", op = "upsert", id = "att-18d-2", data = renamed })).StatusCode);
        Assert.Equal("secret", await jordan.GetStringAsync("/api/attachments/att-18d-2/content"));
    }

    [Fact]
    public async Task Uploads_over_10_MB_are_refused()
    {
        var jordan = await SignIn("jordan@example.com");
        var res = await Upload(jordan, "i2", new byte[AttachmentEndpoints.MaxBytes + 1]);
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Disk_store_rejects_keys_outside_its_folder()
    {
        var store = new DiskFileStore(factory.FilesRoot);
        await Assert.ThrowsAnyAsync<ArgumentException>(() => store.SaveAsync("../outside.txt", new MemoryStream([1])));
        await Assert.ThrowsAnyAsync<ArgumentException>(() => store.SaveAsync("C:/Windows/x.txt", new MemoryStream([1])));
        Assert.Null(await store.OpenReadAsync("missing/file"));
    }

    // ---------- Attendance ----------

    /// <summary>A Wednesday well ahead of the demo requests</summary>
    private static string FutureWednesday(int weeksAhead)
    {
        var d = DateTime.Today.AddDays(7 * weeksAhead);
        while (d.DayOfWeek != DayOfWeek.Wednesday) d = d.AddDays(1);
        return d.ToString("yyyy-MM-dd");
    }

    private static string Monday()
    {
        var d = DateTime.Today;
        while (d.DayOfWeek != DayOfWeek.Monday) d = d.AddDays(-1);
        return d.ToString("yyyy-MM-dd");
    }

    [Fact]
    public async Task Attendance_is_scoped_like_the_ui()
    {
        var from = Monday();
        var to = DateTime.Parse(from).AddDays(6).ToString("yyyy-MM-dd");
        var jordan = await SignIn("jordan@example.com");
        var mine = await jordan.GetFromJsonAsync<JsonElement>($"/api/attendance?from={from}&to={to}");
        Assert.Equal("sample", mine.GetProperty("providers").GetProperty("attendance").GetString());
        Assert.Equal(["u4"], mine.GetProperty("days").EnumerateArray().Select(d => d.GetProperty("userId").GetString()!).Distinct().ToArray());
        Assert.InRange(mine.GetProperty("days").GetArrayLength(), 1, 7); // days up to today
        Assert.Single(mine.GetProperty("balances").EnumerateArray());

        var alex = await SignIn("alex@example.com");
        var all = await alex.GetFromJsonAsync<JsonElement>($"/api/attendance?from={from}&to={to}");
        var people = all.GetProperty("days").EnumerateArray().Select(d => d.GetProperty("userId").GetString()!).Distinct().ToList();
        Assert.Contains("u10", people); // vendor staff are tracked
        Assert.DoesNotContain("u11", people); // client users are not
        Assert.True(all.GetProperty("leaves").GetArrayLength() > 0); // demo requests

        Assert.Equal(HttpStatusCode.BadRequest, (await alex.GetAsync("/api/attendance?from=2026-01-01&to=2026-06-01")).StatusCode);
        var dana = await SignIn("dana@acme.test");
        Assert.Equal(0, (await dana.GetFromJsonAsync<JsonElement>($"/api/attendance?from={from}&to={to}")).GetProperty("days").GetArrayLength());
    }

    [Fact]
    public async Task Leave_is_applied_approved_by_a_manager_and_shared()
    {
        var day = FutureWednesday(20);
        var jordan = await SignIn("jordan@example.com");
        var applied = await jordan.PostAsJsonAsync("/api/attendance/leave", new { type = "casual", from = day, to = day, halfDay = false, reason = "Family event" });
        Assert.Equal(HttpStatusCode.OK, applied.StatusCode);
        var id = (await applied.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;

        var overlap = await jordan.PostAsJsonAsync("/api/attendance/leave", new { type = "sick", from = day, to = day, reason = "Again" });
        Assert.Equal(HttpStatusCode.BadRequest, overlap.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await jordan.PostAsJsonAsync($"/api/attendance/leave/{id}/decide", new { decision = "approved" })).StatusCode);

        // A peer can't decide; Jordan's manager's manager (Meera) can, once
        var chris = await SignIn("chris@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await chris.PostAsJsonAsync($"/api/attendance/leave/{id}/decide", new { decision = "approved" })).StatusCode);
        var meera = await SignIn("meera@example.com");
        Assert.Equal(HttpStatusCode.NoContent, (await meera.PostAsJsonAsync($"/api/attendance/leave/{id}/decide", new { decision = "approved" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await meera.PostAsJsonAsync($"/api/attendance/leave/{id}/decide", new { decision = "rejected" })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await jordan.PostAsync($"/api/attendance/leave/{id}/cancel", null)).StatusCode);

        // Everyone who can see Jordan sees the same decision
        var from = DateTime.Parse(day).AddDays(-2).ToString("yyyy-MM-dd");
        var view = await meera.GetFromJsonAsync<JsonElement>($"/api/attendance?from={from}&to={day}");
        var leave = Find(view, "leaves", id);
        Assert.Equal("approved", leave.GetProperty("status").GetString());
        Assert.Equal("u6", leave.GetProperty("decidedBy").GetString());
        var jordansDay = view.GetProperty("days").EnumerateArray().First(d => d.GetProperty("userId").GetString() == "u4" && d.GetProperty("date").GetString() == day);
        Assert.Equal("leave", jordansDay.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Pending_requests_can_be_withdrawn_and_corrections_are_for_past_days()
    {
        var day = FutureWednesday(24);
        var chris = await SignIn("chris@example.com");
        var applied = await chris.PostAsJsonAsync("/api/attendance/leave", new { type = "sick", from = day, to = day, halfDay = true, reason = "Appointment" });
        var id = (await applied.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetString()!;
        var jordan = await SignIn("jordan@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await jordan.PostAsync($"/api/attendance/leave/{id}/cancel", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await chris.PostAsync($"/api/attendance/leave/{id}/cancel", null)).StatusCode);

        var future = await chris.PostAsJsonAsync("/api/attendance/regularisation", new { date = day, punchIn = DateTimeOffset.Now, punchOut = DateTimeOffset.Now.AddHours(8), reason = "x" });
        Assert.Equal(HttpStatusCode.BadRequest, future.StatusCode);
        var past = DateTime.Today.AddDays(-30);
        while (past.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday) past = past.AddDays(-1);
        var start = new DateTimeOffset(past.AddHours(9));
        var ok = await chris.PostAsJsonAsync("/api/attendance/regularisation", new { date = past.ToString("yyyy-MM-dd"), punchIn = start, punchOut = start.AddHours(9), reason = "Card reader down" });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var again = await chris.PostAsJsonAsync("/api/attendance/regularisation", new { date = past.ToString("yyyy-MM-dd"), punchIn = start, punchOut = start.AddHours(9), reason = "Twice" });
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
    }

    // ---------- Hardening ----------

    [Fact]
    public async Task Responses_carry_security_headers_and_health_details()
    {
        var c = factory.CreateClient();
        var res = await c.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        Assert.Contains("default-src 'self'", res.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Contains("frame-ancestors 'none'", res.Headers.GetValues("Content-Security-Policy").Single());
        Assert.Equal("nosniff", res.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("DENY", res.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("same-origin", res.Headers.GetValues("Referrer-Policy").Single());
        var health = await res.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal("ok", health.GetProperty("status").GetString());
        Assert.Equal("up", health.GetProperty("storage").GetString());
        Assert.Equal("off", health.GetProperty("timedRules").GetString());
    }

    [Fact]
    public async Task Sign_in_is_rate_limited_per_address()
    {
        using var limited = factory.WithWebHostBuilder(b => b.ConfigureAppConfiguration(c => c.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimits:LoginPerMinute"] = "3" })));
        var c = limited.CreateDefaultClient(new XsrfHandler(), new CookieContainerHandler());
        await c.GetAsync("/api/health");
        var codes = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++) codes.Add((await c.PostAsJsonAsync("/api/auth/login", new { login = "nobody@example.com", password = "wrong-password" })).StatusCode);
        Assert.Equal([HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.Unauthorized, HttpStatusCode.TooManyRequests], codes);
    }

    [Fact]
    public async Task Create_admin_makes_a_first_admin_who_can_sign_in()
    {
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<NproDbContext>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
            Assert.StartsWith("Error", await AdminCommand.CreateAsync(db, users, "Weak", "weak@example.com", "EMP-901", "short"));
            Assert.StartsWith("Error", await AdminCommand.CreateAsync(db, users, "Jordan", "jordan@example.com", "EMP-902", "Strong-pass-123"));
            Assert.StartsWith("Error", await AdminCommand.CreateAsync(db, users, "Clash", "clash@example.com", "EMP-004", "Strong-pass-123"));
            Assert.StartsWith("Admin", await AdminCommand.CreateAsync(db, users, "First Admin", "first@example.com", "EMP-900", "Strong-pass-123"));
            Assert.StartsWith("Password reset", await AdminCommand.CreateAsync(db, users, "First Admin", "first@example.com", "EMP-900", "Strong-pass-456"));
        }
        var c = await SignIn("emp-900", "Strong-pass-456");
        var me = await c.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("admin", me.GetProperty("user").GetProperty("role").GetString());
    }
}
