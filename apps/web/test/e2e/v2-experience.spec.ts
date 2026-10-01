import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/**
 * The V2 product structure: one home that leads with Print, Share and Scan,
 * one Share capability with two sides, and a scan that can travel on through
 * Share. Every file here is synthetic.
 */

const DOCUMENT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#26343c"/>
  <polygon points="125,95 790,145 755,1100 82,1038" fill="#fffef8" stroke="#d8d6ce" stroke-width="8"/>
  <g fill="#24313a">
    <rect x="210" y="250" width="410" height="30" rx="6"/>
    <rect x="190" y="330" width="500" height="18" rx="5"/>
    <rect x="180" y="385" width="520" height="18" rx="5"/>
    <rect x="165" y="545" width="535" height="18" rx="5"/>
  </g>
</svg>`;

async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test("@viewport the home leads with Print, Share and Scan and keeps workplaces secondary", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Send a file to another device, or straight to paper.",
  );
  await expect(page.getByRole("heading", { level: 2 })).toHaveText([
    "Print",
    "Share",
    "Scan",
    "At work or on a public computer",
  ]);
  // Printing begins at a kiosk's QR code, so the home describes it and offers
  // no button that would have nowhere honest to go.
  const print = page.getByRole("region", { name: "Print" });
  await expect(print.getByRole("link")).toHaveCount(0);
  await expect(print.getByRole("button")).toHaveCount(0);
  await expect(print.getByRole("listitem")).toHaveCount(3);

  await expect(page.getByRole("link", { name: "Choose files to send" })).toHaveAttribute(
    "href",
    "/send",
  );
  await expect(page.getByRole("link", { name: "Receive files with a code" })).toHaveAttribute(
    "href",
    "/receive",
  );
  await expect(page.getByRole("link", { name: "Scan a document" })).toHaveAttribute(
    "href",
    "/scan",
  );
  const workplace = page.getByRole("navigation", { name: "At work or on a public computer" });
  await expect(workplace.getByRole("link", { name: "Work computer" })).toHaveAttribute(
    "href",
    "/workstation",
  );

  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
});

test("@viewport the home reads right to left in Arabic without overflowing", async ({
  browser,
}) => {
  const context = await browser.newContext({
    locale: "ar",
    extraHTTPHeaders: { "accept-language": "ar" },
    viewport: { width: 320, height: 720 },
  });
  const page = await context.newPage();
  await page.goto("/");

  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 2 }).first()).toHaveText("طباعة");
  await expectNoSidewaysScroll(page);
  await context.close();
});

test("@viewport sending and receiving are two sides of one Share capability", async ({ page }) => {
  await page.goto("/send");
  await expect(page.getByText("Share", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Pick the files to send" })).toBeVisible();
  // The two sources sit at equal weight; neither is the expected answer.
  await expect(page.getByRole("button", { name: /Open my photos/u })).toBeVisible();
  await expect(page.getByRole("button", { name: /Open my files/u })).toBeVisible();
  await expect(page.locator(".pc-progress")).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);

  await page.getByRole("link", { name: "Receive files with a code" }).click();
  await expect(page).toHaveURL(/\/receive$/u);
  await expect(page.getByText("Share", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Type the two numbers" })).toBeVisible();
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);

  await page.getByRole("link", { name: "Send files" }).click();
  await expect(page).toHaveURL(/\/send$/u);

  // The name in the header always leads home.
  await page.getByRole("link", { name: "Print-cess by Club Paradiso" }).click();
  await expect(page).toHaveURL(/\/$/u);
});

test("a failed code offers to try again rather than an input that no longer exists", async ({
  page,
}) => {
  await page.goto("/receive#c=2345-6789-ABCD");
  await expect(page.getByRole("heading", { name: /No transfer matches that code/u })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "Type the transfer code" })).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { name: "Type the two numbers" })).toBeVisible();
});

test("the sender sees the other side's state above the code, and erasing comes last", async ({
  page,
}) => {
  await page.goto("/send");
  await page.getByTestId("drop-file-input").setInputFiles({
    name: "synthetic-note.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("SAMPLE — NOT VALID"),
  });
  await page.getByRole("button", { name: "Send these files" }).click();
  await expect(page.getByRole("heading", { name: "Ready to hand over" })).toBeVisible({
    timeout: 60_000,
  });

  const ready = page.locator(".drop-ready");
  const status = ready.getByRole("status").first();
  await expect(status).toContainText("Waiting for the other phone");
  const order = await ready.evaluate((section) =>
    [".drop-status", ".drop-qr", ".drop-link-actions", ".pairing-pick", ".drop-erase"].map(
      (selector) => {
        const element = section.querySelector(selector);
        return element ? element.getBoundingClientRect().top : Number.NaN;
      },
    ),
  );
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(order.every(Number.isFinite)).toBe(true);
  await expectAccessible(page);
});

test("a scanned PDF travels on through Share and arrives on the other phone", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  await page.goto("/scan");
  await expect(page.getByText("Scan", { exact: true })).toBeVisible();
  await expectAccessible(page);

  await page.getByTestId("scan-gallery-input").setInputFiles({
    name: "synthetic-page.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(DOCUMENT_SVG),
  });
  await expect(page.getByText("Document edges detected")).toBeVisible({ timeout: 60_000 });
  // With a page in hand, making the PDF is the one primary action.
  await expect(page.locator(".scan-composer .pc-button--primary")).toHaveCount(1);
  await expect(page.locator(".scan-composer .pc-button--primary")).toHaveText(/Make PDF/u);
  await page.getByRole("checkbox", { name: /Searchable PDF/u }).uncheck();
  await page.getByRole("button", { name: "Make PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your scan is ready" })).toBeVisible({
    timeout: 60_000,
  });
  // Printing from here uses this device's own print window, and says so.
  await expect(page.getByRole("button", { name: "Print from this device" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Print now" })).toHaveCount(0);

  await page.getByRole("button", { name: "Send to another device" }).click();
  await expect(page.getByRole("heading", { name: "Pick the files to send" })).toBeVisible();
  await expect(page.getByText("Print-cess-scan.pdf")).toBeVisible();

  // The way back keeps the scan.
  await page.getByRole("button", { name: "Back to the scan" }).click();
  await expect(page.getByRole("heading", { name: "Your scan is ready" })).toBeVisible();
  await page.getByRole("button", { name: "Send to another device" }).click();

  await page.getByRole("button", { name: "Send these files" }).click();
  const ready = page.locator(".drop-ready");
  await expect(ready).toHaveAttribute("data-transfer-code", /.+/u, { timeout: 60_000 });
  const code = await ready.getAttribute("data-transfer-code");

  const receiving = await (await browser.newContext()).newPage();
  await receiving.goto(`/receive#c=${code}`);
  await expect(receiving.getByText("Print-cess-scan.pdf")).toBeVisible({ timeout: 60_000 });
  await receiving.context().close();
});
