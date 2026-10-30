"use client";

import { useEffect } from "react";

import {
  COARSE_POINTER_QUERY,
  isNonDesktopScreen,
  PHONE_GUIDE_PATH,
} from "@/lib/phone-at-kiosk";

/**
 * The proxy sends ordinary mobile/tablet user agents straight to /start.
 * iPadOS desktop-mode and browsers masking their user agent need this fallback.
 * Explicit kiosk pins and ?view=kiosk skip mounting this component at the root.
 */
export function PhoneFallbackRedirect() {
  useEffect(() => {
    const coarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia(COARSE_POINTER_QUERY).matches;
    const hasTouch = coarse || window.navigator.maxTouchPoints > 1;
    if (isNonDesktopScreen(window.screen, hasTouch)) window.location.replace(PHONE_GUIDE_PATH);
  }, []);
  return null;
}
