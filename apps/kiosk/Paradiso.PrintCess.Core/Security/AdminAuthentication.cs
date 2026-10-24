namespace Paradiso.PrintCess.Core.Security;

public interface IAdminAuthenticator
{
    bool IsConfigured { get; }

    ValueTask<AdminAuthenticationResult> AuthenticateAsync(
        ReadOnlyMemory<char> password,
        CancellationToken cancellationToken);
}

public sealed record AdminAuthenticationResult(bool Succeeded, string SafeCode)
{
    public static AdminAuthenticationResult Success() => new(true, "ADMIN-OK");

    public static AdminAuthenticationResult Denied(string code = "ADMIN-DENIED") => new(false, code);
}

/// <summary>What the throttle needs to survive an application restart.</summary>
public sealed record AdminThrottleState(int FailureCount, int LockoutCount, DateTimeOffset? LockedUntil);

public interface IAdminThrottleStore
{
    AdminThrottleState? Load();

    void Save(AdminThrottleState state);
}

/// <summary>
/// One throttle guards every screen that checks the administrator password, so
/// the login and the page-limit override cannot be used to double the guessing
/// rate. Each lockout is twice as long as the one before, up to an hour, until a
/// correct password resets it, and the state is saved so a restart does not
/// clear it.
/// </summary>
public sealed class AdminAuthenticationThrottle
{
    private const int DefaultFailureLimit = 5;
    private static readonly TimeSpan DefaultLockoutDuration = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan MaximumLockoutDuration = TimeSpan.FromHours(1);

    private readonly object _sync = new();
    private readonly TimeProvider _timeProvider;
    private readonly IAdminThrottleStore? _store;
    private readonly int _failureLimit;
    private readonly TimeSpan _lockoutDuration;
    private int _failureCount;
    private int _lockoutCount;
    private DateTimeOffset? _lockedUntil;

    public AdminAuthenticationThrottle(
        TimeProvider? timeProvider = null,
        int failureLimit = DefaultFailureLimit,
        TimeSpan? lockoutDuration = null,
        IAdminThrottleStore? store = null)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(failureLimit, 1);

        var duration = lockoutDuration ?? DefaultLockoutDuration;
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(
            duration,
            TimeSpan.Zero,
            nameof(lockoutDuration));
        ArgumentOutOfRangeException.ThrowIfGreaterThan(
            duration,
            MaximumLockoutDuration,
            nameof(lockoutDuration));

        _timeProvider = timeProvider ?? TimeProvider.System;
        _failureLimit = failureLimit;
        _lockoutDuration = duration;
        _store = store;
        Restore();
    }

    public bool TryBegin(out TimeSpan retryAfter)
    {
        lock (_sync)
        {
            var now = _timeProvider.GetUtcNow();
            if (_lockedUntil is { } lockedUntil)
            {
                if (lockedUntil > now)
                {
                    retryAfter = lockedUntil - now;
                    return false;
                }

                _lockedUntil = null;
                _failureCount = 0;
                Persist();
            }

            retryAfter = TimeSpan.Zero;
            return true;
        }
    }

    public void RecordFailure()
    {
        lock (_sync)
        {
            var now = _timeProvider.GetUtcNow();
            if (_lockedUntil is { } lockedUntil)
            {
                if (lockedUntil > now)
                {
                    return;
                }

                _lockedUntil = null;
                _failureCount = 0;
            }

            _failureCount++;
            if (_failureCount >= _failureLimit)
            {
                _failureCount = 0;
                _lockedUntil = now + LockoutFor(_lockoutCount);
                _lockoutCount = Math.Min(_lockoutCount + 1, 32);
            }

            Persist();
        }
    }

    public void RecordSuccess()
    {
        lock (_sync)
        {
            _failureCount = 0;
            _lockoutCount = 0;
            _lockedUntil = null;
            Persist();
        }
    }

    private TimeSpan LockoutFor(int previousLockouts)
    {
        var ticks = _lockoutDuration.Ticks;
        for (var index = 0; index < previousLockouts && ticks < MaximumLockoutDuration.Ticks; index++)
        {
            ticks *= 2;
        }

        return TimeSpan.FromTicks(Math.Min(ticks, MaximumLockoutDuration.Ticks));
    }

    private void Restore()
    {
        AdminThrottleState? state;
        try
        {
            state = _store?.Load();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or InvalidDataException)
        {
            state = null;
        }

        if (state is null)
        {
            return;
        }

        _failureCount = Math.Clamp(state.FailureCount, 0, _failureLimit - 1);
        _lockoutCount = Math.Clamp(state.LockoutCount, 0, 32);
        // A saved lockout can never outlast the longest one this throttle would
        // impose, so a wrong clock or an edited file cannot lock staff out for good.
        var latest = _timeProvider.GetUtcNow() + MaximumLockoutDuration;
        _lockedUntil = state.LockedUntil is { } until && until > latest ? latest : state.LockedUntil;
    }

    private void Persist()
    {
        try
        {
            _store?.Save(new AdminThrottleState(_failureCount, _lockoutCount, _lockedUntil));
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // The in-memory throttle still applies for this run.
        }
    }
}
