import { describe, expect, it } from "vitest";

import { SCANNER_QUALITY_TARGETS } from "./scan-quality-fixtures";

describe("scanner quality targets", () => {
  it("requires multiple stable frames before automatic capture", () => {
    expect(SCANNER_QUALITY_TARGETS.stableFrameCount).toBeGreaterThanOrEqual(3);
    expect(SCANNER_QUALITY_TARGETS.minimumAutoCaptureScore).toBeGreaterThanOrEqual(0.6);
  });
});
