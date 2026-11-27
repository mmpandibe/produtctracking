using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using Npro.Domain;
using Npro.Infrastructure;
using Npro.Infrastructure.Files;

namespace Npro.Api;

/// <summary>
/// Step 18d: attachment files on the server. Upload creates the attachment record (and its history entry) and stores the
/// bytes in <see cref="IFileStore"/>; download checks that the caller can see the ticket. Deleting the record through
/// <c>/api/sync</c> removes the file after the batch commits.
/// </summary>
public static class AttachmentEndpoints
{
    public const long MaxBytes = 10 * 1024 * 1024;

    public static void MapAttachments(this RouteGroupBuilder data)
    {
        data.MapPost("/attachments", async (HttpRequest request, RequestAccess access, NproDbContext db, IFileStore files, ChangeFeed feed) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            if (!request.HasFormContentType) return Results.Problem("Send the file as multipart/form-data", statusCode: 400);
            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("file");
            var issueId = form["issueId"].ToString();
            var id = form["id"].ToString();
            if (file is null || file.Length == 0) return Results.Problem("Choose a file", statusCode: 400);
            if (file.Length > MaxBytes) return Results.Problem($"{file.FileName} is larger than 10 MB", statusCode: 400);
            var issue = await db.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Id == issueId);
            if (issue is null) return Results.NotFound();
            if (!scope.CanSee(issue, me)) return Results.Problem("You don't have access to this ticket", statusCode: 403);
            if (string.IsNullOrWhiteSpace(id) || id.Length > 64 || await db.Attachments.AnyAsync(a => a.Id == id)) id = Guid.NewGuid().ToString();

            var now = DateTimeOffset.Now;
            var name = SafeName(file.FileName);
            var key = $"{now:yyyy}/{now:MM}/{id}"; // never derived from the file name
            await using (var stream = file.OpenReadStream()) await files.SaveAsync(key, stream);

            var attachment = new Attachment
            {
                Id = id, IssueId = issue.Id, Name = name, Size = file.Length,
                Type = string.IsNullOrWhiteSpace(file.ContentType) ? "application/octet-stream" : file.ContentType[..Math.Min(128, file.ContentType.Length)],
                UploadedBy = me.Id, StorageKey = key, CreatedAt = now,
            };
            var activity = new Activity { Id = Guid.NewGuid().ToString(), IssueId = issue.Id, ProductId = issue.ProductId, UserId = me.Id, Action = "attached", To = name, CreatedAt = now };
            db.Attachments.Add(attachment);
            db.Activities.Add(activity);
            try
            {
                await db.SaveChangesAsync();
            }
            catch
            {
                await files.DeleteAsync(key);
                throw;
            }
            var version = feed.Bump();
            return Results.Json(new
            {
                version,
                changes = new[]
                {
                    new Change("attachments", "upsert", attachment.Id, System.Text.Json.JsonSerializer.SerializeToElement(attachment, Sync.Json)),
                    new Change("activities", "upsert", activity.Id, System.Text.Json.JsonSerializer.SerializeToElement(activity, Sync.Json)),
                },
            }, Sync.Json);
        }).DisableAntiforgery().RequireRateLimiting("writes"); // the XSRF middleware already checked the X-XSRF-TOKEN header

        data.MapGet("/attachments/{id}/content", async (string id, RequestAccess access, NproDbContext db, IFileStore files, HttpResponse response) =>
        {
            var (me, scope) = (await access.GetAsync())!.Value;
            var attachment = await db.Attachments.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id);
            if (attachment is null) return Results.NotFound();
            var issue = await db.Issues.AsNoTracking().FirstOrDefaultAsync(i => i.Id == attachment.IssueId);
            if (issue is null || !scope.CanSee(issue, me)) return Results.Problem("You don't have access to this file", statusCode: 403);
            if (attachment.StorageKey is null) return Results.Problem("This file was attached in the offline demo and isn't on the server", statusCode: 404);
            var stream = await files.OpenReadAsync(attachment.StorageKey);
            if (stream is null) return Results.Problem("The file is missing from storage", statusCode: 404);
            // Always a download, never rendered in the page (stored files can't run as HTML / script on our origin)
            response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
            return Results.File(stream, "application/octet-stream", attachment.Name, enableRangeProcessing: false);
        });
    }

    /// <summary>File name for display / download only: no path parts or control characters</summary>
    public static string SafeName(string name)
    {
        var n = Path.GetFileName(name ?? "").Trim();
        n = new string(n.Where(c => !char.IsControl(c) && c is not ('"' or '\\' or '/')).ToArray());
        if (n.Length == 0) n = "file";
        return n.Length > 200 ? n[..200] : n;
    }
}
