using Paradiso.PrintCess.Core.Protocol;

namespace Paradiso.PrintCess.Core.Documents;

internal static class PrintBundleDocumentInspector
{
    public static DocumentProperties Validate(ReadOnlySpan<byte> content)
    {
        try
        {
            using var bundle = PrintBundle.Parse(content);
            var exactPageCount = 0;
            var paginationVerified = true;
            foreach (var entry in bundle.Entries)
            {
                var properties = entry.Kind switch
                {
                    DocumentKind.Pdf => PdfDocumentInspector.Validate(entry.Bytes),
                    DocumentKind.Png => PngDocumentInspector.Validate(entry.Bytes),
                    DocumentKind.Jpeg => JpegDocumentInspector.Validate(entry.Bytes),
                    DocumentKind.Hwpx => HwpxDocumentInspector.Validate(entry.Bytes),
                    DocumentKind.Hwp => HwpDocumentInspector.Validate(entry.Bytes),
                    _ => throw new DocumentValidationException(DocumentValidationError.CorruptBundle),
                };
                if (properties.PageCount is { } pageCount)
                {
                    exactPageCount = checked(exactPageCount + pageCount);
                    if (exactPageCount > PortableDocumentValidator.MaximumPdfPages)
                    {
                        throw new DocumentValidationException(DocumentValidationError.TooManyPages);
                    }
                }
                else
                {
                    paginationVerified = false;
                }
            }
            return new DocumentProperties(paginationVerified ? exactPageCount : null, null, null);
        }
        catch (DocumentValidationException)
        {
            throw;
        }
        catch (ProtocolException)
        {
            throw new DocumentValidationException(DocumentValidationError.CorruptBundle);
        }
    }
}
