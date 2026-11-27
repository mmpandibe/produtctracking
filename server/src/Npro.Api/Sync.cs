using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;
using Npro.Infrastructure.Files;
using Npro.Infrastructure.Rules;

namespace Npro.Api;

/// <summary>One changed record sent by the app: <c>upsert</c> carries the whole record, <c>delete</c> only its id</summary>
public sealed record Change(string Collection, string Op, string Id, JsonElement? Data);

public sealed record SyncRequest(List<Change> Changes);

/// <summary>
/// Step 18b: the Angular <c>DataStore</c> keeps its methods and logic; after each change it sends the records that changed.
/// Every change is checked against the signed-in person's role and scope (same rules as the UI), and a batch is saved
/// all-or-nothing. Business rules that still run in the browser (ticket numbering, automation) move server-side in 18c.
/// </summary>
public static class Sync
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull,
        Converters = { new UtcDateConverter() },
    };

    public const string AutomationId = "automation";

    public static void MapSync(this RouteGroupBuilder data)
    {
        // Everything the signed-in person may see, in the shape of the frontend's DataState
        data.MapGet("/state", async (RequestAccess access, NproDbContext db, ChangeFeed feed) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            var snapshot = await Snapshot(db, me, scope);
            snapshot["version"] = feed.Version;
            return Results.Json(snapshot, Json);
        });

        data.MapPost("/sync", async (SyncRequest req, RequestAccess access, NproDbContext db, UserManager<IdentityUser> users, ChangeFeed feed, IFileStore files, SecurityEvents audit) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            // SQL Server runs with retry-on-failure, so the transaction goes through the execution strategy
            var strategy = db.Database.CreateExecutionStrategy();
            return await strategy.ExecuteAsync(async () =>
            {
                db.ChangeTracker.Clear();
                var ctx = new SyncContext(db, me, scope);
                await using var tx = await db.Database.BeginTransactionAsync();
                try
                {
                    foreach (var change in req.Changes)
                    {
                        var problem = await Apply(ctx, change, users);
                        if (problem is not null)
                        {
                            await tx.RollbackAsync();
                            db.ChangeTracker.Clear();
                            audit.Refused(me.Id, $"{change.Op} {change.Collection}/{change.Id}", problem);
                            return Results.Problem(problem, statusCode: 403, title: "Change not allowed");
                        }
                    }
                    await db.SaveChangesAsync();
                    // Step 18c: the server's own rules — automation for every event in the batch (as the automation user)
                    var engine = new RuleEngine(db, ctx.Changes, DateTimeOffset.Now);
                    foreach (var (trigger, issueId, value) in ctx.Events) await engine.FireAsync(trigger, issueId, value);
                    await db.SaveChangesAsync();
                    await tx.CommitAsync();
                    // Files of deleted attachments go only once the deletion is committed
                    foreach (var key in ctx.FilesToDelete) await files.DeleteAsync(key);
                    foreach (var note in ctx.AccessChanges) audit.AccessChanged(me.Id, note);
                    var version = feed.Bump();
                    return Results.Json(new { saved = req.Changes.Count, version, changes = ToChanges(ctx.Changes) }, Json);
                }
                catch (DbUpdateException)
                {
                    await tx.RollbackAsync();
                    db.ChangeTracker.Clear();
                    // Typically two people creating the same ticket key at once; the app reloads and tries again
                    return Results.Problem("Someone else changed this at the same time. The latest data has been reloaded.", statusCode: 409, title: "Conflict");
                }
            });
        }).RequireRateLimiting("writes");

        // Cheap check the app polls: changes when anyone saves, or when a timed rule runs
        data.MapGet("/state/version", (ChangeFeed feed) => Results.Ok(new { version = feed.Version }));

        // Admins set a person's sign-in password (new people have none until then)
        data.MapPost("/people/{id}/password", async (string id, PasswordRequest req, RequestAccess access, NproDbContext db, UserManager<IdentityUser> users, SecurityEvents audit) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            if (!Capabilities.Can(me.Role, Capabilities.Organisation)) return Results.Problem("Only admins can set passwords", statusCode: 403);
            var person = await db.People.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id);
            if (person is null) return Results.NotFound();
            var account = await EnsureAccount(users, person);
            if (await users.HasPasswordAsync(account)) await users.RemovePasswordAsync(account);
            var result = await users.AddPasswordAsync(account, req.Password ?? "");
            if (!result.Succeeded) return Results.Problem(string.Join(" ", result.Errors.Select(e => e.Description)), statusCode: 400);
            await users.SetLockoutEndDateAsync(account, null);
            // Someone else knows this password now: the person must replace it at their next sign-in
            if (person.Id != me.Id) await db.People.Where(p => p.Id == person.Id).ExecuteUpdateAsync(s => s.SetProperty(p => p.MustChangePassword, true));
            audit.PasswordSet(me.Id, person.Id);
            return Results.NoContent();
        });
    }

    public sealed record PasswordRequest(string Password);

    // ---------------- Snapshot ----------------

    private static async Task<Dictionary<string, object?>> Snapshot(NproDbContext db, User me, AccessScope scope)
    {
        var people = await db.People.AsNoTracking().ToListAsync();
        var products = await db.Products.AsNoTracking().ToListAsync();
        var clients = await db.Clients.AsNoTracking().ToListAsync();
        var issues = (await db.Issues.AsNoTracking().ToListAsync()).Where(i => scope.CanSee(i, me)).ToList();
        var issueIds = issues.Select(i => i.Id).ToHashSet();
        var visibleProducts = scope.All ? products : products.Where(p => scope.ProductIds.Contains(p.Id)).ToList();
        var productIds = visibleProducts.Select(p => p.Id).ToHashSet();

        var comments = (await db.Comments.AsNoTracking().ToListAsync()).Where(c => issueIds.Contains(c.IssueId)).ToList();
        var workLogs = (await db.WorkLogs.AsNoTracking().ToListAsync())
            .Where(w => issueIds.Contains(w.IssueId) && (scope.All || (scope.OwnTimeOnly ? w.UserId == me.Id : scope.UserIds.Contains(w.UserId))))
            .ToList();

        var isProduction = me.Role == Roles.ProductionUser;
        if (isProduction)
        {
            // Client and production users get a directory limited to what they work with
            var referenced = issues.SelectMany(i => new[] { i.ReporterId, i.AssigneeId }).Concat(comments.Select(c => c.AuthorId)).OfType<string>().ToHashSet();
            people = people.Where(p => p.Id == me.Id || referenced.Contains(p.Id)).ToList();
            products = visibleProducts;
            clients = clients.Where(c => c.Id == me.ClientId).ToList();
        }

        var rules = await db.AutomationRules.AsNoTracking().ToListAsync();
        var notes = Capabilities.Can(me.Role, Capabilities.Summary)
            ? (await db.SummaryNotes.AsNoTracking().ToListAsync()).ToDictionary(n => n.Key, n => n.Text)
            : new Dictionary<string, string>();

        return new()
        {
            ["currentUserId"] = me.Id,
            ["users"] = people.OrderBy(p => p.Name).ToList(),
            ["divisions"] = isProduction ? new List<Division>() : await db.Divisions.AsNoTracking().ToListAsync(),
            ["teams"] = isProduction ? new List<Team>() : await db.Teams.AsNoTracking().ToListAsync(),
            ["vendors"] = isProduction ? new List<Vendor>() : await db.Vendors.AsNoTracking().ToListAsync(),
            ["products"] = products,
            ["clients"] = clients,
            ["workflows"] = await db.Workflows.AsNoTracking().ToListAsync(),
            ["issues"] = issues,
            ["workLogs"] = workLogs,
            ["timers"] = await db.Timers.AsNoTracking().Where(t => t.UserId == me.Id).ToListAsync(),
            ["comments"] = comments,
            ["attachments"] = (await db.Attachments.AsNoTracking().ToListAsync()).Where(a => issueIds.Contains(a.IssueId)).ToList(),
            ["activities"] = (await db.Activities.AsNoTracking().ToListAsync())
                .Where(a => a.IssueId is not null ? issueIds.Contains(a.IssueId) : a.ProductId is not null && productIds.Contains(a.ProductId))
                .OrderBy(a => a.CreatedAt).ToList(),
            ["roadmaps"] = (await db.Roadmaps.AsNoTracking().ToListAsync()).Where(r => productIds.Contains(r.ProductId)).ToList(),
            ["sprints"] = (await db.Sprints.AsNoTracking().ToListAsync()).Where(s => productIds.Contains(s.ProductId)).ToList(),
            ["customFields"] = await db.CustomFields.AsNoTracking().ToListAsync(),
            ["automations"] = isProduction ? new List<AutomationRule>() : rules.Where(r => scope.All || r.ProductId is null || productIds.Contains(r.ProductId)).ToList(),
            ["automationLog"] = isProduction ? new List<AutomationRun>() : (await db.AutomationRuns.AsNoTracking().ToListAsync())
                .Where(r => issueIds.Contains(r.IssueId)).OrderByDescending(r => r.At).Take(300).ToList(),
            ["slaPolicies"] = await db.SlaPolicies.AsNoTracking().ToListAsync(),
            ["supportLevels"] = (await db.SupportLevels.AsNoTracking().ToListAsync()).OrderBy(l => l.Level).ToList(),
            ["summaryNotes"] = notes,
        };
    }

    // ---------------- Applying changes ----------------

    private sealed class SyncContext(NproDbContext db, User me, AccessScope scope)
    {
        public NproDbContext Db { get; } = db;
        public User Me { get; } = me;
        public AccessScope Scope { get; } = scope;
        /// <summary>Products and tickets created earlier in the same batch count as visible</summary>
        public HashSet<string> NewProducts { get; } = [];
        public Dictionary<string, Issue> NewIssues { get; } = [];
        /// <summary>Rule triggers raised by this batch: (trigger, issue id, value)</summary>
        public List<(string Trigger, string IssueId, string? Value)> Events { get; } = [];
        /// <summary>Records the server changed on its own, sent back to the browser</summary>
        public ChangeCollector Changes { get; } = new();
        /// <summary>Ticket id → (key the browser guessed, key the server gave)</summary>
        public Dictionary<string, (string Client, string Server)> Renamed { get; } = [];
        /// <summary>Storage keys of attachments deleted in this batch (removed after commit)</summary>
        public List<string> FilesToDelete { get; } = [];
        /// <summary>Role / organisation / deactivation changes in this batch, logged as security events after commit</summary>
        public List<string> AccessChanges { get; } = [];

        public bool Staff => Me.Role != Roles.ProductionUser;

        public bool Can(string cap, string? productId = null) =>
            Capabilities.Can(Me.Role, cap) && (productId is null || Scope.All || Scope.ProductIds.Contains(productId) || NewProducts.Contains(productId));

        public async Task<bool> CanSeeIssue(string issueId)
        {
            if (NewIssues.ContainsKey(issueId)) return true;
            var issue = await Db.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Id == issueId);
            return issue is not null && (Scope.CanSee(issue, Me) || NewProducts.Contains(issue.ProductId));
        }

        public async Task<string?> ProductOfIssue(string issueId) =>
            NewIssues.TryGetValue(issueId, out var n) ? n.ProductId : (await Db.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Id == issueId))?.ProductId;
    }

    private static async Task<string?> Apply(SyncContext c, Change ch, UserManager<IdentityUser> users)
    {
        var del = ch.Op == "delete";
        if (!del && ch.Data is null) return $"{ch.Collection}: missing data";
        return ch.Collection switch
        {
            "users" => await Upsert<User>(c, ch, async (old, next) =>
            {
                if (!c.Can(Capabilities.Organisation)) return "Only admins can change people";
                if (next is not null)
                {
                    next.EmployeeId = next.Kind == UserKinds.Internal ? next.EmployeeId?.Trim().ToUpperInvariant() : null;
                    if (next.Kind == UserKinds.Internal && string.IsNullOrEmpty(next.EmployeeId)) return "Employee ID is required for in-house employees";
                    if (next.EmployeeId is not null && await c.Db.People.AsNoTracking().AnyAsync(p => p.Id != next.Id && p.EmployeeId == next.EmployeeId))
                        return $"Employee ID {next.EmployeeId} is already used";
                }
                if (next is not null)
                {
                    // Server-owned fields: never taken from the browser
                    next.MustChangePassword = old?.MustChangePassword ?? false;
                    next.LastSignInAt = old?.LastSignInAt;
                    next.AnonymisedAt = old?.AnonymisedAt;
                    next.DeactivatedAt = !next.Inactive ? null : old is { Inactive: true } ? old.DeactivatedAt : DateTimeOffset.Now;
                }
                if (next is not null && old is null) c.AccessChanges.Add($"added person {next.Id} as {next.Role}");
                if (next is not null && old is not null)
                {
                    if (old.Role != next.Role) c.AccessChanges.Add($"changed role of {next.Id} from {old.Role} to {next.Role}");
                    if (old.Inactive != next.Inactive) c.AccessChanges.Add(next.Inactive ? $"deactivated {next.Id}" : $"reactivated {next.Id}");
                    if (old.Kind != next.Kind || old.VendorId != next.VendorId || old.ClientId != next.ClientId) c.AccessChanges.Add($"changed organisation of {next.Id}");
                    if (old.Email != next.Email) c.AccessChanges.Add($"changed sign-in email of {next.Id}");
                }
                if (next is null && old is not null) c.AccessChanges.Add($"deleted person {old.Id}");
                if (next is not null && old?.Email != next.Email) await SyncAccount(users, next, old);
                if (next is null && old is not null)
                {
                    if (old.Id == c.Me.Id) return "You can't delete yourself";
                    var account = await users.FindByIdAsync(old.Id);
                    if (account is not null) await users.DeleteAsync(account);
                }
                return null;
            }),
            "divisions" => await Upsert<Division>(c, ch, (_, _) => Admin(c)),
            "teams" => await Upsert<Team>(c, ch, (_, _) => Admin(c)),
            "vendors" => await Upsert<Vendor>(c, ch, (_, _) => Admin(c)),
            "clients" => await Upsert<Client>(c, ch, (_, _) => Admin(c)),
            "workflows" => await Upsert<Workflow>(c, ch, (_, _) => Admin(c)),
            "customFields" => await Upsert<CustomFieldDef>(c, ch, (_, _) => Admin(c)),
            "slaPolicies" => await Upsert<SlaPolicy>(c, ch, (_, _) => Admin(c)),
            "supportLevels" => await Upsert<SupportLevelConfig>(c, ch, (_, _) => Admin(c), key: "Level"),

            "products" => await Upsert<Product>(c, ch, async (old, next) =>
            {
                if (old is null && next is not null)
                {
                    if (!c.Can(Capabilities.Products)) return "You can't create products";
                    c.NewProducts.Add(next.Id);
                    return null;
                }
                if (next is null) return await CanRemoveProduct(c, old!) ? null : "Only an admin or the division head can delete this product";
                // The server owns the ticket counter (18c): whatever the browser sends, the stored value stays
                next.IssueCounter = old!.IssueCounter;
                // A ticket creator's counter bump is then a no-op, which anyone who can create tickets there may send
                if (OnlyChanged(old, next, "issueCounter") && c.Can(Capabilities.Tickets, old.Id)) return null;
                return c.Can(Capabilities.Products, old.Id) ? null : "You can't change this product";
            }),

            "issues" => await Upsert<Issue>(c, ch, async (old, next) =>
            {
                if (old is null && next is not null)
                {
                    if (!c.Can(Capabilities.Tickets, next.ProductId)) return "You can't create tickets on this product";
                    if (!c.Staff && next.ReporterId != c.Me.Id) return "Tickets you raise must be reported by you";
                    // 18c: the server gives the number — the counter is bumped in the database (row lock until commit),
                    // so two people creating tickets at the same moment get different keys
                    var key = await NextKeyAsync(c.Db, next.ProductId);
                    if (key is null) return "Unknown product";
                    if (key != next.Key)
                    {
                        c.Renamed[next.Id] = (next.Key, key);
                        next.Key = key;
                        c.Changes.Upsert("issues", next.Id, next);
                    }
                    c.Changes.Upsert("products", next.ProductId, (await c.Db.Products.AsNoTracking().FirstAsync(p => p.Id == next.ProductId)));
                    c.NewIssues[next.Id] = next;
                    c.Events.Add(("issue_created", next.Id, null));
                    return null;
                }
                if (next is null) return c.Can(Capabilities.Products, old!.ProductId) ? null : "You can't delete this ticket";
                if (!await c.CanSeeIssue(old!.Id)) return "You don't have access to this ticket";
                // A comment only touches updatedAt (and the response clock for staff)
                if (OnlyChanged(old, next, "updatedAt", "firstResponseAt")) return null;
                if (!c.Staff) return "Only staff can edit tickets";
                if (!(c.Can(Capabilities.Tickets, old.ProductId) && c.Can(Capabilities.Tickets, next.ProductId))) return "You can't edit tickets on this product";
                next.Key = old.Key; // keys never change after creation
                if (next.StatusId != old.StatusId) c.Events.Add(("status_changed", next.Id, next.StatusId));
                if (next.AssigneeId != old.AssigneeId) c.Events.Add(("assignee_changed", next.Id, null));
                if (next.Priority != old.Priority) c.Events.Add(("priority_changed", next.Id, null));
                return null;
            }),

            "comments" => await Upsert<Comment>(c, ch, async (old, next) =>
            {
                var r = next ?? old!;
                if (!await c.CanSeeIssue(r.IssueId)) return "You don't have access to this ticket";
                if (old is null)
                {
                    if (next!.AuthorId != c.Me.Id && next.AuthorId != AutomationId) return "Comments must be written by you";
                    if (next.AuthorId != AutomationId) c.Events.Add(("comment_added", next.IssueId, null));
                    return null;
                }
                return old.AuthorId == c.Me.Id || c.Me.Role == Roles.Admin ? null : "You can only change your own comments";
            }),

            "attachments" => await Upsert<Attachment>(c, ch, async (old, next) =>
            {
                var r = next ?? old!;
                if (!await c.CanSeeIssue(r.IssueId)) return "You don't have access to this ticket";
                // The storage key is server-owned: a client must never point a record at another file
                // (it is not in the JSON copy 'old', so it is read from the database)
                var storedKey = old is null ? null : await c.Db.Attachments.AsNoTracking().Where(a => a.Id == old.Id).Select(a => a.StorageKey).FirstOrDefaultAsync();
                if (next is not null) next.StorageKey = storedKey;
                if (old is null) return next!.UploadedBy == c.Me.Id ? null : "Files must be uploaded by you";
                var product = await c.ProductOfIssue(r.IssueId);
                if (!(old.UploadedBy == c.Me.Id || (c.Staff && c.Can(Capabilities.Tickets, product)))) return "You can't remove this file";
                if (next is null && storedKey is not null) c.FilesToDelete.Add(storedKey);
                return null;
            }),

            "activities" => await Upsert<Activity>(c, ch, async (old, next) =>
            {
                if (next is null) return c.Can(Capabilities.Products, old!.ProductId) ? null : "History can't be deleted";
                if (old is not null) return "History can't be changed";
                if (next.UserId != c.Me.Id && next.UserId != AutomationId) return "History must be recorded as you";
                if (next.IssueId is not null && c.Renamed.TryGetValue(next.IssueId, out var rename) && next.To == rename.Client)
                {
                    next.To = rename.Server;
                    c.Changes.Upsert("activities", next.Id, next);
                }
                if (next.IssueId is not null) return await c.CanSeeIssue(next.IssueId) ? null : "You don't have access to this ticket";
                return next.ProductId is null || c.Can(Capabilities.Tickets, next.ProductId) || c.NewProducts.Contains(next.ProductId) || c.Me.Role == Roles.Admin ? null : "You can't add history to this product";
            }),

            "workLogs" => await Upsert<WorkLog>(c, ch, async (old, next) =>
            {
                foreach (var w in new[] { old, next }.OfType<WorkLog>())
                {
                    if (!await c.CanSeeIssue(w.IssueId)) return "You don't have access to this ticket";
                    var mine = w.UserId == c.Me.Id;
                    var managed = c.Can(Capabilities.Time) && !c.Scope.OwnTimeOnly && (c.Scope.All || c.Scope.UserIds.Contains(w.UserId));
                    if (!mine && !managed) return "You can only log your own time";
                }
                return null;
            }),

            "timers" => await Upsert<RunningTimer>(c, ch, (old, next) => Task.FromResult((next ?? old)!.UserId == c.Me.Id ? null : "You can only run your own timer"), key: "UserId"),

            "roadmaps" => await Upsert<Roadmap>(c, ch, (old, next) =>
                Task.FromResult(new[] { old, next }.OfType<Roadmap>().All(r => c.Can(Capabilities.Roadmaps, r.ProductId)) ? null : "You can't change roadmaps on this product")),

            "sprints" => await Upsert<Sprint>(c, ch, (old, next) =>
                Task.FromResult(new[] { old, next }.OfType<Sprint>().All(s => c.Can(Capabilities.Sprints, s.ProductId)) ? null : "You can't change sprints on this product")),

            "automations" => await Upsert<AutomationRule>(c, ch, (old, next) =>
            {
                // Rules record their own runs (count, last run, round-robin position, fired tickets) whoever set them off
                if (old is not null && next is not null && c.Staff && OnlyChanged(old, next, "runCount", "lastRunAt", "rrIndex", "firedFor")) return Task.FromResult<string?>(null);
                var ok = new[] { old, next }.OfType<AutomationRule>().All(r => CanManageRule(c, r.ProductId));
                return Task.FromResult(ok ? null : "You can't change this rule");
            }),

            "automationLog" => await Upsert<AutomationRun>(c, ch, (old, next) =>
                Task.FromResult(old is null ? (c.Staff ? null : "Not allowed") : c.Me.Role == Roles.Admin ? null : "Only admins can clear the run log")),

            "summaryNotes" => await Upsert<SummaryNote>(c, ch, (_, _) => Task.FromResult(c.Can(Capabilities.Summary) ? null : "You can't write summary comments"), key: "Key"),

            _ => $"Unknown collection {ch.Collection}",
        };
    }

    /// <summary>Allocates the next ticket key for a product (UPDATE takes a row lock until the transaction commits)</summary>
    private static async Task<string?> NextKeyAsync(NproDbContext db, string productId)
    {
        var updated = await db.Products.Where(p => p.Id == productId).ExecuteUpdateAsync(s => s.SetProperty(p => p.IssueCounter, p => p.IssueCounter + 1));
        if (updated == 0) return null;
        var p = await db.Products.AsNoTracking().FirstAsync(x => x.Id == productId);
        // A tracked copy of this product (e.g. from an earlier change in the batch) is stale now
        foreach (var e in db.ChangeTracker.Entries<Product>().Where(e => e.Entity.Id == productId).ToList()) e.State = EntityState.Detached;
        return $"{p.Key}-{p.IssueCounter - 1}";
    }

    public static List<Change> ToChanges(ChangeCollector collector) =>
        collector.All().Select(x => new Change(x.Collection, x.Op, x.Id, x.Data is null ? null : JsonSerializer.SerializeToElement(x.Data, x.Data.GetType(), Json))).ToList();

    private static Task<string?> Admin(SyncContext c) => Task.FromResult(c.Can(Capabilities.Organisation) ? null : "Only admins can change the organisation setup");

    private static bool CanManageRule(SyncContext c, string? productId) =>
        c.Me.Role == Roles.Admin || (productId is not null && c.Can(Capabilities.Products, productId));

    private static async Task<bool> CanRemoveProduct(SyncContext c, Product p)
    {
        if (c.Me.Role == Roles.Admin) return true;
        if (p.DivisionId is null) return false;
        return await c.Db.Divisions.AsNoTracking().AnyAsync(d => d.Id == p.DivisionId && d.HeadId == c.Me.Id);
    }

    /// <summary>True when the two records differ only in the given (camelCase) fields</summary>
    private static bool OnlyChanged<T>(T old, T next, params string[] fields)
    {
        var a = JsonSerializer.SerializeToNode(old, Json)!.AsObject();
        var b = JsonSerializer.SerializeToNode(next, Json)!.AsObject();
        foreach (var f in fields) { a.Remove(f); b.Remove(f); }
        return JsonNode.DeepEquals(a, b);
    }

    /// <summary>Loads the stored record, asks <paramref name="authorize"/>, then adds / updates / removes it</summary>
    private static async Task<string?> Upsert<T>(SyncContext c, Change ch, Func<T?, T?, Task<string?>> authorize, string key = "Id") where T : class
    {
        var set = c.Db.Set<T>();
        var stored = await set.FindAsync(ch.Id);
        T? old = null;
        if (stored is not null)
        {
            // Untracked copy of the stored values for comparisons
            old = JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(stored, Json), Json);
        }
        T? next = null;
        if (ch.Op != "delete")
        {
            next = ch.Data!.Value.Deserialize<T>(Json);
            if (next is null) return $"{ch.Collection}: unreadable data";
            var nextKey = typeof(T).GetProperty(key)!.GetValue(next) as string;
            if (nextKey != ch.Id) return $"{ch.Collection}: id mismatch";
        }
        if (old is null && next is null) return null; // deleting something already gone

        var problem = await authorize(old, next);
        if (problem is not null) return problem;

        if (next is null) set.Remove(stored!);
        else if (stored is null) set.Add(next);
        else Copy(c.Db, stored, next);
        // Keep later checks in the batch (e.g. a comment on a ticket created just before) consistent
        await c.Db.SaveChangesAsync();
        return null;
    }

    /// <summary>Copies an incoming record onto the tracked one, including JSON-stored owned parts</summary>
    private static void Copy<T>(NproDbContext db, T stored, T next) where T : class
    {
        db.Entry(stored).CurrentValues.SetValues(next);
        switch (stored)
        {
            case Workflow w: w.Statuses = ((Workflow)(object)next).Statuses; break;
            case AutomationRule r:
                var n = (AutomationRule)(object)next;
                r.Trigger = n.Trigger;
                r.Conditions = n.Conditions;
                r.Actions = n.Actions;
                break;
        }
    }

    // ---------------- Sign-in accounts for people ----------------

    private static async Task SyncAccount(UserManager<IdentityUser> users, User next, User? old)
    {
        var account = await users.FindByIdAsync(next.Id);
        if (account is null)
        {
            await EnsureAccount(users, next);
            return;
        }
        account.Email = next.Email;
        account.UserName = next.Email;
        await users.UpdateAsync(account);
    }

    /// <summary>The person's Identity account (created without a password: an admin sets one)</summary>
    private static async Task<IdentityUser> EnsureAccount(UserManager<IdentityUser> users, User person)
    {
        var account = await users.FindByIdAsync(person.Id);
        if (account is not null) return account;
        account = new IdentityUser { Id = person.Id, UserName = person.Email, Email = person.Email, EmailConfirmed = true };
        var result = await users.CreateAsync(account);
        if (!result.Succeeded) throw new InvalidOperationException(string.Join(" ", result.Errors.Select(e => e.Description)));
        return account;
    }
}
