using System.Buffers.Binary;
using System.Text;

namespace Paradiso.PrintCess.Tests.Fixtures;

/// <summary>
/// Writes a minimal version 3 (512-byte sector) compound file. Streams smaller
/// than 4096 bytes go into the mini stream, as real writers place them. The
/// layout is recorded so tests can corrupt a specific structure afterwards.
/// </summary>
internal sealed class CompoundFileBuilder
{
    private const int SectorSize = 512;
    private const int MiniSectorSize = 64;
    private const int EntriesPerSector = SectorSize / 4;
    private const uint EndOfChain = 0xfffffffe;
    private const uint FreeSector = 0xffffffff;
    private const uint FatSector = 0xfffffffd;
    private const uint NoStream = 0xffffffff;

    private readonly List<Node> _nodes = [new Node("Root Entry", 5, null, null)];

    /// <summary>Adds a stream and returns its directory id.</summary>
    public int AddStream(string name, byte[] data, int parent = 0)
    {
        _nodes.Add(new Node(name, 2, data, parent));
        return _nodes.Count - 1;
    }

    /// <summary>Adds a storage and returns its directory id.</summary>
    public int AddStorage(string name, int parent = 0)
    {
        _nodes.Add(new Node(name, 1, null, parent));
        return _nodes.Count - 1;
    }

    /// <summary>Adds a directory entry that is allocated but not linked into the tree.</summary>
    public int AddUnlinkedStream(string name, byte[] data)
    {
        _nodes.Add(new Node(name, 2, data, -1));
        return _nodes.Count - 1;
    }

    public CompoundFileImage Build()
    {
        // Mini stream: every small stream, each rounded up to 64-byte mini sectors.
        var miniStream = new List<byte>();
        var miniFat = new List<uint>();
        var regular = new List<(int Node, byte[] Data)>();
        foreach (var (node, index) in _nodes.Select((node, index) => (node, index)))
        {
            if (node.Data is null || node.Data.Length == 0)
            {
                continue;
            }

            if (node.Data.Length < 4096)
            {
                var first = (uint)(miniStream.Count / MiniSectorSize);
                var count = (node.Data.Length + MiniSectorSize - 1) / MiniSectorSize;
                for (var sector = 0; sector < count; sector++)
                {
                    miniFat.Add(sector == count - 1 ? EndOfChain : first + (uint)sector + 1);
                }

                miniStream.AddRange(node.Data);
                miniStream.AddRange(new byte[(count * MiniSectorSize) - node.Data.Length]);
                node.StartSector = first;
            }
            else
            {
                regular.Add((index, node.Data));
            }
        }

        var directorySectors = ((_nodes.Count * 128) + SectorSize - 1) / SectorSize;
        var miniFatSectors = miniFat.Count == 0 ? 0 : ((miniFat.Count * 4) + SectorSize - 1) / SectorSize;
        var miniStreamSectors = (miniStream.Count + SectorSize - 1) / SectorSize;
        var regularSectors = regular.Sum(item => (item.Data.Length + SectorSize - 1) / SectorSize);
        var payloadSectors = directorySectors + miniFatSectors + miniStreamSectors + regularSectors;
        var fatSectors = 1;
        while (fatSectors * EntriesPerSector < fatSectors + payloadSectors)
        {
            fatSectors++;
        }

        var totalSectors = fatSectors + payloadSectors;
        var bytes = new byte[(totalSectors + 1) * SectorSize];
        var fat = Enumerable.Repeat(FreeSector, fatSectors * EntriesPerSector).ToArray();
        var next = (uint)0;

        uint Allocate(int count)
        {
            var start = next;
            for (var index = 0; index < count; index++)
            {
                fat[next] = index == count - 1 ? EndOfChain : next + 1;
                next++;
            }

            return start;
        }

        for (var index = 0; index < fatSectors; index++)
        {
            fat[next++] = FatSector;
        }

        var directoryStart = Allocate(directorySectors);
        var miniFatStart = miniFatSectors == 0 ? EndOfChain : Allocate(miniFatSectors);
        var miniStreamStart = miniStreamSectors == 0 ? EndOfChain : Allocate(miniStreamSectors);
        foreach (var (node, data) in regular)
        {
            _nodes[node].StartSector = Allocate((data.Length + SectorSize - 1) / SectorSize);
        }

        _nodes[0].StartSector = miniStreamStart;
        _nodes[0].Size = (ulong)miniStream.Count;

        // Header.
        new byte[] { 0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1 }.CopyTo(bytes, 0);
        WriteUInt16(bytes, 0x18, 0x3e);
        WriteUInt16(bytes, 0x1a, 3);
        WriteUInt16(bytes, 0x1c, 0xfffe);
        WriteUInt16(bytes, 0x1e, 9);
        WriteUInt16(bytes, 0x20, 6);
        WriteUInt32(bytes, 0x2c, (uint)fatSectors);
        WriteUInt32(bytes, 0x30, directoryStart);
        WriteUInt32(bytes, 0x38, 4096);
        WriteUInt32(bytes, 0x3c, miniFatStart);
        WriteUInt32(bytes, 0x40, (uint)miniFatSectors);
        WriteUInt32(bytes, 0x44, EndOfChain);
        WriteUInt32(bytes, 0x48, 0);
        for (var index = 0; index < 109; index++)
        {
            WriteUInt32(bytes, 0x4c + (index * 4), index < fatSectors ? (uint)index : FreeSector);
        }

        // FAT.
        for (var index = 0; index < fat.Length; index++)
        {
            WriteUInt32(bytes, SectorOffset(index / EntriesPerSector) + ((index % EntriesPerSector) * 4), fat[index]);
        }

        // Directory: each storage's children are linked as a right-sibling chain.
        var children = _nodes
            .Select((node, index) => (node, index))
            .Where(item => item.node.Parent is >= 0)
            .GroupBy(item => item.node.Parent!.Value)
            .ToDictionary(group => group.Key, group => group.Select(item => item.index).ToList());
        var directoryOffset = SectorOffset((int)directoryStart);
        for (var id = 0; id < directorySectors * (SectorSize / 128); id++)
        {
            var offset = directoryOffset + (id * 128);
            WriteUInt32(bytes, offset + 0x44, NoStream);
            WriteUInt32(bytes, offset + 0x48, NoStream);
            WriteUInt32(bytes, offset + 0x4c, NoStream);
            if (id >= _nodes.Count)
            {
                continue;
            }

            var node = _nodes[id];
            var name = Encoding.Unicode.GetBytes(node.Name);
            name.CopyTo(bytes, offset);
            WriteUInt16(bytes, offset + 0x40, (ushort)(name.Length + 2));
            bytes[offset + 0x42] = node.Type;
            bytes[offset + 0x43] = 1;
            if (children.TryGetValue(id, out var childIds))
            {
                WriteUInt32(bytes, offset + 0x4c, (uint)childIds[0]);
            }

            if (node.Parent is >= 0 && children[node.Parent.Value] is var siblings)
            {
                var position = siblings.IndexOf(id);
                if (position + 1 < siblings.Count)
                {
                    WriteUInt32(bytes, offset + 0x48, (uint)siblings[position + 1]);
                }
            }

            WriteUInt32(bytes, offset + 0x74, node.Type == 1 ? 0 : node.StartSector);
            var size = node.Type == 5 ? node.Size : (ulong)(node.Data?.Length ?? 0);
            BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(offset + 0x78, 8), size);
        }

        // Mini FAT and mini stream.
        if (miniFatSectors > 0)
        {
            var miniFatOffset = SectorOffset((int)miniFatStart);
            for (var index = 0; index < miniFatSectors * EntriesPerSector; index++)
            {
                WriteUInt32(bytes, miniFatOffset + (index * 4), index < miniFat.Count ? miniFat[index] : FreeSector);
            }
        }

        if (miniStreamSectors > 0)
        {
            miniStream.ToArray().CopyTo(bytes, SectorOffset((int)miniStreamStart));
        }

        foreach (var (node, data) in regular)
        {
            data.CopyTo(bytes, SectorOffset((int)_nodes[node].StartSector));
        }

        return new CompoundFileImage(
            bytes,
            FatOffset: SectorOffset(0),
            DirectoryOffset: directoryOffset,
            DirectoryStartSector: directoryStart,
            MiniFatOffset: miniFatSectors > 0 ? SectorOffset((int)miniFatStart) : -1,
            MiniStreamOffset: miniStreamSectors > 0 ? SectorOffset((int)miniStreamStart) : -1,
            StreamMiniSectors: _nodes.Select(node => node.Data is { Length: > 0 and < 4096 } ? (int)node.StartSector : -1).ToArray());
    }

    private static int SectorOffset(int sector) => (sector + 1) * SectorSize;

    private static void WriteUInt16(byte[] bytes, int offset, ushort value) =>
        BinaryPrimitives.WriteUInt16LittleEndian(bytes.AsSpan(offset, 2), value);

    private static void WriteUInt32(byte[] bytes, int offset, uint value) =>
        BinaryPrimitives.WriteUInt32LittleEndian(bytes.AsSpan(offset, 4), value);

    private sealed class Node(string name, byte type, byte[]? data, int? parent)
    {
        public string Name { get; } = name;

        public byte Type { get; } = type;

        public byte[]? Data { get; } = data;

        /// <summary>Parent directory id; null for the root, -1 for an unlinked entry.</summary>
        public int? Parent { get; } = parent;

        public uint StartSector { get; set; } = EndOfChain;

        public ulong Size { get; set; }
    }
}

/// <summary>The built file plus where each structure starts, for targeted corruption.</summary>
internal sealed record CompoundFileImage(
    byte[] Bytes,
    int FatOffset,
    int DirectoryOffset,
    uint DirectoryStartSector,
    int MiniFatOffset,
    int MiniStreamOffset,
    int[] StreamMiniSectors)
{
    public int DirectoryEntryOffset(int id) => DirectoryOffset + (id * 128);
}
