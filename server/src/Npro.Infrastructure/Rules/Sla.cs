using Npro.Domain;

namespace Npro.Infrastructure.Rules;

/// <summary>running · at_risk (≤ 25 % of the target left) · breached · met (stopped in time)</summary>
public sealed record SlaClock(string State, int TargetMinutes, DateTimeOffset DueAt);

public sealed record SlaStatus(SlaClock Response, SlaClock Resolution)
{
    public bool Has(string state) => Response.State == state || Resolution.State == state;
}

/// <summary>Server copy of src/app/core/sla.ts: calendar-time clocks from creation with the current level's targets.</summary>
public static class Sla
{
    public static SlaClock Clock(DateTimeOffset start, int targetMinutes, DateTimeOffset? stoppedAt, DateTimeOffset now)
    {
        var due = start.AddMinutes(targetMinutes);
        if (stoppedAt is { } t1) return new SlaClock(t1 <= due ? "met" : "breached", targetMinutes, due);
        var left = (due - now).TotalMinutes;
        return new SlaClock(left < 0 ? "breached" : left <= targetMinutes * 0.25 ? "at_risk" : "running", targetMinutes, due);
    }

    /// <summary>Null for tickets without a support level (or without a policy)</summary>
    public static SlaStatus? Of(Issue issue, Workflow workflow, IReadOnlyList<SlaPolicy> policies, DateTimeOffset now)
    {
        if (issue.SupportLevel is null) return null;
        var policy = policies.FirstOrDefault(p => p.Level == issue.SupportLevel && p.Priority == issue.Priority);
        if (policy is null) return null;
        var resolved = workflow.CategoryOf(issue.StatusId) == "done";
        DateTimeOffset? resolvedAt = resolved ? issue.EndAt ?? issue.UpdatedAt : null;
        return new SlaStatus(
            Clock(issue.CreatedAt, policy.ResponseMinutes, issue.FirstResponseAt ?? resolvedAt, now),
            Clock(issue.CreatedAt, policy.ResolutionMinutes, resolvedAt, now));
    }

    public static string? NextLevel(string level) => level switch { "l1" => "l2", "l2" => "l3", _ => null };
}
