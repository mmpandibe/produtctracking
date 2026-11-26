namespace Npro.Tests;

/// <summary>Plays the browser's part in the XSRF check: remembers the XSRF-TOKEN cookie and echoes it on writes</summary>
public sealed class XsrfHandler : DelegatingHandler
{
    private string? token;
    public bool Enabled { get; set; } = true;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        if (Enabled && token is not null && request.Method != HttpMethod.Get) request.Headers.Add("X-XSRF-TOKEN", token);
        var response = await base.SendAsync(request, ct);
        if (response.Headers.TryGetValues("Set-Cookie", out var cookies))
        {
            foreach (var c in cookies.Where(c => c.StartsWith("XSRF-TOKEN=")))
            {
                token = Uri.UnescapeDataString(c.Split(';')[0]["XSRF-TOKEN=".Length..]);
            }
        }
        return response;
    }
}
