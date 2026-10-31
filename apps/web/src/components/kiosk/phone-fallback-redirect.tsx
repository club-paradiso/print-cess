"use client";

import { useEffect } from "react";

import { COARSE_POINTER_QUERY, isNonDesktopScreen, PHONE_PROMO_PATH } from "@/lib/phone-at-kiosk";

/**
 * The proxy sends ordinary mobile/tablet user agents straight to /promo.
 * iPadOS desktop-mode and browsers masking their user agent need this fallback.
 * Explicit kiosk pins and ?view=kiosk skip mounting this component at the root.
 */
export function PhoneFallbackRedirect() {
  useEffect(() => {
    const coarse = window.matchMedia?.(COARSE_POINTER_QUERY).matches ?? false;
    const hasTouch = coarse || window.navigator.maxTouchPoints > 1;
    if (isNonDesktopScreen(window.screen, hasTouch)) {
      const destination = new URL(window.location.href);
      destination.pathname = PHONE_PROMO_PATH;
      window.location.replace(destination.href);
    }
  }, []);
  return null;
}
