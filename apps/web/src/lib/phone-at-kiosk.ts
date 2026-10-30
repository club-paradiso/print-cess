/**
 * The root route is a printer-side kiosk. Phones and tablets visiting it are
 * sent to /start instead, where they can find the print/scan/share entry points.
 *
 * This decision applies only to /. Session, transfer, scanner and API routes
 * must remain available on handheld devices. An explicitly pinned kiosk or
 * ?view=kiosk is never redirected, including a touchscreen station.
 */

export const KIOSK_PIN_COOKIE = "pc_kiosk";
export const KIOSK_PIN_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const PHONE_GUIDE_PATH = "/start?from=kiosk";
export const KIOSK_VIEW_ONCE_PATH = "/?view=kiosk";

/**
 * A client-side second look for iPadOS desktop-style user agents and browsers
 * that hide mobile identity. Require touch plus a tablet-sized shorter screen
 * side, not viewport width, to avoid redirecting a resized desktop window.
 * Header detection remains preferable because it redirects before rendering.
 */
export const NON_DESKTOP_SHORT_SIDE_MAX = 1100;
export const COARSE_POINTER_QUERY = "(pointer: coarse)";

export function isNonDesktopScreen(
  screen: { width: number; height: number },
  hasTouch: boolean,
): boolean {
  return hasTouch && Math.min(screen.width, screen.height) < NON_DESKTOP_SHORT_SIDE_MAX;
}

/**
 * Identify known phone and tablet user agents. iPadOS can masquerade as macOS
 * in desktop mode; the client-side touch/screen check catches that case.
 * A missing or desktop user agent stays on the kiosk unless that check matches.
 */
export function isNonDesktopRequest(headers: { get(name: string): string | null }): boolean {
  if (headers.get("sec-ch-ua-mobile") === "?1") return true;
  const agent = headers.get("user-agent") ?? "";
  if (/\b(iPhone|iPod|iPad)\b/i.test(agent)) return true;
  if (/\bAndroid\b/i.test(agent)) return true;
  if (/\b(Windows Phone|IEMobile|Opera Mini|Kindle|Silk)\b/i.test(agent)) return true;
  if (/\b(PlayBook|BlackBerry|Tablet)\b/i.test(agent)) return true;
  if (/\bMobile\b/i.test(agent) && /Firefox/i.test(agent)) return true;
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
  if (isNonDesktopRequest(headers)) return { kind: "phone-guide", ...clear };
  return { kind: "kiosk", ...clear };
}
