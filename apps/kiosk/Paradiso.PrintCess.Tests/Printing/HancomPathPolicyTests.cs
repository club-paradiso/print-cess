using System.IO;
using Paradiso.PrintCess.Infrastructure.Printing;

namespace Paradiso.PrintCess.Tests.Printing;

public sealed class HancomPathPolicyTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), "PrintCessPathTest", Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(_root))
        {
            Directory.Delete(_root, recursive: true);
        }
    }

    [Fact]
    public void CreatesANewEmptyJobFolderDirectlyUnderTheRoot()
    {
        var first = HancomPathPolicy.CreateJobDirectory(_root);
        var second = HancomPathPolicy.CreateJobDirectory(_root);

        Assert.NotEqual(first, second);
        Assert.Equal(Path.GetFullPath(_root), Path.GetDirectoryName(first));
        Assert.Empty(Directory.EnumerateFileSystemEntries(first));
    }

    [Fact]
    public void AllowsPlainFilesDirectlyInsideTheJobFolder()
    {
        var job = HancomPathPolicy.CreateJobDirectory(_root);
        var input = Path.Combine(job, "document.hwp");
        File.WriteAllBytes(input, [1]);

        Assert.True(HancomPathPolicy.IsAllowed(job, input));
        Assert.True(HancomPathPolicy.IsAllowed(job, Path.Combine(job, "document.pdf")));
        Assert.Equal(input, HancomPathPolicy.EnsureAllowed(job, input));
    }

    [Fact]
    public void RejectsPathsOutsideTheJobFolder()
    {
        var job = HancomPathPolicy.CreateJobDirectory(_root);
        var other = HancomPathPolicy.CreateJobDirectory(_root);
        var separator = Path.DirectorySeparatorChar;

        Assert.False(HancomPathPolicy.IsAllowed(job, Path.Combine(other, "document.pdf")));
        Assert.False(HancomPathPolicy.IsAllowed(job, Path.Combine(_root, "document.pdf")));
        Assert.False(HancomPathPolicy.IsAllowed(job, Path.Combine(job, "nested", "document.pdf")));
        Assert.False(HancomPathPolicy.IsAllowed(job, $"{job}{separator}..{separator}{Path.GetFileName(other)}{separator}document.pdf"));
        Assert.False(HancomPathPolicy.IsAllowed(job, $"{job}{separator}.{separator}document.pdf"));
        Assert.False(HancomPathPolicy.IsAllowed(job, job + "x" + separator + "document.pdf"));
        Assert.False(HancomPathPolicy.IsAllowed(job, "document.pdf"));
        Assert.False(HancomPathPolicy.IsAllowed(job, @"\\server\share\document.pdf"));
        Assert.False(HancomPathPolicy.IsAllowed(job, string.Empty));
        Assert.Throws<InvalidDataException>(() =>
            HancomPathPolicy.EnsureAllowed(job, Path.Combine(other, "document.pdf")));
    }

    [Theory]
    [InlineData("document.pdf:stream")]
    [InlineData("document.pdf.")]
    [InlineData(".document")]
    [InlineData("doc ument.pdf")]
    [InlineData("문서.pdf")]
    public void RejectsUnusualFileNames(string name)
    {
        var job = HancomPathPolicy.CreateJobDirectory(_root);
        Assert.False(HancomPathPolicy.IsAllowed(job, Path.Combine(job, name)));
    }

    [Fact]
    public void RejectsADirectoryInPlaceOfTheFile()
    {
        var job = HancomPathPolicy.CreateJobDirectory(_root);
        var path = Path.Combine(job, "document.pdf");
        Directory.CreateDirectory(path);

        Assert.False(HancomPathPolicy.IsAllowed(job, path));
    }

    [Fact]
    public void RejectsALinkedFileEvenWhenItsTargetIsMissing()
    {
        var job = HancomPathPolicy.CreateJobDirectory(_root);
        var outside = Path.Combine(_root, "outside.txt");
        File.WriteAllBytes(outside, [1]);
        var link = Path.Combine(job, "document.pdf");
        if (!TryCreateFileLink(link, outside))
        {
            return;
        }

        Assert.False(HancomPathPolicy.IsAllowed(job, link));
        File.Delete(outside);
        Assert.False(HancomPathPolicy.IsAllowed(job, link));
    }

    [Fact]
    public void RejectsAJobFolderThatIsALink()
    {
        var real = HancomPathPolicy.CreateJobDirectory(_root);
        var linked = Path.Combine(_root, Guid.NewGuid().ToString("N"));
        if (!TryCreateDirectoryLink(linked, real))
        {
            return;
        }

        Assert.False(HancomPathPolicy.IsAllowed(linked, Path.Combine(linked, "document.pdf")));
    }

    [Fact]
    public void RefusesAWorkRootThatIsALink()
    {
        var target = Path.Combine(_root, "target");
        Directory.CreateDirectory(target);
        var linkedRoot = Path.Combine(_root, "linked-root");
        if (!TryCreateDirectoryLink(linkedRoot, target))
        {
            return;
        }

        Assert.Throws<InvalidDataException>(() => HancomPathPolicy.CreateJobDirectory(linkedRoot));
    }

    // Creating links needs a privilege on some Windows configurations; the
    // link cases are skipped there and still run on CI agents that allow it.
    private static bool TryCreateFileLink(string path, string target)
    {
        try
        {
            File.CreateSymbolicLink(path, target);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    private static bool TryCreateDirectoryLink(string path, string target)
    {
        try
        {
            Directory.CreateSymbolicLink(path, target);
            return true;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }
}
