using Paradiso.PrintCess.Infrastructure.Printing;

namespace Paradiso.PrintCess.Tests.Printing;

public sealed class HancomProcessOwnershipTests
{
    private const int KioskSession = 1;
    private static readonly DateTime RenderStarted = new(2026, 10, 26, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void SelectsTheSingleProcessStartedForThisRender()
    {
        var existing = Process(100, RenderStarted.AddHours(-1));
        var started = Process(200, RenderStarted.AddSeconds(1));

        Assert.Equal(200, HancomProcessOwnership.SelectOwned([existing], [existing, started], KioskSession, RenderStarted));
    }

    [Fact]
    public void NeverSelectsAProcessThatWasAlreadyRunning()
    {
        var existing = Process(100, RenderStarted.AddHours(-1));

        Assert.Null(HancomProcessOwnership.SelectOwned([existing], [existing], KioskSession, RenderStarted));
    }

    [Fact]
    public void TreatsAReusedProcessIdAsANewProcess()
    {
        var exited = Process(100, RenderStarted.AddHours(-1));
        var reused = Process(100, RenderStarted.AddSeconds(2));

        Assert.Equal(100, HancomProcessOwnership.SelectOwned([exited], [reused], KioskSession, RenderStarted));
    }

    [Fact]
    public void IgnoresProcessesInOtherSessionsOrStartedEarlier()
    {
        var otherUser = new HancomProcessSnapshot(300, KioskSession + 1, RenderStarted.AddSeconds(1));
        var olderUnseen = Process(400, RenderStarted.AddMinutes(-5));

        Assert.Null(HancomProcessOwnership.SelectOwned([], [otherUser, olderUnseen], KioskSession, RenderStarted));
    }

    [Fact]
    public void SelectsNothingWhenTwoNewProcessesAppear()
    {
        var first = Process(200, RenderStarted.AddSeconds(1));
        var second = Process(201, RenderStarted.AddSeconds(1));

        Assert.Null(HancomProcessOwnership.SelectOwned([], [first, second], KioskSession, RenderStarted));
    }

    private static HancomProcessSnapshot Process(int id, DateTime started) => new(id, KioskSession, started);
}
