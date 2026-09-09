import { expect, test } from "@playwright/test";

test("smart camera keeps its media stream across parent re-renders", async ({ page }) => {
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
  });

  const cameraStarts = () =>
    page.evaluate(() => Number(sessionStorage.getItem("print-cess-camera-starts") ?? "0"));

  await page.goto("/scan");
  await page.getByTestId("scan-smart-camera").click();
  await expect(page.getByRole("dialog", { name: "Smart camera" })).toBeVisible();
  await expect.poll(cameraStarts).toBe(1);

  await page.locator(".drop-language select").selectOption("ko");
  await expect(page.getByRole("dialog", { name: "스마트 카메라" })).toBeVisible();

  // A locale change re-renders the scanner parent. It must not tear down and
  // reacquire the camera merely because callback/copy identities changed.
  await page.waitForTimeout(750);
  expect(await cameraStarts()).toBe(1);
});
