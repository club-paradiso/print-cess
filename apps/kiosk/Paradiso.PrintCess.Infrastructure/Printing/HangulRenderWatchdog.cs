using System.Globalization;
using System.IO;

namespace Paradiso.PrintCess.Infrastructure.Printing;

/// <summary>
/// Runs a Hancom render on its own worker thread with a time limit. When the
/// limit passes, or the caller cancels, the supplied terminate callback stops
/// the Hancom process this render started, the worker is given a short grace
/// period to run its own cleanup, and the render fails with
/// <see cref="InvalidDataException"/> so it takes the normal "cannot open this
/// document" path.
/// </summary>
public static class HangulRenderWatchdog
{
    public const string TimeoutEnvironmentVariable = "PRINT_CESS_HANCOM_RENDER_TIMEOUT_SECONDS";

    public static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(60);
    public static readonly TimeSpan MinimumTimeout = TimeSpan.FromSeconds(10);
    public static readonly TimeSpan MaximumTimeout = TimeSpan.FromSeconds(600);
    public static readonly TimeSpan TerminationGrace = TimeSpan.FromSeconds(10);

    /// <summary>
    /// Reads the configured limit in whole seconds. A missing, malformed or
    /// out-of-range value uses <see cref="DefaultTimeout"/>.
    /// </summary>
    public static TimeSpan ResolveTimeout(string? configuredSeconds)
    {
        if (string.IsNullOrWhiteSpace(configuredSeconds) ||
            !int.TryParse(configuredSeconds.Trim(), NumberStyles.None, CultureInfo.InvariantCulture, out var seconds))
        {
            return DefaultTimeout;
        }

        var timeout = TimeSpan.FromSeconds(seconds);
        return timeout < MinimumTimeout || timeout > MaximumTimeout ? DefaultTimeout : timeout;
    }

    /// <param name="render">The render; it runs on a dedicated worker thread.</param>
    /// <param name="timeout">How long the render may run.</param>
    /// <param name="terminateRenderer">Stops the Hancom process this render owns; returns whether it did.</param>
    /// <param name="cancellationToken">Cancels the wait; the renderer is stopped the same way as on timeout.</param>
    /// <param name="startWorker">Starts the render; tests replace the thread.</param>
    /// <param name="waitForWorker">Waits up to a limit and returns whether the worker finished; tests replace the clock.</param>
    public static T Run<T>(
        Func<T> render,
        TimeSpan timeout,
        Func<bool> terminateRenderer,
        CancellationToken cancellationToken,
        Func<Func<T>, Task<T>>? startWorker = null,
        Func<Task, TimeSpan, CancellationToken, bool>? waitForWorker = null)
    {
        ArgumentNullException.ThrowIfNull(render);
        ArgumentNullException.ThrowIfNull(terminateRenderer);
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(timeout, TimeSpan.Zero);

        startWorker ??= StartDedicatedThread;
        waitForWorker ??= WaitWithLimit;

        var worker = startWorker(render);
        bool finished;
        try
        {
            finished = waitForWorker(worker, timeout, cancellationToken);
        }
        catch (OperationCanceledException)
        {
            StopAndDrain(worker, terminateRenderer, waitForWorker);
            throw;
        }

        if (finished)
        {
            return worker.GetAwaiter().GetResult();
        }

        StopAndDrain(worker, terminateRenderer, waitForWorker);
        throw new InvalidDataException(
            "Hangul document rendering did not finish within the time limit.",
            new TimeoutException());
    }

    private static void StopAndDrain(
        Task worker,
        Func<bool> terminateRenderer,
        Func<Task, TimeSpan, CancellationToken, bool> waitForWorker)
    {
        // The worker's failure after termination is expected; observe it so it
        // is not reported as an unobserved task exception.
        _ = worker.ContinueWith(
            static task => _ = task.Exception,
            CancellationToken.None,
            TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
            TaskScheduler.Default);

        try
        {
            terminateRenderer();
        }
        catch (Exception exception) when (exception is InvalidOperationException or
                                              UnauthorizedAccessException or
                                              System.ComponentModel.Win32Exception or
                                              NotSupportedException)
        {
            // The render already failed; a process that cannot be stopped is
            // left to the operating system and the next start's cleanup.
        }

        try
        {
            waitForWorker(worker, TerminationGrace, CancellationToken.None);
        }
        catch (OperationCanceledException)
        {
        }
    }

    private static bool WaitWithLimit(Task task, TimeSpan limit, CancellationToken cancellationToken)
    {
        try
        {
            return task.Wait(limit, cancellationToken);
        }
        catch (AggregateException)
        {
            // Finished with an exception; the caller rethrows it from the task.
            return true;
        }
    }

    private static Task<T> StartDedicatedThread<T>(Func<T> render)
    {
        var completion = new TaskCompletionSource<T>(TaskCreationOptions.RunContinuationsAsynchronously);
        var thread = new Thread(() =>
        {
            try
            {
                completion.TrySetResult(render());
            }
            catch (OperationCanceledException exception)
            {
                completion.TrySetCanceled(exception.CancellationToken);
            }
            catch (Exception exception)
            {
                completion.TrySetException(exception);
            }
        })
        {
            IsBackground = true,
            Name = "Print-cess Hangul render worker",
        };

        if (OperatingSystem.IsWindows())
        {
            thread.SetApartmentState(ApartmentState.STA);
        }

        thread.Start();
        return completion.Task;
    }
}
