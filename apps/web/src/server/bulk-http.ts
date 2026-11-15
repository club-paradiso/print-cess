import { BULK_ROOM_ID_PATTERN } from "@print-cess/protocol";

import { authenticateToken, bearerToken } from "./auth";
import type { BulkRoomStore } from "./contracts";
import { roomNotFound } from "./bulk-room-store/transitions";
import { ServiceError } from "./errors";

export const BULK_OWNER_HEADER = "x-print-cess-bulk-token";

export async function readRoomId(context: {
  params: Promise<{ roomId: string }>;
}): Promise<string> {
  const { roomId } = await context.params;
  if (!BULK_ROOM_ID_PATTERN.test(roomId)) {
    throw new ServiceError("bad_request", "The transfer identifier is invalid.", 400);
  }
  return roomId;
}

/** Authenticates the sender and returns the token hash the mutation re-checks. */
export async function authenticateRoomOwner(
  request: Request,
  rooms: BulkRoomStore,
  roomId: string,
  now: number,
): Promise<string> {
  const room = await rooms.get(roomId, now);
  if (!room) throw roomNotFound();
  return authenticateToken(bearerToken(request, BULK_OWNER_HEADER), room.ownerTokenHash, "bulk");
}
