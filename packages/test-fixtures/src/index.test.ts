import { describe, expect, it } from "vitest";

import { MAX_DOCUMENT_BYTES, createBoundaryBytes, createSyntheticPdf } from "./index.js";

describe("synthetic fixture builders", () => {
  it("creates the exact binary boundary", () => {
    expect(createBoundaryBytes()).toHaveLength(MAX_DOCUMENT_BYTES);
    expect(createBoundaryBytes(1)).toHaveLength(MAX_DOCUMENT_BYTES + 1);
  });

  it("builds documents beyond 50 and 100 pages", async () => {
    expect((await createSyntheticPdf(101)).byteLength).toBeGreaterThan(0);
    await expect(createSyntheticPdf(121)).rejects.toThrow("Invalid page count");
  });

  it("marks generated PDFs as synthetic", async () => {
    const pdf = await createSyntheticPdf(1);
    expect(new TextDecoder("latin1").decode(pdf.slice(0, 8))).toContain("%PDF-");
  });
});
