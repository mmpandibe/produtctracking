using System.Text.Json;

namespace Npro.Domain;

// Server-side twin of the Angular model (src/app/core/models.ts). Property names serialise to the same camelCase JSON,
// and "enum" values are the same lower_snake strings the frontend uses (see Roles / Values), so the API returns exactly
// the objects the UI already works with. Ids are strings so existing ids ("u1", UUIDs) carry over unchanged.

public class User
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    /// <summary>admin · division_head · assistant_manager · business_analyst · tech_lead · developer · tester · production_user</summary>
    public string Role { get; set; } = Roles.Developer;
    public string Color { get; set; } = "#9ca3af";
    /// <summary>internal · vendor · client</summary>
    public string Kind { get; set; } = UserKinds.Internal;
    public string? Title { get; set; }
    /// <summary>In-house employees only: HR employee ID (upper-case, unique); can be used to sign in</summary>
    public string? EmployeeId { get; set; }
    /// <summary>Older records only — no longer asked for</summary>
    public string? Phone { get; set; }
    public string? TeamId { get; set; }
    public string? ManagerId { get; set; }
    public string? VendorId { get; set; }
    public string? ClientId { get; set; }
    public bool Inactive { get; set; }

    // ---- Server-owned (ISO 27001 follow-up): browsers see these but can never set them ----
    /// <summary>Set when an admin sets the password; the person must choose a new one before using nPro</summary>
    public bool MustChangePassword { get; set; }
    /// <summary>Last successful sign-in (access reviews)</summary>
    public DateTimeOffset? LastSignInAt { get; set; }
    /// <summary>When the person was deactivated (retention: anonymised after <c>Retention:DeactivatedUserYears</c>)</summary>
    public DateTimeOffset? DeactivatedAt { get; set; }
    /// <summary>When the retention job replaced the person's name, email and employee ID</summary>
    public DateTimeOffset? AnonymisedAt { get; set; }
}

public class Division
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? HeadId { get; set; }
    public string Color { get; set; } = "#7cb4f5";
}

public class Team
{
    public string Id { get; set; } = "";
    public string DivisionId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? ManagerId { get; set; }
}

public class Vendor
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Notes { get; set; }
}

public class SupportLevelConfig
{
    /// <summary>l1 · l2 · l3</summary>
    public string Level { get; set; } = "l1";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? TeamId { get; set; }
}

public class Client
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string? ContactName { get; set; }
    public string? ContactEmail { get; set; }
    public string? ContactPhone { get; set; }
    public string? Notes { get; set; }
    public bool Archived { get; set; }
}

public class WorkflowStatus
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    /// <summary>todo · in_progress · hold · done</summary>
    public string Category { get; set; } = "todo";
    public string Color { get; set; } = "#64748b";
}

public class Workflow
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public List<WorkflowStatus> Statuses { get; set; } = [];
    /// <summary>fromStatusId → exact list of allowed toStatusIds. Empty = rules off (any move); a missing entry = any.</summary>
    public Dictionary<string, List<string>> Transitions { get; set; } = [];

    public bool CanTransition(string fromId, string toId)
    {
        if (fromId == toId) return true;
        if (!Statuses.Any(s => s.Id == toId)) return false;
        return !Transitions.TryGetValue(fromId, out var allowed) || allowed.Contains(toId);
    }

    public string? CategoryOf(string statusId) => Statuses.FirstOrDefault(s => s.Id == statusId)?.Category;
}

public class Product
{
    public string Id { get; set; } = "";
    public string Key { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public string? Version { get; set; }
    /// <summary>planning · active · maintenance · sunset</summary>
    public string Lifecycle { get; set; } = "active";
    public string LeadId { get; set; } = "";
    public List<string> ClientIds { get; set; } = [];
    public string WorkflowId { get; set; } = "";
    public string? DivisionId { get; set; }
    public List<string> MemberIds { get; set; } = [];
    public string Color { get; set; } = "#7cb4f5";
    public string? GithubUrl { get; set; }
    public string? WebsiteUrl { get; set; }
    public int IssueCounter { get; set; } = 1;
    public DateTimeOffset CreatedAt { get; set; }
    public bool Archived { get; set; }
}

public class Issue
{
    public string Id { get; set; } = "";
    public string Key { get; set; } = "";
    public string ProductId { get; set; } = "";
    /// <summary>story · task · bug · epic · request · support</summary>
    public string Type { get; set; } = "task";
    public string Summary { get; set; } = "";
    public string? Description { get; set; }
    public string StatusId { get; set; } = "";
    /// <summary>highest · high · medium · low · lowest</summary>
    public string Priority { get; set; } = "medium";
    public string? AssigneeId { get; set; }
    public string ReporterId { get; set; } = "";
    public string? ClientId { get; set; }
    public string? SprintId { get; set; }
    public string? ParentId { get; set; }
    public double? StoryPoints { get; set; }
    public List<string> Labels { get; set; } = [];
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? StartAt { get; set; }
    public DateTimeOffset? EndAt { get; set; }
    public DateTimeOffset? DueDate { get; set; }
    public int? Progress { get; set; }
    public string? EstimatedBenefits { get; set; }
    public string? AchievedBenefits { get; set; }
    public int? Round { get; set; }
    public double? Rank { get; set; }
    public int? EstimateMinutes { get; set; }
    /// <summary>l1 · l2 · l3 for support tickets</summary>
    public string? SupportLevel { get; set; }
    public DateTimeOffset? FirstResponseAt { get; set; }
    public Dictionary<string, JsonElement> CustomFields { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

public class WorkLog
{
    public string Id { get; set; } = "";
    public string IssueId { get; set; } = "";
    public string UserId { get; set; } = "";
    public DateTimeOffset StartedAt { get; set; }
    public int Minutes { get; set; }
    /// <summary>design · development · testing · analysis · meeting · documentation</summary>
    public string Activity { get; set; } = "development";
    public string? Note { get; set; }
    public bool FromTimer { get; set; }
}

public class RunningTimer
{
    public string UserId { get; set; } = "";
    public string IssueId { get; set; } = "";
    public string Activity { get; set; } = "development";
    public DateTimeOffset StartedAt { get; set; }
}

public class Comment
{
    public string Id { get; set; } = "";
    public string IssueId { get; set; } = "";
    public string AuthorId { get; set; } = "";
    public string Body { get; set; } = "";
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Attachment metadata; the bytes go to object storage (S3) in Step 18d</summary>
public class Attachment
{
    public string Id { get; set; } = "";
    public string IssueId { get; set; } = "";
    public string Name { get; set; } = "";
    public long Size { get; set; }
    public string Type { get; set; } = "";
    public string UploadedBy { get; set; } = "";
    /// <summary>Where the bytes are in the file store (Step 18d). Server-only: never sent to or accepted from browsers.</summary>
    [System.Text.Json.Serialization.JsonIgnore]
    public string? StorageKey { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

/// <summary>Ticket / product history entry</summary>
public class Activity
{
    public string Id { get; set; } = "";
    public string? IssueId { get; set; }
    public string? ProductId { get; set; }
    public string UserId { get; set; } = "";
    public string Action { get; set; } = "";
    public string? From { get; set; }
    public string? To { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class Roadmap
{
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string Name { get; set; } = "";
    public string? Description { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? DueDate { get; set; }
    /// <summary>planned · in_progress · on_hold · completed · cancelled</summary>
    public string Status { get; set; } = "planned";
    public DateTimeOffset? CompletedAt { get; set; }
    public string? AchievedBenefits { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}

public class Sprint
{
    public string Id { get; set; } = "";
    public string ProductId { get; set; } = "";
    public string? RoadmapId { get; set; }
    public string Name { get; set; } = "";
    public string? Goal { get; set; }
    /// <summary>planned · active · closed</summary>
    public string State { get; set; } = "planned";
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
    public double? CommittedPoints { get; set; }
    public double? CompletedPoints { get; set; }
    public DateTimeOffset? CompletedAt { get; set; }
}

public class CustomFieldDef
{
    public string Id { get; set; } = "";
    public string? ProductId { get; set; }
    public string Name { get; set; } = "";
    /// <summary>text · number · date · select · checkbox</summary>
    public string Type { get; set; } = "text";
    public List<string>? Options { get; set; }
    public bool Required { get; set; }
}

public class AutomationTriggerDef
{
    /// <summary>issue_created · status_changed · assignee_changed · priority_changed · comment_added · sla_at_risk · sla_breached · due_passed</summary>
    public string Type { get; set; } = "issue_created";
    public string? Value { get; set; }
}

public class AutomationCondition
{
    public string Field { get; set; } = "type";
    /// <summary>is · is_not</summary>
    public string Op { get; set; } = "is";
    public string Value { get; set; } = "";
}

public class AutomationAction
{
    public string Type { get; set; } = "add_label";
    public string Value { get; set; } = "";
}

public class AutomationRule
{
    public string Id { get; set; } = "";
    public string? ProductId { get; set; }
    public string Name { get; set; } = "";
    public bool Enabled { get; set; }
    public AutomationTriggerDef Trigger { get; set; } = new();
    public List<AutomationCondition> Conditions { get; set; } = [];
    public List<AutomationAction> Actions { get; set; } = [];
    public DateTimeOffset CreatedAt { get; set; }
    public string CreatedBy { get; set; } = "";
    public int RunCount { get; set; }
    public DateTimeOffset? LastRunAt { get; set; }
    public int? RrIndex { get; set; }
    public List<string> FiredFor { get; set; } = [];
}

public class AutomationRun
{
    public string Id { get; set; } = "";
    public string RuleId { get; set; } = "";
    public string RuleName { get; set; } = "";
    public string IssueId { get; set; } = "";
    public string IssueKey { get; set; } = "";
    public string Trigger { get; set; } = "";
    public DateTimeOffset At { get; set; }
    /// <summary>done · partial · failed</summary>
    public string Outcome { get; set; } = "done";
    public List<string> Details { get; set; } = [];
}

public class SlaPolicy
{
    public string Id { get; set; } = "";
    public string Level { get; set; } = "l1";
    public string Priority { get; set; } = "medium";
    public int ResponseMinutes { get; set; }
    public int ResolutionMinutes { get; set; }
}

/// <summary>CXO summary commentary keyed by period ("week:2026-11-23" / "month:2026-11")</summary>
public class SummaryNote
{
    public string Key { get; set; } = "";
    public string Text { get; set; } = "";
}

/// <summary>Step 18d: leave request kept by nPro's server-side attendance adapter (sample provider) — sick or casual</summary>
public class LeaveRequest
{
    public string Id { get; set; } = "";
    /// <summary>nPro person id</summary>
    public string PersonId { get; set; } = "";
    /// <summary>sick · casual</summary>
    public string Type { get; set; } = "casual";
    /// <summary>Local calendar days "yyyy-MM-dd" (inclusive)</summary>
    public string From { get; set; } = "";
    public string To { get; set; } = "";
    public bool HalfDay { get; set; }
    public string Reason { get; set; } = "";
    /// <summary>pending · approved · rejected · cancelled</summary>
    public string Status { get; set; } = "pending";
    public DateTimeOffset AppliedAt { get; set; }
    public string? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}

/// <summary>Step 18d: request to correct a past day's punch in / out</summary>
public class RegularisationRequest
{
    public string Id { get; set; } = "";
    public string PersonId { get; set; } = "";
    public string Date { get; set; } = "";
    public DateTimeOffset PunchIn { get; set; }
    public DateTimeOffset PunchOut { get; set; }
    public string Reason { get; set; } = "";
    public string Status { get; set; } = "pending";
    public DateTimeOffset AppliedAt { get; set; }
    public string? DecidedBy { get; set; }
    public DateTimeOffset? DecidedAt { get; set; }
}
