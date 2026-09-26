using System.Runtime.InteropServices;
using System.Security;
using System.Windows;
using Paradiso.PrintCess.Core.Security;

namespace Paradiso.PrintCess.Kiosk.Views;

public partial class StaffQuotaOverrideWindow : Window
{
    private readonly IAdminAuthenticator _authenticator;
    private readonly AdminAuthenticationThrottle _throttle;
    private readonly CancellationToken _cancellationToken;
    private bool _authenticationInProgress;

    public StaffQuotaOverrideWindow(
        int renderedPageCount,
        IAdminAuthenticator authenticator,
        AdminAuthenticationThrottle throttle,
        CancellationToken cancellationToken)
    {
        InitializeComponent();
        PageCountText.Text = $"{renderedPageCount}페이지";
        _authenticator = authenticator;
        _throttle = throttle;
        _cancellationToken = cancellationToken;
    }

    private async void OnAuthenticate(object sender, RoutedEventArgs e)
    {
        if (_authenticationInProgress)
        {
            return;
        }

        if (!_authenticator.IsConfigured)
        {
            ErrorMessage.Text = "직원 인증이 구성되지 않았습니다. 오류 코드: ADMIN-NOT-CONFIGURED";
            PasswordInput.Clear();
            return;
        }

        if (!_throttle.TryBegin(out _))
        {
            ErrorMessage.Text = "인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요. 오류 코드: ADMIN-RATE-LIMITED";
            PasswordInput.Clear();
            return;
        }

        _authenticationInProgress = true;
        char[]? password = null;
        try
        {
            using var securePassword = PasswordInput.SecurePassword;
            password = CopyPassword(securePassword);
            PasswordInput.Clear();
            var result = await _authenticator.AuthenticateAsync(password, _cancellationToken);
            if (!result.Succeeded)
            {
                _throttle.RecordFailure();
                ErrorMessage.Text = _throttle.TryBegin(out _)
                    ? $"승인할 수 없습니다. 오류 코드: {result.SafeCode}"
                    : "인증 시도가 너무 많습니다. 잠시 후 다시 시도하세요. 오류 코드: ADMIN-RATE-LIMITED";
                return;
            }

            _throttle.RecordSuccess();
            DialogResult = true;
        }
        catch (OperationCanceledException)
        {
            DialogResult = false;
        }
        finally
        {
            if (password is not null)
            {
                Array.Clear(password);
            }
            _authenticationInProgress = false;
        }
    }

    private void OnCancel(object sender, RoutedEventArgs e) => DialogResult = false;

    private static char[] CopyPassword(SecureString securePassword)
    {
        var characters = new char[securePassword.Length];
        var pointer = IntPtr.Zero;
        try
        {
            pointer = Marshal.SecureStringToGlobalAllocUnicode(securePassword);
            Marshal.Copy(pointer, characters, 0, characters.Length);
            return characters;
        }
        finally
        {
            if (pointer != IntPtr.Zero)
            {
                Marshal.ZeroFreeGlobalAllocUnicode(pointer);
            }
        }
    }
}
