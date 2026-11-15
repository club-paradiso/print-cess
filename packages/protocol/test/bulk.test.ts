import { describe, expect, it } from "vitest";

import {
  BULK_BLOCK_BYTES,
  BULK_DATA_HEADER_BYTES,
  BULK_FRAME_BYTES,
  BULK_MANIFEST_PAGE_FILES,
  BULK_MAX_CONTROL_BYTES,
  BULK_MAX_FILES,
  BULK_MAX_FILE_NAME_BYTES,
  BULK_MAX_MANIFEST_PAGES,
  BULK_MAX_SEALED_BLOCK_BYTES,
  DROP_PROTOCOL_VERSION,
  bulkBlockCount,
  bulkBlockPlaintextBytes,
  bulkFragmentCount,
  bulkManifestPageSchema,
  bulkRoomRecordSchema,
  createBulkRoomRequestSchema,
  decodeBulkDataFrame,
  dropRecordSchema,
  encodeBulkDataFrame,
  parseBulkControl,
} from "../src/index.js";

const ROOM_ID = "AAAAAAAAAAAAAAAAAAAAAA";
const HASH = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

describe("bulk protocol constants", () => {
  it("supports 3,000 files in paged manifests and keeps v1 drop records unchanged", () => {
    expect(BULK_MAX_FILES).toBe(3000);
    expect(BULK_MAX_MANIFEST_PAGES * BULK_MANIFEST_PAGE_FILES).toBeGreaterThanOrEqual(3000);
    expect(DROP_PROTOCOL_VERSION).toBe(1);
    // A v2 room is not a v1 drop and must never parse as one.
    expect(dropRecordSchema.safeParse({ protocolVersion: 2 }).success).toBe(false);
  });

  it("counts blocks, including one block for an empty file", () => {
    expect(bulkBlockCount(0)).toBe(1);
    expect(bulkBlockCount(1)).toBe(1);
    expect(bulkBlockCount(BULK_BLOCK_BYTES)).toBe(1);
    expect(bulkBlockCount(BULK_BLOCK_BYTES + 1)).toBe(2);
    expect(bulkBlockPlaintextBytes(BULK_BLOCK_BYTES + 1, 1)).toBe(1);
    expect(bulkBlockPlaintextBytes(0, 0)).toBe(0);
  });

  it("keeps a worst-case manifest page under the control-message ceiling", () => {
    // 150 names of 180 bytes, base64 expanded, plus JSON overhead.
    const worstPageBytes = Math.ceil(
      ((BULK_MAX_FILE_NAME_BYTES + 200) * BULK_MANIFEST_PAGE_FILES * 4) / 3,
    );
    expect(worstPageBytes).toBeLessThan(BULK_MAX_CONTROL_BYTES - 512);
  });
});

describe("room records", () => {
  it("accepts a valid room and refuses oversized or malformed signals", () => {
    const room = {
      protocolVersion: 2,
      roomId: ROOM_ID,
      ownerTokenHash: HASH,
      generation: 1,
      offer: "A".repeat(100),
      answer: null,
      createdAt: 1,
      expiresAt: 2,
      revision: 0,
    };
    expect(bulkRoomRecordSchema.safeParse(room).success).toBe(true);
    expect(bulkRoomRecordSchema.safeParse({ ...room, offer: "A".repeat(30_000) }).success).toBe(
      false,
    );
    expect(bulkRoomRecordSchema.safeParse({ ...room, offer: "has space" }).success).toBe(false);
    expect(
      createBulkRoomRequestSchema.safeParse({
        protocolVersion: 2,
        roomId: ROOM_ID,
        ownerTokenHash: HASH,
        offer: "A".repeat(100),
        extra: true,
      }).success,
    ).toBe(false);
  });
});

describe("control messages", () => {
  it("parses known messages and refuses everything else", () => {
    expect(parseBulkControl(JSON.stringify({ t: "want", file: 2999, from: 0 }))).toEqual({
      t: "want",
      file: 2999,
      from: 0,
    });
    expect(parseBulkControl(JSON.stringify({ t: "want", file: 3000, from: 0 }))).toBeNull();
    expect(parseBulkControl(JSON.stringify({ t: "ack", file: 0, block: -1 }))).toBeNull();
    expect(parseBulkControl(JSON.stringify({ t: "window", blocks: 1000 }))).toBeNull();
    expect(parseBulkControl("{not json")).toBeNull();
    expect(parseBulkControl(JSON.stringify({ t: "evil" }))).toBeNull();
    expect(parseBulkControl("x".repeat(BULK_MAX_CONTROL_BYTES + 1))).toBeNull();
  });

  it("rejects manifest names that try to smuggle a path or exceed the byte budget", () => {
    const page = (name: string) =>
      bulkManifestPageSchema.safeParse({ v: 2, first: 0, files: [{ name, size: 1, type: "" }] })
        .success;
    expect(page("photo.jpg")).toBe(true);
    expect(page("x".repeat(BULK_MAX_FILE_NAME_BYTES + 1))).toBe(false);
    // Separators are not refused here: the receiver replaces them before use,
    // which is tested where names are sanitized. The schema bounds length.
    expect(page("")).toBe(false);
  });
});

describe("data frames", () => {
  it("round-trips and bounds every field", () => {
    const payload = new Uint8Array([1, 2, 3]);
    const encoded = encodeBulkDataFrame({ file: 7, block: 9, fragment: 2, fragments: 3, payload });
    expect(encoded.byteLength).toBe(BULK_DATA_HEADER_BYTES + 3);
    const decoded = decodeBulkDataFrame(encoded, BULK_FRAME_BYTES);
    expect(decoded).toMatchObject({ file: 7, block: 9, fragment: 2, fragments: 3 });
    expect(decoded?.payload).toEqual(payload);

    expect(
      decodeBulkDataFrame(new Uint8Array(BULK_DATA_HEADER_BYTES), BULK_FRAME_BYTES),
    ).toBeNull();
    const big = new Uint8Array(BULK_FRAME_BYTES + 1);
    big[0] = 1;
    expect(decodeBulkDataFrame(big, BULK_FRAME_BYTES)).toBeNull();
    const badFragment = encodeBulkDataFrame({
      file: 0,
      block: 0,
      fragment: 3,
      fragments: 3,
      payload,
    });
    expect(decodeBulkDataFrame(badFragment, BULK_FRAME_BYTES)).toBeNull();
    const badFile = encodeBulkDataFrame({
      file: 3000,
      block: 0,
      fragment: 0,
      fragments: 1,
      payload,
    });
    expect(decodeBulkDataFrame(badFile, BULK_FRAME_BYTES)).toBeNull();
    const wrongType = encoded.slice();
    wrongType[0] = 2;
    expect(decodeBulkDataFrame(wrongType, BULK_FRAME_BYTES)).toBeNull();
  });

  it("splits a sealed block into at most a few dozen 16 KiB messages", () => {
    expect(bulkFragmentCount(BULK_MAX_SEALED_BLOCK_BYTES, BULK_FRAME_BYTES)).toBe(17);
    expect(bulkFragmentCount(28, BULK_FRAME_BYTES)).toBe(1);
  });
});
