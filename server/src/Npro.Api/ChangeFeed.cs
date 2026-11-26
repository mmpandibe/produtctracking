using Microsoft.EntityFrameworkCore;
using Npro.Infrastructure;
using Npro.Infrastructure.Rules;

namespace Npro.Api;

/// <summary>
/// A version number that changes whenever data changes (someone saves, or a timed rule runs). Open browsers poll
/// <c>GET /api/state/version</c> and reload when it moves. Starts from the clock so a restarted server never repeats a value.
/// (One IIS worker process; a web farm would keep this in the database or a cache.)
/// </summary>
public sealed class ChangeFeed
{
    private long version = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

    public long Version => Interlocked.Read(ref version);

    public long Bump() => Interlocked.Increment(ref version);
}

/// <summary>
/// Step 18c: runs the time-based automation rules (SLA at risk / breached, due date passed) every minute on the server.
/// On IIS set the app pool to Start mode = AlwaysRunning and the site to Preload enabled, or IIS stops it when idle.
/// </summary>
public sealed class TimedRulesService(IServiceScopeFactory scopes, ChangeFeed feed, ILogger<TimedRulesService> log, IConfiguration config) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!config.GetValue("Automation:TimedRules", true)) return;
        // Let start-up (migrations, seeding) finish first
        try { await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); } catch (OperationCanceledException) { return; }
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(1));
        do
        {
            try
            {
                var runs = await RunOnceAsync(scopes, DateTimeOffset.Now, stoppingToken);
                if (runs > 0)
                {
                    feed.Bump();
                    log.LogInformation("Timed automation rules ran {Runs} time(s)", runs);
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                log.LogError(ex, "Timed automation rules failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>One pass over the timed rules in its own transaction (also used by tests)</summary>
    public static async Task<int> RunOnceAsync(IServiceScopeFactory scopes, DateTimeOffset now, CancellationToken ct = default)
    {
        using var scope = scopes.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NproDbContext>();
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var tx = await db.Database.BeginTransactionAsync(ct);
            var runs = await new RuleEngine(db, new ChangeCollector(), now).RunTimedAsync();
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            return runs;
        });
    }
}
