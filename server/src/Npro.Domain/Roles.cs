namespace Npro.Domain;

/// <summary>Role ids (same strings as src/app/core/roles.ts)</summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string DivisionHead = "division_head";
    public const string AssistantManager = "assistant_manager";
    public const string BusinessAnalyst = "business_analyst";
    public const string TechLead = "tech_lead";
    public const string Developer = "developer";
    public const string Tester = "tester";
    public const string ProductionUser = "production_user";

    public static readonly string[] All = [Admin, DivisionHead, AssistantManager, BusinessAnalyst, TechLead, Developer, Tester, ProductionUser];
}

public static class UserKinds
{
    public const string Internal = "internal";
    public const string Vendor = "vendor";
    public const string Client = "client";
}

/// <summary>What a role may do within the products it can see (mirror of ROLE_CAPABILITIES in roles.ts)</summary>
public static class Capabilities
{
    public const string Organisation = "organisation";
    public const string Products = "products";
    public const string Roadmaps = "roadmaps";
    public const string Sprints = "sprints";
    public const string Tickets = "tickets";
    public const string Time = "time";
    public const string Reports = "reports";
    public const string Summary = "summary";

    private static readonly Dictionary<string, string[]> ByRole = new()
    {
        [Roles.Admin] = [Organisation, Products, Roadmaps, Sprints, Tickets, Time, Reports, Summary],
        [Roles.DivisionHead] = [Products, Roadmaps, Sprints, Tickets, Time, Reports, Summary],
        [Roles.AssistantManager] = [Products, Roadmaps, Sprints, Tickets, Time, Reports, Summary],
        [Roles.BusinessAnalyst] = [Roadmaps, Sprints, Tickets, Time, Reports],
        [Roles.TechLead] = [Sprints, Tickets, Time, Reports],
        [Roles.Developer] = [Tickets, Time],
        [Roles.Tester] = [Tickets, Time],
        [Roles.ProductionUser] = [Tickets],
    };

    public static IReadOnlyList<string> Of(string role) => ByRole.TryGetValue(role, out var caps) ? caps : [];

    public static bool Can(string role, string capability) => Of(role).Contains(capability);
}
