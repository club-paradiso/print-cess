import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { describe, expect, it } from "vitest";

import { buildScannedPdf } from "./scan-pdf";

describe("searchable scan PDF round trip", () => {
  it("is parseable and exposes English and Korean OCR text through PDF.js", async () => {
    const pdf = buildScannedPdf([
      {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        width: 1200,
        height: 1800,
        ocrWords: [
          {
            text: "HELLO",
            bbox: { x0: 120, y0: 180, x1: 420, y1: 260 },
            confidence: 97,
          },
          {
            text: "한국어",
            bbox: { x0: 120, y0: 300, x1: 430, y1: 390 },
            confidence: 95,
          },
        ],
      },
    ]);

    const task = getDocument({ data: pdf.slice(), stopAtErrors: true });
    const document = await task.promise;
    try {
      expect(document.numPages).toBe(1);
      const page = await document.getPage(1);
      const content = await page.getTextContent();
      const extracted = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      expect(extracted).toContain("HELLO");
      expect(extracted).toContain("한국어");
    } finally {
      await document.destroy();
    }
  });
});
