import { bulkRoomRecordSchema, type BulkRoomRecord } from "@print-cess/protocol";

import type { BulkRoomStore } from "../contracts";
import { ServiceError } from "../errors";
import type { RedisScriptClient } from "../session-store/redis-client";
import { roomNotFound, type BulkRoomMutation } from "./transitions";

const ROOM_KEY_PREFIX = "pc:v2:bulk-room:";
const MAX_CAS_ATTEMPTS = 3;

const CREATE_SCRIPT = `
if redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2], 'NX') then return 1 end
return 0
`;

// Revision-checked replace. The key's expiry follows the record's own expiry,
// so Redis forgets a room on its own and no sweep is needed.
const CAS_SCRIPT = `
local current = redis.call('GET', KEYS[1])
if not current then return 0 end
local decoded = cjson.decode(current)
if tonumber(decoded.revision) ~= tonumber(ARGV[1]) then return -1 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[3])
return 1
`;

export class RedisBulkRoomStore implements BulkRoomStore {
  public constructor(private readonly redis: RedisScriptClient) {}

  public async create(room: BulkRoomRecord): Promise<void> {
    const result = await this.redis.eval(
      CREATE_SCRIPT,
      [roomKey(room.roomId)],
      [JSON.stringify(room), Math.max(1, Math.trunc(room.expiresAt - room.createdAt))],
    );
    if (Number(result) !== 1) {
      throw new ServiceError("conflict", "This transfer code is already in use.", 409);
    }
  }

  public async get(roomId: string, now: number): Promise<BulkRoomRecord | null> {
    const raw = await this.redis.get(roomKey(roomId));
    if (!raw) return null;
    const room = parseRoom(raw);
    return room.expiresAt > now ? room : null;
  }

  public async mutate(
    roomId: string,
    now: number,
    mutation: BulkRoomMutation,
  ): Promise<BulkRoomRecord> {
    for (let attempt = 0; attempt < MAX_CAS_ATTEMPTS; attempt += 1) {
      const current = await this.get(roomId, now);
      if (!current) throw roomNotFound();
      const next = mutation(current);
      if (next === current) return current;
      const result = Number(
        await this.redis.eval(
          CAS_SCRIPT,
          [roomKey(roomId)],
          [current.revision, JSON.stringify(next), Math.max(1, Math.trunc(next.expiresAt - now))],
        ),
      );
      if (result === 1) return next;
      if (result === 0) throw roomNotFound();
    }
    throw new ServiceError("conflict", "This transfer changed while it was being updated.", 409);
  }

  public async remove(roomId: string): Promise<void> {
    await this.redis.eval("redis.call('DEL', KEYS[1]) return 1", [roomKey(roomId)], []);
  }

  public async pruneExpired(): Promise<void> {
    // Redis expires keys itself.
  }
}

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId}`;
}

function parseRoom(raw: unknown): BulkRoomRecord {
  let decoded: unknown = raw;
  if (typeof raw === "string") {
    try {
      decoded = JSON.parse(raw);
    } catch {
      throw new ServiceError("unavailable", "Stored transfer state is unreadable.", 503);
    }
  }
  const parsed = bulkRoomRecordSchema.safeParse(decoded);
  if (!parsed.success) {
    throw new ServiceError("unavailable", "Stored transfer state is unreadable.", 503);
  }
  return parsed.data;
}

export { parseRoom };
