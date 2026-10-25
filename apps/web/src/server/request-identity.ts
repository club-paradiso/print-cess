/**
 * Coarse client identity for rate limiting only. It is never logged or attached
 * to a transfer; it exists so one phone cannot exhaust the service for everyone
 * else in the room. The shared hourly upload budget keeps it only as a hash
 * salted with the hour (`drop-budget.ts`), which expires with that hour.
 *
 * Which address to believe depends on who wrote the header:
 * - On Vercel the platform replaces `x-forwarded-for` and sets
 *   `x-vercel-forwarded-for`, so the first value is the client.
 * - Behind other proxies, each trusted proxy appends the address it saw.
 *   `PRINT_CESS_TRUSTED_PROXY_HOPS` says how many there are, and the client is
 *   that many entries from the right. Anything further left was sent by the
 *   client and is ignored. `loadConfig` refuses to start a production
 *   deployment outside Vercel without this setting.
 * - In development the first value is used, so tests can pick an address.
 */
export const TRUSTED_PROXY_HOPS_VARIABLE = "PRINT_CESS_TRUSTED_PROXY_HOPS";
export const MAX_TRUSTED_PROXY_HOPS = 5;

export function clientAddress(
  request: Request,
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const chain = forwardedChain(request.headers.get("x-forwarded-for"));

  if (environment.VERCEL === "1") {
    return (
      forwardedChain(request.headers.get("x-vercel-forwarded-for"))[0] ?? chain[0] ?? "unknown"
    );
  }

  const hops = trustedProxyHops(environment);
  if (hops !== null) return chain[chain.length - hops] ?? "unknown";

  if (environment.NODE_ENV === "production") return "unknown";
  return chain[0] ?? "local";
}

/** The configured hop count, or null when it is unset. Throws when it is set but invalid. */
export function trustedProxyHops(environment: NodeJS.ProcessEnv = process.env): number | null {
  const raw = environment[TRUSTED_PROXY_HOPS_VARIABLE];
  if (raw === undefined || raw === "") return null;
  const hops = Number(raw);
  if (!Number.isInteger(hops) || hops < 1 || hops > MAX_TRUSTED_PROXY_HOPS) {
    throw new Error(
      `${TRUSTED_PROXY_HOPS_VARIABLE} must be a whole number from 1 to ${MAX_TRUSTED_PROXY_HOPS}`,
    );
  }
  return hops;
}

function forwardedChain(header: string | null): string[] {
  if (!header) return [];
  return header
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
