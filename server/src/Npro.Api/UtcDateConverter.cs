using System.Globalization;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace Npro.Api;

/// <summary>
/// Writes timestamps exactly like the browser's <c>toISOString()</c> ("2026-11-26T08:50:00.000Z"). The app sorts some lists
/// by comparing these strings, so mixing "+05:30" offsets with "Z" times would order them wrongly. Reading accepts any ISO form.
/// </summary>
public sealed class UtcDateConverter : JsonConverter<DateTimeOffset>
{
    public override DateTimeOffset Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options) =>
        DateTimeOffset.Parse(reader.GetString()!, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);

    public override void Write(Utf8JsonWriter writer, DateTimeOffset value, JsonSerializerOptions options) =>
        writer.WriteStringValue(value.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture));
}
