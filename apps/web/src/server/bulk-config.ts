import { createHash } from "node:crypto";

import type { BulkIceServer } from "@print-cess/protocol";

import type { DropStore } from "./contracts";
import { ServiceError } from "./errors";

/**
 * Configuration for direct bulk transfers. It lives apart from `loadConfig`
 * because none of it is required: with no variables set, the deployment offers
 * direct transfers over a public STUN server and no relay.
 *
 * STUN only tells each browser its own public address. It never carries file
 * bytes and costs nothing. A TURN relay does carry (encrypted) bytes and costs
 * bandwidth, so it is never enabled unless an operator sets all three TURN
 * variables explicitly.
 */
export const DEFAULT_BULK_STUN_URLS = ["stun:stun.l.google.com:19302"];
const ICE_URL_PATTERN = /^(stun|stuns|turn|turns):[^\s,]{1,200}$/u;
const HOUR_MS = 60 * 60_000;

export type BulkConfig = {
  iceServers: BulkIceServer[];
  relayConfigured: boolean;
  cloudFallback: boolean;
  hourlyRooms: number;
};

export function loadBulkConfig(environment: NodeJS.ProcessEnv = process.env): BulkConfig {
  const iceServers: BulkIceServer[] = [];
  const stunSetting = environment.PRINT_CESS_BULK_STUN_URLS?.trim();
  const stunUrls =
    stunSetting === undefined || stunSetting === ""
      ? DEFAULT_BULK_STUN_URLS
      : stunSetting === "none"
        ? []
        : splitUrls(stunSetting, "PRINT_CESS_BULK_STUN_URLS", /^stuns?:/u);
  if (stunUrls.length > 0) iceServers.push({ urls: stunUrls });

  const turnUrls = environment.PRINT_CESS_BULK_TURN_URLS?.trim();
  const username = environment.PRINT_CESS_BULK_TURN_USERNAME?.trim();
  const credential = environment.PRINT_CESS_BULK_TURN_CREDENTIAL?.trim();
  let relayConfigured = false;
  if (turnUrls || username || credential) {
    if (!turnUrls || !username || !credential) {
      throw new Error(
        "PRINT_CESS_BULK_TURN_URLS, PRINT_CESS_BULK_TURN_USERNAME and PRINT_CESS_BULK_TURN_CREDENTIAL must be set together",
      );
    }
    iceServers.push({
      urls: splitUrls(turnUrls, "PRINT_CESS_BULK_TURN_URLS", /^turns?:/u),
      username,
      credential,
    });
    relayConfigured = true;
  }

  const hourlyRooms = Number(environment.PRINT_CESS_BULK_HOURLY_ROOMS ?? 30);
  if (!Number.isInteger(hourlyRooms) || hourlyRooms < 1 || hourlyRooms > 10_000) {
    throw new Error("PRINT_CESS_BULK_HOURLY_ROOMS must be an integer between 1 and 10000");
  }
  return {
    iceServers,
    relayConfigured,
    cloudFallback: environment.PRINT_CESS_BULK_CLOUD_FALLBACK !== "false",
    hourlyRooms,
  };
}

function splitUrls(value: string, name: string, scheme: RegExp): string[] {
  const urls = value
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  if (urls.length === 0 || urls.length > 8) throw new Error(`${name} must list 1 to 8 URLs`);
  for (const url of urls) {
    if (!ICE_URL_PATTERN.test(url) || !scheme.test(url)) throw new Error(`${name} is invalid`);
  }
  return urls;
}

/**
 * Charges one room to the creator's hourly budget in the shared store, so the
 * limit holds across serverless instances. The address is stored only as a
 * hash salted with the hour.
 */
export async function chargeBulkRoomBudget(
  drops: Pick<DropStore, "consumeBudget">,
  hourlyRooms: number,
  address: string,
  now = Date.now(),
): Promise<void> {
  const windowStart = now - (now % HOUR_MS);
  const client = createHash("sha256")
    .update(`bulk:${windowStart}:${address}`)
    .digest("hex")
    .slice(0, 32);
  if (!(await drops.consumeBudget(`bulk-rooms:${client}`, 1, hourlyRooms, HOUR_MS, now))) {
    throw new ServiceError(
      "rate_limited",
      "You have started a lot of transfers in the last hour. Try again later.",
      429,
    );
  }
}
