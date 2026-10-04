const DEDICATED_KIOSK_PREVIEW_BRANCH = "preview";

export function isBrowserKioskEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  // A positive flag always enables the public browser kiosk.
  if (environment.ENABLE_BROWSER_KIOSK === "true") return true;

  // Keep the dedicated kiosk Preview branch available even when the legacy
  // flag is explicitly false. That branch is the controlled browser-kiosk
  // acceptance surface.
  if (
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === DEDICATED_KIOSK_PREVIEW_BRANCH
  ) {
    return true;
  }

  // In Vercel Production the public browser kiosk is a real product surface,
  // not a demo. Missing configuration must not make QR generation disappear.
  // An explicit false remains the emergency kill switch.
  if (environment.VERCEL_ENV === "production") {
    return environment.ENABLE_BROWSER_KIOSK !== "false";
  }

  if (environment.ENABLE_BROWSER_KIOSK === "false") return false;

  return isDemoRouteEnabled(environment);
}

export function isDemoRouteEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  // Demo APIs and administrator pages must never become reachable in a real
  // Production deployment, even if an inherited or stale environment flag is
  // accidentally set. Vercel Preview builds also use NODE_ENV=production, so
  // distinguish them through VERCEL_ENV and fail closed for non-Vercel hosts.
  if (
    environment.VERCEL_ENV === "production" ||
    (environment.NODE_ENV === "production" && !environment.VERCEL_ENV)
  ) {
    return false;
  }

  if (environment.ENABLE_DEMO_ROUTES === "true") return true;

  return (
    environment.VERCEL_ENV === "preview" &&
    environment.VERCEL_GIT_COMMIT_REF === DEDICATED_KIOSK_PREVIEW_BRANCH
  );
}
