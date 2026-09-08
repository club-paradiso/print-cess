import { expect, test } from "@playwright/test";

const DOCUMENT_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <rect width="900" height="1200" fill="#26343c"/>
  <polygon points="125,95 790,145 755,1100 82,1038" fill="#fffef8" stroke="#d8d6ce" stroke-width="8"/>
  <g fill="#24313a">
    <rect x="210" y="250" width="410" height="30" rx="6"/>
    <rect x="190" y="330" width="500" height="18" rx="5"/>
    <rect x="180" y="385" width="520" height="18" rx="5"/>
    <rect x="170" y="440" width="490" height="18" rx="5"/>
    <rect x="165" y="545" width="535" height="18" rx="5"/>
    <rect x="160" y="600" width="500" height="18" rx="5"/>
    <rect x="155" y="655" width="525" height="18" rx="5"/>
    <rect x="150" y="760" width="510" height="18" rx="5"/>
    <rect x="145" y="815" width="480" height="18" rx="5"/>
  </g>
</svg>`;

test("document scanner detects edges, lets the user refine them, and produces a PDF", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/scan");
  await page.getByTestId("scan-gallery-input").setInputFiles({
    name: "skewed-document.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from(DOCUMENT_SVG),
  });

  await expect(page.getByText("Document edges detected")).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Adjust edges" }).click();

  const dialog = page.getByRole("dialog", { name: "Adjust edges" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("circle")).toHaveCount(4);
  await page.getByRole("button", { name: "Black & white" }).click();
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(dialog).toBeHidden({ timeout: 60_000 });

  await page.getByRole("button", { name: "Make PDF" }).click();
  await expect(page.getByRole("heading", { name: "Your scan is ready" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Print-cess-scan.pdf")).toBeVisible();
  expect(errors).toEqual([]);
});
