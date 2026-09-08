import { describe, expect, it } from "vitest";

import {
  analyzeCapturePixels,
  type DocumentDetection,
} from "./document-scan-engine";

function imageData(
  width: number,
  height: number,
  pixel: (x: number, y: number) => number,
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = Math.max(0, Math.min(255, pixel(x, y)));
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

const LARGE_DOCUMENT: DocumentDetection = {
  detected: true,
  confidence: 0.94,
  quad: [
    { x: 0.08, y: 0.07 },
    { x: 0.92, y: 0.08 },
    { x: 0.91, y: 0.93 },
    { x: 0.09, y: 0.92 },
  ],
};

describe("adversarial live capture quality gates", () => {
  it("rejects a detected document whose boundary confidence is too low", () => {
    const quality = analyzeCapturePixels(
      imageData(120, 160, (x, y) =>
        y % 18 < 4 && x > 16 && x < 104 ? 45 : 214,
      ),
      { ...LARGE_DOCUMENT, confidence: 0.42 },
    );

    expect(quality.issue).toBe("no-document");
    expect(quality.ready).toBe(false);
  });

  it("asks the user to move closer when the page occupies too little of the frame", () => {
    const quality = analyzeCapturePixels(
      imageData(120, 160, (x, y) =>
        y % 18 < 4 && x > 16 && x < 104 ? 45 : 214,
      ),
      {
        detected: true,
        confidence: 0.94,
        quad: [
          { x: 0.31, y: 0.29 },
          { x: 0.69, y: 0.3 },
          { x: 0.68, y: 0.69 },
          { x: 0.32, y: 0.68 },
        ],
      },
    );

    expect(quality.coverage).toBeLessThan(0.28);
    expect(quality.issue).toBe("move-closer");
    expect(quality.ready).toBe(false);
  });

  it("rejects a well-exposed but detail-free blurry frame", () => {
    const quality = analyzeCapturePixels(imageData(160, 220, () => 205), LARGE_DOCUMENT);

    expect(quality.brightness).toBeGreaterThan(0.2);
    expect(quality.brightness).toBeLessThan(0.96);
    expect(quality.sharpness).toBeLessThan(0.14);
    expect(quality.issue).toBe("blurry");
    expect(quality.ready).toBe(false);
  });
});
