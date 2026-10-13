import { expect, test, type Page } from "@playwright/test";

/**
 * Verify the *deployed* page with production CSP, not just the local Next.js
 * development server (which permits unsafe-eval and can hide scanner failures).
 * The images and webcam video are synthetic; no personal documents are used.
 */
const PRODUCTION_URL = "https://print-cess.vercel.app/scan";

const DOCUMENT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
<rect width="600" height="800" fill="#273743"/>
<polygon points="70,65 540,90 515,745 55,720" fill="#fff" stroke="#333" stroke-width="5"/>
<g fill="#131b26"><rect x="115" y="160" width="320" height="18"/>
<rect x="115" y="222" width="350" height="13"/><rect x="115" y="290" width="300" height="13"/>
<rect x="115" y="365" width="350" height="13"/><rect x="115" y="435" width="310" height="13"/>
<rect x="115" y="510" width="350" height="13"/></g></svg>`;

function collectDiagnostics(page: Page): string[] {
  const diagnostics: string[] = [];
  page.on("pageerror", (error) => diagnostics.push("PAGE ERROR: " + error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") {
      diagnostics.push("CONSOLE " + message.type() + ": " + message.text());
    }
  });
  page.on("requestfailed", (request) =>
    diagnostics.push("NETWORK: " + request.url() + " " + (request.failure()?.errorText ?? "unknown")),
  );
  return diagnostics;
}

test("@viewport production scanner imports an image and generates a PDF", async ({ page }) => {
  test.setTimeout(110_000);
  const errors = collectDiagnostics(page);
  const response = await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });
  const csp = response?.headers()["content-security-policy"] ?? "<missing>";
  try {
    expect(response?.status()).toBe(200);
    await expect(page.getByTestId("scan-gallery-input")).toBeAttached();
    await page.getByTestId("scan-gallery-input").setInputFiles({
      name: "synthetic-page.svg",
      mimeType: "image/svg+xml",
      buffer: Buffer.from(DOCUMENT_SVG),
    });
    await expect(page.locator(".scan-page-preview")).toHaveCount(1, { timeout: 55_000 });
    await page.getByRole("button", { name: /Make PDF|PDF 만들기/u }).click();
    await expect(page.getByRole("heading", { name: /Your scan is ready|스캔/u })).toBeVisible({
      timeout: 40_000,
    });
  } finally {
    console.log("PRODUCTION_CSP:", csp);
    console.log("SCANNER_PRODUCTION_DIAGNOSTICS:", JSON.stringify(errors));
    console.log("SCANNER_VISIBLE_TEXT:", (await page.locator("body").innerText()).slice(-1300));
  }
});

test("@viewport production smart camera captures a synthetic live frame", async ({ page }) => {
  test.setTimeout(110_000);
  const errors = collectDiagnostics(page);
  await page.addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 800;
    const ctx = canvas.getContext("2d")!;
    const render = () => {
      ctx.fillStyle = "#263744";
      ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = "#fff";
      ctx.fillRect(70, 70, 460, 660);
      ctx.fillStyle = "#1c2532";
      for (let i = 0; i < 8; i++) ctx.fillRect(120, 165 + i * 65, 340, 12);
    };
    render();
    setInterval(render, 400);
    MediaDevices.prototype.getUserMedia = async () => canvas.captureStream(15);
  });

  const response = await page.goto(PRODUCTION_URL, { waitUntil: "domcontentloaded" });
  try {
    expect(response?.status()).toBe(200);
    await page.getByTestId("scan-smart-camera").click();
    const dialog = page.locator(".scan-live-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("video")).toBeVisible();
    await expect(dialog.locator(".scan-live-loading")).toBeHidden({ timeout: 20_000 });
    const button = dialog.getByRole("button", { name: /Capture now|지금 촬영/u });
    await expect(button).toBeEnabled();
    await button.click();
    await expect(page.locator(".scan-page-preview")).toHaveCount(1, { timeout: 55_000 });
  } finally {
    console.log("CAMERA_PRODUCTION_DIAGNOSTICS:", JSON.stringify(errors));
    console.log("CAMERA_VISIBLE_TEXT:", (await page.locator("body").innerText()).slice(-1300));
  }
});
