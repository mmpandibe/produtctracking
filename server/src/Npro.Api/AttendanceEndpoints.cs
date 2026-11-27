using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Npro.Domain;
using Npro.Infrastructure;
using Npro.Infrastructure.Attendance;

namespace Npro.Api;

/// <summary>
/// Step 18d: attendance, leave, corrections and productivity served by the API. The provider is the server-side sample
/// adapter until the HR system / laptop tracker details exist (<c>Attendance:Provider</c>, <c>Productivity:Provider</c>);
/// requests and approvals are stored in the database, so every user sees the same data. Scope: developers / testers see
/// themselves; others the tracked people in their scope.
/// </summary>
public static class AttendanceEndpoints
{
    public sealed record LeaveInput(string Type, string From, string To, bool? HalfDay, string Reason);
    public sealed record CorrectionInput(string Date, DateTimeOffset PunchIn, DateTimeOffset PunchOut, string Reason);
    public sealed record DecisionInput(string Decision);

    private static readonly string[] LeaveTypes = ["sick", "casual"];

    public static void MapAttendance(this RouteGroupBuilder data)
    {
        var g = data.MapGroup("/attendance");

        g.MapGet("", async (string from, string to, RequestAccess access, NproDbContext db, IConfiguration config) =>
        {
            if (!ValidDay(from) || !ValidDay(to) || string.CompareOrdinal(from, to) > 0) return Results.Problem("Give from and to as yyyy-MM-dd", statusCode: 400);
            if ((SampleAttendance.Parse(to) - SampleAttendance.Parse(from)).TotalDays > 62) return Results.Problem("At most 62 days at a time", statusCode: 400);
            var (me, scope) = (await access.GetAsync())!.Value;
            var people = await VisiblePeople(db, me, scope);
            var ids = people.Select(p => p.Id).ToHashSet();
            var wideFrom = SampleAttendance.Key(SampleAttendance.Parse(from).AddDays(-60));
            var wideTo = SampleAttendance.Key(SampleAttendance.Parse(to).AddDays(60));
            var leaves = (await db.LeaveRequests.AsNoTracking().ToListAsync()).Where(l => ids.Contains(l.PersonId)).ToList();
            var regs = (await db.RegularisationRequests.AsNoTracking().ToListAsync()).Where(r => ids.Contains(r.PersonId)).ToList();
            var now = DateTimeOffset.Now;
            var zone = Zone(config);
            var days = SampleAttendance.AttendanceDays(people, from, to, leaves, regs, now, zone, LateAfter(config));
            var year = TimeZoneInfo.ConvertTime(now, zone).Year;
            return Results.Json(new
            {
                providers = new { attendance = config["Attendance:Provider"] ?? "sample", productivity = config["Productivity:Provider"] ?? "sample" },
                lateAfter = config["Attendance:LateAfter"] ?? "10:00",
                days,
                productivity = SampleAttendance.Productivity(days),
                leaves = leaves.Where(l => string.CompareOrdinal(l.To, wideFrom) >= 0 && string.CompareOrdinal(l.From, wideTo) <= 0).Select(ToDto),
                regularisations = regs.Where(r => string.CompareOrdinal(r.Date, wideFrom) >= 0 && string.CompareOrdinal(r.Date, wideTo) <= 0).Select(ToDto),
                balances = people.Select(p => SampleAttendance.Balance(p, year, leaves)),
            }, Sync.Json);
        });

        g.MapPost("/leave", async (LeaveInput input, RequestAccess access, NproDbContext db, ChangeFeed feed) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            if (!Tracked(me)) return Results.Problem("Attendance isn't tracked for your account", statusCode: 403);
            var type = input.Type?.Trim().ToLowerInvariant() ?? "";
            if (!LeaveTypes.Contains(type)) return Bad("Choose sick or casual leave");
            if (!ValidDay(input.From) || !ValidDay(input.To)) return Bad("Pick the dates");
            if (string.CompareOrdinal(input.To, input.From) < 0) return Bad("The leave ends before it starts");
            var half = input.HalfDay == true;
            if (half && input.To != input.From) return Bad("A half day is a single day");
            if (string.IsNullOrWhiteSpace(input.Reason)) return Bad("Please give a reason");
            var request = new LeaveRequest { Id = Guid.NewGuid().ToString(), PersonId = me.Id, Type = type, From = input.From, To = input.To, HalfDay = half, Reason = input.Reason.Trim()[..Math.Min(500, input.Reason.Trim().Length)], Status = "pending", AppliedAt = DateTimeOffset.Now };
            if (SampleAttendance.LeaveDays(request) == 0) return Bad("Those dates are all weekend days");
            var clash = (await db.LeaveRequests.AsNoTracking().Where(l => l.PersonId == me.Id && (l.Status == "pending" || l.Status == "approved")).ToListAsync())
                .FirstOrDefault(l => string.CompareOrdinal(l.From, request.To) <= 0 && string.CompareOrdinal(l.To, request.From) >= 0);
            if (clash is not null) return Bad($"You already have leave from {clash.From} to {clash.To}");
            db.LeaveRequests.Add(request);
            await db.SaveChangesAsync();
            feed.Bump();
            return Results.Json(ToDto(request), Sync.Json);
        });

        g.MapPost("/regularisation", async (CorrectionInput input, RequestAccess access, NproDbContext db, ChangeFeed feed, IConfiguration config) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            if (!Tracked(me)) return Results.Problem("Attendance isn't tracked for your account", statusCode: 403);
            var today = SampleAttendance.Key(TimeZoneInfo.ConvertTime(DateTimeOffset.Now, Zone(config)).Date);
            if (!ValidDay(input.Date)) return Bad("Pick the day");
            if (string.CompareOrdinal(input.Date, today) >= 0) return Bad("You can only correct days that are over");
            if (input.PunchOut <= input.PunchIn) return Bad("Punch out must be after punch in");
            if (string.IsNullOrWhiteSpace(input.Reason)) return Bad("Please give a reason");
            if (await db.RegularisationRequests.AnyAsync(r => r.PersonId == me.Id && r.Date == input.Date && (r.Status == "pending" || r.Status == "approved")))
                return Bad("That day already has a correction request");
            var request = new RegularisationRequest { Id = Guid.NewGuid().ToString(), PersonId = me.Id, Date = input.Date, PunchIn = input.PunchIn, PunchOut = input.PunchOut, Reason = input.Reason.Trim()[..Math.Min(500, input.Reason.Trim().Length)], Status = "pending", AppliedAt = DateTimeOffset.Now };
            db.RegularisationRequests.Add(request);
            await db.SaveChangesAsync();
            feed.Bump();
            return Results.Json(ToDto(request), Sync.Json);
        });

        g.MapPost("/{kind}/{id}/decide", async (string kind, string id, DecisionInput input, RequestAccess access, NproDbContext db, ChangeFeed feed) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            if (input.Decision is not ("approved" or "rejected")) return Bad("Decision must be approved or rejected");
            var (personId, status, apply) = await Find(db, kind, id);
            if (personId is null) return Results.NotFound();
            if (personId == me.Id) return Results.Problem("You can’t approve your own request", statusCode: 403);
            if (!await CanApprove(db, me, personId)) return Results.Problem("Only their manager or an admin can decide this", statusCode: 403);
            if (status != "pending") return Results.Problem("This request was already decided", statusCode: 409);
            apply!(input.Decision, me.Id);
            await db.SaveChangesAsync();
            feed.Bump();
            return Results.NoContent();
        });

        g.MapPost("/{kind}/{id}/cancel", async (string kind, string id, RequestAccess access, NproDbContext db, ChangeFeed feed) =>
        {
            var (me, _) = (await access.GetAsync())!.Value;
            var (personId, status, apply) = await Find(db, kind, id);
            if (personId is null) return Results.NotFound();
            if (personId != me.Id) return Results.Problem("Only the person who asked can withdraw it", statusCode: 403);
            if (status != "pending") return Results.Problem("Only pending requests can be withdrawn", statusCode: 409);
            apply!("cancelled", null);
            await db.SaveChangesAsync();
            feed.Bump();
            return Results.NoContent();
        });
    }

    private static IResult Bad(string message) => Results.Problem(message, statusCode: 400);

    private static bool ValidDay(string? s) => s is not null && DateTime.TryParseExact(s, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    /// <summary>Active internal and vendor staff (not client / production users)</summary>
    private static bool Tracked(User u) => !u.Inactive && u.Kind != UserKinds.Client && u.Role != Roles.ProductionUser;

    private static async Task<List<User>> VisiblePeople(NproDbContext db, User me, AccessScope scope)
    {
        var people = (await db.People.AsNoTracking().ToListAsync()).Where(Tracked).ToList();
        if (scope.OwnTimeOnly) return people.Where(p => p.Id == me.Id).ToList();
        return scope.All ? people : people.Where(p => scope.UserIds.Contains(p.Id)).ToList();
    }

    private static async Task<bool> CanApprove(NproDbContext db, User me, string personId)
    {
        if (me.Role == Roles.Admin) return true;
        var people = await db.People.AsNoTracking().ToListAsync();
        return AccessScope.ReportsOf(me.Id, people).Any(u => u.Id == personId);
    }

    private static async Task<(string? PersonId, string? Status, Action<string, string?>? Apply)> Find(NproDbContext db, string kind, string id)
    {
        if (kind == "leave")
        {
            var l = await db.LeaveRequests.FindAsync(id);
            return l is null ? (null, null, null) : (l.PersonId, l.Status, (s, by) => { l.Status = s; l.DecidedBy = by; l.DecidedAt = by is null ? null : DateTimeOffset.Now; });
        }
        if (kind == "regularisation")
        {
            var r = await db.RegularisationRequests.FindAsync(id);
            return r is null ? (null, null, null) : (r.PersonId, r.Status, (s, by) => { r.Status = s; r.DecidedBy = by; r.DecidedAt = by is null ? null : DateTimeOffset.Now; });
        }
        return (null, null, null);
    }

    private static TimeZoneInfo Zone(IConfiguration config)
    {
        var id = config["Attendance:TimeZone"];
        return string.IsNullOrWhiteSpace(id) ? TimeZoneInfo.Local : TimeZoneInfo.FindSystemTimeZoneById(id);
    }

    private static int LateAfter(IConfiguration config)
    {
        var v = config["Attendance:LateAfter"] ?? "10:00";
        return TimeSpan.TryParse(v, CultureInfo.InvariantCulture, out var t) ? (int)t.TotalMinutes : 600;
    }

    // Same shapes as the frontend (core/external.ts); employeeId carries the person id in server mode
    private static object ToDto(LeaveRequest l) => new { l.Id, employeeId = l.PersonId, userId = l.PersonId, l.Type, l.From, l.To, halfDay = l.HalfDay ? true : (bool?)null, l.Reason, l.Status, l.AppliedAt, l.DecidedBy, l.DecidedAt };

    private static object ToDto(RegularisationRequest r) => new { r.Id, employeeId = r.PersonId, userId = r.PersonId, r.Date, r.PunchIn, r.PunchOut, r.Reason, r.Status, r.AppliedAt, r.DecidedBy, r.DecidedAt };
}
