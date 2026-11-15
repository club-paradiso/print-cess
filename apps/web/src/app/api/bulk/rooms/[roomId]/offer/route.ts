import {
  BULK_MAX_SIGNAL_BYTES,
  BULK_PROTOCOL_VERSION,
  bulkOfferRequestSchema,
} from "@print-cess/protocol";

import { authenticateRoomOwner, readRoomId } from "@/server/bulk-http";
import { applyOffer, requireRoomOwner } from "@/server/bulk-room-store/transitions";
import { assertAllowedOrigin, errorResponse, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { getRuntime } from "@/server/runtime";

export const runtime = "nodejs";

type Context = { params: Promise<{ roomId: string }> };

/** The sender opens the next generation after a lost connection. */
export async function POST(request: Request, context: Context) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const roomId = await readRoomId(context);
    enforceRateLimit(`bulk-offer:${roomId}`, 30, 60_000);
    const body = await readJson(request, bulkOfferRequestSchema, BULK_MAX_SIGNAL_BYTES + 512);
    const now = Date.now();
    const tokenHash = await authenticateRoomOwner(request, server.bulkRooms, roomId, now);
    const room = await server.bulkRooms.mutate(roomId, now, (current) => {
      requireRoomOwner(current, tokenHash);
      return applyOffer(current, body.generation, body.offer, now);
    });
    return json({
      protocolVersion: BULK_PROTOCOL_VERSION,
      generation: room.generation,
      expiresAt: room.expiresAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
