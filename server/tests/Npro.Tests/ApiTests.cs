using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Npro.Domain;
using Npro.Infrastructure;

namespace Npro.Tests;

public class ApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private HttpClient NewClient() => factory.CreateDefaultClient(new XsrfHandler(), new Microsoft.AspNetCore.Mvc.Testing.Handlers.CookieContainerHandler());

    private static async Task<HttpClient> SignIn(HttpClient c, string email)
    {
        await c.GetAsync("/api/health"); // picks up the XSRF token, as the app does on start
        var res = await c.PostAsJsonAsync("/api/auth/login", new { email, password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        await c.GetAsync("/api/auth/me"); // fresh token for the signed-in person
        return c;
    }

    private static async Task<List<string>> IssueKeys(HttpClient c) =>
        (await c.GetFromJsonAsync<List<JsonElement>>("/api/issues"))!.Select(i => i.GetProperty("key").GetString()!).Order().ToList();

    [Fact]
    public async Task Health_is_open_and_reports_the_database()
    {
        var body = await NewClient().GetFromJsonAsync<JsonElement>("/api/health");
        Assert.Equal("up", body.GetProperty("database").GetString());
    }

    [Fact]
    public async Task Data_needs_a_signed_in_person_and_wrong_passwords_are_refused()
    {
        var c = NewClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/products")).StatusCode); // also issues the XSRF token
        var bad = await c.PostAsJsonAsync("/api/auth/login", new { email = "alex@example.com", password = "not-the-password" });
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        var unknown = await c.PostAsJsonAsync("/api/auth/login", new { email = "nobody@example.com", password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        // Employee ID sign-in: in-house people only (a client user has none), any letter case
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { login = "emp-004", password = ApiFactory.Password })).StatusCode);
        var me = await c.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("EMP-004", me.GetProperty("user").GetProperty("employeeId").GetString());
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { login = "EMP-404", password = ApiFactory.Password })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await c.GetAsync("/api/does-not-exist")).StatusCode);
    }

    [Fact]
    public async Task Me_returns_role_capabilities_and_scope_in_the_frontend_shape()
    {
        var c = await SignIn(NewClient(), "jordan@example.com");
        var me = await c.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("developer", me.GetProperty("user").GetProperty("role").GetString());
        Assert.Equal(["tickets", "time"], me.GetProperty("capabilities").EnumerateArray().Select(x => x.GetString()!).ToArray());
        Assert.True(me.GetProperty("scope").GetProperty("ownTimeOnly").GetBoolean());
        // Optional fields are left out when empty, like the Angular model
        Assert.False(me.GetProperty("user").TryGetProperty("vendorId", out _));

        await c.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Client_users_see_only_their_own_and_their_company_tickets()
    {
        var c = await SignIn(NewClient(), "dana@acme.test");
        Assert.Equal(["MOB-2", "MOB-3", "WEB-1", "WEB-2", "WEB-5"], await IssueKeys(c));
        Assert.Equal(HttpStatusCode.Forbidden, (await c.GetAsync("/api/issues/WEB-3")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.GetAsync("/api/issues/mob-3")).StatusCode);
        var org = await c.GetFromJsonAsync<JsonElement>("/api/organisation");
        Assert.Equal(["u11"], org.GetProperty("users").EnumerateArray().Select(u => u.GetProperty("id").GetString()!).ToArray());
        Assert.Equal(["Acme Corp"], org.GetProperty("clients").EnumerateArray().Select(x => x.GetProperty("name").GetString()!).ToArray());
    }

    [Fact]
    public async Task Division_heads_see_their_division_products_and_admins_see_everything()
    {
        var head = await SignIn(NewClient(), "ravi@example.com"); // Enterprise Solutions
        var products = await head.GetFromJsonAsync<List<JsonElement>>("/api/products");
        Assert.Equal(["ANL"], products!.Select(p => p.GetProperty("key").GetString()!).ToArray());

        var admin = await SignIn(NewClient(), "alex@example.com");
        Assert.Equal(10, (await IssueKeys(admin)).Count);
        var web2 = await admin.GetFromJsonAsync<JsonElement>("/api/issues/WEB-2");
        Assert.Equal("Production", web2.GetProperty("customFields").GetProperty("cf-env").GetString());
    }

    [Fact]
    public async Task Demo_switcher_signs_in_as_someone_else()
    {
        var c = await SignIn(NewClient(), "alex@example.com");
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsync("/api/auth/switch/u7", null)).StatusCode);
        var me = await c.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("Tom Becker", me.GetProperty("user").GetProperty("name").GetString());
        Assert.Equal(HttpStatusCode.NotFound, (await c.PostAsync("/api/auth/switch/nobody", null)).StatusCode);
    }
}

public class DomainTests
{
    private static readonly DemoData.Set Demo = DemoData.Build(DateTimeOffset.Now);
    private static AccessScope.Org Org => new(Demo.Users, Demo.Divisions, Demo.Teams, Demo.Products);
    private static User Person(string id) => Demo.Users.Single(u => u.Id == id);

    [Fact]
    public void Capabilities_match_the_frontend_matrix()
    {
        Assert.True(Capabilities.Can(Roles.Admin, Capabilities.Organisation));
        Assert.False(Capabilities.Can(Roles.DivisionHead, Capabilities.Organisation));
        Assert.True(Capabilities.Can(Roles.BusinessAnalyst, Capabilities.Roadmaps));
        Assert.False(Capabilities.Can(Roles.TechLead, Capabilities.Roadmaps));
        Assert.Equal([Capabilities.Tickets], Capabilities.Of(Roles.ProductionUser));
    }

    [Fact]
    public void Access_scope_follows_the_organisation()
    {
        var head = AccessScope.For(Person("u2"), Org); // Priya, Digital Products
        Assert.Equal(["p1", "p2"], head.ProductIds.Order().ToArray());
        Assert.Contains("u13", head.UserIds); // Service Desk is in her division

        var am = AccessScope.For(Person("u6"), Org); // Meera manages t1, t2, t4
        Assert.Contains("u9", am.UserIds);
        Assert.DoesNotContain("u10", am.UserIds); // vendor dev on Analytics only

        Assert.Equal(["u13", "u3", "u4", "u8", "u9"], AccessScope.ReportsOf("u6", Demo.Users).Select(u => u.Id).Order().ToArray());
    }

    [Fact]
    public void Workflow_transitions_follow_the_same_rules_as_the_ui()
    {
        var wf = DemoData.DefaultWorkflow();
        Assert.True(wf.CanTransition("new", "live")); // rules off
        wf.Transitions["new"] = ["dev"];
        Assert.True(wf.CanTransition("new", "dev"));
        Assert.False(wf.CanTransition("new", "live"));
        Assert.True(wf.CanTransition("dev", "live")); // no entry = any move
        Assert.False(wf.CanTransition("dev", "missing"));
    }
}
