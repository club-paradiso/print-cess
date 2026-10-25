using System.Buffers.Binary;
using System.Text;
using Paradiso.PrintCess.Core.Documents;
using Paradiso.PrintCess.Tests.Fixtures;

namespace Paradiso.PrintCess.Tests.Documents;

public sealed class HwpCompoundFileTests
{
    private const uint ScriptFlag = 1u << 3;
    private const uint DrmFlag = 1u << 4;

    private readonly PortableDocumentValidator _validator = new();

    [Fact]
    public void AcceptsACleanCompoundDocument()
    {
        using var hwp = Validate(HwpTestDocuments.Valid());
        Assert.Equal(DocumentKind.Hwp, hwp.Kind);
    }

    [Fact]
    public void ReadsFlagsFromTheFileHeaderStreamNotAnEarlierHeaderCopy()
    {
        // An earlier stream carries a clean copy of the header; the real
        // FileHeader stream sets the script flag.
        var builder = new CompoundFileBuilder();
        builder.AddStream("Preview", HwpTestDocuments.FileHeader(0));
        builder.AddStream("FileHeader", HwpTestDocuments.FileHeader(ScriptFlag));
        builder.AddStream("DocInfo", new byte[300]);
        var bytes = builder.Build().Bytes;

        var clean = Encoding.ASCII.GetBytes("HWP Document File");
        Assert.True(bytes.AsSpan().IndexOf(clean) < bytes.AsSpan().LastIndexOf(clean));
        AssertError(DocumentValidationError.UnsafeHwpContent, bytes);
    }

    [Fact]
    public void RejectsProtectedFlagsBehindACleanDecoyHeader()
    {
        var builder = new CompoundFileBuilder();
        builder.AddStream("Preview", HwpTestDocuments.FileHeader(0));
        builder.AddStream("FileHeader", HwpTestDocuments.FileHeader(DrmFlag));
        builder.AddStream("DocInfo", new byte[300]);

        AssertError(DocumentValidationError.EncryptedHwp, builder.Build().Bytes);
    }

    [Fact]
    public void RejectsHeaderBytesThatAreNotInsideAFileHeaderStream()
    {
        // Names and a clean header appear in the raw bytes, but no directory
        // describes them.
        var bytes = new byte[2048];
        new byte[] { 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1 }.CopyTo(bytes, 0);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(0x1c, 2), 0xfffe);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(0x1e, 2), 9);
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(0x20, 2), 6);
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(0x38, 4), 4096);
        Encoding.Unicode.GetBytes("FileHeader").CopyTo(bytes, 512);
        Encoding.Unicode.GetBytes("DocInfo").CopyTo(bytes, 640);
        Encoding.ASCII.GetBytes("HWP Document File").CopyTo(bytes, 1024);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsAFileHeaderThatIsNotARootStream()
    {
        var builder = new CompoundFileBuilder();
        var storage = builder.AddStorage("Nested");
        builder.AddStream("FileHeader", HwpTestDocuments.FileHeader(0), storage);
        builder.AddStream("DocInfo", new byte[300]);

        AssertError(DocumentValidationError.CorruptHwp, builder.Build().Bytes);
    }

    [Fact]
    public void RejectsAFileHeaderWithoutTheHwpSignature()
    {
        var builder = new CompoundFileBuilder();
        builder.AddStream("FileHeader", new byte[256]);
        builder.AddStream("DocInfo", new byte[300]);

        AssertError(DocumentValidationError.CorruptHwp, builder.Build().Bytes);
    }

    [Fact]
    public void RejectsDuplicateNamesInOneStorageRegardlessOfCase()
    {
        var builder = new CompoundFileBuilder();
        builder.AddStream("FileHeader", HwpTestDocuments.FileHeader(0));
        builder.AddStream("FILEHEADER", HwpTestDocuments.FileHeader(ScriptFlag));
        builder.AddStream("DocInfo", new byte[300]);

        AssertError(DocumentValidationError.CorruptHwp, builder.Build().Bytes);
    }

    [Theory]
    [InlineData("Scripts")]
    [InlineData("scripts")]
    [InlineData("DefaultJScript")]
    [InlineData("JScriptVersion")]
    [InlineData("_VBA_PROJECT")]
    [InlineData("MACROS")]
    public void RejectsScriptOrMacroEntriesAtAnyDepth(string name)
    {
        var builder = HwpTestDocuments.Builder();
        var storage = builder.AddStorage("BinData");
        builder.AddStream(name, new byte[16], storage);

        AssertError(DocumentValidationError.UnsafeHwpContent, builder.Build().Bytes);
    }

    [Fact]
    public void RejectsAScriptEntryThatIsNotLinkedIntoTheTree()
    {
        var builder = HwpTestDocuments.Builder();
        builder.AddUnlinkedStream("DefaultJScript", new byte[16]);

        AssertError(DocumentValidationError.UnsafeHwpContent, builder.Build().Bytes);
    }

    [Fact]
    public void RejectsADistributionBodyStorage()
    {
        var builder = HwpTestDocuments.Builder();
        var view = builder.AddStorage("ViewText");
        builder.AddStream("Section0", new byte[16], view);

        AssertError(DocumentValidationError.EncryptedHwp, builder.Build().Bytes);
    }

    [Fact]
    public void ReadsStreamsStoredInRegularSectors()
    {
        var builder = new CompoundFileBuilder();
        builder.AddStream("FileHeader", HwpTestDocuments.FileHeader(0));
        builder.AddStream("DocInfo", new byte[9000]);
        using var hwp = Validate(builder.Build().Bytes);
        Assert.Equal(DocumentKind.Hwp, hwp.Kind);
    }

    [Fact]
    public void RejectsALoopInTheDirectoryChain()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        // The directory sector points at itself instead of ENDOFCHAIN.
        WriteFat(bytes, image, image.DirectoryStartSector, image.DirectoryStartSector);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsAnOutOfRangeSectorInTheDirectoryChain()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        WriteFat(bytes, image, image.DirectoryStartSector, 0x00ffffff);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsALoopInTheFileHeaderMiniChain()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        var first = image.StreamMiniSectors[1];
        // FileHeader spans four mini sectors; make the last one point back to the first.
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(image.MiniFatOffset + ((first + 3) * 4), 4), (uint)first);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsAnOutOfRangeMiniSector()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(image.DirectoryEntryOffset(1) + 0x74, 4), 50_000);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsALoopInTheDirectoryTree()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        // DocInfo's right sibling points back at FileHeader.
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(image.DirectoryEntryOffset(2) + 0x48, 4), 1);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsADirectoryLinkOutsideTheDirectory()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(image.DirectoryEntryOffset(2) + 0x44, 4), 4000);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsAbsurdAllocationCounts()
    {
        var bytes = HwpTestDocuments.Valid();
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(0x2c, 4), 0x7fffffff);
        AssertError(DocumentValidationError.CorruptHwp, bytes);

        bytes = HwpTestDocuments.Valid();
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(0x48, 4), 0x7fffffff);
        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsAStreamSizeLargerThanItsChain()
    {
        var image = HwpTestDocuments.Builder().Build();
        var bytes = image.Bytes;
        BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(image.DirectoryEntryOffset(1) + 0x78, 8), 1024);

        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void RejectsATruncatedFile()
    {
        var bytes = HwpTestDocuments.Valid();
        AssertError(DocumentValidationError.CorruptHwp, bytes.AsSpan(0, bytes.Length - 512).ToArray());
        AssertError(DocumentValidationError.CorruptHwp, bytes.AsSpan(0, 600).ToArray());
    }

    [Fact]
    public void RejectsAnInconsistentHeader()
    {
        var bytes = HwpTestDocuments.Valid();
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(0x1e, 2), 12);
        AssertError(DocumentValidationError.CorruptHwp, bytes);

        bytes = HwpTestDocuments.Valid();
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(0x38, 4), 2048);
        AssertError(DocumentValidationError.CorruptHwp, bytes);
    }

    [Fact]
    public void PreRenderGateAcceptsOnlyInspectedHangulDocuments()
    {
        PortableDocumentValidator.EnsureHangulDocumentPassesInspection(HwpTestDocuments.Valid(), DocumentKind.Hwp);
        PortableDocumentValidator.EnsureHangulDocumentPassesInspection(HwpxTestDocuments.Valid(), DocumentKind.Hwpx);

        var unsafeHwp = Assert.Throws<DocumentValidationException>(() =>
            PortableDocumentValidator.EnsureHangulDocumentPassesInspection(
                HwpTestDocuments.Valid(properties: ScriptFlag),
                DocumentKind.Hwp));
        Assert.Equal(DocumentValidationError.UnsafeHwpContent, unsafeHwp.Error);

        var mismatch = Assert.Throws<DocumentValidationException>(() =>
            PortableDocumentValidator.EnsureHangulDocumentPassesInspection(HwpTestDocuments.Valid(), DocumentKind.Hwpx));
        Assert.Equal(DocumentValidationError.TypeMismatch, mismatch.Error);

        var notHangul = Assert.Throws<DocumentValidationException>(() =>
            PortableDocumentValidator.EnsureHangulDocumentPassesInspection(TestDocuments.OnePagePdf(), DocumentKind.Pdf));
        Assert.Equal(DocumentValidationError.TypeMismatch, notHangul.Error);
    }

    private static void WriteFat(byte[] bytes, CompoundFileImage image, uint sector, uint value) =>
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(image.FatOffset + ((int)sector * 4), 4), value);

    private ValidatedDocument Validate(byte[] bytes) =>
        _validator.Validate(bytes, DocumentKind.Hwp, "application/x-hwp", TestDocuments.SessionId);

    private void AssertError(DocumentValidationError expected, byte[] bytes)
    {
        var exception = Assert.Throws<DocumentValidationException>(() => Validate(bytes));
        Assert.Equal(expected, exception.Error);
    }
}
