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
 * Same origin only. The screen builds its QR from the origin it runs on, so a
 * code from any other host is not this deployment's session, however much it
 * looks like one. That also keeps a lookalike domain from ever being opened.
 *
 * What this cannot know is whether the session has expired or is in use: only
 * the server can say, and the session page already tells the visitor.
 */
export function parsePrintSessionQr(rawValue: string, origin: string): string | null {
  if (rawValue.length > 512) return null;
  let url: URL;
  try {
    url = new URL(rawValue.trim());
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (url.username || url.password || url.search) return null;
  const match = /^\/s\/([^/]+)$/u.exec(url.pathname);
  const sessionId = match?.[1];
  if (!sessionId || !SESSION_ID_PATTERN.test(sessionId)) return null;
  if (!parseSessionFragment(url.hash)) return null;
  return `/s/${sessionId}${url.hash}`;
}
