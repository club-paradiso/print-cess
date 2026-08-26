using Paradiso.PrintCess.Core.Printing;

namespace Paradiso.PrintCess.Tests.Printing;

public sealed class PrintQuotaPolicyTests
{
    [Theory]
    [InlineData(1)]
    [InlineData(10)]
    [InlineData(11)]
    public void PublicLimitAllowsTheLastFreePage(int pages) =>
        Assert.Equal(PrintQuotaDecision.Allowed, PrintQuotaPolicy.Decide(pages));

    [Theory]
    [InlineData(12)]
    [InlineData(49)]
    [InlineData(50)]
    public void CourtesyLimitRequiresStaff(int pages)
    {
        Assert.Equal(PrintQuotaDecision.StaffOverrideRequired, PrintQuotaPolicy.Decide(pages));
        Assert.Equal(PrintQuotaDecision.Allowed, PrintQuotaPolicy.Decide(pages, staffAuthorized: true));
    }

    [Fact]
    public void TechnicalCeilingCannotBeOverridden()
    {
        Assert.Equal(PrintQuotaDecision.HardLimitExceeded, PrintQuotaPolicy.Decide(51));
        Assert.Equal(PrintQuotaDecision.HardLimitExceeded, PrintQuotaPolicy.Decide(51, staffAuthorized: true));
    }
}
