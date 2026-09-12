import { expect, test } from "@playwright/test";

const SHADOWED_DOCUMENT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#9a9b94"/>
      <stop offset="0.42" stop-color="#d8d7ce"/>
      <stop offset="1" stop-color="#fffef8"/>
    </linearGradient>
  </defs>
  <rect width="900" height="1200" fill="#26343c"/>
  <polygon points="118,105 798,152 758,1092 78,1038" fill="url(#paper)" stroke="#eceae0" stroke-width="8"/>
  <g fill="#263238">
    <rect x="210" y="250" width="410" height="30" rx="6"/>
    <rect x="188" y="335" width="510" height="18" rx="5"/>
    <rect x="178" y="390" width="525" height="18" rx="5"/>
    <rect x="168" y="445" width="495" height="18" rx="5"/>
    <rect x="158" y="560" width="535" height="18" rx="5"/>
    <rect x="153" y="615" width="500" height="18" rx="5"/>
    <rect x="148" y="670" width="525" height="18" rx="5"/>
    <rect x="143" y="785" width="510" height="18" rx="5"/>
    <rect x="138" y="840" width="480" height="18" rx="5"/>
  </g>
</svg>`;

test("document detection survives strong uneven illumination and perspective", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/scan");
  await page.getByTestId("scan-gallery-input").setInputFiles({
    name: "shadowed-skewed-document.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(SHADOWED_DOCUMENT_SVG),
  });

  await expect(page.getByText("Document edges detected")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Adjust edges" }).click();
  const dialog = page.getByRole("dialog", { name: "Adjust edges" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("circle")).toHaveCount(4);
  expect(errors).toEqual([]);
});
