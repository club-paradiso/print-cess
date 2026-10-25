using System.IO;
using Paradiso.PrintCess.Infrastructure.Printing;

namespace Paradiso.PrintCess.Tests.Printing;

public sealed class HangulRenderWatchdogTests
{
    private static readonly TimeSpan Limit = TimeSpan.FromSeconds(60);

    [Fact]
    public void ReturnsTheRenderResultWithoutStoppingAnything()
    {
        var terminated = 0;
        var result = HangulRenderWatchdog.Run(
            () => new byte[] { 1, 2, 3 },
            Limit,
            () => { terminated++; return true; },
            CancellationToken.None);

        Assert.Equal(new byte[] { 1, 2, 3 }, result);
        Assert.Equal(0, terminated);
    }

    [Fact]
    public void PassesTheRenderFailureThrough()
    {
        var exception = Assert.Throws<InvalidDataException>(() =>
            HangulRenderWatchdog.Run<byte[]>(
                () => throw new InvalidDataException("rejected"),
                Limit,
                () => true,
                CancellationToken.None));

        Assert.Equal("rejected", exception.Message);
    }

    [Fact]
    public void StopsTheRendererAndLetsTheWorkerCleanUpWhenTheLimitPasses()
    {
        using var released = new ManualResetEventSlim();
        var cleanedUp = false;
        var terminated = 0;
        var waits = new List<TimeSpan>();

        var exception = Assert.Throws<InvalidDataException>(() =>
            HangulRenderWatchdog.Run<byte[]>(
                () =>
                {
                    try
                    {
                        // A hung Hancom call: it only returns when the process is stopped.
                        released.Wait(TimeSpan.FromSeconds(30));
                        throw new InvalidDataException("Hancom disconnected.");
                    }
                    finally
                    {
                        cleanedUp = true;
                    }
                },
                Limit,
                () =>
                {
                    terminated++;
                    released.Set();
                    return true;
                },
                CancellationToken.None,
                waitForWorker: (task, limit, _) =>
                {
                    waits.Add(limit);
                    if (limit == Limit)
                    {
                        // The clock reaches the limit before the render finishes.
                        return false;
                    }

                    return Wait(task, limit);
                }));

        Assert.IsType<TimeoutException>(exception.InnerException);
        Assert.Equal(1, terminated);
        Assert.True(cleanedUp);
        Assert.Equal(new[] { Limit, HangulRenderWatchdog.TerminationGrace }, waits);
    }

    [Fact]
    public void StillFailsSafelyWhenTheRendererCannotBeStopped()
    {
        using var never = new ManualResetEventSlim();
        var exception = Assert.Throws<InvalidDataException>(() =>
            HangulRenderWatchdog.Run<byte[]>(
                () =>
                {
                    never.Wait(TimeSpan.FromSeconds(5));
                    return [];
                },
                Limit,
                () => false,
                CancellationToken.None,
                waitForWorker: (_, _, _) => false));

        Assert.IsType<TimeoutException>(exception.InnerException);
        never.Set();
    }

    [Fact]
    public void StopsTheRendererWhenTheCallerCancels()
    {
        using var released = new ManualResetEventSlim();
        using var cancellation = new CancellationTokenSource();
        var terminated = 0;

        Assert.ThrowsAny<OperationCanceledException>(() =>
            HangulRenderWatchdog.Run<byte[]>(
                () =>
                {
                    released.Wait(TimeSpan.FromSeconds(30));
                    return [];
                },
                Limit,
                () =>
                {
                    terminated++;
                    released.Set();
                    return true;
                },
                cancellation.Token,
                waitForWorker: (task, limit, token) =>
                {
                    if (limit == Limit)
                    {
                        cancellation.Cancel();
                        token.ThrowIfCancellationRequested();
                    }

                    return Wait(task, limit);
                }));

        Assert.Equal(1, terminated);
    }

    [Fact]
    public void RunsTheRenderOnItsOwnThread()
    {
        var caller = Environment.CurrentManagedThreadId;
        var worker = HangulRenderWatchdog.Run(
            () => Environment.CurrentManagedThreadId,
            Limit,
            () => true,
            CancellationToken.None);

        Assert.NotEqual(caller, worker);
    }

    [Theory]
    [InlineData(null, 60)]
    [InlineData("", 60)]
    [InlineData("abc", 60)]
    [InlineData("-5", 60)]
    [InlineData("9", 60)]
    [InlineData("601", 60)]
    [InlineData("10", 10)]
    [InlineData(" 90 ", 90)]
    [InlineData("600", 600)]
    public void ReadsTheConfiguredLimitWithinBounds(string? configured, int expectedSeconds) =>
        Assert.Equal(TimeSpan.FromSeconds(expectedSeconds), HangulRenderWatchdog.ResolveTimeout(configured));

    private static bool Wait(Task task, TimeSpan limit)
    {
        try
        {
            return task.Wait(limit);
        }
        catch (AggregateException)
        {
            return true;
        }
    }
}
