import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import PromoPage from "./page";

// Branch previews deliberately disable the browser kiosk. A real page must not
// advertise a destination that its deployment will return as 404.
describe("promo destinations in production builds", () => {
  afterEach(() => vi.unstubAllEnvs());
  it.each([true, false])("advertises the kiosk only when enabled: %s", async (enabled) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", String(enabled));
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "ux/promo-mobile-20261031");
    const html = renderToStaticMarkup(await PromoPage());
    expect(html.includes('href="/kiosk"')).toBe(enabled);
    expect(html).toContain('href="/start"');
  });
});
