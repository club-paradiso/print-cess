import { describe, expect, it } from "vitest";

import {
  containsKioskProhibitedToken,
  encodePdfSafeJpeg,
  jpegQualityLadder,
} from "./pdf-marker-guard";

const latin1 = (value: string) => new Uint8Array(Array.from(value, (c) => c.charCodeAt(0)));
const blobOf = (value: string) => new Blob([latin1(value)]);

describe("PDF marker guard for embedded JPEGs", () => {
  it("steps the quality down by one point per retry", () => {
    expect(jpegQualityLadder(0.92)).toEqual([0.92, 0.91, 0.9, 0.89, 0.88, 0.87]);
  });

  it("keeps the first encoding when it is clean", async () => {
    const qualities: number[] = [];
    const { bytes } = await encodePdfSafeJpeg(
      async (quality) => {
        qualities.push(quality);
        return blobOf("\xff\xd8clean\xff\xd9");
      },
      0.92,
      () => new Error("unreachable"),
    );
    expect(qualities).toEqual([0.92]);
    expect(containsKioskProhibitedToken(bytes)).toBe(false);
  });

  it("re-encodes a scan page whose bytes spell /AA until it is clean", async () => {
    const outputs = ["\xff\xd8/AA\x00\xff\xd9", "\xff\xd8x/JS(\xff\xd9", "\xff\xd8ok\xff\xd9"];
    const qualities: number[] = [];
    const { bytes } = await encodePdfSafeJpeg(
      async (quality) => {
        qualities.push(quality);
        return blobOf(outputs.shift()!);
      },
      0.92,
      () => new Error("unreachable"),
    );
    expect(qualities).toEqual([0.92, 0.91, 0.9]);
    expect(new TextDecoder("latin1").decode(bytes)).toContain("ok");
  });

  it("fails closed when every quality is refused", async () => {
    await expect(
      encodePdfSafeJpeg(
        async () => blobOf("/AA"),
        0.92,
        () => new Error("scanImageError"),
      ),
    ).rejects.toThrow("scanImageError");
  });
});
