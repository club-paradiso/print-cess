using System.Buffers.Binary;

namespace Paradiso.PrintCess.Core.Documents;

/// <summary>
/// Validates a legacy HWP 5.x document by reading its compound-file structure.
/// The document properties come from the bytes of the root-level FileHeader
/// stream itself, and active-content checks look at directory entry names, so
/// bytes outside those structures cannot change the result.
/// </summary>
internal static class HwpDocumentInspector
{
    private const uint RejectedPropertyMask =
        (1u << 1) | // password encryption
        (1u << 2) | // distribution document
        (1u << 3) | // script
        (1u << 4) | // DRM
        (1u << 8);  // certificate encryption

    private const uint ProtectedPropertyMask =
        (1u << 1) | (1u << 2) | (1u << 4) | (1u << 8);

    private const int FileHeaderPropertiesOffset = 36;
    private const int FileHeaderMinimumLength = FileHeaderPropertiesOffset + 4;
    private const int FileHeaderMaximumLength = 4096;

    private static ReadOnlySpan<byte> CompoundFileSignature =>
        [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

    private static ReadOnlySpan<byte> HwpFileHeaderSignature => "HWP Document File"u8;

    /// <summary>Storage or stream names that carry scripts or macros, anywhere in the tree.</summary>
    private static readonly string[] ActiveContentEntryNames =
    [
        "Scripts",
        "DefaultJScript",
        "JScriptVersion",
        "_VBA_PROJECT",
        "Macros",
    ];

    /// <summary>A distribution document keeps its body in ViewText instead of BodyText.</summary>
    private static readonly string[] ProtectedContentEntryNames =
    [
        "ViewText",
    ];

    public static bool LooksLikeHwp(ReadOnlySpan<byte> content) =>
        content.Length >= 512 && content[..8].SequenceEqual(CompoundFileSignature);

    public static DocumentProperties Validate(ReadOnlySpan<byte> content)
    {
        if (!LooksLikeHwp(content))
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptHwp);
        }

        CompoundFile compound;
        try
        {
            compound = CompoundFile.Parse(content);
        }
        catch (CompoundFileFormatException)
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptHwp);
        }

        // Every allocated entry counts, including entries not linked into the
        // tree, so an unlinked script storage is still rejected.
        if (compound.Entries.Any(entry => MatchesAny(entry.Name, ActiveContentEntryNames)))
        {
            throw new DocumentValidationException(DocumentValidationError.UnsafeHwpContent);
        }

        if (compound.Entries.Any(entry => MatchesAny(entry.Name, ProtectedContentEntryNames)))
        {
            throw new DocumentValidationException(DocumentValidationError.EncryptedHwp);
        }

        var fileHeader = FindRootStream(compound, "FileHeader");
        if (fileHeader is null ||
            FindRootStream(compound, "DocInfo") is null ||
            fileHeader.Size is < FileHeaderMinimumLength or > FileHeaderMaximumLength)
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptHwp);
        }

        byte[] header;
        try
        {
            header = compound.ReadStream(fileHeader);
        }
        catch (CompoundFileFormatException)
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptHwp);
        }

        if (!header.AsSpan().StartsWith(HwpFileHeaderSignature) ||
            header[HwpFileHeaderSignature.Length] != 0)
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptHwp);
        }

        var properties = BinaryPrimitives.ReadUInt32LittleEndian(
            header.AsSpan(FileHeaderPropertiesOffset, 4));
        if ((properties & RejectedPropertyMask) != 0)
        {
            throw new DocumentValidationException(
                (properties & ProtectedPropertyMask) != 0
                    ? DocumentValidationError.EncryptedHwp
                    : DocumentValidationError.UnsafeHwpContent);
        }

        return new DocumentProperties(null, null, null);
    }

    private static CompoundFileEntry? FindRootStream(CompoundFile compound, string name) =>
        compound.RootChildren.SingleOrDefault(entry =>
            entry.Type == CompoundFileEntryType.Stream &&
            string.Equals(entry.Name, name, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Compound-file directory names compare case-insensitively, so a storage
    /// named "SCRIPTS" is the same storage to Hancom as "Scripts".
    /// </summary>
    private static bool MatchesAny(string name, string[] candidates) =>
        candidates.Any(candidate => string.Equals(name, candidate, StringComparison.OrdinalIgnoreCase));
}
