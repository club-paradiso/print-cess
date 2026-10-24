using System.Security.Cryptography;
using System.Text;
using Paradiso.PrintCess.Core.Protocol;
using Paradiso.PrintCess.Core.Security;
using Paradiso.PrintCess.Infrastructure.Admin;

namespace Paradiso.PrintCess.Tests.Recovery;

public sealed class AdminAuthenticationTests
{
    [Fact]
    public async Task UsesExternalPbkdf2CredentialAndFailsClosedWhenMissing()
    {
        const string password = "synthetic-test-password";
        var salt = Enumerable.Range(0, 16).Select(static value => (byte)value).ToArray();
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            210_000,
            HashAlgorithmName.SHA256,
            32);
        var encoded = $"pbkdf2-sha256$210000${CanonicalEncoding.EncodeBase64Url(salt)}${CanonicalEncoding.EncodeBase64Url(hash)}";
        var configured = new Pbkdf2AdminAuthenticator(encoded);
        var missing = new Pbkdf2AdminAuthenticator(null);

        Assert.True((await configured.AuthenticateAsync(password.AsMemory(), CancellationToken.None)).Succeeded);
        Assert.False((await configured.AuthenticateAsync("wrong".AsMemory(), CancellationToken.None)).Succeeded);
        Assert.False((await missing.AuthenticateAsync(password.AsMemory(), CancellationToken.None)).Succeeded);
        Assert.False(missing.IsConfigured);
    }

    [Fact]
    public void ThrottlePersistsAcrossWindowsAndExpiresAfterTheLockout()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero));
        var throttle = new AdminAuthenticationThrottle(
            clock,
            failureLimit: 3,
            lockoutDuration: TimeSpan.FromSeconds(30));

        Assert.True(throttle.TryBegin(out _));
        throttle.RecordFailure();
        Assert.True(throttle.TryBegin(out _));
        throttle.RecordFailure();
        Assert.True(throttle.TryBegin(out _));
        throttle.RecordFailure();

        Assert.False(throttle.TryBegin(out var retryAfter));
        Assert.Equal(TimeSpan.FromSeconds(30), retryAfter);

        clock.Advance(TimeSpan.FromSeconds(29));
        Assert.False(throttle.TryBegin(out _));
        clock.Advance(TimeSpan.FromSeconds(1));
        Assert.True(throttle.TryBegin(out _));

        throttle.RecordFailure();
        throttle.RecordSuccess();
        Assert.True(throttle.TryBegin(out _));
    }

    [Fact]
    public void EachLockoutDoublesUntilACorrectPasswordAndNeverExceedsAnHour()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero));
        var throttle = new AdminAuthenticationThrottle(clock, failureLimit: 1, lockoutDuration: TimeSpan.FromMinutes(20));

        foreach (var expected in new[] { 20, 40, 60, 60 })
        {
            Assert.True(throttle.TryBegin(out _));
            throttle.RecordFailure();
            Assert.False(throttle.TryBegin(out var retryAfter));
            Assert.Equal(TimeSpan.FromMinutes(expected), retryAfter);
            clock.Advance(retryAfter);
        }

        Assert.True(throttle.TryBegin(out _));
        throttle.RecordSuccess();
        throttle.RecordFailure();
        Assert.False(throttle.TryBegin(out var reset));
        Assert.Equal(TimeSpan.FromMinutes(20), reset);
    }

    [Fact]
    public void ALockoutSurvivesARestartThroughTheStore()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero));
        var store = new MemoryStore();
        var first = new AdminAuthenticationThrottle(clock, failureLimit: 2, store: store);
        first.RecordFailure();
        first.RecordFailure();

        var restarted = new AdminAuthenticationThrottle(clock, failureLimit: 2, store: store);
        Assert.False(restarted.TryBegin(out var retryAfter));
        Assert.Equal(TimeSpan.FromSeconds(30), retryAfter);
    }

    [Fact]
    public void ASavedLockoutCannotOutlastTheLongestOne()
    {
        var clock = new ManualTimeProvider(new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero));
        var store = new MemoryStore { State = new AdminThrottleState(0, 3, clock.GetUtcNow().AddYears(1)) };
        var throttle = new AdminAuthenticationThrottle(clock, store: store);

        Assert.False(throttle.TryBegin(out var retryAfter));
        Assert.Equal(TimeSpan.FromHours(1), retryAfter);
    }

    [Fact]
    public void TheFileStoreRoundTripsAndToleratesAMissingFile()
    {
        var path = Path.Combine(Path.GetTempPath(), "PrintCessTest", Guid.NewGuid().ToString("N"), "throttle.json");
        try
        {
            var store = new FileAdminThrottleStore(path);
            Assert.Null(store.Load());
            var state = new AdminThrottleState(2, 1, new DateTimeOffset(2026, 8, 3, 12, 0, 0, TimeSpan.Zero));
            store.Save(state);
            Assert.Equal(state, new FileAdminThrottleStore(path).Load());
        }
        finally
        {
            Directory.Delete(Path.GetDirectoryName(path)!, recursive: true);
        }
    }

    private sealed class MemoryStore : IAdminThrottleStore
    {
        public AdminThrottleState? State { get; set; }

        public AdminThrottleState? Load() => State;

        public void Save(AdminThrottleState state) => State = state;
    }

    private sealed class ManualTimeProvider : TimeProvider
    {
        private DateTimeOffset _utcNow;

        public ManualTimeProvider(DateTimeOffset utcNow)
        {
            _utcNow = utcNow;
        }

        public override DateTimeOffset GetUtcNow() => _utcNow;

        public void Advance(TimeSpan amount)
        {
            _utcNow += amount;
        }
    }
}
