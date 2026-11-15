import { timingSafeEqualBase64Url } from "@print-cess/crypto";
import {
  BULK_MAX_GENERATIONS,
  BULK_ROOM_MAX_LIFETIME_SECONDS,
  BULK_ROOM_TTL_SECONDS,
  type BulkRoomRecord,
} from "@print-cess/protocol";

import { ServiceError } from "../errors";

export type BulkRoomMutation = (room: BulkRoomRecord) => BulkRoomRecord;

/**
 * Every unknown, expired, or wrong-owner room is answered the same way to a
 * caller without the owner credential, so a guess never learns that a room
 * exists. The owner gets a 401 only once the room is known to be theirs to ask
 * about — which their own client already knows.
 */
export function roomNotFound(): ServiceError {
  return new ServiceError("not_found", "This transfer was not found.", 404);
}

export function requireRoomOwner(room: BulkRoomRecord, candidateTokenHash: string): void {
  if (!timingSafeEqualBase64Url(room.ownerTokenHash, candidateTokenHash)) {
    throw new ServiceError("unauthorized", "The transfer credential is invalid.", 401);
  }
}

/** A room slides forward on activity, but never past a fixed lifetime from creation. */
export function slidingExpiry(room: Pick<BulkRoomRecord, "createdAt">, now: number): number {
  return Math.min(
    now + BULK_ROOM_TTL_SECONDS * 1000,
    room.createdAt + BULK_ROOM_MAX_LIFETIME_SECONDS * 1000,
  );
}

/**
 * The first answer for the current generation wins and is final. A late or
 * duplicate answer — or one written for a generation the sender has already
 * replaced — is a conflict, never an overwrite: the sender may already be
 * connecting to the first one.
 */
export function applyAnswer(
  room: BulkRoomRecord,
  generation: number,
  answer: string,
): BulkRoomRecord {
  if (generation !== room.generation) {
    throw new ServiceError("conflict", "That connection attempt has been replaced.", 409);
  }
  if (room.answer !== null) {
    throw new ServiceError("conflict", "Another device already answered.", 409);
  }
  return { ...room, answer, revision: room.revision + 1 };
}

/** A reconnection: strictly the next generation, a fresh offer, and no answer yet. */
export function applyOffer(
  room: BulkRoomRecord,
  generation: number,
  offer: string,
  now: number,
): BulkRoomRecord {
  if (generation !== room.generation + 1 || generation > BULK_MAX_GENERATIONS) {
    throw new ServiceError("conflict", "That connection attempt is out of order.", 409);
  }
  return {
    ...room,
    generation,
    offer,
    answer: null,
    expiresAt: slidingExpiry(room, now),
    revision: room.revision + 1,
  };
}

export function applyKeepAlive(room: BulkRoomRecord, now: number): BulkRoomRecord {
  const expiresAt = slidingExpiry(room, now);
  // Writing on every poll would cost a store write per second for nothing.
  if (expiresAt - room.expiresAt < 60_000) return room;
  return { ...room, expiresAt, revision: room.revision + 1 };
}
