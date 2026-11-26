using Microsoft.EntityFrameworkCore;
using Npro.Domain;

namespace Npro.Infrastructure.Rules;

/// <summary>
/// Step 18c: the automation engine on the server (port of the DataStore engine in src/app/core/data-store.ts).
/// "When X, if Y, then Z" rules run after the change that triggered them is saved; they act as the <c>automation</c> user,
/// follow the workflow's transition rules, never re-run within their own chain (max 5 levels), and log every run.
/// Everything they change is reported to <see cref="ChangeCollector"/> so the browser can merge it.
/// </summary>
public sealed class RuleEngine(NproDbContext db, ChangeCollector changes, DateTimeOffset now)
{
    public const string AutomationId = "automation";
    public const int MaxChain = 5;
    public const int LogLimit = 300;
    private static readonly HashSet<string> Timed = ["sla_at_risk", "sla_breached", "due_passed"];

    private readonly List<string> chain = [];
    private List<SlaPolicy>? policies;

    // ---------------- Triggers ----------------

    /// <summary>Runs every enabled rule for an event on a ticket</summary>
    public async Task FireAsync(string trigger, string issueId, string? value = null)
    {
        if (chain.Count >= MaxChain) return;
        var issue = await db.Issues.FindAsync(issueId);
        if (issue is null) return;
        var rules = await db.AutomationRules.Where(r => r.Enabled).ToListAsync();
        foreach (var rule in rules.Where(r =>
                     r.Trigger.Type == trigger &&
                     (r.ProductId is null || r.ProductId == issue.ProductId) &&
                     !chain.Contains(r.Id) &&
                     (trigger != "status_changed" || string.IsNullOrEmpty(r.Trigger.Value) || r.Trigger.Value == value)))
        {
            await RunRuleAsync(rule, issue, trigger);
        }
    }

    /// <summary>Time-based triggers (SLA at risk / breached, due date passed): each rule fires once per ticket. Returns runs.</summary>
    public async Task<int> RunTimedAsync()
    {
        var runs = 0;
        var today = new DateTimeOffset(now.ToLocalTime().Date, now.ToLocalTime().Offset);
        var rules = await db.AutomationRules.Where(r => r.Enabled).ToListAsync();
        foreach (var rule in rules.Where(r => Timed.Contains(r.Trigger.Type)))
        {
            var issues = await db.Issues.Where(i => rule.ProductId == null || i.ProductId == rule.ProductId).ToListAsync();
            foreach (var issue in issues)
            {
                if (rule.FiredFor.Contains(issue.Id)) continue;
                var wf = await WorkflowOf(issue);
                if (wf.CategoryOf(issue.StatusId) == "done") continue;
                bool hit;
                if (rule.Trigger.Type == "due_passed") hit = issue.DueDate is { } due && due < today;
                else
                {
                    var sla = Sla.Of(issue, wf, await Policies(), now);
                    hit = sla is not null && sla.Has(rule.Trigger.Type == "sla_breached" ? "breached" : "at_risk");
                }
                if (hit && await RunRuleAsync(rule, issue, rule.Trigger.Type))
                {
                    runs++;
                    rule.FiredFor = [.. rule.FiredFor, issue.Id];
                    changes.Upsert("automations", rule.Id, rule);
                }
            }
        }
        return runs;
    }

    // ---------------- One rule ----------------

    private async Task<bool> RunRuleAsync(AutomationRule rule, Issue issue, string trigger)
    {
        var wf = await WorkflowOf(issue);
        var reporter = await db.People.FindAsync(issue.ReporterId);
        if (!rule.Conditions.All(c => Matches(c, issue, wf, reporter))) return false;

        AddActivity(issue, "ran rule", null, rule.Name);
        var details = new List<string>();
        var failed = 0;
        chain.Add(rule.Id);
        try
        {
            foreach (var action in rule.Actions)
            {
                try
                {
                    details.Add(await ApplyAsync(rule, action, issue));
                }
                catch (RuleException ex)
                {
                    failed++;
                    details.Add("Skipped: " + ex.Message);
                }
            }
        }
        finally
        {
            chain.RemoveAt(chain.Count - 1);
        }

        var run = new AutomationRun
        {
            Id = Guid.NewGuid().ToString(), RuleId = rule.Id, RuleName = rule.Name, IssueId = issue.Id, IssueKey = issue.Key, Trigger = trigger, At = now,
            Outcome = failed == 0 ? "done" : failed == rule.Actions.Count ? "failed" : "partial", Details = details,
        };
        db.AutomationRuns.Add(run);
        changes.Upsert("automationLog", run.Id, run);
        rule.RunCount++;
        rule.LastRunAt = now;
        changes.Upsert("automations", rule.Id, rule);
        await db.SaveChangesAsync();
        await TrimLogAsync();
        return true;
    }

    private static bool Matches(AutomationCondition c, Issue i, Workflow wf, User? reporter)
    {
        var target = c.Value.Trim().ToLowerInvariant();
        bool hit = c.Field switch
        {
            "label" => i.Labels.Any(l => l.ToLowerInvariant() == target),
            _ => (c.Field switch
            {
                "type" => i.Type,
                "priority" => i.Priority,
                "status" => i.StatusId,
                "status_category" => wf.CategoryOf(i.StatusId) ?? "",
                "support_level" => i.SupportLevel ?? "",
                "client" => i.ClientId ?? "",
                "assignee" => i.AssigneeId ?? "",
                "reporter_kind" => reporter?.Role == Roles.ProductionUser || reporter?.Kind == UserKinds.Client ? "production" : "staff",
                _ => "",
            }).ToLowerInvariant() == target,
        };
        return c.Op == "is" ? hit : !hit;
    }

    private sealed class RuleException(string message) : Exception(message);

    private async Task<string> ApplyAsync(AutomationRule rule, AutomationAction action, Issue issue)
    {
        switch (action.Type)
        {
            case "set_status":
            {
                var wf = await WorkflowOf(issue);
                var to = wf.Statuses.FirstOrDefault(s => s.Id == action.Value) ?? throw new RuleException("that status isn’t in this product’s workflow");
                if (to.Id == issue.StatusId) return $"Already in {to.Name}";
                var from = wf.Statuses.FirstOrDefault(s => s.Id == issue.StatusId);
                if (!wf.CanTransition(issue.StatusId, to.Id)) throw new RuleException($"{from?.Name ?? "?"} → {to.Name} isn’t allowed by the workflow");
                await UpdateIssueAsync(issue, x => x.StatusId = to.Id);
                return $"Status set to {to.Name}";
            }
            case "assign":
            {
                var u = await db.People.FindAsync(action.Value);
                if (u is null || u.Inactive || u.Role == Roles.ProductionUser) throw new RuleException("that person can’t be assigned");
                if (issue.AssigneeId == u.Id) return $"Already assigned to {u.Name}";
                await UpdateIssueAsync(issue, x => x.AssigneeId = u.Id);
                return $"Assigned to {u.Name}";
            }
            case "assign_round_robin":
            {
                var team = await db.Teams.FindAsync(action.Value) ?? throw new RuleException("that team no longer exists");
                var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == issue.ProductId);
                var members = await db.People.Where(u => u.TeamId == team.Id && !u.Inactive && u.Role != Roles.ProductionUser).ToListAsync();
                var onProduct = members.Where(u => product is not null && (product.LeadId == u.Id || product.MemberIds.Contains(u.Id))).ToList();
                var pool = (onProduct.Count > 0 ? onProduct : members).OrderBy(u => u.Name, StringComparer.CurrentCulture).ToList();
                if (pool.Count == 0) throw new RuleException($"nobody active in {team.Name}");
                var idx = (rule.RrIndex ?? 0) % pool.Count;
                var u = pool[idx];
                rule.RrIndex = idx + 1;
                changes.Upsert("automations", rule.Id, rule);
                if (issue.AssigneeId == u.Id) return $"Already assigned to {u.Name}";
                await UpdateIssueAsync(issue, x => x.AssigneeId = u.Id);
                return $"Assigned to {u.Name} ({team.Name}, in turn)";
            }
            case "unassign":
                if (issue.AssigneeId is null) return "Already unassigned";
                await UpdateIssueAsync(issue, x => x.AssigneeId = null);
                return "Unassigned";
            case "set_priority":
                if (issue.Priority == action.Value) return $"Priority already {action.Value}";
                await UpdateIssueAsync(issue, x => x.Priority = action.Value);
                return $"Priority set to {action.Value}";
            case "add_label":
            {
                var label = action.Value.Trim();
                if (issue.Labels.Contains(label)) return $"Already labelled {label}";
                await UpdateIssueAsync(issue, x => x.Labels = [.. x.Labels, label]);
                return $"Label {label} added";
            }
            case "add_comment":
                AddComment(issue, action.Value);
                return "Comment added";
            case "escalate":
            {
                if (issue.SupportLevel is null) throw new RuleException("only support tickets can be escalated");
                var to = Sla.NextLevel(issue.SupportLevel) ?? throw new RuleException("already at L3");
                var from = issue.SupportLevel;
                issue.SupportLevel = to;
                issue.AssigneeId = null;
                issue.UpdatedAt = now;
                changes.Upsert("issues", issue.Id, issue);
                AddActivity(issue, "escalated", from.ToUpperInvariant(), to.ToUpperInvariant());
                await db.SaveChangesAsync();
                return $"Escalated to {to.ToUpperInvariant()}";
            }
            default:
                throw new RuleException($"unknown action {action.Type}");
        }
    }

    // ---------------- Changes made by rules ----------------

    /// <summary>Same bookkeeping as the app's updateIssue: work dates, response clock, history; then chained triggers</summary>
    private async Task UpdateIssueAsync(Issue issue, Action<Issue> mutate)
    {
        var before = new { issue.StatusId, issue.AssigneeId, issue.Priority, Labels = string.Join(",", issue.Labels) };
        mutate(issue);
        issue.UpdatedAt = now;
        var wf = await WorkflowOf(issue);
        if (issue.StatusId != before.StatusId)
        {
            var from = wf.Statuses.FirstOrDefault(s => s.Id == before.StatusId);
            var to = wf.Statuses.FirstOrDefault(s => s.Id == issue.StatusId);
            if (to?.Category is "in_progress" or "done" && issue.StartAt is null) issue.StartAt = now;
            if (to?.Category == "done") issue.EndAt = now;
            if (to?.Category != "done" && from?.Category == "done") issue.EndAt = null;
            if (issue.SupportLevel is not null && issue.FirstResponseAt is null && to?.Category != "todo") issue.FirstResponseAt = now;
            AddActivity(issue, "changed status", from?.Name, to?.Name);
        }
        var fields = new List<string>();
        if (issue.AssigneeId != before.AssigneeId) fields.Add("assignee");
        if (issue.Priority != before.Priority) fields.Add("priority");
        if (string.Join(",", issue.Labels) != before.Labels) fields.Add("labels");
        if (fields.Count > 0) AddActivity(issue, "updated", null, string.Join(", ", fields));
        changes.Upsert("issues", issue.Id, issue);
        await db.SaveChangesAsync();

        if (issue.StatusId != before.StatusId) await FireAsync("status_changed", issue.Id, issue.StatusId);
        if (issue.AssigneeId != before.AssigneeId) await FireAsync("assignee_changed", issue.Id);
        if (issue.Priority != before.Priority) await FireAsync("priority_changed", issue.Id);
    }

    /// <summary>A comment by the automation user (doesn't stop the SLA response clock and doesn't trigger comment rules)</summary>
    private void AddComment(Issue issue, string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return;
        var c = new Comment { Id = Guid.NewGuid().ToString(), IssueId = issue.Id, AuthorId = AutomationId, Body = text.Trim(), CreatedAt = now };
        db.Comments.Add(c);
        changes.Upsert("comments", c.Id, c);
        issue.UpdatedAt = now;
        changes.Upsert("issues", issue.Id, issue);
        AddActivity(issue, "added a comment", null, null);
    }

    private void AddActivity(Issue issue, string action, string? from, string? to)
    {
        var a = new Activity { Id = Guid.NewGuid().ToString(), IssueId = issue.Id, ProductId = issue.ProductId, UserId = AutomationId, Action = action, From = from, To = to, CreatedAt = now };
        db.Activities.Add(a);
        changes.Upsert("activities", a.Id, a);
    }

    private async Task TrimLogAsync()
    {
        var count = await db.AutomationRuns.CountAsync();
        if (count <= LogLimit) return;
        // Sorted in memory: SQLite (tests) can't ORDER BY DateTimeOffset
        var old = (await db.AutomationRuns.ToListAsync()).OrderBy(r => r.At).Take(count - LogLimit).ToList();
        db.AutomationRuns.RemoveRange(old);
        foreach (var r in old) changes.Delete("automationLog", r.Id);
        await db.SaveChangesAsync();
    }

    private readonly Dictionary<string, Workflow> workflows = [];

    private async Task<Workflow> WorkflowOf(Issue issue)
    {
        var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == issue.ProductId);
        var id = product?.WorkflowId ?? "";
        if (workflows.TryGetValue(id, out var wf)) return wf;
        wf = await db.Workflows.AsNoTracking().FirstOrDefaultAsync(w => w.Id == id) ?? await db.Workflows.AsNoTracking().FirstAsync();
        workflows[id] = wf;
        return wf;
    }

    private async Task<List<SlaPolicy>> Policies() => policies ??= await db.SlaPolicies.AsNoTracking().ToListAsync();
}
