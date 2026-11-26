using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;

namespace Npro.Tests;

/// <summary>Step 18b: the state snapshot and change sync, with the server-side role checks.</summary>
public class SyncTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    public SyncTests(ApiFactory factory) => this.factory = factory;

    private async Task<(HttpClient Client, XsrfHandler Xsrf)> SignIn(string email, string password = ApiFactory.Password)
    {
        var xsrf = new XsrfHandler();
        var c = factory.CreateDefaultClient(xsrf, new CookieContainerHandler());
        await c.GetAsync("/api/health");
        var res = await c.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
        await c.GetAsync("/api/auth/me");
        return (c, xsrf);
    }

    private static Task<JsonElement> State(HttpClient c) => c.GetFromJsonAsync<JsonElement>("/api/state");

    private static object Upsert(string collection, string id, object data) => new { collection, op = "upsert", id, data };

    private static Task<HttpResponseMessage> Send(HttpClient c, params object[] changes) => c.PostAsJsonAsync("/api/sync", new { changes });

    private static JsonElement Find(JsonElement state, string collection, string id) =>
        state.GetProperty(collection).EnumerateArray().FirstOrDefault(x => x.GetProperty("id").GetString() == id);

    private static object NewIssue(string id, string key, string product, string reporter) => new
    {
        id, key, productId = product, type = "task", summary = "Created through the API", statusId = "new", priority = "medium",
        reporterId = reporter, labels = Array.Empty<string>(), customFields = new { }, createdAt = DateTimeOffset.Now, updatedAt = DateTimeOffset.Now,
    };

    [Fact]
    public async Task State_has_the_frontend_shape_and_is_scoped()
    {
        var (dana, _) = await SignIn("dana@acme.test");
        var s = await State(dana);
        Assert.Equal("u11", s.GetProperty("currentUserId").GetString());
        Assert.Equal(5, s.GetProperty("issues").GetArrayLength());
        Assert.Equal(0, s.GetProperty("divisions").GetArrayLength());
        Assert.Equal(["Acme Corp"], s.GetProperty("clients").EnumerateArray().Select(x => x.GetProperty("name").GetString()!).ToArray());
        Assert.Equal(JsonValueKind.Object, s.GetProperty("summaryNotes").ValueKind);

        var (alex, _) = await SignIn("alex@example.com");
        var all = await State(alex);
        Assert.Equal(11, all.GetProperty("workflows")[0].GetProperty("statuses").GetArrayLength());
        Assert.True(all.GetProperty("automations").GetArrayLength() >= 4);
    }

    [Fact]
    public async Task Developer_creates_a_ticket_but_cannot_rename_a_product()
    {
        var (jordan, _) = await SignIn("jordan@example.com");
        var before = Find(await State(jordan), "products", "p2");
        var counter = before.GetProperty("issueCounter").GetInt32();
        var product = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(before.GetRawText())!;
        product["issueCounter"] = JsonSerializer.SerializeToElement(counter + 1);

        var ok = await Send(jordan,
            Upsert("issues", "api-i1", NewIssue("api-i1", $"MOB-{counter}", "p2", "u4")),
            Upsert("products", "p2", product),
            Upsert("activities", "api-a1", new { id = "api-a1", issueId = "api-i1", productId = "p2", userId = "u4", action = "created ticket", to = $"MOB-{counter}", createdAt = DateTimeOffset.Now }),
            Upsert("comments", "api-c1", new { id = "api-c1", issueId = "api-i1", authorId = "u4", body = "First!", createdAt = DateTimeOffset.Now }));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var after = await State(jordan);
        Assert.Equal(JsonValueKind.Object, Find(after, "issues", "api-i1").ValueKind);
        Assert.Equal(counter + 1, Find(after, "products", "p2").GetProperty("issueCounter").GetInt32());

        product["name"] = JsonSerializer.SerializeToElement("Renamed by a developer");
        var refused = await Send(jordan, Upsert("products", "p2", product));
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);
    }

    [Fact]
    public async Task A_refused_change_rolls_back_the_whole_batch()
    {
        var (jordan, _) = await SignIn("jordan@example.com");
        var res = await Send(jordan,
            Upsert("comments", "rb-c1", new { id = "rb-c1", issueId = "i2", authorId = "u4", body = "Should not stay", createdAt = DateTimeOffset.Now }),
            Upsert("clients", "rb-cl", new { id = "rb-cl", name = "Sneaky client" }));
        Assert.Equal(HttpStatusCode.Forbidden, res.StatusCode);
        var s = await State(jordan);
        Assert.Equal(JsonValueKind.Undefined, Find(s, "comments", "rb-c1").ValueKind);
    }

    [Fact]
    public async Task Client_users_can_comment_but_not_edit_or_impersonate()
    {
        var (dana, _) = await SignIn("dana@acme.test");
        var mob3 = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(Find(await State(dana), "issues", "i9").GetRawText())!;
        mob3["summary"] = JsonSerializer.SerializeToElement("Changed by the client");
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(dana, Upsert("issues", "i9", mob3))).StatusCode);

        var asSomeoneElse = new { id = "cl-c1", issueId = "i9", authorId = "u1", body = "I am the admin", createdAt = DateTimeOffset.Now };
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(dana, Upsert("comments", "cl-c1", asSomeoneElse))).StatusCode);

        var hidden = new { id = "cl-c2", issueId = "i3", authorId = "u11", body = "Not my ticket", createdAt = DateTimeOffset.Now };
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(dana, Upsert("comments", "cl-c2", hidden))).StatusCode);

        var mine = new { id = "cl-c3", issueId = "i9", authorId = "u11", body = "Any news?", createdAt = DateTimeOffset.Now };
        Assert.Equal(HttpStatusCode.OK, (await Send(dana, Upsert("comments", "cl-c3", mine))).StatusCode);
    }

    [Fact]
    public async Task Writes_without_the_xsrf_token_are_refused()
    {
        var (jordan, xsrf) = await SignIn("jordan@example.com");
        xsrf.Enabled = false;
        var res = await Send(jordan, Upsert("comments", "x-c1", new { id = "x-c1", issueId = "i2", authorId = "u4", body = "no token", createdAt = DateTimeOffset.Now }));
        Assert.Equal(HttpStatusCode.BadRequest, res.StatusCode);
    }

    [Fact]
    public async Task Admin_adds_a_person_and_sets_their_password()
    {
        var (alex, _) = await SignIn("alex@example.com");
        var noId = new { id = "u-noid", name = "No Id", email = "noid@example.com", role = "developer", kind = "internal", color = "#9ca3af" };
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(alex, Upsert("users", "u-noid", noId))).StatusCode);
        var dupId = new { id = "u-dup", name = "Dup", email = "dup@example.com", employeeId = "emp-004", role = "developer", kind = "internal", color = "#9ca3af" };
        Assert.Equal(HttpStatusCode.Forbidden, (await Send(alex, Upsert("users", "u-dup", dupId))).StatusCode);
        var person = new { id = "u-new", name = "Riya Menon", email = "riya@example.com", employeeId = "emp-014", role = "developer", kind = "internal", color = "#9ca3af", teamId = "t1" };
        var added = await Send(alex, Upsert("users", "u-new", person));
        Assert.True(added.IsSuccessStatusCode, await added.Content.ReadAsStringAsync());
        Assert.Equal(HttpStatusCode.BadRequest, (await alex.PostAsJsonAsync("/api/people/u-new/password", new { password = "short" })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await alex.PostAsJsonAsync("/api/people/u-new/password", new { password = "Riya-first-pass1" })).StatusCode);

        // In-house employees can sign in with their employee ID instead of their email
        var (riya, _) = await SignIn("EMP-014", "Riya-first-pass1");
        var me = await riya.GetFromJsonAsync<JsonElement>("/api/auth/me");
        Assert.Equal("Riya Menon", me.GetProperty("user").GetProperty("name").GetString());

        var (jordan, _) = await SignIn("jordan@example.com");
        Assert.Equal(HttpStatusCode.Forbidden, (await jordan.PostAsJsonAsync("/api/people/u-new/password", new { password = "Jordan-sets-it1" })).StatusCode);
    }
}
