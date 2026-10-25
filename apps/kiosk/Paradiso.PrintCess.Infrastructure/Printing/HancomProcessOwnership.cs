namespace Paradiso.PrintCess.Infrastructure.Printing;

/// <summary>A Hancom process as seen at one moment: its id, logon session and start time.</summary>
public sealed record HancomProcessSnapshot(int ProcessId, int SessionId, DateTime StartTimeUtc);

/// <summary>
/// Picks the Hancom process a render started, so a time-limited render stops
/// only that process. A process qualifies when it was not running before the
/// render began (compared by id and start time, so a reused id does not
/// count), runs in the kiosk's own session, and started after the render
/// began. Anything other than exactly one qualifying process is ambiguous,
/// and nothing is selected.
/// </summary>
public static class HancomProcessOwnership
{
    /// <summary>Clock resolution allowance between the recorded start and the process start time.</summary>
    public static readonly TimeSpan StartTimeTolerance = TimeSpan.FromSeconds(1);

    public static int? SelectOwned(
        IReadOnlyCollection<HancomProcessSnapshot> before,
        IEnumerable<HancomProcessSnapshot> now,
        int sessionId,
        DateTime renderStartedUtc)
    {
        ArgumentNullException.ThrowIfNull(before);
        ArgumentNullException.ThrowIfNull(now);

        var earlier = before.ToHashSet();
        var candidates = now
            .Where(process =>
                !earlier.Contains(process) &&
                process.SessionId == sessionId &&
                process.StartTimeUtc >= renderStartedUtc - StartTimeTolerance)
            .Select(process => process.ProcessId)
            .Distinct()
            .Take(2)
            .ToList();

        return candidates.Count == 1 ? candidates[0] : null;
    }
}
