import { redirect } from "next/navigation";

import BrowserKioskPage from "@/app/kiosk/page";
import { isBrowserKioskEnabled } from "@/server/demo";

/**
 * The service's main screen is the shared display, so the bare domain opens
 * it: a station can be pointed at the root URL and show its QR code. The same
 * `?printing=auto` and `?sound=off` switches work here as on `/kiosk`.
 *
 * A visitor's guide (where the screen is, the in-page QR scanner, Share and
 * Scan) lives at `/start`. When the browser kiosk is switched off in
 * Production, the root falls back to that guide instead of a 404.
 */
export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{ printing?: string | string[]; sound?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production" && !isBrowserKioskEnabled()) redirect("/start");
  return BrowserKioskPage({ searchParams });
}
