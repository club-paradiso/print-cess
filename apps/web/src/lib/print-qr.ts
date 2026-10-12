import { SESSION_ID_PATTERN } from "@print-cess/protocol";

import { parseSessionFragment } from "./session-fragment";

/**
 * Accepts only the QR code a Print-cess screen draws, and turns it into a path
 * on this site. A camera will happily read any QR code in the room: a menu, a
 * poster, another service's session. None of those may move the visitor
 * anywhere, so the content is checked in full before it is used and the
 * navigation target is rebuilt from the checked parts rather than taken from
 * the scanned text.
 *
 * Same deployment only. A code is accepted from this page's own origin or from
 * `sessionOrigins`: the deployment's configured PUBLIC_BASE_URL, which the
 * kiosk builds its QR from. Production answers on two hosts and one redirects
 * to the other, so a visitor on print-cess.vercel.app scans codes that name
 * paradiso-print-cess-web.vercel.app. Both are this deployment; any other host
 * is not, however much its code looks like a session, and a lookalike domain
 * is never opened. The returned path is always on this page's own origin.
 *
 * What this cannot know is whether the session has expired or is in use: only
 * the server can say, and the session page already tells the visitor.
 */
export function parsePrintSessionQr(
  rawValue: string,
  origin: string,
  sessionOrigins: readonly string[] = [],
): string | null {
  if (rawValue.length > 512) return null;
  let url: URL;
  try {
    url = new URL(rawValue.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin && !sessionOrigins.includes(url.origin)) return null;
  if (url.username || url.password || url.search) return null;
  const match = /^\/s\/([^/]+)$/u.exec(url.pathname);
  const sessionId = match?.[1];
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return null;
  if (!parseSessionFragment(url.hash)) return null;
  return `/s/${sessionId}${url.hash}`;
}

/**
 * The origin kiosk QR codes are built from, when PUBLIC_BASE_URL is a bare
 * http(s) origin. Anything else (a path, a query, garbage) is not trusted as an
 * extra scan origin; the page then accepts only its own.
 */
export function sessionOriginFrom(publicBaseUrl: string | undefined): string | undefined {
  if (!publicBaseUrl) return undefined;
  let url: URL;
  try {
    url = new URL(publicBaseUrl.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    return undefined;
  }
  return url.origin;
}
