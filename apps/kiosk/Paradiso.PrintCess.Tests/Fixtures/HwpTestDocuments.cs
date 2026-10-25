using System.Buffers.Binary;
using System.Text;

namespace Paradiso.PrintCess.Tests.Fixtures;

internal static class HwpTestDocuments
{
    public static byte[] Valid(
        uint properties = 0,
        bool includeScriptStream = false,
        string scriptStreamName = "Scripts") =>
        Builder(properties, includeScriptStream, scriptStreamName).Build().Bytes;

    /// <summary>A 256-byte HWP 5.x FileHeader stream with the given property flags.</summary>
    public static byte[] FileHeader(uint properties)
    {
        var header = new byte[256];
        Encoding.ASCII.GetBytes("HWP Document File").CopyTo(header, 0);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(32, 4), 0x05010100);
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(36, 4), properties);
        return header;
    }

    /// <summary>
    /// Root entries in the order FileHeader (id 1), DocInfo (id 2), BodyText
    /// storage (id 3) with Section0 (id 4), then the optional script storage.
    /// </summary>
    public static CompoundFileBuilder Builder(
        uint properties = 0,
        bool includeScriptStream = false,
        string scriptStreamName = "Scripts")
    {
        var builder = new CompoundFileBuilder();
        builder.AddStream("FileHeader", FileHeader(properties));
        builder.AddStream("DocInfo", new byte[300]);
        var body = builder.AddStorage("BodyText");
        builder.AddStream("Section0", new byte[200], body);
        if (includeScriptStream)
        {
            var scripts = builder.AddStorage(scriptStreamName);
            builder.AddStream("Body", new byte[16], scripts);
        }

        return builder;
    }
}
