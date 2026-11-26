using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.Extensions.DependencyInjection;
using Npro.Api;

namespace Npro.Tests;

/// <summary>Step 18c: ticket numbers, automation and timed rules run on the server; the browser gets the changes back.</summary>
public class ServerRulesTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private async Task<HttpClient> SignIn(string login)
    {
        var c = factory.CreateDefaultClient(new XsrfHandler(), new CookieContainerHandler());
        await c.GetAsync("/api/health");
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { login, password = ApiFactory.Password })).StatusCode);
        await c.GetAsync("/api/auth/me");
        return c;
    }

    private static object Upsert(string collection, string id, object data) => new { collection, op = "upsert", id, data };

    private static async Task<JsonElement> Sync(HttpClient c, params object[] changes)
    {
        var res = await c.PostAsJsonAsync("/api/sync", new { changes });
        Assert.True(res.IsSuccessStatusCode, await res.Content.ReadAsStringAsync());
        return await res.Content.ReadFromJsonAsync<JsonElement>();
    }

    private static IEnumerable<JsonElement> Changed(JsonElement res, string collection) =>
        res.GetProperty("changes").EnumerateArray().Where(c => c.GetProperty("collection").GetString() == collection).Select(c => c.GetProperty("data"));

    private static object Ticket(string id, string key, string product, string type = "task", string reporter = "u1") => new
    {
        id, key, productId = product, type, summary = "Server rules test " + id, statusId = "new", priority = "medium", reporterId = reporter,
        labels = Array.Empty<string>(), customFields = new { }, createdAt = DateTimeOffset.Now, updatedAt = DateTimeOffset.Now,
    };

    [Fact]
    public async Task Two_people_guessing_the_same_ticket_key_get_different_numbers()
    {
        var alex = await SignIn("alex@example.com");
        var state = await alex.GetFromJsonAsync<JsonElement>("/api/state");
        var counter = state.GetProperty("products").EnumerateArray().First(p => p.GetProperty("id").GetString() == "p3").GetProperty("issueCounter").GetInt32();
        var guess = $"ANL-{counter}";

        var first = await Sync(alex, Upsert("issues", "num-1", Ticket("num-1", guess, "p3")));
        Assert.Empty(Changed(first, "issues")); // the guess was right
        var second = await Sync(alex,
            Upsert("issues", "num-2", Ticket("num-2", guess, "p3")),
            Upsert("activities", "num-a2", new { id = "num-a2", issueId = "num-2", productId = "p3", userId = "u1", action = "created ticket", to = guess, createdAt = DateTimeOffset.Now }));
        var renamed = Changed(second, "issues").Single();
        Assert.Equal($"ANL-{counter + 1}", renamed.GetProperty("key").GetString());
        Assert.Equal($"ANL-{counter + 1}", Changed(second, "activities").Single().GetProperty("to").GetString());
        Assert.Equal(counter + 2, Changed(second, "products").Single().GetProperty("issueCounter").GetInt32());
    }

    [Fact]
    public async Task Automation_runs_on_the_server_and_its_changes_come_back()
    {
        var alex = await SignIn("alex@example.com");
        // Switch on the demo round-robin rule (support tickets → Service Desk, t4)
        var state = await alex.GetFromJsonAsync<JsonElement>("/api/state");
        var rule = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(state.GetProperty("automations").EnumerateArray().First(r => r.GetProperty("id").GetString() == "ar2").GetRawText())!;
        rule["enabled"] = JsonSerializer.SerializeToElement(true);
        await Sync(alex, Upsert("automations", "ar2", rule));

        var counter = state.GetProperty("products").EnumerateArray().First(p => p.GetProperty("id").GetString() == "p1").GetProperty("issueCounter").GetInt32();
        var res = await Sync(alex, Upsert("issues", "rr-1", Ticket("rr-1", $"WEB-{counter + 50}", "p1", "support")));
        var issue = Changed(res, "issues").Last();
        Assert.Equal("u13", issue.GetProperty("assigneeId").GetString()); // Ana Costa, the Service Desk
        Assert.Equal($"WEB-{counter}", issue.GetProperty("key").GetString()); // the server's number, not the guess
        Assert.Contains(Changed(res, "automationLog"), r => r.GetProperty("ruleId").GetString() == "ar2" && r.GetProperty("outcome").GetString() == "done");
        Assert.Contains(Changed(res, "activities"), a => a.GetProperty("userId").GetString() == "automation" && a.GetProperty("action").GetString() == "ran rule");
        Assert.True(res.GetProperty("version").GetInt64() > 0);
    }

    [Fact]
    public async Task Set_status_actions_respect_the_workflow_and_are_logged_as_skipped()
    {
        var alex = await SignIn("alex@example.com");
        var state = await alex.GetFromJsonAsync<JsonElement>("/api/state");
        // New may only go to Development In Progress
        var wf = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(state.GetProperty("workflows")[0].GetRawText())!;
        wf["transitions"] = JsonSerializer.SerializeToElement(new Dictionary<string, string[]> { ["new"] = ["dev"] });
        var rule = new
        {
            id = "wf-rule", name = "Bugs straight to Testing", enabled = true, productId = "p2",
            trigger = new { type = "issue_created" }, conditions = new[] { new { field = "type", op = "is", value = "bug" } },
            actions = new[] { new { type = "add_label", value = "triage" }, new { type = "set_status", value = "testing" } },
            createdAt = DateTimeOffset.Now, createdBy = "u1", runCount = 0, firedFor = Array.Empty<string>(),
        };
        await Sync(alex, Upsert("workflows", "wf-default", wf), Upsert("automations", "wf-rule", rule));
        var res = await Sync(alex, Upsert("issues", "wf-1", Ticket("wf-1", "MOB-999", "p2", "bug")));
        var run = Changed(res, "automationLog").Single(r => r.GetProperty("ruleId").GetString() == "wf-rule");
        Assert.Equal("partial", run.GetProperty("outcome").GetString());
        Assert.Contains(run.GetProperty("details").EnumerateArray(), d => d.GetString()!.StartsWith("Skipped") && d.GetString()!.Contains("isn’t allowed"));
        var issue = Changed(res, "issues").Last();
        Assert.Equal("new", issue.GetProperty("statusId").GetString());
        Assert.Contains("triage", issue.GetProperty("labels").EnumerateArray().Select(l => l.GetString()));

        // Put the workflow back for other tests
        wf["transitions"] = JsonSerializer.SerializeToElement(new Dictionary<string, string[]>());
        await Sync(alex, Upsert("workflows", "wf-default", wf));
    }

    [Fact]
    public async Task Timed_rules_run_on_the_server_once_per_ticket()
    {
        var scopes = factory.Services.GetRequiredService<IServiceScopeFactory>();
        // Demo rule ar1 (on): escalate breached L1 support tickets; ANL-1 was raised a day ago at L1 with a 4h target
        var runs = await TimedRulesService.RunOnceAsync(scopes, DateTimeOffset.Now);
        Assert.True(runs >= 1);
        Assert.Equal(0, await TimedRulesService.RunOnceAsync(scopes, DateTimeOffset.Now));

        var alex = await SignIn("alex@example.com");
        var state = await alex.GetFromJsonAsync<JsonElement>("/api/state");
        var anl1 = state.GetProperty("issues").EnumerateArray().First(i => i.GetProperty("key").GetString() == "ANL-1");
        Assert.Equal("l2", anl1.GetProperty("supportLevel").GetString());
        Assert.Contains(state.GetProperty("comments").EnumerateArray(), c => c.GetProperty("authorId").GetString() == "automation" && c.GetProperty("issueId").GetString() == "i6");
    }

    [Fact]
    public async Task The_version_moves_when_data_changes()
    {
        var alex = await SignIn("alex@example.com");
        var v1 = (await alex.GetFromJsonAsync<JsonElement>("/api/state/version")).GetProperty("version").GetInt64();
        await Sync(alex, Upsert("comments", "v-c1", new { id = "v-c1", issueId = "i2", authorId = "u1", body = "Version check", createdAt = DateTimeOffset.Now }));
        var v2 = (await alex.GetFromJsonAsync<JsonElement>("/api/state/version")).GetProperty("version").GetInt64();
        Assert.True(v2 > v1);
    }
}
