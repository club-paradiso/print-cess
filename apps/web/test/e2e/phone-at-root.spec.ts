import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Browser } from "@playwright/test";

// The root address is the big screen beside the printer. Phones and tablets
// are sent to the visitor guide, told why in one line, and can still look.
// Each phone is emulated here rather than through the `iphone` and `android`
// projects, because the desktop project runs every test too and must see the
// kiosk at "/".

const PHONES = {
  iPhone: devices["iPhone 15"],
  Android: devices["Pixel 7"],
};

async function phonePage(browser: Browser, phone: keyof typeof PHONES) {
  // Keep the descriptor's viewport, touch and user agent, but run it in the
  // project's own browser.
  const descriptor: Partial<(typeof PHONES)[typeof phone]> = { ...PHONES[phone] };
  delete descriptor.defaultBrowserType;
  const context = await browser.newContext({ ...descriptor, locale: "en-US" });
  return { context, page: await context.newPage() };
}

for (const phone of Object.keys(PHONES) as (keyof typeof PHONES)[]) {
  test(`${phone}: opening the kiosk address lands on the guide and is told why`, async ({
    browser,
  }) => {
    const { context, page } = await phonePage(browser, phone);
    await page.goto("/");

    await expect(page).toHaveURL(/\/start\?from=kiosk$/u);
    const note = page.getByRole("status").filter({ hasText: "big screen beside the printer" });
    await expect(note).toBeVisible();
    await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();

    // Nothing sideways, and the page still passes the automated checks.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    // The way back shows the big screen once, without pinning the phone.
    await note.getByRole("link", { name: "Show the big screen anyway" }).click();
    await expect(page).toHaveURL(/\/\?view=kiosk$/u);
    await expect(page.locator(".kiosk-qr")).toBeVisible();
    await page.goto("/");
    await expect(page).toHaveURL(/\/start\?from=kiosk$/u);
    await context.close();
  });
}

test("a touch station pinned with ?kiosk=1 keeps the kiosk until unpinned", async ({ browser }) => {
  const { context, page } = await phonePage(browser, "Android");
  await page.goto("/?kiosk=1");
  await expect(page.locator(".kiosk-qr")).toBeVisible();
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator(".kiosk-qr")).toBeVisible();

  await page.goto("/?kiosk=0");
  await expect(page).toHaveURL(/\/start\?from=kiosk$/u);
  await context.close();
});

test("a phone hiding behind a desktop user agent is caught by its screen", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    hasTouch: true,
    // Safari with a desktop user agent sends no mobile client hint, and
    // Chromium would send one for `isMobile`, so leave it off.
    isMobile: false,
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/start\?from=kiosk$/u);
  await context.close();
});

test("an iPad mini in portrait (desktop user agent, touch) opens the guide", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 744, height: 1133 },
    screen: { width: 744, height: 1133 },
    hasTouch: true,
    // Safari with a desktop user agent sends no mobile client hint, and
    // Chromium would send one for `isMobile`, so leave it off.
    isMobile: false,
    locale: "en-US",
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
  });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page).toHaveURL(/\/start\?from=kiosk$/u);
  await expect(page.getByRole("button", { name: "Scan QR code" })).toBeVisible();
  await context.close();
});

test("a desktop browser keeps the kiosk at the root address", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/$/u);
  await expect(page.locator(".kiosk-qr")).toBeVisible();
});
