import {
  BULK_MAX_SIGNAL_BYTES,
  BULK_PROTOCOL_VERSION,
  createBulkRoomRequestSchema,
  type BulkRoomRecord,
} from "@print-cess/protocol";

import { chargeBulkRoomBudget, loadBulkConfig } from "@/server/bulk-config";
import { slidingExpiry } from "@/server/bulk-room-store/transitions";
import { assertAllowedOrigin, errorResponse, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request-identity";
import { getRuntime } from "@/server/runtime";

export const runtime = "nodejs";

/**
 * Opens a signalling room. The body is an opaque room identifier derived from
 * the transfer code, a hash of the sender's owner token, and one encrypted
 * offer. Nothing in it names a file, a person, or a device.
 */
export async function POST(request: Request) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const address = clientAddress(request);
    enforceRateLimit(`bulk-room-create:${address}`, 20, 60_000);
    const body = await readJson(request, createBulkRoomRequestSchema, BULK_MAX_SIGNAL_BYTES + 1024);
    const now = Date.now();
    await chargeBulkRoomBudget(server.drops, loadBulkConfig().hourlyRooms, address, now);
    const room: BulkRoomRecord = {
      protocolVersion: BULK_PROTOCOL_VERSION,
      roomId: body.roomId,
      ownerTokenHash: body.ownerTokenHash,
      generation: 1,
      offer: body.offer,
      answer: null,
      createdAt: now,
      expiresAt: slidingExpiry({ createdAt: now }, now),
      revision: 0,
    };
    await server.bulkRooms.create(room);
    return json(
      { protocolVersion: BULK_PROTOCOL_VERSION, roomId: room.roomId, expiresAt: room.expiresAt },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
