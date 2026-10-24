/**
 * Coarse client identity for rate limiting only. It is never logged or attached
 * to a transfer; it exists so one phone cannot exhaust the service for everyone
 * else in the room. The shared hourly upload budget keeps it only as a hash
 * salted with the hour (`drop-budget.ts`), which expires with that hour.
 */
export function clientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "local";
}
