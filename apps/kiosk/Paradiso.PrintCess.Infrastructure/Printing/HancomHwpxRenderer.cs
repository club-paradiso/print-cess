#if WINDOWS
using System.ComponentModel;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Security;
using Microsoft.Win32;
using Paradiso.PrintCess.Core.Documents;

namespace Paradiso.PrintCess.Infrastructure.Printing;

internal static class HancomHwpxRenderer
{
    private const int MaximumRenderedPdfBytes = 64 * 1024 * 1024;
    private const string SecurityModuleEnvironmentVariable = "PRINT_CESS_HANCOM_SECURITY_MODULE";
    private const string DefaultSecurityModuleName = "FilePathCheckerModuleExample";
    private const string SecurityModuleRegistryPath = @"Software\HNC\HwpAutomation\Modules";

    public static bool IsAvailable =>
        GetAutomationType() is not null && ResolveSecurityModuleName() is not null;

    public static Task<byte[]> RenderToPdfAsync(
        byte[] content,
        DocumentKind kind,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(content);
        if (kind is not (DocumentKind.Hwp or DocumentKind.Hwpx))
        {
            throw new ArgumentOutOfRangeException(nameof(kind));
        }
        cancellationToken.ThrowIfCancellationRequested();

        var moduleName = ResolveSecurityModuleName();
        if (string.IsNullOrWhiteSpace(moduleName))
        {
            throw new InvalidDataException(
                $"No usable Hancom Automation file-path security module is registered under HKCU\\{SecurityModuleRegistryPath}. " +
                $"Register '{DefaultSecurityModuleName}' or set {SecurityModuleEnvironmentVariable} to the exact registered value name.");
        }

        // Hancom opens the file with forceopen, so the bytes are inspected
        // again here and nothing that fails inspection reaches it.
        try
        {
            PortableDocumentValidator.EnsureHangulDocumentPassesInspection(content, kind);
        }
        catch (DocumentValidationException exception)
        {
            throw new InvalidDataException("The Hangul document did not pass inspection.", exception);
        }

        string directory;
        try
        {
            directory = HancomPathPolicy.CreateJobDirectory(HancomWorkspace.WorkRoot);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            throw new InvalidDataException("The Hangul work folder could not be prepared.", exception);
        }

        var timeout = HangulRenderWatchdog.ResolveTimeout(
            Environment.GetEnvironmentVariable(HangulRenderWatchdog.TimeoutEnvironmentVariable));
        using var hancomProcess = OwnedHancomProcess.CaptureBaseline();
        try
        {
            var pdf = HangulRenderWatchdog.Run(
                () => RenderInJobDirectory(content, kind, moduleName, directory, hancomProcess, cancellationToken),
                timeout,
                hancomProcess.TryTerminate,
                cancellationToken);
            return Task.FromResult(pdf);
        }
        finally
        {
            // The worker cleans up after itself; this repeats it for a render
            // that was stopped and did not get that far.
            DeleteJobDirectory(directory);
        }
    }

    private static byte[] RenderInJobDirectory(
        byte[] content,
        DocumentKind kind,
        string moduleName,
        string directory,
        OwnedHancomProcess hancomProcess,
        CancellationToken cancellationToken)
    {
        var extension = kind == DocumentKind.Hwp ? "hwp" : "hwpx";
        var inputPath = HancomPathPolicy.EnsureAllowed(directory, Path.Combine(directory, $"document.{extension}"));
        var outputPath = HancomPathPolicy.EnsureAllowed(directory, Path.Combine(directory, "document.pdf"));
        object? automation = null;

        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            using (var input = new FileStream(inputPath, FileMode.CreateNew, FileAccess.Write, FileShare.None))
            {
                input.Write(content);
            }

            var automationType = GetAutomationType();
            if (automationType is null)
            {
                throw new InvalidDataException("A supported Hancom Office automation component is not installed.");
            }

            automation = Activator.CreateInstance(automationType) ??
                         throw new InvalidDataException("Hancom Office automation could not be started.");
            hancomProcess.Identify();

            var registered = Invoke(automation, "RegisterModule", "FilePathCheckDLL", moduleName);
            if (registered is not bool registeredResult || !registeredResult)
            {
                throw new InvalidDataException(
                    $"Hancom rejected security module '{moduleName}'. Verify the HKCU Automation module registration and DLL path.");
            }

            cancellationToken.ThrowIfCancellationRequested();
            HancomPathPolicy.EnsureAllowed(directory, inputPath);
            // Let Hancom detect the real document format. This is more robust than forcing
            // HWP/HWPX from the extension and is the vendor-recommended behavior when the
            // exact underlying format is not guaranteed by the filename alone.
            var opened = Invoke(
                automation,
                "Open",
                inputPath,
                string.Empty,
                "lock:false;forceopen:true;suspendpassword:true;versionwarning:false;");
            if (opened is bool openedResult && !openedResult)
            {
                throw new InvalidDataException("Hancom Office rejected the Hangul document.");
            }

            cancellationToken.ThrowIfCancellationRequested();
            if (File.Exists(outputPath) || Directory.Exists(outputPath))
            {
                throw new InvalidDataException("The Hangul output path is already in use.");
            }

            HancomPathPolicy.EnsureAllowed(directory, outputPath);
            var saved = Invoke(automation, "SaveAs", outputPath, "PDF", string.Empty);
            if (saved is bool savedResult && !savedResult)
            {
                throw new InvalidDataException("Hancom Office could not render the Hangul document as PDF.");
            }

            if (!File.Exists(outputPath))
            {
                throw new InvalidDataException("Hancom Office did not create a PDF output file.");
            }

            HancomPathPolicy.EnsureAllowed(directory, outputPath);
            var info = new FileInfo(outputPath);
            if (info.Length is < 1 or > MaximumRenderedPdfBytes)
            {
                throw new InvalidDataException("The rendered PDF is outside the safe size limit.");
            }

            cancellationToken.ThrowIfCancellationRequested();
            return File.ReadAllBytes(outputPath);
        }
        catch (Exception exception) when (exception is COMException or TargetInvocationException or
                                          MissingMethodException or UnauthorizedAccessException or
                                          SecurityException or IOException)
        {
            throw new InvalidDataException("Hangul document rendering failed safely.", exception);
        }
        finally
        {
            if (automation is not null)
            {
                TryInvoke(automation, "Clear", 1);
                TryInvoke(automation, "Quit");
                if (Marshal.IsComObject(automation))
                {
                    Marshal.FinalReleaseComObject(automation);
                }
            }

            DeleteJobDirectory(directory);
        }
    }

    private static void DeleteJobDirectory(string directory)
    {
        foreach (var name in new[] { "document.hwp", "document.hwpx", "document.pdf" })
        {
            SecureDelete(Path.Combine(directory, name));
        }

        try
        {
            if (Directory.Exists(directory))
            {
                Directory.Delete(directory, recursive: true);
            }
        }
        catch
        {
            // HancomWorkspace.PurgeAbandoned removes what is left on the next start.
        }
    }

    private static Type? GetAutomationType() =>
        Type.GetTypeFromProgID("HWPFrame.HwpObject.2", throwOnError: false) ??
        Type.GetTypeFromProgID("HWPFrame.HwpObject", throwOnError: false);

    private static string? ResolveSecurityModuleName()
    {
        var configuredName = Environment.GetEnvironmentVariable(SecurityModuleEnvironmentVariable)?.Trim();
        if (!string.IsNullOrWhiteSpace(configuredName))
        {
            return IsSecurityModuleRegistered(configuredName) ? configuredName : null;
        }

        return IsSecurityModuleRegistered(DefaultSecurityModuleName)
            ? DefaultSecurityModuleName
            : null;
    }

    private static bool IsSecurityModuleRegistered(string moduleName) =>
        TryFindSecurityModule(moduleName, RegistryView.Registry64) ||
        TryFindSecurityModule(moduleName, RegistryView.Registry32);

    private static bool TryFindSecurityModule(string moduleName, RegistryView view)
    {
        try
        {
            using var currentUser = RegistryKey.OpenBaseKey(RegistryHive.CurrentUser, view);
            using var modules = currentUser.OpenSubKey(SecurityModuleRegistryPath, writable: false);
            var registeredPath = modules?.GetValue(
                moduleName,
                defaultValue: null,
                RegistryValueOptions.DoNotExpandEnvironmentNames) as string;
            if (string.IsNullOrWhiteSpace(registeredPath))
            {
                return false;
            }

            var expandedPath = Environment.ExpandEnvironmentVariables(registeredPath.Trim());
            return Path.IsPathFullyQualified(expandedPath) && File.Exists(expandedPath);
        }
        catch (Exception exception) when (exception is SecurityException or UnauthorizedAccessException or IOException)
        {
            return false;
        }
    }

    private static object? Invoke(object target, string method, params object?[] arguments) =>
        target.GetType().InvokeMember(
            method,
            BindingFlags.InvokeMethod | BindingFlags.Public | BindingFlags.Instance,
            binder: null,
            target,
            arguments,
            CultureInfo.InvariantCulture);

    private static void TryInvoke(object target, string method, params object?[] arguments)
    {
        try
        {
            Invoke(target, method, arguments);
        }
        catch
        {
            // Cleanup must continue even when the automation object is already shutting down.
        }
    }

    private static void SecureDelete(string path)
    {
        try
        {
            var file = new FileInfo(path);
            if (file.LinkTarget is not null ||
                ((int)file.Attributes != -1 && (file.Attributes & FileAttributes.ReparsePoint) != 0))
            {
                // Remove the link itself; never write through it.
                File.Delete(path);
                return;
            }

            if (!file.Exists)
            {
                return;
            }

            var length = file.Length;
            if (length is > 0 and <= MaximumRenderedPdfBytes)
            {
                using var stream = new FileStream(path, FileMode.Open, FileAccess.Write, FileShare.None);
                var zeros = new byte[64 * 1024];
                long remaining = length;
                while (remaining > 0)
                {
                    var count = (int)Math.Min(zeros.Length, remaining);
                    stream.Write(zeros, 0, count);
                    remaining -= count;
                }
                stream.Flush(flushToDisk: true);
            }
            File.Delete(path);
        }
        catch
        {
            // Best effort only; encrypted transfer storage remains independently short-lived.
        }
    }

    /// <summary>
    /// Tracks the Hwp.exe process that this render's automation object
    /// started. The kiosk records the Hancom processes already running before
    /// it creates the automation object; afterwards, the single new process in
    /// the kiosk's session is the one it owns. The process handle is kept open
    /// from then on, so stopping it can never reach a different process that
    /// later reuses the id.
    /// </summary>
    private sealed class OwnedHancomProcess : IDisposable
    {
        private const string HancomProcessName = "Hwp";

        private readonly object _gate = new();
        private readonly IReadOnlyCollection<HancomProcessSnapshot> _before;
        private readonly DateTime _startedUtc;
        private readonly int _sessionId;
        private Process? _owned;
        private DateTime _ownedStartUtc;
        private bool _disposed;

        private OwnedHancomProcess(IReadOnlyCollection<HancomProcessSnapshot> before, DateTime startedUtc, int sessionId)
        {
            _before = before;
            _startedUtc = startedUtc;
            _sessionId = sessionId;
        }

        public static OwnedHancomProcess CaptureBaseline()
        {
            using var current = Process.GetCurrentProcess();
            var startedUtc = DateTime.UtcNow;
            return new OwnedHancomProcess(Snapshot(), startedUtc, current.SessionId);
        }

        /// <summary>Records the owned process once it can be told apart; safe to call repeatedly.</summary>
        public void Identify()
        {
            lock (_gate)
            {
                if (_disposed || _owned is not null)
                {
                    return;
                }

                var processId = HancomProcessOwnership.SelectOwned(_before, Snapshot(), _sessionId, _startedUtc);
                if (processId is null)
                {
                    return;
                }

                try
                {
                    var process = Process.GetProcessById(processId.Value);
                    // Reading the start time opens and keeps the process handle.
                    _ownedStartUtc = process.StartTime.ToUniversalTime();
                    _owned = process;
                }
                catch (Exception exception) when (exception is ArgumentException or InvalidOperationException or Win32Exception)
                {
                    // The process already exited or cannot be opened.
                }
            }
        }

        /// <summary>Stops the owned Hancom process and its children. Returns false when none is known.</summary>
        public bool TryTerminate()
        {
            lock (_gate)
            {
                Identify();
                if (_owned is null)
                {
                    return false;
                }

                try
                {
                    if (_owned.HasExited ||
                        _owned.StartTime.ToUniversalTime() != _ownedStartUtc ||
                        !string.Equals(_owned.ProcessName, HancomProcessName, StringComparison.OrdinalIgnoreCase))
                    {
                        return false;
                    }

                    _owned.Kill(entireProcessTree: true);
                    _owned.WaitForExit(5_000);
                    return true;
                }
                catch (Exception exception) when (exception is InvalidOperationException or Win32Exception or NotSupportedException)
                {
                    return false;
                }
            }
        }

        public void Dispose()
        {
            lock (_gate)
            {
                _disposed = true;
                _owned?.Dispose();
                _owned = null;
            }
        }

        private static List<HancomProcessSnapshot> Snapshot()
        {
            var snapshots = new List<HancomProcessSnapshot>();
            foreach (var process in Process.GetProcessesByName(HancomProcessName))
            {
                using (process)
                {
                    try
                    {
                        snapshots.Add(new HancomProcessSnapshot(
                            process.Id,
                            process.SessionId,
                            process.StartTime.ToUniversalTime()));
                    }
                    catch (Exception exception) when (exception is InvalidOperationException or Win32Exception)
                    {
                        // Exited meanwhile, or not ours to inspect.
                    }
                }
            }

            return snapshots;
        }
    }
}
#else
namespace Paradiso.PrintCess.Infrastructure.Printing;

internal static class HancomHwpxRenderer
{
    public static bool IsAvailable => false;
}
#endif
