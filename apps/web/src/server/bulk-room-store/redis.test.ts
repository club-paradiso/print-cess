import { describe, expect, it } from "vitest";

import type { BulkRoomRecord } from "@print-cess/protocol";

import type { RedisScriptClient } from "../session-store/redis-client";
import { RedisBulkRoomStore } from "./redis";
import { applyAnswer, applyOffer } from "./transitions";

/** Interprets exactly the three scripts the adapter sends, with TTLs. */
class FakeRedis implements RedisScriptClient {
  public readonly values = new Map<string, { value: string; expiresAt: number }>();
  public now = 0;

  public async eval(script: string, keys: string[], args: (string | number)[]): Promise<unknown> {
    const key = keys[0] ?? "";
    const live = this.live(key);
    if (script.includes("'NX'")) {
      if (live) return 0;
      this.values.set(key, { value: String(args[0]), expiresAt: this.now + Number(args[1]) });
      return 1;
    }
    if (script.includes("revision")) {
      if (!live) return 0;
      if ((JSON.parse(live) as { revision: number }).revision !== Number(args[0])) return -1;
      this.values.set(key, { value: String(args[1]), expiresAt: this.now + Number(args[2]) });
      return 1;
    }
    if (script.includes("DEL")) {
      this.values.delete(key);
      return 1;
    }
    throw new Error(`Unexpected script ${script}`);
  }

  public async get(key: string): Promise<string | null> {
    return this.live(key);
  }

  public async set(): Promise<void> {
    throw new Error("not used");
  }

  public async zrangeByScore(): Promise<string[]> {
    return [];
  }

  public async zrem(): Promise<void> {}

  public async del(key: string): Promise<void> {
    this.values.delete(key);
  }

  private live(key: string): string | null {
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= this.now) return null;
    return entry.value;
  }
}

const room: BulkRoomRecord = {
  protocolVersion: 2,
  roomId: "AAAAAAAAAAAAAAAAAAAAAA",
  ownerTokenHash: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  generation: 1,
  offer: "O".repeat(50),
  answer: null,
  createdAt: 0,
  expiresAt: 1_800_000,
  revision: 0,
};

describe("RedisBulkRoomStore", () => {
  it("creates once, mutates with a revision check, and expires with the key", async () => {
    const redis = new FakeRedis();
    const store = new RedisBulkRoomStore(redis as unknown as RedisScriptClient);
    await store.create(room);
    await expect(store.create(room)).rejects.toMatchObject({ status: 409 });

    const answered = await store.mutate(room.roomId, 1, (current) =>
      applyAnswer(current, 1, "A".repeat(50)),
    );
    expect(answered.revision).toBe(1);
    await expect(
      store.mutate(room.roomId, 1, (current) => applyAnswer(current, 1, "B".repeat(50))),
    ).rejects.toMatchObject({ status: 409 });

    const next = await store.mutate(room.roomId, 60_000, (current) =>
      applyOffer(current, 2, "N".repeat(50), 60_000),
    );
    expect(next).toMatchObject({ generation: 2, answer: null });

    redis.now = next.expiresAt;
    expect(await store.get(room.roomId, redis.now)).toBeNull();
    await expect(store.mutate(room.roomId, redis.now, (current) => current)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("refuses a stored record that does not parse", async () => {
    const redis = new FakeRedis();
    redis.values.set(`pc:v2:bulk-room:${room.roomId}`, { value: "{bad", expiresAt: 10 });
    const store = new RedisBulkRoomStore(redis as unknown as RedisScriptClient);
    await expect(store.get(room.roomId, 0)).rejects.toMatchObject({ status: 503 });
  });
});
