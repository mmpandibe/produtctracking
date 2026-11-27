using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing.Handlers;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Npro.Tests;

/// <summary>ISO 27001 A.8.15: security events are logged (and passwords never are).</summary>
public class SecurityLogTests : IClassFixture<ApiFactory>
{
    private readonly ApiFactory factory;
    public SecurityLogTests(ApiFactory factory) => this.factory = factory;

    private sealed class Capture : ILoggerProvider
    {
        public readonly ConcurrentQueue<(string Category, int EventId, string Message)> Entries = new();
        public ILogger CreateLogger(string category) => new Logger(this, category);
        public void Dispose() { }

        private sealed class Logger(Capture owner, string category) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
            public bool IsEnabled(LogLevel level) => true;
            public void Log<TState>(LogLevel level, EventId id, TState state, Exception? ex, Func<TState, Exception?, string> format) =>
                owner.Entries.Enqueue((category, id.Id, format(state, ex)));
        }
    }

    [Fact]
    public async Task Sign_in_failures_successes_and_refused_changes_are_logged_without_passwords()
    {
        var capture = new Capture();
        using var app = factory.WithWebHostBuilder(b => b.ConfigureServices(s => s.AddSingleton<ILoggerProvider>(capture)));
        var c = app.CreateDefaultClient(new XsrfHandler(), new CookieContainerHandler());
        await c.GetAsync("/api/health");

        const string wrong = "Wrong-password-123";
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { login = "jordan@example.com", password = wrong })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await c.PostAsJsonAsync("/api/auth/login", new { login = "ghost@example.com", password = wrong })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await c.PostAsJsonAsync("/api/auth/login", new { login = "jordan@example.com", password = ApiFactory.Password })).StatusCode);
        await c.GetAsync("/api/auth/me");
        // A developer may not rename a division
        var refused = await c.PostAsJsonAsync("/api/sync", new { changes = new[] { new { collection = "divisions", op = "upsert", id = "d1", data = new { id = "d1", name = "Hacked" } } } });
        Assert.Equal(HttpStatusCode.Forbidden, refused.StatusCode);

        var security = capture.Entries.Where(e => e.Category == "Npro.Security").ToList();
        Assert.Contains(security, e => e.EventId == 1002 && e.Message.Contains("u4") && e.Message.Contains("wrong password"));
        Assert.Contains(security, e => e.EventId == 1002 && e.Message.Contains("(unknown account)"));
        Assert.Contains(security, e => e.EventId == 1001 && e.Message.Contains("u4"));
        Assert.Contains(security, e => e.EventId == 1201 && e.Message.Contains("divisions/d1"));
        Assert.DoesNotContain(capture.Entries, e => e.Message.Contains(wrong) || e.Message.Contains(ApiFactory.Password) || e.Message.Contains("ghost@"));
    }
}
