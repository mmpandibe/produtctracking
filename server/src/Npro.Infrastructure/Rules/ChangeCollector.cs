namespace Npro.Infrastructure.Rules;

/// <summary>
/// Records the server made on its own (ticket numbers, automation results). They go back to the browser in the frontend's
/// collection names so the app can merge them without reloading everything.
/// </summary>
public sealed class ChangeCollector
{
    private readonly Dictionary<(string Collection, string Id), object?> items = [];
    private readonly List<(string Collection, string Id)> order = [];

    public void Upsert(string collection, string id, object entity) => Put(collection, id, entity);

    public void Delete(string collection, string id) => Put(collection, id, null);

    private void Put(string collection, string id, object? entity)
    {
        var key = (collection, id);
        if (!items.ContainsKey(key)) order.Add(key);
        items[key] = entity;
    }

    public bool Any => order.Count > 0;

    /// <summary>(collection, op, id, entity) in the order they were first touched</summary>
    public IEnumerable<(string Collection, string Op, string Id, object? Data)> All() =>
        order.Select(k => (k.Collection, items[k] is null ? "delete" : "upsert", k.Id, items[k]));
}
