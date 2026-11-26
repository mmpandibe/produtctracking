using System.Text.Json;
using Npro.Domain;

namespace Npro.Infrastructure;

/// <summary>
/// The demo organisation (port of src/app/core/seed.ts) so a fresh database looks like the Phase A app.
/// Dates are relative to "now" so SLA clocks, sprints and overdue flags make sense on any day.
/// </summary>
public static class DemoData
{
    public sealed record Set(
        List<User> Users, List<Division> Divisions, List<Team> Teams, List<Vendor> Vendors, List<Client> Clients,
        List<Workflow> Workflows, List<Product> Products, List<Issue> Issues, List<WorkLog> WorkLogs, List<Comment> Comments,
        List<Activity> Activities, List<Roadmap> Roadmaps, List<Sprint> Sprints, List<CustomFieldDef> CustomFields,
        List<AutomationRule> AutomationRules, List<SlaPolicy> SlaPolicies, List<SupportLevelConfig> SupportLevels);

    public static Workflow DefaultWorkflow() => new()
    {
        Id = "wf-default",
        Name = "Delivery workflow",
        Statuses =
        [
            new() { Id = "new", Name = "New", Category = "todo", Color = "#64748b" },
            new() { Id = "dev", Name = "Development In Progress", Category = "in_progress", Color = "#2563eb" },
            new() { Id = "testing", Name = "Testing", Category = "in_progress", Color = "#7c3aed" },
            new() { Id = "ready_uat", Name = "Ready for UAT", Category = "in_progress", Color = "#0891b2" },
            new() { Id = "uat", Name = "UAT In Progress", Category = "in_progress", Color = "#0e7490" },
            new() { Id = "ready_qa", Name = "Ready for QA", Category = "in_progress", Color = "#d97706" },
            new() { Id = "qa", Name = "QA In Progress", Category = "in_progress", Color = "#b45309" },
            new() { Id = "ready_live", Name = "Ready for Live", Category = "in_progress", Color = "#059669" },
            new() { Id = "live", Name = "Live", Category = "done", Color = "#16a34a" },
            new() { Id = "hold", Name = "Hold", Category = "hold", Color = "#dc2626" },
            new() { Id = "closed", Name = "Closed", Category = "done", Color = "#475569" },
        ],
    };

    /// <summary>Default SLA targets in minutes (response, resolution) per support level and priority</summary>
    public static List<SlaPolicy> DefaultSlaPolicies()
    {
        var targets = new Dictionary<string, (string P, int R, int F)[]>
        {
            ["l1"] = [("highest", 15, 240), ("high", 30, 480), ("medium", 60, 1440), ("low", 240, 2880), ("lowest", 480, 4320)],
            ["l2"] = [("highest", 30, 480), ("high", 60, 960), ("medium", 240, 2880), ("low", 480, 4320), ("lowest", 1440, 7200)],
            ["l3"] = [("highest", 60, 1440), ("high", 120, 2880), ("medium", 480, 4320), ("low", 1440, 7200), ("lowest", 2880, 10080)],
        };
        return targets.SelectMany(kv => kv.Value.Select(t => new SlaPolicy
        {
            Id = $"sla-{kv.Key}-{t.P}", Level = kv.Key, Priority = t.P, ResponseMinutes = t.R, ResolutionMinutes = t.F,
        })).ToList();
    }

    public static Set Build(DateTimeOffset now)
    {
        var local = now.ToLocalTime();
        // t(daysAgo, hour): that day at hour:00 local time; h(hoursAgo): an exact moment
        DateTimeOffset T(int daysAgo, int hour = 10) => new DateTimeOffset(local.Date.AddDays(-daysAgo).AddHours(hour), local.Offset);
        DateTimeOffset H(double hoursAgo) => now.AddHours(-hoursAgo);

        var users = new List<User>
        {
            new() { Id = "u1", EmployeeId = "EMP-001", Name = "Alex Morgan", Email = "alex@example.com", Role = Roles.Admin, Title = "Head of delivery", Color = "#f59a7e" },
            new() { Id = "u2", EmployeeId = "EMP-002", Name = "Priya Shah", Email = "priya@example.com", Role = Roles.DivisionHead, Title = "Head of Digital Products", ManagerId = "u1", Color = "#7cb4f5" },
            new() { Id = "u5", EmployeeId = "EMP-005", Name = "Ravi Kumar", Email = "ravi@example.com", Role = Roles.DivisionHead, Title = "Head of Enterprise Solutions", ManagerId = "u1", Color = "#b9a3f5" },
            new() { Id = "u6", EmployeeId = "EMP-006", Name = "Meera Iyer", Email = "meera@example.com", Role = Roles.AssistantManager, TeamId = "t1", ManagerId = "u2", Color = "#f29bc4" },
            new() { Id = "u7", EmployeeId = "EMP-007", Name = "Tom Becker", Email = "tom@example.com", Role = Roles.AssistantManager, TeamId = "t3", ManagerId = "u5", Color = "#8fd3d1" },
            new() { Id = "u8", EmployeeId = "EMP-008", Name = "Lena Fischer", Email = "lena@example.com", Role = Roles.BusinessAnalyst, TeamId = "t1", ManagerId = "u6", Color = "#f5b971" },
            new() { Id = "u3", EmployeeId = "EMP-003", Name = "Sam Lee", Email = "sam@example.com", Role = Roles.TechLead, TeamId = "t1", ManagerId = "u6", Color = "#7ed98f" },
            new() { Id = "u4", EmployeeId = "EMP-004", Name = "Jordan Diaz", Email = "jordan@example.com", Role = Roles.Developer, TeamId = "t1", ManagerId = "u3", Color = "#f5c84a" },
            new() { Id = "u9", EmployeeId = "EMP-009", Name = "Chris Novak", Email = "chris@example.com", Role = Roles.Tester, TeamId = "t2", ManagerId = "u6", Color = "#a3c9f5" },
            new() { Id = "u10", Name = "Vikram Rao", Email = "vikram@nimbus.test", Role = Roles.Developer, Kind = UserKinds.Vendor, VendorId = "v1", TeamId = "t3", ManagerId = "u7", Title = "Contract developer", Color = "#d1b38f" },
            new() { Id = "u11", Name = "Dana White", Email = "dana@acme.test", Role = Roles.ProductionUser, Kind = UserKinds.Client, ClientId = "c1", Title = "IT manager, Acme", Color = "#c7d98f" },
            new() { Id = "u12", EmployeeId = "EMP-012", Name = "Neha Gupta", Email = "neha@example.com", Role = Roles.ProductionUser, Title = "Operations", Color = "#e3a3a3" },
            new() { Id = "u13", EmployeeId = "EMP-013", Name = "Ana Costa", Email = "ana@example.com", Role = Roles.Tester, TeamId = "t4", ManagerId = "u6", Title = "Support engineer", Color = "#9fd8b4" },
        };

        var products = new List<Product>
        {
            new() { Id = "p1", Key = "WEB", Name = "Web App", Description = "Customer-facing web application", Version = "3.2", Lifecycle = "active", LeadId = "u2", DivisionId = "d1", MemberIds = ["u6", "u8", "u3", "u4", "u9", "u13"], ClientIds = ["c1", "c2"], WorkflowId = "wf-default", Color = "#f5c84a", GithubUrl = "https://github.com/example/web-app", WebsiteUrl = "https://app.example.com", IssueCounter = 6, CreatedAt = T(40) },
            new() { Id = "p2", Key = "MOB", Name = "Mobile App", Description = "iOS and Android apps", Version = "1.0", Lifecycle = "planning", LeadId = "u6", DivisionId = "d1", MemberIds = ["u3", "u4", "u9", "u13"], ClientIds = ["c1", "c2"], WorkflowId = "wf-default", Color = "#f29bc4", GithubUrl = "https://github.com/example/mobile-app", IssueCounter = 4, CreatedAt = T(25) },
            new() { Id = "p3", Key = "ANL", Name = "Analytics Suite", Description = "Reporting and BI module for enterprise clients", Version = "5.8", Lifecycle = "maintenance", LeadId = "u7", DivisionId = "d2", MemberIds = ["u10", "u4", "u3", "u13"], ClientIds = ["c2", "c3"], WorkflowId = "wf-default", Color = "#7ed98f", IssueCounter = 3, CreatedAt = T(12) },
        };

        static Dictionary<string, JsonElement> Fields(params (string K, string V)[] kv) => kv.ToDictionary(x => x.K, x => JsonSerializer.SerializeToElement(x.V));

        var issues = new List<Issue>
        {
            new() { Id = "i1", Key = "WEB-1", ProductId = "p1", Type = "story", Summary = "New homepage layout", StatusId = "live", Priority = "high", AssigneeId = "u3", ReporterId = "u2", ClientId = "c1", StoryPoints = 5, StartAt = T(20, 9), EndAt = T(15, 17), CreatedAt = T(22), UpdatedAt = T(15),
                SprintId = "s0", StartDate = T(20), DueDate = T(15), Progress = 100, Round = 1, EstimatedBenefits = "Higher sign-up conversion from the homepage", AchievedBenefits = "Sign-ups up 12% in the first two weeks" },
            new() { Id = "i2", Key = "WEB-2", ProductId = "p1", Type = "bug", Summary = "Login button misaligned on Safari", StatusId = "dev", CustomFields = Fields(("cf-env", "Production")), ParentId = "i1", Priority = "medium", AssigneeId = "u4", ReporterId = "u2", ClientId = "c1", StoryPoints = 2, StartAt = T(3, 11), CreatedAt = T(5), UpdatedAt = T(1),
                SprintId = "s1", StartDate = T(3), DueDate = T(-2), Progress = 60, EstimateMinutes = 480, Round = 2, EstimatedBenefits = "Fewer failed logins on Safari (about 8% of sessions)" },
            new() { Id = "i3", Key = "WEB-3", ProductId = "p1", Type = "task", Summary = "Set up analytics tracking", StatusId = "new", Priority = "low", ReporterId = "u1", ClientId = "c2", CreatedAt = T(2), UpdatedAt = T(2),
                SprintId = "s1", DueDate = T(-5), Progress = 0, EstimateMinutes = 240 },
            new() { Id = "i4", Key = "MOB-1", ProductId = "p2", Type = "story", Summary = "Push notifications", StatusId = "testing", Priority = "high", AssigneeId = "u3", ReporterId = "u1", ClientId = "c2", StoryPoints = 8, StartAt = T(8, 10), CreatedAt = T(10), UpdatedAt = T(1),
                SprintId = "s3", StartDate = T(8), DueDate = T(-1), Progress = 80, EstimateMinutes = 960, Round = 1, EstimatedBenefits = "Re-engage inactive users" },
            new() { Id = "i5", Key = "MOB-2", ProductId = "p2", Type = "bug", Summary = "Crash on Android 12 startup", StatusId = "closed", Priority = "highest", AssigneeId = "u4", ReporterId = "u1", ClientId = "c1", StoryPoints = 3, StartAt = T(6, 9), EndAt = T(5, 18), CreatedAt = T(7), UpdatedAt = T(5),
                SprintId = "s3", StartDate = T(6), DueDate = T(5), Progress = 100 },
            new() { Id = "i6", Key = "ANL-1", ProductId = "p3", Type = "request", Summary = "Monthly revenue export is empty", StatusId = "new", Priority = "high", ReporterId = "u3", ClientId = "c3", SupportLevel = "l1", CreatedAt = T(1), UpdatedAt = T(1),
                SprintId = "s5", DueDate = T(1), Progress = 0 },
            new() { Id = "i7", Key = "ANL-2", ProductId = "p3", Type = "support", Summary = "Client cannot log in to the dashboard", StatusId = "hold", Priority = "highest", AssigneeId = "u4", ReporterId = "u3", ClientId = "c2", Labels = ["access"], SupportLevel = "l2", FirstResponseAt = T(2, 11), CreatedAt = T(2), UpdatedAt = T(1),
                SprintId = "s5", StartDate = T(1), DueDate = T(-3), Progress = 20 },
            new() { Id = "i8", Key = "WEB-4", ProductId = "p1", Type = "support", Summary = "Password reset email not arriving", StatusId = "dev", Priority = "high", AssigneeId = "u13", ReporterId = "u12", SupportLevel = "l1", FirstResponseAt = H(2.6), StartAt = H(2.6), CreatedAt = H(3), UpdatedAt = H(2.6) },
            new() { Id = "i9", Key = "MOB-3", ProductId = "p2", Type = "bug", Summary = "App crashes when uploading a photo", Description = "Happens on iPhone 13 with iOS 18 when the photo is larger than 10 MB.", StatusId = "new", Priority = "medium", ReporterId = "u11", ClientId = "c1", SupportLevel = "l1", CreatedAt = H(0.8), UpdatedAt = H(0.8) },
            new() { Id = "i10", Key = "WEB-5", ProductId = "p1", Type = "support", Summary = "Invoice PDF shows the wrong VAT rate", StatusId = "closed", Priority = "medium", AssigneeId = "u4", ReporterId = "u11", ClientId = "c1", SupportLevel = "l2", FirstResponseAt = H(95), StartAt = H(95), EndAt = H(74), Progress = 100, CreatedAt = H(96), UpdatedAt = H(74) },
        };

        var templates = new (string Name, AutomationTriggerDef Trigger, List<AutomationCondition> Conditions, List<AutomationAction> Actions)[]
        {
            ("Escalate breached L1 support tickets", new() { Type = "sla_breached" }, [new() { Field = "support_level", Value = "l1" }],
                [new() { Type = "escalate" }, new() { Type = "add_comment", Value = "SLA breached at L1 — escalated automatically." }]),
            ("Share new support tickets across the Service Desk", new() { Type = "issue_created" }, [new() { Field = "type", Value = "support" }, new() { Field = "assignee", Value = "" }],
                [new() { Type = "assign_round_robin", Value = "t4" }]),
            ("Flag urgent client tickets", new() { Type = "issue_created" }, [new() { Field = "priority", Value = "highest" }, new() { Field = "reporter_kind", Value = "production" }],
                [new() { Type = "add_label", Value = "urgent-client" }, new() { Type = "add_comment", Value = "Urgent ticket from a client — please pick up today." }]),
            ("Raise priority of overdue tickets", new() { Type = "due_passed" }, [new() { Field = "priority", Op = "is_not", Value = "highest" }],
                [new() { Type = "set_priority", Value = "high" }, new() { Type = "add_label", Value = "overdue" }]),
        };

        return new Set(
            Users: users,
            Divisions:
            [
                new() { Id = "d1", Name = "Digital Products", Description = "Customer-facing web and mobile apps", HeadId = "u2", Color = "#7cb4f5" },
                new() { Id = "d2", Name = "Enterprise Solutions", Description = "Reporting and BI for enterprise clients", HeadId = "u5", Color = "#b9a3f5" },
            ],
            Teams:
            [
                new() { Id = "t1", DivisionId = "d1", Name = "Web & Mobile", ManagerId = "u6" },
                new() { Id = "t2", DivisionId = "d1", Name = "Quality Assurance", ManagerId = "u6" },
                new() { Id = "t3", DivisionId = "d2", Name = "Analytics", ManagerId = "u7" },
                new() { Id = "t4", DivisionId = "d1", Name = "Service Desk", Description = "First-line support for all products", ManagerId = "u6" },
            ],
            Vendors: [new() { Id = "v1", Name = "Nimbus Dev Labs", ContactName = "Arun Mehta", ContactEmail = "arun@nimbus.test", ContactPhone = "+91 80 4000 1200", Notes = "Fixed-capacity contract: 2 developers" }],
            Clients:
            [
                new() { Id = "c1", Name = "Acme Corp", ContactName = "Dana White", ContactEmail = "dana@acme.test", ContactPhone = "+1 555 0100", Notes = "Key account. Escalate outages to Dana directly." },
                new() { Id = "c2", Name = "Globex", ContactName = "Hank Scorpio", ContactEmail = "hank@globex.test", ContactPhone = "+1 555 0142" },
                new() { Id = "c3", Name = "Initech", ContactName = "Bill L.", ContactEmail = "bill@initech.test" },
            ],
            Workflows: [DefaultWorkflow()],
            Products: products,
            Issues: issues,
            WorkLogs:
            [
                new() { Id = "w1", IssueId = "i2", UserId = "u4", StartedAt = T(3, 11), Minutes = 180, Activity = "development", Note = "CSS fix for Safari flexbox" },
                new() { Id = "w2", IssueId = "i2", UserId = "u4", StartedAt = T(2, 10), Minutes = 60, Activity = "analysis" },
                new() { Id = "w3", IssueId = "i4", UserId = "u3", StartedAt = T(1, 14), Minutes = 120, Activity = "testing", Note = "Android + iOS smoke test" },
                new() { Id = "w4", IssueId = "i1", UserId = "u3", StartedAt = T(18, 9), Minutes = 240, Activity = "design" },
            ],
            Comments:
            [
                new() { Id = "cm1", IssueId = "i2", AuthorId = "u2", Body = "Reproduced on Safari 17. Happens only on the login page.", CreatedAt = T(2, 15) },
                new() { Id = "cm2", IssueId = "i8", AuthorId = "u13", Body = "Thanks Neha, checking the mail server logs now.", CreatedAt = H(2.6) },
            ],
            Activities:
            [
                new() { Id = "a-esc1", IssueId = "i7", ProductId = "p3", UserId = "u13", Action = "escalated", From = "L1", To = "L2", CreatedAt = T(2, 12) },
                new() { Id = "a-esc2", IssueId = "i10", ProductId = "p1", UserId = "u13", Action = "escalated", From = "L1", To = "L2", CreatedAt = H(93) },
            ],
            Roadmaps:
            [
                new() { Id = "r1", ProductId = "p1", Name = "Web App 2026 revamp", Description = "New homepage, login fixes and analytics", StartDate = T(28), DueDate = T(-21), Status = "in_progress", CreatedAt = T(30), AchievedBenefits = "Homepage redesign live; sign-ups up 12%" },
                new() { Id = "r2", ProductId = "p2", Name = "Mobile v1 launch", Description = "First public release on iOS and Android", StartDate = T(10), DueDate = T(-18), Status = "in_progress", CreatedAt = T(12) },
                new() { Id = "r3", ProductId = "p3", Name = "Analytics stability", Description = "Fix export and access issues for enterprise clients", StartDate = T(5), DueDate = T(-9), Status = "planned", CreatedAt = T(6) },
            ],
            Sprints:
            [
                new() { Id = "s0", ProductId = "p1", RoadmapId = "r1", Name = "WEB Sprint 11", Goal = "Homepage redesign", State = "closed", StartDate = T(28), EndDate = T(14), CommittedPoints = 8, CompletedPoints = 5, CompletedAt = T(14) },
                new() { Id = "s1", ProductId = "p1", RoadmapId = "r1", Name = "WEB Sprint 12", Goal = "Login and analytics fixes", State = "active", StartDate = T(7), EndDate = T(-7) },
                new() { Id = "s2", ProductId = "p1", RoadmapId = "r1", Name = "WEB Sprint 13", State = "planned", StartDate = T(-7), EndDate = T(-21) },
                new() { Id = "s3", ProductId = "p2", RoadmapId = "r2", Name = "MOB Sprint 3", Goal = "Release candidate", State = "active", StartDate = T(10), EndDate = T(-4) },
                new() { Id = "s4", ProductId = "p2", RoadmapId = "r2", Name = "MOB Sprint 4", State = "planned", StartDate = T(-4), EndDate = T(-18) },
                new() { Id = "s5", ProductId = "p3", RoadmapId = "r3", Name = "ANL Sprint 8", State = "active", StartDate = T(5), EndDate = T(-9) },
            ],
            CustomFields:
            [
                new() { Id = "cf-env", Name = "Environment", Type = "select", Options = ["Production", "Staging", "Development"] },
                new() { Id = "cf-ref", Name = "Customer reference", Type = "text", ProductId = "p3" },
            ],
            AutomationRules: templates.Select((t, n) => new AutomationRule
            {
                Id = $"ar{n + 1}", Name = t.Name, Enabled = n == 0, Trigger = t.Trigger, Conditions = t.Conditions, Actions = t.Actions,
                CreatedAt = now, CreatedBy = "u1",
            }).ToList(),
            SlaPolicies: DefaultSlaPolicies(),
            SupportLevels:
            [
                new() { Level = "l1", Name = "Service desk", Description = "First contact: triage, known fixes, how-to questions", TeamId = "t4" },
                new() { Level = "l2", Name = "Product support", Description = "Product team: configuration, data fixes, deeper analysis", TeamId = "t1" },
                new() { Level = "l3", Name = "Engineering", Description = "Code changes, infrastructure, vendor escalations", TeamId = "t3" },
            ]);
    }
}
