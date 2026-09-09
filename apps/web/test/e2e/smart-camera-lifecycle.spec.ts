import { expect, test } from "@playwright/test";

test("smart camera keeps its media stream while a captured page is processed", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const current = Number(sessionStorage.getItem("print-cess-camera-starts") ?? "0");
          sessionStorage.setItem("print-cess-camera-starts", String(current + 1));
          return new MediaStream();
        },
      },
    });

    HTMLMediaElement.prototype.play = async function play() {
      Object.defineProperty(this, "videoWidth", { configurable: true, value: 1280 });
      Object.defineProperty(this, "videoHeight", { configurable: true, value: 720 });
    };

    Object.defineProperty(CanvasRenderingContext2D.prototype, "drawImage", {
      configurable: true,
      value: () => {},
    });
    Object.defineProperty(HTMLCanvasElement.prototype, "toBlob", {
      configurable: true,
      value: (callback: BlobCallback) => {
        callback(new Blob(["scanner-lifecycle-test"], { type: "image/jpeg" }));
      },
    });
  });

  const cameraStarts = () =>
    page.evaluate(() => Number(sessionStorage.getItem("print-cess-camera-starts") ?? "0"));

  await page.goto("/scan");
  await page.getByTestId("scan-smart-camera").click();
  await expect(page.getByRole("dialog", { name: "Smart camera" })).toBeVisible();
  await expect.poll(cameraStarts).toBe(1);

  // Processing a capture toggles ScanComposer's busy state and therefore
  // re-renders the parent that provides the inline onCapture callback. The
  // live stream must survive that re-render instead of being reacquired.
  await page.locator(".scan-live-controls button").last().click();
  await page.waitForTimeout(900);
  expect(await cameraStarts()).toBe(1);
});
