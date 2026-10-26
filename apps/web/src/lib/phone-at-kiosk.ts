/**
 * The root address (`/`) is the big screen that stands beside the printer. A
 * phone that opens it has nothing to do there: it cannot scan the QR code on
 * its own screen, and every load would mint a print session from the counter's
 * creation limit. Phones are therefore sent to the visitor guide (`/start`),
 * which is built for them, while the kiosk keeps the root address.
 *
 * Switches, all on `/` only:
 * - `?kiosk=1` pins this browser as a kiosk (a cookie), for touch-screen
 *   stations that might otherwise look like a phone. `?kiosk=0` removes it.
 * - `?view=kiosk` shows the big screen once, without pinning anything. The
 *   guide links here for the curious visitor who wants to see it anyway.
 */

export const KIOSK_PIN_COOKIE = "pc_kiosk";
export const KIOSK_PIN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const PHONE_GUIDE_PATH = "/start?from=kiosk";
export const KIOSK_VIEW_ONCE_PATH = "/?view=kiosk";

/** The same test the client applies when the user agent hides a phone. */
export const PHONE_MEDIA_QUERY = "(max-width: 767px) and (pointer: coarse)";

/**
 * Whether a request comes from a phone, judged from its headers alone.
 *
 * Tablets are left on the kiosk: an iPad reports a desktop user agent, and an
 * Android tablet omits "Mobile", which is exactly the rule Android documents
 * for telling the two apart.
 */
export function isPhoneRequest(headers: { get(name: string): string | null }): boolean {
  if (headers.get("sec-ch-ua-mobile") === "?1") return true;
  const agent = headers.get("user-agent") ?? "";
  if (/\b(iPhone|iPod)\b/.test(agent)) return true;
  if (/\bAndroid\b/.test(agent) && /\bMobile\b/.test(agent)) return true;
  if (/Windows Phone|IEMobile|Opera Mini/.test(agent)) return true;
  if (/\bMobile\b/.test(agent) && /Firefox/.test(agent) && !/Tablet/.test(agent)) return true;
  return false;
}

export function hasKioskPin(cookieHeader: string | null | undefined): boolean {
  if (!cookieHeader) return false;
  return cookieHeader.split(";").some((part) => part.trim() === `${KIOSK_PIN_COOKIE}=1`);
}

export type RootDecision =
  { kind: "kiosk"; pin?: "set" | "clear" } | { kind: "phone-guide"; pin?: "clear" };

/** What the root address should do for this request. */
export function decideRoot(input: {
  searchParams: URLSearchParams;
  headers: { get(name: string): string | null };
}): RootDecision {
  const { searchParams, headers } = input;
  const kiosk = searchParams.get("kiosk");
  if (kiosk === "1") return { kind: "kiosk", pin: "set" };
  const clear = kiosk === "0" ? ({ pin: "clear" } as const) : {};
  if (searchParams.get("view") === "kiosk") return { kind: "kiosk", ...clear };
  if (kiosk !== "0" && hasKioskPin(headers.get("cookie"))) return { kind: "kiosk" };
  if (isPhoneRequest(headers)) return { kind: "phone-guide", ...clear };
  return { kind: "kiosk", ...clear };
}
