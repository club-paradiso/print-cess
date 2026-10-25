using System.IO;

namespace Paradiso.PrintCess.Infrastructure.Printing;

/// <summary>
/// Decides which file paths the kiosk hands to Hancom Office. Each render gets
/// its own new directory under the work root, and only plain files directly
/// inside that directory are allowed: the path must already be in normalized
/// full form (no "." or ".." segments, no device or network prefix, no
/// alternate data stream), and neither the work root, the job directory nor
/// the file may be a symbolic link, junction or other reparse point.
/// </summary>
public static class HancomPathPolicy
{
    private const int MaximumFileNameLength = 64;

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    /// <summary>Creates a new, empty job directory directly under <paramref name="workRoot"/>.</summary>
    public static string CreateJobDirectory(string workRoot)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(workRoot);
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(workRoot));
        Directory.CreateDirectory(root);
        if (IsLink(root))
        {
            throw new InvalidDataException("The Hangul work folder is a link.");
        }

        var job = Path.Combine(root, Guid.NewGuid().ToString("N"));
        if (Directory.Exists(job) || File.Exists(job))
        {
            throw new InvalidDataException("The Hangul job folder already exists.");
        }

        Directory.CreateDirectory(job);
        if (IsLink(job) ||
            !string.Equals(Path.GetDirectoryName(job), root, PathComparison) ||
            Directory.EnumerateFileSystemEntries(job).Any())
        {
            throw new InvalidDataException("The Hangul job folder is not a new private folder.");
        }

        return job;
    }

    /// <summary>Returns <paramref name="candidate"/> when it is allowed, otherwise throws.</summary>
    public static string EnsureAllowed(string jobDirectory, string candidate) =>
        IsAllowed(jobDirectory, candidate)
            ? candidate
            : throw new InvalidDataException("A Hangul rendering path is outside the job folder.");

    public static bool IsAllowed(string jobDirectory, string candidate)
    {
        if (string.IsNullOrWhiteSpace(jobDirectory) || string.IsNullOrWhiteSpace(candidate) ||
            !IsNormalizedFullPath(jobDirectory) || !IsNormalizedFullPath(candidate))
        {
            return false;
        }

        var directory = Path.GetDirectoryName(candidate);
        var name = Path.GetFileName(candidate);
        if (directory is null ||
            !string.Equals(directory, Path.TrimEndingDirectorySeparator(jobDirectory), PathComparison) ||
            !IsPlainFileName(name))
        {
            return false;
        }

        try
        {
            var root = Path.GetDirectoryName(directory);
            if (root is null || !Directory.Exists(directory) || IsLink(root) || IsLink(directory))
            {
                return false;
            }

            return !Directory.Exists(candidate) && !IsLink(candidate);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static bool IsNormalizedFullPath(string path)
    {
        if (!Path.IsPathFullyQualified(path) ||
            path.StartsWith(@"\\", StringComparison.Ordinal) ||
            path.StartsWith("//", StringComparison.Ordinal) ||
            path.Contains('\0', StringComparison.Ordinal))
        {
            return false;
        }

        string full;
        try
        {
            full = Path.GetFullPath(path);
        }
        catch (Exception exception) when (exception is ArgumentException or NotSupportedException or PathTooLongException)
        {
            return false;
        }

        // GetFullPath removes "." and ".." segments and, on Windows, trailing
        // dots and spaces, so any difference means the path was not canonical.
        return string.Equals(
            Path.TrimEndingDirectorySeparator(full),
            Path.TrimEndingDirectorySeparator(path),
            StringComparison.Ordinal);
    }

    private static bool IsPlainFileName(string name)
    {
        if (name.Length is 0 or > MaximumFileNameLength || name[0] == '.' || name[^1] == '.')
        {
            return false;
        }

        foreach (var character in name)
        {
            if (!(char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_'))
            {
                return false;
            }
        }

        return true;
    }

    /// <summary>
    /// True for a symbolic link (dangling or not), a junction, or any other
    /// reparse point, whether it names a file or a directory.
    /// </summary>
    private static bool IsLink(string path)
    {
        var info = new FileInfo(path);
        if (info.LinkTarget is not null)
        {
            return true;
        }

        var attributes = info.Attributes;
        return (int)attributes != -1 && (attributes & FileAttributes.ReparsePoint) != 0;
    }
}
