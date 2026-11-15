import { beforeAll, describe, expect, it } from "vitest";

import { BULK_BLOCK_BYTES, BULK_ROOM_ID_PATTERN } from "@print-cess/protocol";

import {
  bulkNonce,
  computeBulkProof,
  deriveBulkFileKey,
  deriveBulkKeys,
  openBulkBlock,
  openBulkManifestPage,
  openBulkSignal,
  sealBulkBlock,
  sealBulkManifestPage,
  sealBulkSignal,
  verifyBulkProof,
  type BulkKeys,
  type BulkProofContext,
} from "../src/bulk-crypto.js";
import { deriveDropKeys } from "../src/drop-crypto.js";

const CODE = "23456789ABCD";
const OTHER_CODE = "ZYXWVTSRQPNM";
let keys: BulkKeys;
let otherKeys: BulkKeys;

beforeAll(async () => {
  [keys, otherKeys] = await Promise.all([deriveBulkKeys(CODE), deriveBulkKeys(OTHER_CODE)]);
});

describe("bulk key derivation", () => {
  it("is deterministic, normalizes what people type, and names a canonical room", async () => {
    const again = await deriveBulkKeys("2345-6789-abcd");
    expect(again.roomId).toBe(keys.roomId);
    expect(keys.roomId).toMatch(BULK_ROOM_ID_PATTERN);
    expect(otherKeys.roomId).not.toBe(keys.roomId);
  });

  it("never names the same identifier as a v1 drop with the same characters", async () => {
    const drop = await deriveDropKeys(CODE);
    expect(drop.dropId).not.toBe(keys.roomId);
  });

  it("refuses a malformed code", async () => {
    await expect(deriveBulkKeys("short")).rejects.toThrow();
  });
});

describe("signal envelopes", () => {
  it("round-trips for the right room, role, and generation only", async () => {
    const payload = { v: 2, kind: "offer", sdp: "v=0..." };
    const sealed = await sealBulkSignal(keys, "sender", 3, payload);
    await expect(openBulkSignal(keys, "sender", 3, sealed)).resolves.toEqual(payload);
    // A different generation is a replay; the other role is a reflection.
    await expect(openBulkSignal(keys, "sender", 4, sealed)).rejects.toThrow();
    await expect(openBulkSignal(keys, "receiver", 3, sealed)).rejects.toThrow();
    await expect(openBulkSignal(otherKeys, "sender", 3, sealed)).rejects.toThrow();
  });

  it("rejects a tampered envelope", async () => {
    const sealed = await sealBulkSignal(keys, "receiver", 1, { a: 1 });
    const flipped = sealed.slice(0, 20) + (sealed[20] === "A" ? "B" : "A") + sealed.slice(21);
    await expect(openBulkSignal(keys, "receiver", 1, flipped)).rejects.toThrow();
  });
});

describe("channel proof", () => {
  const context: BulkProofContext = {
    role: "sender",
    generation: 1,
    senderNonce: bulkNonce(),
    receiverNonce: bulkNonce(),
    senderFingerprint: "sha-256 AA:BB",
    receiverFingerprint: "sha-256 CC:DD",
  };

  it("verifies only with the same code and the same channel", async () => {
    const mac = await computeBulkProof(keys, context);
    expect(await verifyBulkProof(keys, context, mac)).toBe(true);
    expect(await verifyBulkProof(otherKeys, context, mac)).toBe(false);
    expect(await verifyBulkProof(keys, { ...context, role: "receiver" }, mac)).toBe(false);
    expect(
      await verifyBulkProof(keys, { ...context, receiverFingerprint: "sha-256 EE:FF" }, mac),
    ).toBe(false);
    expect(await verifyBulkProof(keys, { ...context, senderNonce: bulkNonce() }, mac)).toBe(false);
    expect(await verifyBulkProof(keys, context, "not-a-mac")).toBe(false);
  });
});

describe("manifest pages", () => {
  it("binds a page to its position and the file count", async () => {
    const page = { v: 2, first: 0, files: [{ name: "a.jpg", size: 1, type: "image/jpeg" }] };
    const sealed = await sealBulkManifestPage(keys, 0, 2, 151, page);
    await expect(openBulkManifestPage(keys, 0, 2, 151, sealed)).resolves.toEqual(page);
    await expect(openBulkManifestPage(keys, 1, 2, 151, sealed)).rejects.toThrow();
    await expect(openBulkManifestPage(keys, 0, 2, 150, sealed)).rejects.toThrow();
  });
});

describe("content blocks", () => {
  it("round-trips a full block, an empty block, and rejects moved or damaged blocks", async () => {
    const fileKey = await deriveBulkFileKey(keys, 2999);
    const plaintext = new Uint8Array(BULK_BLOCK_BYTES).map((_, index) => index % 251);
    const context = { file: 2999, block: 4, blockCount: 9 };
    const sealed = await sealBulkBlock(fileKey, keys, context, plaintext);
    expect(sealed.byteLength).toBe(BULK_BLOCK_BYTES + 28);
    expect(await openBulkBlock(fileKey, keys, context, sealed)).toEqual(plaintext);

    await expect(openBulkBlock(fileKey, keys, { ...context, block: 5 }, sealed)).rejects.toThrow();
    await expect(
      openBulkBlock(fileKey, keys, { ...context, blockCount: 8 }, sealed),
    ).rejects.toThrow();
    const otherFileKey = await deriveBulkFileKey(keys, 0);
    await expect(openBulkBlock(otherFileKey, keys, context, sealed)).rejects.toThrow();
    const damaged = sealed.slice();
    damaged[100] = (damaged[100] ?? 0) ^ 1;
    await expect(openBulkBlock(fileKey, keys, context, damaged)).rejects.toThrow();

    const empty = await sealBulkBlock(
      fileKey,
      keys,
      { file: 2999, block: 0, blockCount: 1 },
      new Uint8Array(),
    );
    expect(
      (await openBulkBlock(fileKey, keys, { file: 2999, block: 0, blockCount: 1 }, empty))
        .byteLength,
    ).toBe(0);
  });

  it("uses a fresh IV every time the same block is sealed", async () => {
    const fileKey = await deriveBulkFileKey(keys, 0);
    const context = { file: 0, block: 0, blockCount: 1 };
    const a = await sealBulkBlock(fileKey, keys, context, new Uint8Array([1, 2, 3]));
    const b = await sealBulkBlock(fileKey, keys, context, new Uint8Array([1, 2, 3]));
    expect(a.subarray(0, 12)).not.toEqual(b.subarray(0, 12));
  });

  it("refuses an out-of-range file index or oversized block", async () => {
    await expect(deriveBulkFileKey(keys, 3000)).rejects.toThrow();
    const fileKey = await deriveBulkFileKey(keys, 0);
    await expect(
      sealBulkBlock(
        fileKey,
        keys,
        { file: 0, block: 0, blockCount: 1 },
        new Uint8Array(BULK_BLOCK_BYTES + 1),
      ),
    ).rejects.toThrow();
  });
});
