import { describe, expect, it } from "vitest";

import { SCANNER_QUALITY_POLICY } from "./scan-quality-policy";

describe("scanner quality policy", () => {
  it("requires stable high-quality frames for automatic capture", () => {
    expect(SCANNER_QUALITY_POLICY.autoCapture.stableFrameCount).toBeGreaterThanOrEqual(3);
    expect(SCANNER_QUALITY_POLICY.autoCapture.minimumScore).toBeGreaterThanOrEqual(0.6);
    expect(SCANNER_QUALITY_POLICY.frame.minimumDocumentCoverage).toBeGreaterThanOrEqual(0.25);
    expect(SCANNER_QUALITY_POLICY.frame.maximumLocalizedGlare).toBeLessThan(0.8);
  });
});
