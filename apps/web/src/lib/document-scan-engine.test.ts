import { describe, expect, it } from "vitest";

import {
  analyzeCapturePixels,
  clampQuad,
  orderDocumentQuad,
  quadArea,
  quadDrift,
  type DocumentDetection,
  type DocumentQuad,
} from "./document-scan-engine";

describe("document scan geometry", () => {
  it("orders detected corners as top-left, top-right, bottom-right, bottom-left", () => {
    const ordered = orderDocumentQuad([
      { x: 0.91, y: 0.87 },
      { x: 0.12, y: 0.15 },
      { x: 0.86, y: 0.12 },
      { x: 0.08, y: 0.9 },
    ]);

    expect(ordered).toEqual([
      { x: 0.12, y: 0.15 },
      { x: 0.86, y: 0.12 },
      { x: 0.91, y: 0.87 },
      { x: 0.08, y: 0.9 },
    ]);
  });

  it("computes normalized quadrilateral area", () => {
    const quad: DocumentQuad = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];

    expect(quadArea(quad)).toBeCloseTo(0.64, 8);
  });

  it("keeps manually dragged crop handles inside the source image", () => {
    const quad: DocumentQuad = [
      { x: -0.4, y: 0.2 },
      { x: 0.8, y: -0.3 },
      { x: 1.5, y: 0.7 },
      { x: 0.3, y: 1.2 },
    ];

    expect(clampQuad(quad)).toEqual([
      { x: 0, y: 0.2 },
      { x: 0.8, y: 0 },
      { x: 1, y: 0.7 },
      { x: 0.3, y: 1 },
    ]);
  });

  it("measures average corner drift for auto-capture stability", () => {
    const first: DocumentQuad = [
      { x: 0.1, y: 0.1 },
      { x: 0.9, y: 0.1 },
      { x: 0.9, y: 0.9 },
      { x: 0.1, y: 0.9 },
    ];
    const second: DocumentQuad = first.map((point) => ({
      x: point.x + 0.01,
      y: point.y,
    })) as DocumentQuad;

    expect(quadDrift(first, second)).toBeCloseTo(0.01, 8);
  });
});

function imageData(width: number, height: number, pixel: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = pixel(x, y);
      const index = (y * width + x) * 4;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }
  return new ImageData(data, width, height);
}

const GOOD_DETECTION: DocumentDetection = {
  detected: true,
  confidence: 0.92,
  quad: [
    { x: 0.1, y: 0.08 },
    { x: 0.91, y: 0.1 },
    { x: 0.9, y: 0.92 },
    { x: 0.09, y: 0.9 },
  ],
};

describe("live capture quality gates", () => {
  it("refuses auto capture when no document is detected", () => {
    const quality = analyzeCapturePixels(
      imageData(80, 100, (x, y) => ((x + y) % 4 < 2 ? 70 : 205)),
      { detected: false, confidence: 0, quad: GOOD_DETECTION.quad },
    );

    expect(quality.ready).toBe(false);
    expect(quality.issue).toBe("no-document");
  });

  it("rejects a dark frame before triggering the shutter", () => {
    const quality = analyzeCapturePixels(
      imageData(80, 100, (x, y) => 25 + ((x * 7 + y * 5) % 25)),
      GOOD_DETECTION,
    );

    expect(quality.ready).toBe(false);
    expect(quality.issue).toBe("too-dark");
  });

  it("accepts a well exposed high-detail document frame", () => {
    const quality = analyzeCapturePixels(
      imageData(120, 160, (x, y) => {
        const paper = 218;
        const line = y % 18 < 4 && x > 16 && x < 104;
        return line ? 45 : paper - ((x + y) % 7);
      }),
      GOOD_DETECTION,
    );

    expect(quality.issue).toBe("ready");
    expect(quality.ready).toBe(true);
    expect(quality.score).toBeGreaterThanOrEqual(0.62);
  });
});
