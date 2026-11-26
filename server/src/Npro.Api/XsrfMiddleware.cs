using Microsoft.AspNetCore.Antiforgery;

namespace Npro.Api;

/// <summary>
/// XSRF protection for the cookie-signed-in API:
/// - every GET under /api refreshes a readable <c>XSRF-TOKEN</c> cookie (tied to who is signed in);
/// - every POST / PUT / PATCH / DELETE under /api must echo it in the <c>X-XSRF-TOKEN</c> header, or gets 400.
/// After signing in (or switching person) the client reads <c>/api/auth/me</c>, which issues a token for the new identity.
/// </summary>
public sealed class XsrfMiddleware(RequestDelegate next, IAntiforgery antiforgery)
{
    public const string CookieName = "XSRF-TOKEN";

    public async Task InvokeAsync(HttpContext ctx)
    {
        if (ctx.Request.Path.StartsWithSegments("/api"))
        {
            if (HttpMethods.IsGet(ctx.Request.Method))
            {
                var tokens = antiforgery.GetAndStoreTokens(ctx);
                ctx.Response.Cookies.Append(CookieName, tokens.RequestToken!, new CookieOptions
                {
                    HttpOnly = false,
                    SameSite = SameSiteMode.Strict,
                    Secure = ctx.Request.IsHttps,
                    Path = "/",
                });
            }
            else if (HttpMethods.IsPost(ctx.Request.Method) || HttpMethods.IsPut(ctx.Request.Method) || HttpMethods.IsPatch(ctx.Request.Method) || HttpMethods.IsDelete(ctx.Request.Method))
            {
                try
                {
                    await antiforgery.ValidateRequestAsync(ctx);
                }
                catch (AntiforgeryValidationException)
                {
                    ctx.Response.StatusCode = StatusCodes.Status400BadRequest;
                    await ctx.Response.WriteAsJsonAsync(new { title = "Missing or expired security token", detail = "Reload the page and try again." });
                    return;
                }
            }
        }
        await next(ctx);
    }
}
