import { describe, expect, it } from "vitest";

import { analyzeCapturePixels, type DocumentDetection } from "./document-scan-engine";

const detection: DocumentDetection = {
  detected: true,
  confidence: 0.94,
  quad: [
    { x: 0.08, y: 0.07 },
    { x: 0.92, y: 0.08 },
    { x: 0.91, y: 0.93 },
    { x: 0.09, y: 0.92 },
  ],
};

function fixture(width: number, height: number, valueAt: (x: number, y: number) => number) {
  const bytes = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = Math.max(0, Math.min(255, valueAt(x, y)));
      const offset = (y * width + x) * 4;
      bytes[offset] = value;
      bytes[offset + 1] = value;
      bytes[offset + 2] = value;
      bytes[offset + 3] = 255;
    }
  }
  return { data: bytes, width, height };
}

describe("scanner capture fixtures", () => {
  it("flags localized clipped glare even when average exposure looks normal", () => {
    const image = fixture(240, 320, (x, y) => {
      if (x > 155 && x < 210 && y > 70 && y < 135) return 255;
      if (y % 21 < 4 && x > 30 && x < 210) return 45;
      return 205 + ((x + y) % 12);
    });
    const result = analyzeCapturePixels(image, detection);

    expect(result.glare).toBeGreaterThan(0.72);
    expect(result.issue).toBe("glare");
    expect(result.ready).toBe(false);
  });

  it("does not accept a blown-out page just because edges are detected", () => {
    const image = fixture(180, 240, (x, y) => 248 + ((x + y) % 8));
    const result = analyzeCapturePixels(image, detection);

    expect(result.issue).toBe("too-bright");
    expect(result.ready).toBe(false);
  });
});
