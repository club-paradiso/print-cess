import { describe, expect, it } from "vitest";

import * as protocol from "../src/index.js";
import {
  ENVELOPE_OVERHEAD_BYTES,
  MAX_ENVELOPE_BYTES,
  MAX_PLAINTEXT_BYTES,
  MAX_PRINT_BUNDLE_BYTES,
  PRINT_BUNDLE_ENTRY_HEADER_BYTES,
  PRINT_BUNDLE_HEADER_BYTES,
  PrintBundleError,
  encodePrintBundle,
} from "../src/index.js";

const MIB = 1024 * 1024;

describe("size limits", () => {
  it("allows 50 MiB per document and 128 MiB per encrypted bundle", () => {
    expect(MAX_PLAINTEXT_BYTES).toBe(50 * MIB);
    expect(MAX_PRINT_BUNDLE_BYTES).toBe(128 * MIB);
    expect(MAX_ENVELOPE_BYTES).toBe(128 * MIB + ENVELOPE_OVERHEAD_BYTES);
  });

  it("exports no page-count or staff-quota policy", () => {
    for (const name of [
      "MAX_PDF_PAGES",
      "PUBLIC_FREE_PAGE_LIMIT",
      "SYSTEM_MAX_PAGE_LIMIT",
      "decidePrintQuota",
    ]) {
      expect(name in protocol, name).toBe(false);
    }
  });

  it("accepts a bundle that exactly fills the budget and rejects one byte more", () => {
    const fixed = PRINT_BUNDLE_HEADER_BYTES + 3 * PRINT_BUNDLE_ENTRY_HEADER_BYTES;
    const rest = MAX_PRINT_BUNDLE_BYTES - fixed - 2 * MAX_PLAINTEXT_BYTES;
    const entries = (extra: number) => [
      { fileKind: "pdf" as const, bytes: new Uint8Array(MAX_PLAINTEXT_BYTES) },
      { fileKind: "pdf" as const, bytes: new Uint8Array(MAX_PLAINTEXT_BYTES) },
      { fileKind: "pdf" as const, bytes: new Uint8Array(rest + extra) },
    ];
    expect(encodePrintBundle(entries(0)).byteLength).toBe(MAX_PRINT_BUNDLE_BYTES);
    expect(() => encodePrintBundle(entries(1))).toThrow(PrintBundleError);
  });
});
