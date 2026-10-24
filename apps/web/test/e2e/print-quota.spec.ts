import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { createSyntheticPdf, createSyntheticPng } from "@print-cess/test-fixtures";

let kioskRateLimitBucket = 0;

async function openMobile(kiosk: Page, context: BrowserContext): Promise<Page> {
  kioskRateLimitBucket += 1;
  await context.setExtraHTTPHeaders({
    "x-forwarded-for": `203.0.113.${kioskRateLimitBucket}`,
  });

  await kiosk.request.get("/api/sessions/e2e-cold-start/claim", { timeout: 60_000 });
  await kiosk.goto("/kiosk");
  const qr = kiosk.locator(".kiosk-qr");
  await expect(qr).toHaveAttribute("data-session-url", /#t=/u, { timeout: 60_000 });
  const mobile = await context.newPage();
  await mobile.goto((await qr.getAttribute("data-session-url"))!);
  await expect(mobile.getByRole("heading", { name: "Pick files to print" })).toBeVisible({
    timeout: 60_000,
  });
  return mobile;
}

async function pickPdf(mobile: Page, pages: number): Promise<void> {
  await mobile.getByTestId("file-input").setInputFiles({
    name: `synthetic-${pages}p.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(await createSyntheticPdf(pages)),
  });
}

const staffNotice = (page: Page) =>
  page.getByRole("dialog", { name: "This print job is over the free limit." });

test("eleven pages is the last selection that just prints", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 11);
  await expect(mobile.getByRole("heading", { name: "Is this the right page?" })).toBeVisible();
  await expect(mobile.getByRole("dialog")).toHaveCount(0);
});

test("twelve pages explains staff approval rather than an error", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 12);

  const dialog = staffNotice(mobile);
  await expect(dialog).toBeVisible();

  await expect(dialog.getByText("12 pages", { exact: true })).toBeVisible();
  await expect(dialog.getByText("Up to 11 pages", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/at the kiosk itself/u)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Choose files again" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancel" })).toBeVisible();

  await expect(mobile.getByRole("heading", { name: "Is this the right page?" })).toHaveCount(0);
});

test("the staff notice offers no payment", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 37);

  const dialog = staffNotice(mobile);
  await expect(dialog.getByText("37 pages", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/₩/u)).toHaveCount(0);
  await expect(dialog.getByRole("button")).toHaveCount(2);
});

test("past the technical ceiling no approval is offered", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 51);

  const dialog = mobile.getByRole("dialog", {
    name: "This is more than the printer can take.",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("51 pages", { exact: true })).toBeVisible();
  await expect(dialog.getByText("50 pages", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/at the kiosk itself/u)).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "Cancel" })).toHaveCount(0);
});

test("a batch is judged on its total, not file by file", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await mobile.getByTestId("file-input").setInputFiles([
    {
      name: "a-7p.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await createSyntheticPdf(7)),
    },
    {
      name: "b.png",
      mimeType: "image/png",
      buffer: Buffer.from(await createSyntheticPng(800, 1100)),
    },
    {
      name: "c-4p.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await createSyntheticPdf(4)),
    },
  ]);

  const dialog = staffNotice(mobile);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("12 pages", { exact: true })).toBeVisible();
});

test("a batch one page under the limit still prints", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await mobile.getByTestId("file-input").setInputFiles([
    {
      name: "a-7p.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await createSyntheticPdf(7)),
    },
    {
      name: "b.png",
      mimeType: "image/png",
      buffer: Buffer.from(await createSyntheticPng(800, 1100)),
    },
    {
      name: "c-3p.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await createSyntheticPdf(3)),
    },
  ]);
  await expect(mobile.getByRole("heading", { name: "Check these files" })).toBeVisible();
  await expect(mobile.getByRole("dialog")).toHaveCount(0);
});

test("the staff notice has no accessibility violations", async ({ page, context }) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 24);
  await expect(staffNotice(mobile)).toBeVisible();

  const results = await new AxeBuilder({ page: mobile })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("@viewport the staff notice fits a phone without sideways scrolling", async ({
  page,
  context,
}) => {
  const mobile = await openMobile(page, context);
  await pickPdf(mobile, 37);
  await expect(staffNotice(mobile)).toBeVisible();

  const overflow = await mobile.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
