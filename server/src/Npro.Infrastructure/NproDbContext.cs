using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Npro.Domain;

namespace Npro.Infrastructure;

/// <summary>
/// The nPro database (MS SQL Server in every environment; SQLite in-memory in tests).
/// Sign-in accounts are ASP.NET Core Identity users whose Id equals the nPro <see cref="User"/> Id.
/// </summary>
public class NproDbContext(DbContextOptions<NproDbContext> options) : IdentityDbContext<IdentityUser>(options)
{
    public DbSet<User> People => Set<User>();
    public DbSet<Division> Divisions => Set<Division>();
    public DbSet<Team> Teams => Set<Team>();
    public DbSet<Vendor> Vendors => Set<Vendor>();
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Workflow> Workflows => Set<Workflow>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Issue> Issues => Set<Issue>();
    public DbSet<WorkLog> WorkLogs => Set<WorkLog>();
    public DbSet<RunningTimer> Timers => Set<RunningTimer>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Attachment> Attachments => Set<Attachment>();
    public DbSet<Activity> Activities => Set<Activity>();
    public DbSet<Roadmap> Roadmaps => Set<Roadmap>();
    public DbSet<Sprint> Sprints => Set<Sprint>();
    public DbSet<CustomFieldDef> CustomFields => Set<CustomFieldDef>();
    public DbSet<AutomationRule> AutomationRules => Set<AutomationRule>();
    public DbSet<AutomationRun> AutomationRuns => Set<AutomationRun>();
    public DbSet<SlaPolicy> SlaPolicies => Set<SlaPolicy>();
    public DbSet<SupportLevelConfig> SupportLevels => Set<SupportLevelConfig>();
    public DbSet<SummaryNote> SummaryNotes => Set<SummaryNote>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<RegularisationRequest> RegularisationRequests => Set<RegularisationRequest>();

    private const int IdLength = 64;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        b.Entity<User>(e =>
        {
            e.ToTable("People");
            Id(e);
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Email).HasMaxLength(256);
            e.HasIndex(x => x.Email).IsUnique();
            e.Property(x => x.Role).HasMaxLength(32);
            e.Property(x => x.Kind).HasMaxLength(16);
            e.Property(x => x.Color).HasMaxLength(16);
            e.Property(x => x.Title).HasMaxLength(200);
            e.Property(x => x.Phone).HasMaxLength(50);
            e.Property(x => x.EmployeeId).HasMaxLength(20);
            e.HasIndex(x => x.EmployeeId).IsUnique().HasFilter("[EmployeeId] IS NOT NULL");
            Ref(e, x => x.TeamId, x => x.ManagerId, x => x.VendorId, x => x.ClientId);
        });
        b.Entity<Division>(e => { Id(e); e.Property(x => x.Name).HasMaxLength(200); e.Property(x => x.Color).HasMaxLength(16); Ref(e, x => x.HeadId); });
        b.Entity<Team>(e => { Id(e); e.Property(x => x.Name).HasMaxLength(200); Ref(e, x => x.DivisionId, x => x.ManagerId); e.HasIndex(x => x.DivisionId); });
        b.Entity<Vendor>(e => { Id(e); e.Property(x => x.Name).HasMaxLength(200); });
        b.Entity<Client>(e => { Id(e); e.Property(x => x.Name).HasMaxLength(200); });

        b.Entity<Workflow>(e =>
        {
            Id(e);
            e.Property(x => x.Name).HasMaxLength(200);
            e.OwnsMany(x => x.Statuses, s => s.ToJson());
            JsonColumn(e.Property(x => x.Transitions));
        });

        b.Entity<Product>(e =>
        {
            Id(e);
            e.Property(x => x.Key).HasMaxLength(10);
            e.HasIndex(x => x.Key).IsUnique();
            e.Property(x => x.Name).HasMaxLength(200);
            e.Property(x => x.Lifecycle).HasMaxLength(16);
            e.Property(x => x.Color).HasMaxLength(16);
            Ref(e, x => x.LeadId, x => x.WorkflowId, x => x.DivisionId);
        });

        b.Entity<Issue>(e =>
        {
            Id(e);
            e.Property(x => x.Key).HasMaxLength(24);
            e.HasIndex(x => x.Key).IsUnique();
            e.HasIndex(x => x.ProductId);
            e.HasIndex(x => x.AssigneeId);
            e.Property(x => x.Summary).HasMaxLength(500);
            e.Property(x => x.Type).HasMaxLength(16);
            e.Property(x => x.Priority).HasMaxLength(16);
            e.Property(x => x.SupportLevel).HasMaxLength(4);
            Ref(e, x => x.ProductId, x => x.StatusId, x => x.AssigneeId, x => x.ReporterId, x => x.ClientId, x => x.SprintId, x => x.ParentId);
            JsonColumn(e.Property(x => x.CustomFields));
        });

        b.Entity<WorkLog>(e => { Id(e); Ref(e, x => x.IssueId, x => x.UserId); e.HasIndex(x => new { x.UserId, x.StartedAt }); e.HasIndex(x => x.IssueId); e.Property(x => x.Activity).HasMaxLength(24); });
        b.Entity<RunningTimer>(e => { e.HasKey(x => x.UserId); Ref(e, x => x.UserId, x => x.IssueId); e.Property(x => x.Activity).HasMaxLength(24); });
        b.Entity<Comment>(e => { Id(e); Ref(e, x => x.IssueId, x => x.AuthorId); e.HasIndex(x => x.IssueId); });
        b.Entity<Attachment>(e => { Id(e); Ref(e, x => x.IssueId, x => x.UploadedBy); e.HasIndex(x => x.IssueId); e.Property(x => x.Name).HasMaxLength(260); e.Property(x => x.Type).HasMaxLength(128); e.Property(x => x.StorageKey).HasMaxLength(512); });
        b.Entity<Activity>(e => { Id(e); Ref(e, x => x.IssueId, x => x.ProductId, x => x.UserId); e.HasIndex(x => x.IssueId); e.Property(x => x.Action).HasMaxLength(64); e.Property(x => x.From).HasMaxLength(500); e.Property(x => x.To).HasMaxLength(500); });
        b.Entity<Roadmap>(e => { Id(e); Ref(e, x => x.ProductId); e.HasIndex(x => x.ProductId); e.Property(x => x.Name).HasMaxLength(200); e.Property(x => x.Status).HasMaxLength(16); });
        b.Entity<Sprint>(e => { Id(e); Ref(e, x => x.ProductId, x => x.RoadmapId); e.HasIndex(x => x.ProductId); e.Property(x => x.Name).HasMaxLength(200); e.Property(x => x.State).HasMaxLength(16); });
        b.Entity<CustomFieldDef>(e => { Id(e); Ref(e, x => x.ProductId); e.Property(x => x.Name).HasMaxLength(200); e.Property(x => x.Type).HasMaxLength(16); });

        b.Entity<AutomationRule>(e =>
        {
            Id(e);
            Ref(e, x => x.ProductId, x => x.CreatedBy);
            e.Property(x => x.Name).HasMaxLength(200);
            e.OwnsOne(x => x.Trigger, t => t.ToJson());
            e.OwnsMany(x => x.Conditions, c => c.ToJson());
            e.OwnsMany(x => x.Actions, a => a.ToJson());
        });
        b.Entity<AutomationRun>(e => { Id(e); Ref(e, x => x.RuleId, x => x.IssueId); e.HasIndex(x => x.At); e.Property(x => x.RuleName).HasMaxLength(200); e.Property(x => x.IssueKey).HasMaxLength(24); e.Property(x => x.Trigger).HasMaxLength(32); e.Property(x => x.Outcome).HasMaxLength(16); });

        b.Entity<SlaPolicy>(e => { Id(e); e.HasIndex(x => new { x.Level, x.Priority }).IsUnique(); e.Property(x => x.Level).HasMaxLength(4); e.Property(x => x.Priority).HasMaxLength(16); });
        b.Entity<SupportLevelConfig>(e => { e.HasKey(x => x.Level); e.Property(x => x.Level).HasMaxLength(4); e.Property(x => x.Name).HasMaxLength(200); Ref(e, x => x.TeamId); });
        b.Entity<SummaryNote>(e => { e.HasKey(x => x.Key); e.Property(x => x.Key).HasMaxLength(32); });
        b.Entity<LeaveRequest>(e => { Id(e); Ref(e, x => x.PersonId, x => x.DecidedBy); e.HasIndex(x => x.PersonId); e.Property(x => x.Type).HasMaxLength(16); e.Property(x => x.Status).HasMaxLength(16); e.Property(x => x.From).HasMaxLength(10); e.Property(x => x.To).HasMaxLength(10); e.Property(x => x.Reason).HasMaxLength(500); });
        b.Entity<RegularisationRequest>(e => { Id(e); Ref(e, x => x.PersonId, x => x.DecidedBy); e.HasIndex(x => new { x.PersonId, x.Date }); e.Property(x => x.Status).HasMaxLength(16); e.Property(x => x.Date).HasMaxLength(10); e.Property(x => x.Reason).HasMaxLength(500); });
    }

    private static void Id<T>(EntityTypeBuilder<T> e) where T : class
    {
        e.HasKey("Id");
        e.Property<string>("Id").HasMaxLength(IdLength);
    }

    /// <summary>Id-reference columns get the same length as ids</summary>
    private static void Ref<T>(EntityTypeBuilder<T> e, params System.Linq.Expressions.Expression<Func<T, string?>>[] props) where T : class
    {
        foreach (var p in props) e.Property(p).HasMaxLength(IdLength);
    }

    /// <summary>Stores a dictionary as a JSON text column, compared by content</summary>
    private static void JsonColumn<TValue>(PropertyBuilder<TValue> p) where TValue : class, new()
    {
        p.HasConversion(
            v => JsonSerializer.Serialize(v, Json),
            v => string.IsNullOrEmpty(v) ? new TValue() : JsonSerializer.Deserialize<TValue>(v, Json) ?? new TValue(),
            new ValueComparer<TValue>(
                (a, c) => JsonSerializer.Serialize(a, Json) == JsonSerializer.Serialize(c, Json),
                v => JsonSerializer.Serialize(v, Json).GetHashCode(),
                v => JsonSerializer.Deserialize<TValue>(JsonSerializer.Serialize(v, Json), Json)!));
    }
}
