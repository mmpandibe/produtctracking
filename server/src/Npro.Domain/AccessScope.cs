namespace Npro.Domain;

/// <summary>
/// What a signed-in person may see. Server-side port of <c>DataStore.access()</c> (src/app/core/data-store.ts) — every API
/// query filters through this, so the rules no longer depend on the browser.
/// </summary>
public sealed record AccessScope(
    bool All,
    IReadOnlySet<string> ProductIds,
    IReadOnlySet<string> UserIds,
    /// <summary>Production users: only tickets they reported or their client's</summary>
    bool OwnTicketsOnly,
    /// <summary>Developers, testers, production users: only their own time</summary>
    bool OwnTimeOnly)
{
    /// <summary>The organisation data the rules need</summary>
    public sealed record Org(
        IReadOnlyList<User> Users,
        IReadOnlyList<Division> Divisions,
        IReadOnlyList<Team> Teams,
        IReadOnlyList<Product> Products);

    public static AccessScope For(User me, Org org)
    {
        if (me.Role == Roles.Admin)
        {
            return new AccessScope(true, org.Products.Select(p => p.Id).ToHashSet(), org.Users.Select(u => u.Id).ToHashSet(), false, false);
        }

        var productIds = org.Products.Where(p => p.LeadId == me.Id || p.MemberIds.Contains(me.Id)).Select(p => p.Id).ToHashSet();
        var userIds = new HashSet<string> { me.Id };

        if (me.Role == Roles.DivisionHead)
        {
            var divIds = org.Divisions.Where(d => d.HeadId == me.Id).Select(d => d.Id).ToHashSet();
            foreach (var p in org.Products.Where(p => p.DivisionId != null && divIds.Contains(p.DivisionId))) productIds.Add(p.Id);
            foreach (var d in divIds) foreach (var u in DivisionMembers(d, org)) userIds.Add(u.Id);
            foreach (var u in ReportsOf(me.Id, org.Users)) userIds.Add(u.Id);
        }
        else if (me.Role == Roles.AssistantManager)
        {
            var teamIds = org.Teams.Where(t => t.ManagerId == me.Id).Select(t => t.Id).ToHashSet();
            foreach (var u in org.Users.Where(u => u.TeamId != null && teamIds.Contains(u.TeamId))) userIds.Add(u.Id);
            foreach (var u in ReportsOf(me.Id, org.Users)) userIds.Add(u.Id);
        }
        else if (me.Role == Roles.ProductionUser && me.ClientId != null)
        {
            // Client users can raise tickets on every product their company uses
            foreach (var p in org.Products.Where(p => p.ClientIds.Contains(me.ClientId))) productIds.Add(p.Id);
        }

        // Everyone working on a visible product can be seen (needed to assign work), except by production users
        if (me.Role != Roles.ProductionUser)
        {
            foreach (var p in org.Products.Where(p => productIds.Contains(p.Id)))
            {
                userIds.Add(p.LeadId);
                foreach (var m in p.MemberIds) userIds.Add(m);
            }
        }

        return new AccessScope(false, productIds, userIds,
            OwnTicketsOnly: me.Role == Roles.ProductionUser,
            OwnTimeOnly: me.Role is Roles.Developer or Roles.Tester or Roles.ProductionUser);
    }

    /// <summary>Whether this person may see a ticket</summary>
    public bool CanSee(Issue issue, User me) =>
        All || (ProductIds.Contains(issue.ProductId) && (!OwnTicketsOnly || issue.ReporterId == me.Id || (me.ClientId != null && issue.ClientId == me.ClientId)));

    /// <summary>Direct and indirect reports (follows ManagerId, safe against loops)</summary>
    public static List<User> ReportsOf(string userId, IReadOnlyList<User> users)
    {
        var result = new List<User>();
        var seen = new HashSet<string> { userId };
        var queue = new Queue<string>([userId]);
        while (queue.Count > 0)
        {
            var boss = queue.Dequeue();
            foreach (var u in users)
            {
                if (u.ManagerId == boss && seen.Add(u.Id))
                {
                    result.Add(u);
                    queue.Enqueue(u.Id);
                }
            }
        }
        return result;
    }

    /// <summary>Everyone in a division's teams, the teams' managers and the division head</summary>
    public static IEnumerable<User> DivisionMembers(string divisionId, Org org)
    {
        var teams = org.Teams.Where(t => t.DivisionId == divisionId).ToList();
        var teamIds = teams.Select(t => t.Id).ToHashSet();
        var managerIds = teams.Select(t => t.ManagerId).OfType<string>().ToHashSet();
        var headId = org.Divisions.FirstOrDefault(d => d.Id == divisionId)?.HeadId;
        return org.Users.Where(u => u.Id == headId || (u.TeamId != null && teamIds.Contains(u.TeamId)) || managerIds.Contains(u.Id));
    }
}
