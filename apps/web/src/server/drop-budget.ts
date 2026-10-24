import { createHash } from "node:crypto";

import type { ServerConfig } from "./config";
import type { DropStore } from "./contracts";
import { ServiceError } from "./errors";

const HOUR_MS = 60 * 60_000;

/**
 * Charges one transfer and its declared size to the sender's hourly budget.
 * The per-instance limiter alone can be multiplied by serverless instances, so
 * this budget lives in the shared store. The address is kept only as a hash
 * salted with the hour, which expires with the window.
 */
export async function chargeDropBudget(
  drops: DropStore,
  config: Pick<ServerConfig, "dropClientHourlyBytes" | "dropClientHourlyTransfers">,
  address: string,
  totalBytes: number,
  now = Date.now(),
): Promise<void> {
  const windowStart = now - (now % HOUR_MS);
  const client = createHash("sha256")
    .update(`${windowStart}:${address}`)
    .digest("hex")
    .slice(0, 32);
  const withinCount = await drops.consumeBudget(
    `drops:${client}`,
    1,
    config.dropClientHourlyTransfers,
    HOUR_MS,
    now,
  );
  const withinBytes =
    withinCount &&
    (await drops.consumeBudget(
      `bytes:${client}`,
      totalBytes,
      config.dropClientHourlyBytes,
      HOUR_MS,
      now,
    ));
  if (!withinBytes) {
    throw new ServiceError(
      "rate_limited",
      "You have sent a lot in the last hour. Try again later.",
      429,
    );
  }
}
