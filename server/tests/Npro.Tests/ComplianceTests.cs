using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npro.Api;
using Npro.Infrastructure;

namespace Npro.Tests;

/// <summary>ISO 27001 follow-ups: password change (A.5.17), access review (A.5.18), retention (A.8.10).</summary>
public class ComplianceTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    public ComplianceTests(ApiFactory factory) => this.factory = factory;

    private async Task<(HttpClient Client, HttpStatusCode Status)> TrySignIn(string login, string password)
    {
        var c = factory.CreateDefaultClient(new XsrfHandler(), new CookieContainerHandler());
        await c.GetAsync("/api/health");
        var res = await c.PostAsJsonAsync("/api/auth/login", new { login, password });
        if (res.IsSuccessStatusCode) await c.GetAsync("/api/auth/me");
        return (c, res.StatusCode);
    }

    private async Task<HttpClient> SignIn(string login, string password = ApiFactory.Password)
    {
        var (c, status) = await TrySignIn(login, password);
        Assert.Equal(HttpStatusCode.OK, status);
        return c;
    }

    private static Task<HttpResponseMessage> ChangePassword(HttpClient c, string current, string next) =>
        c.PostAsJsonAsync("/api/auth/password", new { currentPassword = current, newPassword = next });

    private static async Task<Dictionary<string, JsonElement>> Person(HttpClient c, string id)
    {
        var state = await c.GetFromJsonAsync<JsonElement>("/api/state");
        var p = state.GetProperty("users").EnumerateArray().First(u => u.GetProperty("id").GetString() == id);
        return JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(p.GetRawText())!;
    }

    private static Task<HttpResponseMessage> SavePerson(HttpClient c, Dictionary<string, JsonElement> person) =>
        c.PostAsJsonAsync("/api/sync", new { changes = new[] { new { collection = "users", op = "upsert", id = person["id"].GetString(), data = person } } });

    [Fact]
    public async Task People_change_their_own_password()
    {
        var lena = await SignIn("lena@example.com");
        Assert.Equal(HttpStatusCode.BadRequest, (await ChangePassword(lena, "Not-my-password-1", "New-password-123")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ChangePassword(lena, ApiFactory.Password, ApiFactory.Password)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await ChangePassword(lena, ApiFactory.Password, "weak")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await ChangePassword(lena, ApiFactory.Password, "New-password-123")).StatusCode);
        // This browser stays signed in; the old password no longer works
        Assert.Equal(HttpStatusCode.OK, (await lena.GetAsync("/api/state")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await TrySignIn("lena@example.com", ApiFactory.Password)).Status);
        await SignIn("EMP-008", "New-password-123");
    }

    [Fact]
    public async Task An_admin_set_password_must_be_replaced_before_using_nPro()
    {
        var alex = await SignIn("alex@example.com");
        Assert.Equal(HttpStatusCode.NoContent, (await alex.PostAsJsonAsync("/api/people/u9/password", new { password = "Temporary-pass-1" })).StatusCode);

        var chris = await SignIn("chris@example.com", "Temporary-pass-1");
        var me = await chris.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.True(me.GetProperty("user").GetProperty("mustChangePassword").GetBoolean());
        var blocked = await chris.GetAsync("/api/state");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("new password", await blocked.Content.ReadAsStringAsync());

        // Nobody can clear the flag through sync, not even an admin
        var person = await Person(alex, "u9");
        person["mustChangePassword"] = JsonSerializer.SerializeToElement(false);
        person["title"] = JsonSerializer.SerializeToElement("QA lead");
        Assert.Equal(HttpStatusCode.OK, (await SavePerson(alex, person)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await chris.GetAsync("/api/state")).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent, (await ChangePassword(chris, "Temporary-pass-1", "Chris-own-pass-9")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await chris.GetAsync("/api/state")).StatusCode);
        Assert.False((await chris.GetFromJsonAsync<JsonElement>("/api/auth/me")).GetProperty("user").GetProperty("mustChangePassword").GetBoolean());
    }

    [Fact]
    public async Task Admins_export_the_access_review()
    {
        await SignIn("jordan@example.com");
        var alex = await SignIn("alex@example.com");
        var review = await alex.GetFromJsonAsync<JsonElement>("/api/access-review");
        var rows = review.GetProperty("rows").EnumerateArray().ToList();
        Assert.Equal(13, rows.Count);
        var jordan = rows.Single(r => r.GetProperty("id").GetString() == "u4");
        Assert.Equal("developer", jordan.GetProperty("role").GetString());
        Assert.Contains("WEB", jordan.GetProperty("products").GetString());
        Assert.True(jordan.GetProperty("canSignIn").GetBoolean());
        Assert.True(jordan.TryGetProperty("lastSignInAt", out _));
        Assert.Equal("All products", rows.Single(r => r.GetProperty("id").GetString() == "u1").GetProperty("products").GetString());
        Assert.Equal("Nimbus", rows.Single(r => r.GetProperty("id").GetString() == "u10").GetProperty("company").GetString()?.Split(' ')[0]);

        var dev = await SignIn("jordan@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await dev.GetAsync("/api/access-review")).StatusCode);
    }

    [Fact]
    public async Task Retention_anonymises_old_leavers_and_deletes_expired_records()
    {
        var alex = await SignIn("alex@example.com");
        var neha = await Person(alex, "u12");
        neha["inactive"] = JsonSerializer.SerializeToElement(true);
        Assert.Equal(HttpStatusCode.OK, (await SavePerson(alex, neha)).StatusCode);
        Assert.True((await Person(alex, "u12")).ContainsKey("deactivatedAt"));

        var scopes = factory.Services.GetRequiredService<IServiceScopeFactory>();
        var options = new RetentionOptions(LegalHold: false, DeactivatedUserYears: 2, TimeLogYears: 7, AttendanceMonths: 13);
        Assert.Null(await RetentionService.RunOnceAsync(scopes, options with { LegalHold = true }, DateTimeOffset.Now.AddYears(10)));

        // Next year: nothing is old enough for people; attendance requests from the demo are not 13 months old either
        var soon = await RetentionService.RunOnceAsync(scopes, options, DateTimeOffset.Now.AddMonths(6));
        Assert.Equal(0, soon!.PeopleAnonymised);
        Assert.Equal(0, soon.TimeLogsDeleted);

        // Three years on: Neha is anonymised (her account removed); attendance requests are past 13 months
        var later = await RetentionService.RunOnceAsync(scopes, options, DateTimeOffset.Now.AddYears(3));
        Assert.Equal(1, later!.PeopleAnonymised);
        Assert.True(later.LeaveRequestsDeleted > 0);
        Assert.Equal(0, later.TimeLogsDeleted);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<NproDbContext>();
            var p = await db.People.AsNoTracking().SingleAsync(x => x.Id == "u12");
            Assert.StartsWith("Former user", p.Name);
            Assert.EndsWith("@deleted.invalid", p.Email);
            Assert.Null(p.EmployeeId);
            Assert.NotNull(p.AnonymisedAt);
            Assert.Empty(await db.LeaveRequests.ToListAsync());
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await TrySignIn("neha@example.com", ApiFactory.Password)).Status);

        // Eight years on: time logs past the 7-year period go too
        var much = await RetentionService.RunOnceAsync(scopes, options, DateTimeOffset.Now.AddYears(8));
        Assert.True(much!.TimeLogsDeleted > 0);
        Assert.Equal(0, much.PeopleAnonymised); // already done
    }
}
