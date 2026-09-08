export type PdfImagePage = {
  bytes: Uint8Array;
  width: number;
  height: number;
};

const A4_PORTRAIT = { width: 595.28, height: 841.89 };
const encoder = new TextEncoder();

function text(value: string): Uint8Array {
  return encoder.encode(value);
}

function join(parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.byteLength, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.byteLength;
  }
  return output;
}

function stream(dictionary: string, body: Uint8Array): Uint8Array {
  return join([
    text(`<< ${dictionary} /Length ${body.byteLength} >>\nstream\n`),
    body,
    text("\nendstream"),
  ]);
}

/**
 * Builds a small, standards-compliant PDF directly from normalized JPEG pages.
 * Keeping this local means a scan never has to leave the visitor's device just
 * to become a PDF.
 */
export function buildScannedPdf(pages: readonly PdfImagePage[]): Uint8Array {
  if (pages.length === 0) throw new Error("scanNeedsPage");

  const objects: Uint8Array[] = [];
  objects[0] = text("<< /Type /Catalog /Pages 2 0 R >>");
  const pageIds = pages.map((_, index) => 3 + index * 3);
  objects[1] = text(
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  );

  pages.forEach((page, index) => {
    if (page.width <= 0 || page.height <= 0 || page.bytes.byteLength === 0) {
      throw new Error("scanInvalidPage");
    }
    const pageId = pageIds[index]!;
    const imageId = pageId + 1;
    const contentId = pageId + 2;
    const landscape = page.width > page.height;
    const pageWidth = landscape ? A4_PORTRAIT.height : A4_PORTRAIT.width;
    const pageHeight = landscape ? A4_PORTRAIT.width : A4_PORTRAIT.height;
    const scale = Math.min(pageWidth / page.width, pageHeight / page.height);
    const drawnWidth = page.width * scale;
    const drawnHeight = page.height * scale;
    const x = (pageWidth - drawnWidth) / 2;
    const y = (pageHeight - drawnHeight) / 2;
    const content = text(
      `q\n${drawnWidth.toFixed(2)} 0 0 ${drawnHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Scan Do\nQ`,
    );

    objects[pageId - 1] = text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Resources << /XObject << /Scan ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    objects[imageId - 1] = stream(
      `/Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`,
      page.bytes,
    );
    objects[contentId - 1] = stream("", content);
  });

  const header = text("%PDF-1.4\n% Print-cess scan\n");
  const output: Uint8Array[] = [header];
  const offsets = [0];
  let byteOffset = header.byteLength;
  objects.forEach((body, index) => {
    offsets[index + 1] = byteOffset;
    const object = join([text(`${index + 1} 0 obj\n`), body, text("\nendobj\n")]);
    output.push(object);
    byteOffset += object.byteLength;
  });

  const xrefOffset = byteOffset;
  const xref = [
    `xref\n0 ${objects.length + 1}\n`,
    "0000000000 65535 f \n",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  ].join("");
  output.push(text(xref));
  return join(output);
}
