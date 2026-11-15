import {
  BULK_MAX_SIGNAL_BYTES,
  BULK_PROTOCOL_VERSION,
  bulkAnswerRequestSchema,
  type BulkRoomOwnerView,
} from "@print-cess/protocol";

import { authenticateRoomOwner, readRoomId } from "@/server/bulk-http";
import {
  applyAnswer,
  applyKeepAlive,
  requireRoomOwner,
} from "@/server/bulk-room-store/transitions";
import { assertAllowedOrigin, errorResponse, json, readJson } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request-identity";
import { getRuntime } from "@/server/runtime";

export const runtime = "nodejs";

type Context = { params: Promise<{ roomId: string }> };

/**
 * The receiver posts its encrypted answer for the current generation. The
 * first answer is final; the sender then authenticates it end to end, so an
 * answer written by someone without the transfer code fails on the sender's
 * phone and the sender simply opens a new generation.
 */
export async function POST(request: Request, context: Context) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const roomId = await readRoomId(context);
    enforceRateLimit(`bulk-answer:${clientAddress(request)}`, 30, 60_000);
    enforceRateLimit(`bulk-answer-id:${roomId}`, 30, 60_000);
    const body = await readJson(request, bulkAnswerRequestSchema, BULK_MAX_SIGNAL_BYTES + 512);
    const room = await server.bulkRooms.mutate(roomId, Date.now(), (current) =>
      applyAnswer(current, body.generation, body.answer),
    );
    return json({ protocolVersion: BULK_PROTOCOL_VERSION, generation: room.generation }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * The sender polls for the answer. Each poll also keeps the room alive, so a
 * long transfer that later loses its connection can still reconnect.
 */
export async function GET(request: Request, context: Context) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    const roomId = await readRoomId(context);
    enforceRateLimit(`bulk-answer-poll:${roomId}`, 240, 60_000);
    const now = Date.now();
    const tokenHash = await authenticateRoomOwner(request, server.bulkRooms, roomId, now);
    const room = await server.bulkRooms.mutate(roomId, now, (current) => {
      requireRoomOwner(current, tokenHash);
      return applyKeepAlive(current, now);
    });
    const view: BulkRoomOwnerView = {
      protocolVersion: BULK_PROTOCOL_VERSION,
      generation: room.generation,
      answer: room.answer,
      expiresAt: room.expiresAt,
    };
    return json(view);
  } catch (error) {
    return errorResponse(error);
  }
}
