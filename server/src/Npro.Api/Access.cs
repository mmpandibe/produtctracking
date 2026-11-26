using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;

namespace Npro.Api;

/// <summary>
/// The signed-in person and what they may see, worked out once per request.
/// Every endpoint filters through <see cref="AccessScope"/>, the server-side copy of the rules the UI uses.
/// </summary>
public sealed class RequestAccess(NproDbContext db, IHttpContextAccessor http)
{
    private (User Me, AccessScope Scope)? cached;

    public string? UserId => http.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);

    /// <summary>Null when nobody (or a deactivated / unknown person) is signed in</summary>
    public async Task<(User Me, AccessScope Scope)?> GetAsync()
    {
        if (cached is not null) return cached;
        var id = UserId;
        if (id is null) return null;
        var people = await db.People.AsNoTracking().ToListAsync();
        var me = people.FirstOrDefault(p => p.Id == id);
        if (me is null || me.Inactive) return null;
        var org = new AccessScope.Org(people, await db.Divisions.AsNoTracking().ToListAsync(), await db.Teams.AsNoTracking().ToListAsync(), await db.Products.AsNoTracking().ToListAsync());
        cached = (me, AccessScope.For(me, org));
        return cached;
    }
}

/// <summary>Endpoint filter: 401 unless an active nPro person is signed in</summary>
public sealed class RequirePerson : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var access = ctx.HttpContext.RequestServices.GetRequiredService<RequestAccess>();
        return await access.GetAsync() is null ? Results.Unauthorized() : await next(ctx);
    }
}
