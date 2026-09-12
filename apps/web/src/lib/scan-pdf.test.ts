import { describe, expect, it } from "vitest";

import { buildScannedPdf } from "./scan-pdf";

const decoder = new TextDecoder("latin1");

describe("buildScannedPdf", () => {
  it("creates one indexed PDF page per JPEG", () => {
    const pdf = buildScannedPdf([
      { bytes: new Uint8Array([0xff, 0xd8, 1, 2, 0xff, 0xd9]), width: 1200, height: 1800 },
      { bytes: new Uint8Array([0xff, 0xd8, 3, 4, 0xff, 0xd9]), width: 1800, height: 1200 },
    ]);
    const rendered = decoder.decode(pdf);

    expect(rendered.startsWith("%PDF-1.4")).toBe(true);
    expect(rendered).toContain("/Count 2");
    expect(rendered).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(rendered).toContain("/MediaBox [0 0 841.89 595.28]");
    expect(rendered.endsWith("%%EOF\n")).toBe(true);
  });

  it("writes xref offsets that point at their objects", () => {
    const pdf = buildScannedPdf([
      { bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), width: 100, height: 200 },
    ]);
    const rendered = decoder.decode(pdf);
    const firstOffset = Number(/xref\n0 6\n0000000000 65535 f \n(\d{10})/u.exec(rendered)?.[1]);

    expect(rendered.slice(firstOffset, firstOffset + 7)).toBe("1 0 obj");
  });

  it("adds an invisible searchable Unicode OCR layer", () => {
    const pdf = buildScannedPdf([
      {
        bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
        width: 1200,
        height: 1800,
        ocrWords: [
          { text: "Hello", bbox: { x0: 100, y0: 120, x1: 360, y1: 185 }, confidence: 96 },
          { text: "한국어", bbox: { x0: 100, y0: 220, x1: 340, y1: 300 }, confidence: 91 },
          { text: "العربية", bbox: { x0: 100, y0: 340, x1: 430, y1: 420 }, confidence: 88 },
        ],
      },
    ]);
    const rendered = decoder.decode(pdf);

    expect(rendered).toContain("/Subtype /Type0");
    expect(rendered).toContain("/ToUnicode");
    expect(rendered).toContain("3 Tr");
    expect(rendered).toContain("D55C");
    expect(rendered).toContain("AD6D");
    expect(rendered).toContain("0627");
    expect(rendered).toContain("/Font << /OCR");
  });

  it("refuses an empty document", () => {
    expect(() => buildScannedPdf([])).toThrow("scanNeedsPage");
  });
});
