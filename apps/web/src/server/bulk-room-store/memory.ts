import type { BulkRoomRecord } from "@print-cess/protocol";

import type { BulkRoomStore } from "../contracts";
import { ServiceError } from "../errors";
import { roomNotFound, type BulkRoomMutation } from "./transitions";

/** Development and test adapter. Same contract as the hosted adapters. */
export class MemoryBulkRoomStore implements BulkRoomStore {
  readonly #rooms = new Map<string, BulkRoomRecord>();

  public async create(room: BulkRoomRecord): Promise<void> {
    this.prune(room.createdAt);
    if (this.#rooms.has(room.roomId)) {
      throw new ServiceError("conflict", "This transfer code is already in use.", 409);
    }
    this.#rooms.set(room.roomId, structuredClone(room));
  }

  public async get(roomId: string, now: number): Promise<BulkRoomRecord | null> {
    const room = this.#rooms.get(roomId);
    if (!room) return null;
    if (room.expiresAt <= now) {
      this.#rooms.delete(roomId);
      return null;
    }
    return structuredClone(room);
  }

  public async mutate(
    roomId: string,
    now: number,
    mutation: BulkRoomMutation,
  ): Promise<BulkRoomRecord> {
    const current = await this.get(roomId, now);
    if (!current) throw roomNotFound();
    const next = mutation(current);
    this.#rooms.set(roomId, structuredClone(next));
    return structuredClone(next);
  }

  public async remove(roomId: string): Promise<void> {
    this.#rooms.delete(roomId);
  }

  public async pruneExpired(now: number): Promise<void> {
    this.prune(now);
  }

  private prune(now: number): void {
    for (const [roomId, room] of this.#rooms) {
      if (room.expiresAt <= now) this.#rooms.delete(roomId);
    }
  }
}
