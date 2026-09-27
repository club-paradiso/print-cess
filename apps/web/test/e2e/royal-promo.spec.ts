import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const slogans = [
  "아니 황궁에 사람이 몇인데 공주가 직접 출력함",
  "황태자 전하도 파일은 직접 보내셔야 합니다",
  "제국을 구하셔도 출력은 셀프입니다",
  "황태자는 됐고, 용지가 걸렸다고",
] as const;

test("the royal campaign keeps one heading, four artworks, exact captions, and real CTAs", async ({
  page,
}) => {
  await page.goto("/promo");

  await expect(page).toHaveTitle("공주는 편한 게 최고야 | Print-cess by Club Paradiso");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("공주는 편한 게 최고야");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  for (const slogan of slogans) {
    await expect(page.locator("figcaption").filter({ hasText: slogan })).toHaveCount(1);
  }
  await expect(page.locator("img")).toHaveCount(5);
  await expect(page.getByRole("link", { name: /지금 출력하기/u })).toHaveAttribute("href", "/");
  await expect(page.getByRole("link", { name: /Print-cess 사용하기/u })).toHaveAttribute(
    "href",
    "/",
  );

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});

test("the campaign route does not replace the service home", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).not.toHaveText("공주는 편한 게 최고야");
  await expect(page.locator('[class*="promo-module"]')).toHaveCount(0);
});

test("@viewport the campaign has no sideways overflow on a phone", async ({ page }) => {
  await page.goto("/promo");
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.getByRole("link", { name: /지금 출력하기/u })).toBeVisible();
});
