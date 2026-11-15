import { BULK_PROTOCOL_VERSION, type BulkRoomReceiverView } from "@print-cess/protocol";

import { authenticateRoomOwner, readRoomId } from "@/server/bulk-http";
import { roomNotFound } from "@/server/bulk-room-store/transitions";
import { assertAllowedOrigin, errorResponse, json } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request-identity";
import { getRuntime } from "@/server/runtime";

export const runtime = "nodejs";

type Context = { params: Promise<{ roomId: string }> };

/**
 * The receiver's view: the current encrypted offer and whether it has already
 * been answered. Reaching it requires the room identifier, which is derived
 * from the transfer code, and an unknown room answers exactly like an expired
 * one.
 */
export async function GET(request: Request, context: Context) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const roomId = await readRoomId(context);
    enforceRateLimit(`bulk-room-read:${clientAddress(request)}`, 120, 60_000);
    enforceRateLimit(`bulk-room-read-id:${roomId}`, 240, 60_000);
    const room = await server.bulkRooms.get(roomId, Date.now());
    if (!room) throw roomNotFound();
    const view: BulkRoomReceiverView = {
      protocolVersion: BULK_PROTOCOL_VERSION,
      generation: room.generation,
      offer: room.offer,
      answered: room.answer !== null,
      expiresAt: room.expiresAt,
    };
    return json(view);
  } catch (error) {
    return errorResponse(error);
  }
}

/** The sender closes the room. Idempotent: a room that is already gone is gone. */
export async function DELETE(request: Request, context: Context) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const roomId = await readRoomId(context);
    enforceRateLimit(`bulk-room-delete:${roomId}`, 20, 60_000);
    const now = Date.now();
    const room = await server.bulkRooms.get(roomId, now);
    if (room) {
      await authenticateRoomOwner(request, server.bulkRooms, roomId, now);
      await server.bulkRooms.remove(roomId);
    }
    return json({ roomId, deleted: true });
  } catch (error) {
    return errorResponse(error);
  }
}
