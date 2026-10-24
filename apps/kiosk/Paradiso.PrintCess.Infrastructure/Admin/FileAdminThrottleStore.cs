using System.IO;
using System.Text.Json;
using Paradiso.PrintCess.Core.Security;

namespace Paradiso.PrintCess.Infrastructure.Admin;

/// <summary>Keeps the administrator lockout across restarts in a small JSON file.</summary>
public sealed class FileAdminThrottleStore : IAdminThrottleStore
{
    private readonly string _path;

    public FileAdminThrottleStore(string path)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(path);
        _path = path;
    }

    public AdminThrottleState? Load()
    {
        if (!File.Exists(_path))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<AdminThrottleState>(File.ReadAllBytes(_path));
        }
        catch (JsonException exception)
        {
            throw new InvalidDataException("The administrator throttle state is unreadable.", exception);
        }
    }

    public void Save(AdminThrottleState state)
    {
        var directory = Path.GetDirectoryName(_path);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var temporary = _path + ".tmp";
        File.WriteAllBytes(temporary, JsonSerializer.SerializeToUtf8Bytes(state));
        File.Move(temporary, _path, overwrite: true);
    }
}
