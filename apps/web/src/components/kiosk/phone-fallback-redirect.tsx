"use client";

import { useEffect } from "react";

import { PHONE_GUIDE_PATH, PHONE_MEDIA_QUERY } from "@/lib/phone-at-kiosk";

/**
 * The proxy already sends phones to the visitor guide by their headers. A phone
 * asking for the "desktop site" hides behind a desktop user agent, so the
 * screen itself is checked here as a second look: narrow and touch-driven.
 * Touch-screen stations wider than a phone are not affected, and `?kiosk=1`
 * pins a station so this never runs on it.
 */
export function PhoneFallbackRedirect() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    if (window.matchMedia(PHONE_MEDIA_QUERY).matches) window.location.replace(PHONE_GUIDE_PATH);
  }, []);
  return null;
}
