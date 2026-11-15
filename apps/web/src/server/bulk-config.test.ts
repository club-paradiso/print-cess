import { describe, expect, it } from "vitest";

import { DEFAULT_BULK_STUN_URLS, loadBulkConfig } from "./bulk-config";
import {
  applyAnswer,
  applyKeepAlive,
  applyOffer,
  slidingExpiry,
} from "./bulk-room-store/transitions";
import { MemoryBulkRoomStore } from "./bulk-room-store/memory";

describe("bulk configuration", () => {
  it("defaults to public STUN, no relay, and cloud fallback available on consent", () => {
    const config = loadBulkConfig({} as unknown as NodeJS.ProcessEnv);
    expect(config.iceServers).toEqual([{ urls: DEFAULT_BULK_STUN_URLS }]);
    expect(config.relayConfigured).toBe(false);
    expect(config.cloudFallback).toBe(true);
  });

  it("can disable STUN, and refuses partial or malformed TURN settings", () => {
    expect(
      loadBulkConfig({ PRINT_CESS_BULK_STUN_URLS: "none" } as unknown as NodeJS.ProcessEnv)
        .iceServers,
    ).toEqual([]);
    expect(() =>
      loadBulkConfig({
        PRINT_CESS_BULK_TURN_URLS: "turn:relay.example:3478",
      } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
    expect(() =>
      loadBulkConfig({ PRINT_CESS_BULK_STUN_URLS: "http://evil" } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
    const relay = loadBulkConfig({
      PRINT_CESS_BULK_TURN_URLS: "turns:relay.example:5349",
      PRINT_CESS_BULK_TURN_USERNAME: "u",
      PRINT_CESS_BULK_TURN_CREDENTIAL: "c",
    } as unknown as NodeJS.ProcessEnv);
    expect(relay.relayConfigured).toBe(true);
    expect(relay.iceServers).toHaveLength(2);
  });
});

describe("bulk room transitions", () => {
  const room = {
    protocolVersion: 2 as const,
    roomId: "AAAAAAAAAAAAAAAAAAAAAA",
    ownerTokenHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    generation: 1,
    offer: "O".repeat(50),
    answer: null,
    createdAt: 0,
    expiresAt: 1_800_000,
    revision: 0,
  };

  it("keeps the first answer, refuses stale generations, and resets on a new offer", () => {
    const answered = applyAnswer(room, 1, "A".repeat(50));
    expect(() => applyAnswer(answered, 1, "B".repeat(50))).toThrow();
    expect(() => applyAnswer(room, 2, "B".repeat(50))).toThrow();
    const next = applyOffer(answered, 2, "N".repeat(50), 60_000);
    expect(next).toMatchObject({ generation: 2, answer: null });
    expect(() => applyOffer(next, 2, "N".repeat(50), 60_000)).toThrow();
  });

  it("writes keep-alives at most once a minute", () => {
    expect(applyKeepAlive(room, 10_000)).toBe(room);
    expect(applyKeepAlive(room, 120_000).expiresAt).toBe(slidingExpiry(room, 120_000));
  });

  it("forgets expired rooms in memory", async () => {
    const store = new MemoryBulkRoomStore();
    await store.create(room);
    expect(await store.get(room.roomId, 1)).not.toBeNull();
    expect(await store.get(room.roomId, room.expiresAt)).toBeNull();
    await store.create({ ...room, createdAt: 2_000_000, expiresAt: 3_000_000 });
    await store.pruneExpired(3_000_000);
    expect(await store.get(room.roomId, 2_000_001)).toBeNull();
  });
});
