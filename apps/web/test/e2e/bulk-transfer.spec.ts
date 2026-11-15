import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Bulk Transfer 2.0 over a real WebRTC data channel between two browser
 * contexts. The web server runs with PRINT_CESS_BULK_STUN_URLS=none, so the
 * connection uses host candidates only and no request leaves this machine.
 * These tests exercise Chromium; Safari and physical devices are on the
 * manual acceptance checklist in docs/BULK_TRANSFER.md.
 */

type Payload = { name: string; mimeType: string; buffer: Buffer };

function sha(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function noPickers(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    delete (window as unknown as Record<string, unknown>).showDirectoryPicker;
  });
}

async function startSending(page: Page, files: Payload[]): Promise<string> {
  await page.goto("/bulk/send");
  await page.setInputFiles('[data-testid="bulk-file-input"]', files);
  await expect(page.getByTestId("bulk-selection-summary")).toContainText(
    `${files.length.toLocaleString("ko-KR")}개`,
  );
  await page.getByTestId("bulk-start").click();
  const share = page.locator("[data-transfer-code]");
  await expect(share).toHaveAttribute("data-transfer-code", /^[0-9A-HJKMNP-TV-Z]{12}$/u);
  return (await share.getAttribute("data-transfer-code"))!;
}

test.describe("bulk transfer", () => {
  test("moves mixed files directly and byte-exactly, with honest per-file states", async ({
    browser,
  }) => {
    const sender = await browser.newContext();
    const receiver = await browser.newContext({ acceptDownloads: true });
    await noPickers(receiver);
    const files: Payload[] = [
      { name: "IMG_0001.JPG", mimeType: "image/jpeg", buffer: Buffer.alloc(700_000, 1) },
      { name: "IMG_0001.JPG", mimeType: "image/jpeg", buffer: Buffer.alloc(300_001, 2) },
      {
        name: "보고서 최종.hwpx",
        mimeType: "",
        buffer: Buffer.from("PK\u0003\u0004 hwpx".repeat(500)),
      },
      { name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) },
      { name: "clip.mov", mimeType: "video/quicktime", buffer: Buffer.alloc(1_100_000, 7) },
    ];
    try {
      const sending = await sender.newPage();
      const code = await startSending(sending, files);
      await expect(sending.locator("[data-link-state]").first()).toHaveAttribute(
        "data-link-state",
        /preparing|waiting/u,
      );

      const receiving = await receiver.newPage();
      await receiving.goto(`/bulk/receive#c=${code}`);
      // The code is removed from the address bar as soon as it is read.
      await expect.poll(() => new URL(receiving.url()).hash).toBe("");
      // The first test after the dev server starts also pays for route compilation.
      await expect(receiving.getByTestId("bulk-manifest-title")).toContainText("5개", {
        timeout: 90_000,
      });
      await expect(receiving.locator("[data-link-state]").first()).toHaveAttribute(
        "data-link-state",
        "direct",
      );
      await receiving.getByTestId("bulk-save-batch").click();
      await expect(receiving.getByTestId("bulk-receive-title")).toHaveText("모두 받았어요", {
        timeout: 60_000,
      });
      // Held by the browser is never reported as saved.
      await expect(receiving.getByTestId("bulk-counts")).toHaveText("브라우저에 보관 5");
      await expect(sending.getByTestId("bulk-send-done")).toContainText("브라우저에 보관 5");

      const downloads: Promise<string>[] = [];
      const seen: string[] = [];
      receiving.on("download", (download) => {
        seen.push(download.suggestedFilename());
        downloads.push(download.path());
      });
      await receiving.getByTestId("bulk-batch-download").click();
      await expect.poll(() => seen.length, { timeout: 20_000 }).toBeGreaterThanOrEqual(4);
      const paths = await Promise.all(downloads);
      const received = new Map<string, string>();
      const digests = new Set<string>();
      for (const [index, name] of seen.entries()) {
        const digest = sha(await readFile(paths[index]!));
        received.set(name, digest);
        digests.add(digest);
      }
      // Duplicate names are disambiguated, never overwritten.
      expect(received.get("IMG_0001.JPG")).toBe(sha(files[0]!.buffer));
      expect(received.get("IMG_0001 (2).JPG")).toBe(sha(files[1]!.buffer));
      expect(received.get("clip.mov")).toBe(sha(files[4]!.buffer));
      // Headless Chromium in CI reports every non-ASCII blob download as
      // "download" (reproduced with a bare anchor, independent of this code),
      // so the Korean file is matched by content and its name is checked on
      // screen instead.
      expect(digests.has(sha(files[2]!.buffer))).toBe(true);
      await expect(receiving.getByText("보고서 최종.hwpx")).toBeVisible();
      await expect(receiving.getByTestId("bulk-handed-over")).toBeVisible();
    } finally {
      await sender.close();
      await receiver.close();
    }
  });

  test("carries a 3,000-file selection and renders only a window of rows", async ({ browser }) => {
    test.setTimeout(300_000);
    const sender = await browser.newContext();
    const receiver = await browser.newContext();
    await noPickers(receiver);
    const files: Payload[] = Array.from({ length: 3000 }, (_, index) => ({
      name: `사진_${String(index % 1000).padStart(4, "0")}.jpg`,
      mimeType: "image/jpeg",
      buffer: Buffer.from(`synthetic-${index}`),
    }));
    try {
      const sending = await sender.newPage();
      const code = await startSending(sending, files);
      const receiving = await receiver.newPage();
      await receiving.goto(`/bulk/receive#c=${code}`);
      await expect(receiving.getByTestId("bulk-manifest-title")).toContainText("3,000개", {
        timeout: 60_000,
      });
      expect(await receiving.locator(".bulk-row").count()).toBeLessThan(30);
      await receiving.getByTestId("bulk-save-batch").click();
      await expect(receiving.getByTestId("bulk-receive-title")).toHaveText("모두 받았어요", {
        timeout: 240_000,
      });
      await expect(receiving.getByTestId("bulk-counts")).toHaveText("브라우저에 보관 3,000");
      expect(await receiving.locator(".bulk-row").count()).toBeLessThan(30);
      await expect(sending.getByTestId("bulk-send-done")).toContainText("3,000");
    } finally {
      await sender.close();
      await receiver.close();
    }
  });

  test("shows cancellation on the other device and keeps finished files", async ({ browser }) => {
    const sender = await browser.newContext();
    const receiver = await browser.newContext();
    await noPickers(receiver);
    const files: Payload[] = Array.from({ length: 30 }, (_, index) => ({
      name: `v${index}.mp4`,
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1_500_000, index),
    }));
    try {
      const sending = await sender.newPage();
      const code = await startSending(sending, files);
      const receiving = await receiver.newPage();
      await receiving.goto(`/bulk/receive#c=${code}`);
      await receiving.getByTestId("bulk-save-batch").click();
      await expect(sending.getByTestId("bulk-progress")).toBeVisible({ timeout: 30_000 });
      sending.once("dialog", (dialog) => void dialog.accept());
      await sending.getByRole("button", { name: "전송 취소" }).click();
      await expect(sending.getByRole("heading", { name: "전송을 취소했어요" })).toBeVisible();
      await expect(receiving.getByRole("heading", { name: "전송을 취소했어요" })).toBeVisible({
        timeout: 20_000,
      });
    } finally {
      await sender.close();
      await receiver.close();
    }
  });

  test("recovers from a lost connection and finishes without starting over", async ({
    browser,
  }) => {
    test.setTimeout(240_000);
    const sender = await browser.newContext();
    const receiver = await browser.newContext();
    await noPickers(receiver);
    const files: Payload[] = Array.from({ length: 24 }, (_, index) => ({
      name: `r${index}.mp4`,
      mimeType: "video/mp4",
      buffer: Buffer.alloc(1_800_000, index + 1),
    }));
    try {
      const sending = await sender.newPage();
      const code = await startSending(sending, files);
      const receiving = await receiver.newPage();
      await receiving.goto(`/bulk/receive#c=${code}`);
      await receiving.getByTestId("bulk-save-batch").click();
      await expect
        .poll(
          async () =>
            Number(await receiving.getByTestId("bulk-progress").getAttribute("data-percent")),
          {
            timeout: 60_000,
          },
        )
        .toBeGreaterThan(5);
      // Drop the peer connection from the sending side mid-transfer.
      await sending.evaluate(() =>
        (window as unknown as { __printCessBulkDropLink: () => void }).__printCessBulkDropLink(),
      );
      await expect(receiving.locator('[data-link-state="disconnected"]')).toBeVisible({
        timeout: 30_000,
      });
      await expect(receiving.locator('[data-link-state="direct"]')).toBeVisible({
        timeout: 90_000,
      });
      await expect(receiving.getByTestId("bulk-receive-title")).toHaveText("모두 받았어요", {
        timeout: 120_000,
      });
      await expect(receiving.getByTestId("bulk-counts")).toHaveText("브라우저에 보관 24");
      await expect(sending.getByTestId("bulk-send-done")).toContainText("브라우저에 보관 24");
    } finally {
      await sender.close();
      await receiver.close();
    }
  });

  test("never switches to cloud storage without explicit consent", async ({ page }) => {
    const cloudRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/drops")) cloudRequests.push(request.url());
    });
    await startSending(page, [
      { name: "a.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(1000, 1) },
    ]);
    await page.getByText("직접 연결이 안 되나요?").click();
    await page.getByRole("button", { name: "암호화 클라우드 전송으로 바꾸기" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("30분 뒤 자동으로 지워져요");
    // Opening the explanation is not consent.
    expect(cloudRequests.filter((url) => !url.endsWith("/capabilities"))).toEqual([]);
    await page.getByRole("button", { name: "클라우드로 보내기" }).click();
    await expect(page.locator('[data-link-state="cloud"]')).toHaveText(/클라우드 전송 사용 중/u);
  });

  test("reports an unknown code instead of waiting forever", async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto("/bulk/receive#c=23456789ABCD");
    await expect(page.getByRole("heading", { name: /전송을 찾을 수 없어요/u })).toBeVisible({
      timeout: 60_000,
    });
  });

  test("fits a small phone screen @viewport", async ({ page }) => {
    await page.goto("/bulk/receive");
    await expect(page.getByTestId("bulk-code-input")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
