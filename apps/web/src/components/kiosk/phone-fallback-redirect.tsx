"use client";

import { useEffect } from "react";

import { COARSE_POINTER_QUERY, isPhoneScreen, PHONE_GUIDE_PATH } from "@/lib/phone-at-kiosk";

/**
 * The proxy already sends phones to the visitor guide by their headers. A phone
 * asking for the "desktop site" hides behind a desktop user agent, so the
 * screen itself is checked here as a second look: a phone-sized screen driven
 * by touch. Tablets and touch-screen stations are larger and stay, and
 * `?kiosk=1` pins a station so this never runs on it.
 */
export function PhoneFallbackRedirect() {
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const coarse = window.matchMedia(COARSE_POINTER_QUERY).matches;
    if (isPhoneScreen(window.screen, coarse)) window.location.replace(PHONE_GUIDE_PATH);
  }, []);
  return null;
}
