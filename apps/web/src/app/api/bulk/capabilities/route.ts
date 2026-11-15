import {
  BULK_MAX_FILES,
  BULK_MAX_FILE_BYTES,
  BULK_MAX_TOTAL_BYTES,
  BULK_PROTOCOL_VERSION,
  MAX_DROP_FILES,
  type BulkCapabilities,
} from "@print-cess/protocol";

import { loadBulkConfig } from "@/server/bulk-config";
import { assertAllowedOrigin, errorResponse, json } from "@/server/http";
import { enforceRateLimit } from "@/server/rate-limit";
import { clientAddress } from "@/server/request-identity";
import { getRuntime } from "@/server/runtime";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const server = getRuntime();
    assertAllowedOrigin(request, server.config);
    enforceRateLimit(`bulk-capabilities:${clientAddress(request)}`, 60, 60_000);
    const bulk = loadBulkConfig();
    const capabilities: BulkCapabilities = {
      protocolVersion: BULK_PROTOCOL_VERSION,
      maximumFileCount: BULK_MAX_FILES,
      maximumTotalBytes: BULK_MAX_TOTAL_BYTES,
      maximumFileBytes: BULK_MAX_FILE_BYTES,
      iceServers: bulk.iceServers,
      relayConfigured: bulk.relayConfigured,
      cloudFallback: {
        available: bulk.cloudFallback,
        maximumFileCount: MAX_DROP_FILES,
        maximumTotalBytes: server.config.dropMaxTotalBytes,
      },
    };
    return json(capabilities);
  } catch (error) {
    return errorResponse(error);
  }
}
