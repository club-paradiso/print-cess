import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadCiphertext, uploadTimeoutMs } from "./api-client";

describe("uploadCiphertext", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a successful private Vercel Blob response without an ETag", async () => {
    const fetch = vi.fn().mockResolvedValue(
      Response.json({
        contentDisposition: 'attachment; filename="encrypted.bin"',
        contentType: "application/octet-stream",
        pathname: "v1/session/encrypted.bin",
        size: 4,
        uploadedAt: "2026-08-03T00:00:00.000Z",
        url: "https://blob.example/encrypted.bin",
      }),
    );
    vi.stubGlobal("fetch", fetch);

    await expect(
      uploadCiphertext(
        {
          url: "https://vercel.com/api/blob/presigned",
          headers: { "Content-Type": "application/octet-stream" },
        },
        new Uint8Array([1, 2, 3, 4]),
      ),
    ).resolves.toEqual({ size: 4 });
  });
});

describe("uploadTimeoutMs", () => {
  const MIB = 1024 * 1024;

  it("keeps the two-minute floor for small payloads", () => {
    expect(uploadTimeoutMs(1)).toBe(120_000);
    expect(uploadTimeoutMs(10 * MIB)).toBe(120_000);
  });

  it("grows with payload size and stays bounded", () => {
    expect(uploadTimeoutMs(50 * MIB)).toBeGreaterThan(120_000);
    expect(uploadTimeoutMs(128 * MIB)).toBeGreaterThan(uploadTimeoutMs(50 * MIB));
    expect(uploadTimeoutMs(128 * MIB)).toBeLessThanOrEqual(600_000);
    expect(uploadTimeoutMs(10_000 * MIB)).toBe(600_000);
  });
});
