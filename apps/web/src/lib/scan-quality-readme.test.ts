import { describe, expect, it } from "vitest";

import { SCANNER_QUALITY_TARGETS } from "./scan-quality-fixtures";

describe("capture gate conservatism", () => {
  it("rejects small, soft, or strongly glared captures by policy", () => {
    expect(SCANNER_QUALITY_TARGETS.minimumDocumentCoverage).toBeGreaterThanOrEqual(0.25);
    expect(SCANNER_QUALITY_TARGETS.minimumSharpness).toBeGreaterThan(0.1);
    expect(SCANNER_QUALITY_TARGETS.maximumLocalizedGlare).toBeLessThan(0.8);
  });
});
