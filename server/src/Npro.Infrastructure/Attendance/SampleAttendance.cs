using System.Globalization;
using Npro.Domain;

namespace Npro.Infrastructure.Attendance;

/// <summary>A person's attendance for one day (same shape as the frontend's AttendanceDay, keyed by person id)</summary>
public sealed record AttendanceDayDto(
    string UserId, string EmployeeId, string Date, string Status, DateTimeOffset? PunchIn, DateTimeOffset? PunchOut,
    int WorkedMinutes, string? LeaveType, bool? Regularised, bool? Late);

public sealed record ProductivityDayDto(string UserId, string EmployeeId, string Date, int ActiveMinutes, int ProductiveMinutes, int IdleMinutes);

public sealed record Allowance(int Allowed, double Used);

public sealed record LeaveBalanceDto(string UserId, string EmployeeId, int Year, Allowance Sick, Allowance Casual);

/// <summary>
/// Step 18d: server-side stand-in for the attendance system and the laptop productivity tracker (port of the browser's
/// sample adapter). Days are generated deterministically from (person, date); leave and correction requests are real rows
/// in the database, so everyone sees the same requests and approvals. A real provider replaces the generator later.
/// </summary>
public static class SampleAttendance
{
    public const int SickAllowance = 12;
    public const int CasualAllowance = 12;

    public static string Key(DateTime d) => d.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static DateTime Parse(string key) => DateTime.ParseExact(key, "yyyy-MM-dd", CultureInfo.InvariantCulture);

    public static bool IsWeekend(string key) => Parse(key).DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;

    public static IEnumerable<string> Days(string from, string to)
    {
        for (var d = Parse(from); d <= Parse(to); d = d.AddDays(1)) yield return Key(d);
    }

    /// <summary>Local time on a day → absolute moment</summary>
    public static DateTimeOffset At(string key, int minutes, TimeZoneInfo zone)
    {
        var local = Parse(key).AddMinutes(minutes);
        return new DateTimeOffset(local, zone.GetUtcOffset(local));
    }

    /// <summary>Working days a leave covers (half a day for half-day leave)</summary>
    public static double LeaveDays(LeaveRequest l) => l.HalfDay ? 0.5 : Days(l.From, l.To).Count(k => !IsWeekend(k));

    /// <summary>Small seeded random generator (same seed → same sequence)</summary>
    private sealed class Rng(string seed)
    {
        private uint h = Init(seed);

        private static uint Init(string seed)
        {
            var h = 1779033703u ^ (uint)seed.Length;
            foreach (var ch in seed)
            {
                h = (h ^ ch) * 3432918353u;
                h = (h << 13) | (h >> 19);
            }
            return h;
        }

        public double Next()
        {
            h = (h ^ (h >> 16)) * 2246822507u;
            h = (h ^ (h >> 13)) * 3266489909u;
            h ^= h >> 16;
            return h / 4294967296.0;
        }
    }

    /// <summary>Attendance for people over a range, with approved leave / corrections and pending corrections applied</summary>
    public static List<AttendanceDayDto> AttendanceDays(
        IEnumerable<User> people, string from, string to, IReadOnlyList<LeaveRequest> leaves, IReadOnlyList<RegularisationRequest> regs,
        DateTimeOffset now, TimeZoneInfo zone, int lateAfterMinutes)
    {
        var today = Key(TimeZoneInfo.ConvertTime(now, zone).Date);
        var result = new List<AttendanceDayDto>();
        foreach (var p in people)
        {
            var emp = p.EmployeeId ?? p.Email;
            foreach (var k in Days(from, to))
            {
                var leave = leaves.FirstOrDefault(l => l.PersonId == p.Id && l.Status == "approved" && string.CompareOrdinal(l.From, k) <= 0 && string.CompareOrdinal(l.To, k) >= 0);
                var reg = regs.FirstOrDefault(g => g.PersonId == p.Id && g.Date == k && g.Status is "pending" or "approved");
                var day = Generated(p.Id, emp, k, today, now, zone);
                if (leave is not null && !IsWeekend(k) && !leave.HalfDay)
                {
                    day = new AttendanceDayDto(p.Id, emp, k, "leave", null, null, 0, leave.Type, null, null);
                }
                else if (reg?.Status == "approved")
                {
                    day = new AttendanceDayDto(p.Id, emp, k, "present", reg.PunchIn, reg.PunchOut, (int)Math.Round((reg.PunchOut - reg.PunchIn).TotalMinutes), null, true, null);
                }
                else if (reg is not null && day is not null)
                {
                    // A pending correction exists because the punch out was missing
                    day = day with { Status = "missed_punch", PunchIn = day.PunchIn ?? reg.PunchIn, PunchOut = null, WorkedMinutes = 0 };
                }
                if (day is not null && leave is { HalfDay: true } && !IsWeekend(k) && string.CompareOrdinal(k, today) <= 0)
                {
                    var half = (int)Math.Round(day.WorkedMinutes / 2.0);
                    day = day with
                    {
                        Status = "half_day", LeaveType = leave.Type,
                        WorkedMinutes = day.PunchOut is null ? day.WorkedMinutes : half,
                        PunchOut = day.PunchOut is null ? null : day.PunchIn!.Value.AddMinutes(half),
                    };
                }
                if (day is null) continue;
                if (day.PunchIn is { } pin && day.Status != "half_day") day = day with { Late = pin > At(k, lateAfterMinutes, zone) };
                result.Add(day);
            }
        }
        return result;
    }

    private static AttendanceDayDto? Generated(string userId, string emp, string k, string today, DateTimeOffset now, TimeZoneInfo zone)
    {
        if (string.CompareOrdinal(k, today) > 0) return null;
        if (IsWeekend(k)) return new AttendanceDayDto(userId, emp, k, "weekend", null, null, 0, null, null, null);
        var r = new Rng($"{emp}|{k}");
        var roll = r.Next();
        if (string.CompareOrdinal(k, today) < 0 && roll < 0.025) return new AttendanceDayDto(userId, emp, k, "absent", null, null, 0, null, null, null);
        var inMin = 8 * 60 + 40 + (int)Math.Round(r.Next() * 85); // 08:40 – 10:05
        var length = (int)(7.75 * 60) + (int)Math.Round(r.Next() * 120); // 7h45 – 9h45
        var punchIn = At(k, inMin, zone);
        if (k == today)
        {
            if (now < punchIn) return new AttendanceDayDto(userId, emp, k, "absent", null, null, 0, null, null, null);
            var outAt = punchIn.AddMinutes(length);
            return now < outAt
                ? new AttendanceDayDto(userId, emp, k, "present", punchIn, null, (int)Math.Round((now - punchIn).TotalMinutes), null, null, null)
                : new AttendanceDayDto(userId, emp, k, "present", punchIn, outAt, length, null, null, null);
        }
        if (roll < 0.07) return new AttendanceDayDto(userId, emp, k, "missed_punch", punchIn, null, 0, null, null, null);
        return new AttendanceDayDto(userId, emp, k, "present", punchIn, punchIn.AddMinutes(length), length, null, null, null);
    }

    /// <summary>Laptop time follows attendance: none on days the person wasn't in</summary>
    public static List<ProductivityDayDto> Productivity(IEnumerable<AttendanceDayDto> days) =>
        days.Where(a => a.PunchIn is not null && a.Status != "weekend").Select(a =>
        {
            var r = new Rng($"prod|{a.EmployeeId}|{a.Date}");
            var span = a.WorkedMinutes > 0 ? a.WorkedMinutes : 8 * 60 + (int)Math.Round(r.Next() * 60);
            var logged = (int)Math.Round(span * (0.82 + r.Next() * 0.14));
            var active = (int)Math.Round(logged * (0.72 + r.Next() * 0.2));
            var productive = (int)Math.Round(active * (0.68 + r.Next() * 0.27));
            return new ProductivityDayDto(a.UserId, a.EmployeeId, a.Date, active, productive, logged - active);
        }).ToList();

    public static LeaveBalanceDto Balance(User p, int year, IEnumerable<LeaveRequest> leaves)
    {
        double Used(string type) => leaves.Where(l => l.PersonId == p.Id && l.Type == type && l.Status == "approved" && l.From.StartsWith(year.ToString(CultureInfo.InvariantCulture))).Sum(LeaveDays);
        return new LeaveBalanceDto(p.Id, p.EmployeeId ?? p.Email, year, new Allowance(SickAllowance, Used("sick")), new Allowance(CasualAllowance, Used("casual")));
    }

    /// <summary>Demo requests around "today" for the demo people (development seed only)</summary>
    public static (List<LeaveRequest> Leaves, List<RegularisationRequest> Regs) DemoRequests(DateTimeOffset now, TimeZoneInfo zone)
    {
        var today = Key(TimeZoneInfo.ConvertTime(now, zone).Date);
        string Prev(string k, int steps = 1) { var d = Parse(k); for (var i = 0; i < steps;) { d = d.AddDays(-1); if (!IsWeekend(Key(d))) i++; } return Key(d); }
        string Next(string k, int steps = 1) { var d = Parse(k); for (var i = 0; i < steps;) { d = d.AddDays(1); if (!IsWeekend(Key(d))) i++; } return Key(d); }
        DateTimeOffset Stamp(string k) => At(k, 9 * 60 + 15, zone);
        LeaveRequest Leave(string person, string type, string from, string to, string status, string reason, bool half = false) => new()
        {
            Id = Guid.NewGuid().ToString(), PersonId = person, Type = type, From = from, To = to, HalfDay = half, Reason = reason, Status = status,
            AppliedAt = Stamp(string.CompareOrdinal(Prev(from, 2), today) < 0 ? Prev(from, 2) : Prev(today)),
            DecidedBy = status == "approved" ? "u6" : null, DecidedAt = status == "approved" ? Stamp(Prev(from)) : null,
        };
        var todayOrNext = IsWeekend(today) ? Next(today) : today;
        var jordanDay = Prev(today, 2);
        var anaDay = Prev(today, 4);
        return (
            [
                Leave("u4", "sick", Prev(today, 7), Prev(today, 6), "approved", "Fever"),
                Leave("u9", "casual", todayOrNext, todayOrNext, "approved", "Family function"),
                Leave("u10", "casual", Next(today, 4), Next(today, 5), "pending", "Travelling home"),
                Leave("u8", "sick", Prev(today, 3), Prev(today, 3), "approved", "Doctor appointment", true),
            ],
            [
                new() { Id = Guid.NewGuid().ToString(), PersonId = "u4", Date = jordanDay, PunchIn = At(jordanDay, 9 * 60 + 20, zone), PunchOut = At(jordanDay, 18 * 60 + 10, zone), Reason = "Forgot to punch out", Status = "pending", AppliedAt = Stamp(Prev(today)) },
                new() { Id = Guid.NewGuid().ToString(), PersonId = "u13", Date = anaDay, PunchIn = At(anaDay, 8 * 60 + 55, zone), PunchOut = At(anaDay, 17 * 60 + 40, zone), Reason = "Biometric reader was down", Status = "approved", AppliedAt = Stamp(Prev(today, 3)), DecidedBy = "u6", DecidedAt = Stamp(Prev(today, 3)) },
            ]);
    }
}
