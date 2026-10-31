import { expect, test } from "@playwright/test";

const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

test("Android tablet opening / goes straight to /promo", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent: ANDROID_TABLET,
    viewport: { width: 800, height: 1280 },
    hasTouch: true,
    isMobile: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/promo$/u);
  } finally {
    await context.close();
  }
});

test("desktop-style iPad uses the touch fallback but can explicitly view the kiosk", async ({
  browser,
}) => {
  const context = await browser.newContext({
    userAgent: IPAD_DESKTOP_MODE,
    viewport: { width: 1024, height: 1366 },
    screen: { width: 1024, height: 1366 },
    hasTouch: true,
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "maxTouchPoints", {
      configurable: true,
      get: () => 5,
    });
  });

  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page).toHaveURL(/\/promo$/u);
    await page.goto("/?view=kiosk");
    await expect(page).toHaveURL(/\/\?view=kiosk$/u);
  } finally {
    await context.close();
  }
});
