using System.Buffers.Binary;
using System.Text;

namespace Paradiso.PrintCess.Core.Documents;

/// <summary>
/// A read-only Compound File Binary (OLE2 / MS-CFB) reader for in-memory
/// documents. It parses the header, the FAT through the header and DIFAT
/// chain, the directory, and the mini stream, and reads a stream from its own
/// sectors. Every sector number, chain length, directory link and size is
/// checked; anything inconsistent throws <see cref="CompoundFileFormatException"/>.
/// </summary>
internal sealed class CompoundFile
{
    internal const uint MaxRegularSector = 0xfffffffa;
    internal const uint DifatSector = 0xfffffffc;
    internal const uint FatSector = 0xfffffffd;
    internal const uint EndOfChain = 0xfffffffe;
    internal const uint FreeSector = 0xffffffff;
    internal const uint NoStream = 0xffffffff;

    private const int HeaderDifatEntries = 109;
    private const int DirectoryEntrySize = 128;
    private const int MiniSectorSize = 64;
    private const uint MiniStreamCutoff = 4096;

    private static ReadOnlySpan<byte> Signature => [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

    private readonly byte[] _content;
    private readonly int _sectorSize;
    private readonly uint _sectorCount;
    private readonly uint[] _fat;
    private readonly uint[] _miniFat;
    private readonly byte[] _miniStream;

    private CompoundFile(
        byte[] content,
        int sectorSize,
        uint sectorCount,
        uint[] fat,
        uint[] miniFat,
        byte[] miniStream,
        IReadOnlyList<CompoundFileEntry> entries)
    {
        _content = content;
        _sectorSize = sectorSize;
        _sectorCount = sectorCount;
        _fat = fat;
        _miniFat = miniFat;
        _miniStream = miniStream;
        Entries = entries;
    }

    /// <summary>Every allocated storage and stream entry in directory order, reachable or not.</summary>
    public IReadOnlyList<CompoundFileEntry> Entries { get; }

    /// <summary>The direct children of the root storage, reached through the directory tree.</summary>
    public IEnumerable<CompoundFileEntry> RootChildren => Entries.Where(entry => entry.IsReachable && entry.ParentId == 0);

    public static CompoundFile Parse(ReadOnlySpan<byte> content)
    {
        if (content.Length < 512 || !content[..8].SequenceEqual(Signature))
        {
            throw new CompoundFileFormatException("The compound file signature is missing.");
        }

        var majorVersion = BinaryPrimitives.ReadUInt16LittleEndian(content[0x1a..]);
        var byteOrder = BinaryPrimitives.ReadUInt16LittleEndian(content[0x1c..]);
        var sectorShift = BinaryPrimitives.ReadUInt16LittleEndian(content[0x1e..]);
        var miniSectorShift = BinaryPrimitives.ReadUInt16LittleEndian(content[0x20..]);
        var directorySectorCount = BinaryPrimitives.ReadUInt32LittleEndian(content[0x28..]);
        var fatSectorCount = BinaryPrimitives.ReadUInt32LittleEndian(content[0x2c..]);
        var firstDirectorySector = BinaryPrimitives.ReadUInt32LittleEndian(content[0x30..]);
        var miniStreamCutoff = BinaryPrimitives.ReadUInt32LittleEndian(content[0x38..]);
        var firstMiniFatSector = BinaryPrimitives.ReadUInt32LittleEndian(content[0x3c..]);
        var miniFatSectorCount = BinaryPrimitives.ReadUInt32LittleEndian(content[0x40..]);
        var firstDifatSector = BinaryPrimitives.ReadUInt32LittleEndian(content[0x44..]);
        var difatSectorCount = BinaryPrimitives.ReadUInt32LittleEndian(content[0x48..]);

        if (byteOrder != 0xfffe ||
            !((majorVersion == 3 && sectorShift == 9) || (majorVersion == 4 && sectorShift == 12)) ||
            miniSectorShift != 6 ||
            miniStreamCutoff != MiniStreamCutoff ||
            (majorVersion == 3 && directorySectorCount != 0))
        {
            throw new CompoundFileFormatException("The compound file header is invalid.");
        }

        var sectorSize = 1 << sectorShift;
        if (content.Length < sectorSize * 2)
        {
            throw new CompoundFileFormatException("The compound file is truncated.");
        }

        // Sector n starts at (n + 1) * sectorSize; only whole sectors are addressable.
        var sectorCount = (uint)((content.Length / sectorSize) - 1);
        var entriesPerSector = sectorSize / 4;

        if (fatSectorCount == 0 || fatSectorCount > sectorCount ||
            difatSectorCount > sectorCount ||
            miniFatSectorCount > sectorCount)
        {
            throw new CompoundFileFormatException("The compound file allocation sizes are out of range.");
        }

        var bytes = content.ToArray();
        var fatSectors = ReadFatSectorList(
            bytes,
            sectorSize,
            sectorCount,
            fatSectorCount,
            firstDifatSector,
            difatSectorCount);

        var fat = new uint[checked((int)fatSectorCount * entriesPerSector)];
        for (var index = 0; index < fatSectors.Length; index++)
        {
            var sector = SectorSpan(bytes, sectorSize, sectorCount, fatSectors[index]);
            for (var entry = 0; entry < entriesPerSector; entry++)
            {
                fat[(index * entriesPerSector) + entry] =
                    BinaryPrimitives.ReadUInt32LittleEndian(sector[(entry * 4)..]);
            }
        }

        var directoryChain = FollowChain(fat, sectorCount, firstDirectorySector, "directory");
        if (directoryChain.Count == 0 ||
            (majorVersion == 4 && directorySectorCount != 0 && directorySectorCount != directoryChain.Count))
        {
            throw new CompoundFileFormatException("The compound file directory chain is invalid.");
        }

        var directoryBytes = new byte[checked(directoryChain.Count * sectorSize)];
        for (var index = 0; index < directoryChain.Count; index++)
        {
            SectorSpan(bytes, sectorSize, sectorCount, directoryChain[index])
                .CopyTo(directoryBytes.AsSpan(index * sectorSize));
        }

        var rawEntries = ReadDirectoryEntries(directoryBytes, majorVersion);
        var root = rawEntries[0];
        if (root.Type != CompoundFileEntryType.Root)
        {
            throw new CompoundFileFormatException("The compound file root entry is missing.");
        }

        uint[] miniFat = [];
        if (miniFatSectorCount > 0)
        {
            var miniFatChain = FollowChain(fat, sectorCount, firstMiniFatSector, "mini FAT");
            if (miniFatChain.Count != miniFatSectorCount)
            {
                throw new CompoundFileFormatException("The compound file mini FAT size is inconsistent.");
            }

            miniFat = new uint[checked(miniFatChain.Count * entriesPerSector)];
            for (var index = 0; index < miniFatChain.Count; index++)
            {
                var sector = SectorSpan(bytes, sectorSize, sectorCount, miniFatChain[index]);
                for (var entry = 0; entry < entriesPerSector; entry++)
                {
                    miniFat[(index * entriesPerSector) + entry] =
                        BinaryPrimitives.ReadUInt32LittleEndian(sector[(entry * 4)..]);
                }
            }
        }
        else if (firstMiniFatSector != EndOfChain)
        {
            throw new CompoundFileFormatException("The compound file mini FAT location is inconsistent.");
        }

        if (root.Size > (ulong)content.Length ||
            root.Size > (ulong)miniFat.Length * MiniSectorSize)
        {
            throw new CompoundFileFormatException("The compound file mini stream size is out of range.");
        }

        var miniStream = root.Size == 0
            ? []
            : ReadRegularStream(bytes, fat, sectorSize, sectorCount, root.StartSector, (long)root.Size);

        var entries = LinkDirectoryTree(rawEntries);
        return new CompoundFile(bytes, sectorSize, sectorCount, fat, miniFat, miniStream, entries);
    }

    /// <summary>Reads a stream entry's bytes from its own regular or mini sector chain.</summary>
    public byte[] ReadStream(CompoundFileEntry entry)
    {
        ArgumentNullException.ThrowIfNull(entry);
        if (entry.Type != CompoundFileEntryType.Stream)
        {
            throw new CompoundFileFormatException("Only stream entries have content.");
        }

        if (entry.Size > (ulong)_content.Length)
        {
            throw new CompoundFileFormatException("The compound file stream size is out of range.");
        }

        if (entry.Size == 0)
        {
            return [];
        }

        return entry.Size < MiniStreamCutoff
            ? ReadMiniStream(entry.StartSector, (int)entry.Size)
            : ReadRegularStream(_content, _fat, _sectorSize, _sectorCount, entry.StartSector, (long)entry.Size);
    }

    private byte[] ReadMiniStream(uint start, int size)
    {
        var miniSectorCount = (uint)(_miniStream.Length / MiniSectorSize);
        var chain = FollowChain(_miniFat, miniSectorCount, start, "mini stream");
        if ((long)chain.Count * MiniSectorSize < size ||
            (long)(chain.Count - 1) * MiniSectorSize >= size)
        {
            throw new CompoundFileFormatException("The compound file mini stream chain length is inconsistent.");
        }

        var output = new byte[size];
        for (var index = 0; index < chain.Count; index++)
        {
            var offset = checked((int)chain[index] * MiniSectorSize);
            var count = Math.Min(MiniSectorSize, size - (index * MiniSectorSize));
            _miniStream.AsSpan(offset, count).CopyTo(output.AsSpan(index * MiniSectorSize));
        }

        return output;
    }

    private static byte[] ReadRegularStream(
        byte[] content,
        uint[] fat,
        int sectorSize,
        uint sectorCount,
        uint start,
        long size)
    {
        var chain = FollowChain(fat, sectorCount, start, "stream");
        if ((long)chain.Count * sectorSize < size ||
            (long)(chain.Count - 1) * sectorSize >= size)
        {
            throw new CompoundFileFormatException("The compound file stream chain length is inconsistent.");
        }

        var output = new byte[checked((int)size)];
        for (var index = 0; index < chain.Count; index++)
        {
            var count = (int)Math.Min(sectorSize, size - ((long)index * sectorSize));
            SectorSpan(content, sectorSize, sectorCount, chain[index])[..count]
                .CopyTo(output.AsSpan(index * sectorSize));
        }

        return output;
    }

    private static uint[] ReadFatSectorList(
        byte[] content,
        int sectorSize,
        uint sectorCount,
        uint fatSectorCount,
        uint firstDifatSector,
        uint difatSectorCount)
    {
        var fatSectors = new uint[fatSectorCount];
        var filled = 0;
        var header = content.AsSpan(0x4c, HeaderDifatEntries * 4);
        for (var index = 0; index < HeaderDifatEntries; index++)
        {
            var sector = BinaryPrimitives.ReadUInt32LittleEndian(header[(index * 4)..]);
            if (filled < fatSectorCount)
            {
                fatSectors[filled++] = sector;
            }
            else if (sector != FreeSector)
            {
                throw new CompoundFileFormatException("The compound file header DIFAT has unexpected entries.");
            }
        }

        var difatVisited = new HashSet<uint>();
        var next = firstDifatSector;
        var entriesPerDifatSector = (sectorSize / 4) - 1;
        for (var read = 0u; read < difatSectorCount; read++)
        {
            if (next > MaxRegularSector || next >= sectorCount || !difatVisited.Add(next))
            {
                throw new CompoundFileFormatException("The compound file DIFAT chain is invalid.");
            }

            var sector = SectorSpan(content, sectorSize, sectorCount, next);
            for (var index = 0; index < entriesPerDifatSector; index++)
            {
                var value = BinaryPrimitives.ReadUInt32LittleEndian(sector[(index * 4)..]);
                if (filled < fatSectorCount)
                {
                    fatSectors[filled++] = value;
                }
                else if (value != FreeSector)
                {
                    throw new CompoundFileFormatException("The compound file DIFAT has unexpected entries.");
                }
            }

            next = BinaryPrimitives.ReadUInt32LittleEndian(sector[(entriesPerDifatSector * 4)..]);
        }

        if (filled != fatSectorCount ||
            (difatSectorCount == 0 ? firstDifatSector is not (EndOfChain or FreeSector) : next is not (EndOfChain or FreeSector)))
        {
            throw new CompoundFileFormatException("The compound file DIFAT does not describe the FAT.");
        }

        var unique = new HashSet<uint>();
        foreach (var sector in fatSectors)
        {
            if (sector > MaxRegularSector || sector >= sectorCount || !unique.Add(sector) || difatVisited.Contains(sector))
            {
                throw new CompoundFileFormatException("The compound file FAT sector list is invalid.");
            }
        }

        return fatSectors;
    }

    /// <summary>
    /// Follows an allocation chain until ENDOFCHAIN. Every link must name an
    /// addressable sector, and a sector seen twice means the chain loops.
    /// </summary>
    private static List<uint> FollowChain(uint[] table, uint addressableSectors, uint start, string chainName)
    {
        var limit = Math.Min((uint)table.Length, addressableSectors);
        var chain = new List<uint>();
        var visited = new HashSet<uint>();
        var current = start;
        while (current != EndOfChain)
        {
            if (current > MaxRegularSector || current >= limit || !visited.Add(current))
            {
                throw new CompoundFileFormatException($"The compound file {chainName} chain is invalid.");
            }

            chain.Add(current);
            current = table[current];
        }

        return chain;
    }

    private static ReadOnlySpan<byte> SectorSpan(byte[] content, int sectorSize, uint sectorCount, uint sector)
    {
        if (sector > MaxRegularSector || sector >= sectorCount)
        {
            throw new CompoundFileFormatException("The compound file references a sector outside the file.");
        }

        return content.AsSpan(checked((int)((sector + 1) * (long)sectorSize)), sectorSize);
    }

    private static List<RawEntry> ReadDirectoryEntries(byte[] directory, ushort majorVersion)
    {
        var entries = new List<RawEntry>(directory.Length / DirectoryEntrySize);
        for (var offset = 0; offset + DirectoryEntrySize <= directory.Length; offset += DirectoryEntrySize)
        {
            var span = directory.AsSpan(offset, DirectoryEntrySize);
            var type = span[0x42] switch
            {
                0 => CompoundFileEntryType.Unallocated,
                1 => CompoundFileEntryType.Storage,
                2 => CompoundFileEntryType.Stream,
                5 => CompoundFileEntryType.Root,
                _ => throw new CompoundFileFormatException("The compound file directory has an unknown entry type."),
            };

            var size = BinaryPrimitives.ReadUInt64LittleEndian(span[0x78..]);
            if (majorVersion == 3)
            {
                // Version 3 writers may leave the high half uninitialised.
                size &= 0xffffffff;
            }

            var name = string.Empty;
            if (type != CompoundFileEntryType.Unallocated)
            {
                var nameLength = BinaryPrimitives.ReadUInt16LittleEndian(span[0x40..]);
                if (nameLength < 2 || nameLength > 64 || nameLength % 2 != 0 ||
                    span[nameLength - 2] != 0 || span[nameLength - 1] != 0)
                {
                    throw new CompoundFileFormatException("The compound file directory has an invalid entry name.");
                }

                name = Encoding.Unicode.GetString(span[..(nameLength - 2)]);
                if (name.Length == 0 || name.Contains('\0', StringComparison.Ordinal))
                {
                    throw new CompoundFileFormatException("The compound file directory has an invalid entry name.");
                }
            }

            entries.Add(new RawEntry(
                name,
                type,
                BinaryPrimitives.ReadUInt32LittleEndian(span[0x44..]),
                BinaryPrimitives.ReadUInt32LittleEndian(span[0x48..]),
                BinaryPrimitives.ReadUInt32LittleEndian(span[0x4c..]),
                BinaryPrimitives.ReadUInt32LittleEndian(span[0x74..]),
                size));
        }

        if (entries.Count == 0)
        {
            throw new CompoundFileFormatException("The compound file directory is empty.");
        }

        if (entries.Skip(1).Any(entry => entry.Type == CompoundFileEntryType.Root))
        {
            throw new CompoundFileFormatException("The compound file directory has more than one root.");
        }

        return entries;
    }

    /// <summary>
    /// Walks the root's child tree and every storage's child tree. An entry is
    /// linked at most once; a second link means the tree loops or is shared,
    /// which no valid compound file contains. Names under one storage compare
    /// case-insensitively and must be unique.
    /// </summary>
    private static List<CompoundFileEntry> LinkDirectoryTree(List<RawEntry> raw)
    {
        var parents = new uint?[raw.Count];
        var linked = new bool[raw.Count];
        linked[0] = true;
        var pendingStorages = new Stack<uint>();
        pendingStorages.Push(0);

        while (pendingStorages.Count > 0)
        {
            var storageId = pendingStorages.Pop();
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var siblings = new Stack<uint>();
            PushLink(raw[(int)storageId].Child);

            while (siblings.Count > 0)
            {
                var id = siblings.Pop();
                var entry = raw[(int)id];
                if (entry.Type is not (CompoundFileEntryType.Storage or CompoundFileEntryType.Stream) ||
                    !names.Add(entry.Name))
                {
                    throw new CompoundFileFormatException("The compound file directory tree is invalid.");
                }

                parents[id] = storageId;
                PushLink(entry.Left);
                PushLink(entry.Right);
                if (entry.Type == CompoundFileEntryType.Storage)
                {
                    pendingStorages.Push(id);
                }
                else if (entry.Child != NoStream)
                {
                    throw new CompoundFileFormatException("The compound file directory tree is invalid.");
                }
            }

            void PushLink(uint link)
            {
                if (link == NoStream)
                {
                    return;
                }

                if (link >= raw.Count || linked[link])
                {
                    throw new CompoundFileFormatException("The compound file directory tree is invalid.");
                }

                linked[link] = true;
                siblings.Push(link);
            }
        }

        var entries = new List<CompoundFileEntry>();
        for (var id = 0; id < raw.Count; id++)
        {
            var entry = raw[id];
            if (entry.Type is CompoundFileEntryType.Storage or CompoundFileEntryType.Stream)
            {
                entries.Add(new CompoundFileEntry(
                    (uint)id,
                    entry.Name,
                    entry.Type,
                    parents[id],
                    linked[id],
                    entry.StartSector,
                    entry.Size));
            }
        }

        return entries;
    }

    private sealed record RawEntry(
        string Name,
        CompoundFileEntryType Type,
        uint Left,
        uint Right,
        uint Child,
        uint StartSector,
        ulong Size);
}

internal enum CompoundFileEntryType
{
    Unallocated,
    Storage,
    Stream,
    Root,
}

internal sealed record CompoundFileEntry(
    uint Id,
    string Name,
    CompoundFileEntryType Type,
    uint? ParentId,
    bool IsReachable,
    uint StartSector,
    ulong Size);

internal sealed class CompoundFileFormatException : Exception
{
    public CompoundFileFormatException(string message)
        : base(message)
    {
    }
}
