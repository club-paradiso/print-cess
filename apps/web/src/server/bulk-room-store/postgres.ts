import type { BulkRoomRecord } from "@print-cess/protocol";

import type { BulkRoomStore } from "../contracts";
import { ServiceError } from "../errors";
import { createPostgresExecutor, type PostgresExecutor } from "../session-store/postgres-client";
import { parseRoom } from "./redis";
import { roomNotFound, type BulkRoomMutation } from "./transitions";

const TABLE_NAME = "print_cess_bulk_room_v2";

type RoomRow = { room: unknown };

/**
 * PostgreSQL has no key expiry, so reads ignore expired rows and the scheduled
 * cleanup sweep deletes them. One row per room, rewritten in place: a bulk
 * transfer never writes a row per file, per block, or per message.
 */
export class RailwayPostgresBulkRoomStore implements BulkRoomStore {
  readonly #executor: PostgresExecutor;
  #schema: Promise<void> | null = null;

  public constructor(executor: PostgresExecutor = createPostgresExecutor()) {
    this.#executor = executor;
  }

  public async create(room: BulkRoomRecord): Promise<void> {
    await this.ensureSchema();
    const result = await this.#executor.query(
      `
      INSERT INTO ${TABLE_NAME} (room_id, room, expires_at)
      VALUES ($1, $2::jsonb, $3)
      ON CONFLICT (room_id) DO UPDATE
        SET room = EXCLUDED.room, expires_at = EXCLUDED.expires_at
        WHERE ${TABLE_NAME}.expires_at <= $4
      `,
      [room.roomId, JSON.stringify(room), room.expiresAt, room.createdAt],
    );
    if (result.rowCount !== 1) {
      throw new ServiceError("conflict", "This transfer code is already in use.", 409);
    }
  }

  public async get(roomId: string, now: number): Promise<BulkRoomRecord | null> {
    await this.ensureSchema();
    const result = await this.#executor.query<RoomRow>(
      `SELECT room FROM ${TABLE_NAME} WHERE room_id = $1 AND expires_at > $2`,
      [roomId, now],
    );
    const row = result.rows[0];
    return row ? parseRoom(row.room) : null;
  }

  public async mutate(
    roomId: string,
    now: number,
    mutation: BulkRoomMutation,
  ): Promise<BulkRoomRecord> {
    await this.ensureSchema();
    return this.#executor.transaction(`bulk-room:${roomId}`, async (client) => {
      const result = await client.query<RoomRow>(
        `SELECT room FROM ${TABLE_NAME} WHERE room_id = $1 AND expires_at > $2 FOR UPDATE`,
        [roomId, now],
      );
      const row = result.rows[0];
      if (!row) throw roomNotFound();
      const current = parseRoom(row.room);
      const next = mutation(current);
      if (next === current) return current;
      await client.query(
        `UPDATE ${TABLE_NAME} SET room = $2::jsonb, expires_at = $3 WHERE room_id = $1`,
        [roomId, JSON.stringify(next), next.expiresAt],
      );
      return next;
    });
  }

  public async remove(roomId: string): Promise<void> {
    await this.ensureSchema();
    await this.#executor.query(`DELETE FROM ${TABLE_NAME} WHERE room_id = $1`, [roomId]);
  }

  public async pruneExpired(now: number): Promise<void> {
    await this.ensureSchema();
    await this.#executor.query(`DELETE FROM ${TABLE_NAME} WHERE expires_at <= $1`, [now]);
  }

  private ensureSchema(): Promise<void> {
    this.#schema ??= this.#executor
      .query(
        `
        CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (
          room_id TEXT PRIMARY KEY,
          room JSONB NOT NULL,
          expires_at BIGINT NOT NULL
        )
        `,
      )
      .then(() => undefined)
      .catch((error: unknown) => {
        this.#schema = null;
        throw error;
      });
    return this.#schema;
  }
}
