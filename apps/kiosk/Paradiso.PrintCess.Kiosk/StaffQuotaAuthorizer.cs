using System.Windows;
using Paradiso.PrintCess.Core.Security;
using Paradiso.PrintCess.Kiosk.Views;

namespace Paradiso.PrintCess.Kiosk;

internal interface IStaffQuotaAuthorizer
{
    Task<bool> AuthorizeAsync(int renderedPageCount, CancellationToken cancellationToken);
}

internal sealed class StaffQuotaAuthorizer : IStaffQuotaAuthorizer
{
    private readonly IAdminAuthenticator _authenticator;
    private readonly AdminAuthenticationThrottle _throttle = new();

    public StaffQuotaAuthorizer(IAdminAuthenticator authenticator)
    {
        _authenticator = authenticator;
    }

    public async Task<bool> AuthorizeAsync(int renderedPageCount, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var application = Application.Current ?? throw new InvalidOperationException("The kiosk application is not running.");
        return await application.Dispatcher.InvokeAsync(() =>
        {
            cancellationToken.ThrowIfCancellationRequested();
            var dialog = new StaffQuotaOverrideWindow(
                renderedPageCount,
                _authenticator,
                _throttle,
                cancellationToken)
            {
                Owner = application.MainWindow,
            };
            return dialog.ShowDialog() == true;
        });
    }
}
