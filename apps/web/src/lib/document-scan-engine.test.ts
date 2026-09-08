import { describe, expect, it } from "vitest";

import { clampQuad, orderDocumentQuad, quadArea, type DocumentQuad } from "./document-scan-engine";

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
});
