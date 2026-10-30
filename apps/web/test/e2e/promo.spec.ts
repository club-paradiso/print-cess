import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** /promo is a separate marketing page. These checks keep it apart from the product. */

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function expectNoSideScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test("the hero explains Print-cess and plays two muted films", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/promo");
  await expect(
    page.getByRole("heading", { level: 1, name: /휴대전화 속 문서를\s*프린터에서 바로 뽑아요/u }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /사용 방법 보기/u })).toHaveAttribute("href", "#how");
  await expect(page.getByText(/개발·시연 단계예요/u).first()).toBeVisible();

  const videos = page.locator("video");
  await expect(videos).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(videos.nth(index)).toHaveJSProperty("muted", true);
    await expect(videos.nth(index)).toHaveJSProperty("autoplay", false);
  }
  await expect(page.locator("[data-state='playing']")).toHaveCount(1, { timeout: 15_000 });
  await page.getByRole("button", { name: "영상 멈추기" }).click();
  await expect(page.getByRole("button", { name: "영상 재생" })).toBeVisible();

  expect(errors.filter((text) => !/Failed to load resource/u.test(text))).toEqual([]);
});

test("reduced motion keeps the still and loads no film until asked", async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  const requested: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".mp4")) requested.push(request.url());
  });

  await page.goto("/promo");
  await expect(page.locator("[data-state='still']")).toHaveCount(1);
  await page.waitForTimeout(1500);
  expect(requested).toEqual([]);

  await page.getByRole("button", { name: "영상 재생" }).click();
  await expect(page.locator("[data-state='playing']")).toHaveCount(1, { timeout: 15_000 });
  expect(requested.length).toBeGreaterThan(0);
  await context.close();
});

test("a film that cannot load leaves the still in place", async ({ page }) => {
  await page.route("**/promo/*.mp4", (route) => route.abort());
  await page.goto("/promo");

  await expect(page.locator("[data-state='failed']")).toHaveCount(1, { timeout: 15_000 });
  await expect(page.locator("video[data-ready='true']")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /영상/u })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("the demo walks the four real screens and never prints", async ({ page }) => {
  await page.goto("/promo#how");
  const stage = page.locator("figure");
  await expect(stage.getByText("프린터 옆 화면")).toBeVisible();
  await page.getByRole("button", { name: "다음 화면" }).click();
  await expect(stage.getByText("인쇄할 문서를 하나 고르세요")).toBeVisible();
  await page.getByRole("button", { name: "다음 화면" }).click();
  await expect(stage.getByText("이 문서가 맞나요?")).toBeVisible();
  await page.getByRole("button", { name: "다음 화면" }).click();
  await expect(stage.getByText("종이를 가져가세요")).toBeVisible();
  await expect(page.getByRole("button", { name: "다음 화면" })).toBeDisabled();
  // The drawn buttons are not controls.
  await expect(stage.getByRole("button", { name: /A4 한 부 인쇄/u })).toHaveCount(0);
});

test("the trust section says what it is and is not", async ({ page }) => {
  await page.goto("/promo#trust");
  await expect(page.getByRole("heading", { name: "지금은 개발·시연 단계예요" })).toBeVisible();
  await expect(page.getByText(/계정이 필요 없어요/u)).toBeVisible();
  await expect(page.getByText(/즉시 지워진다는 약속은 아니에요/u)).toBeVisible();
});

test("@viewport has no accessibility violations and no side scroll", async ({ page }) => {
  await page.goto("/promo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSideScroll(page);
  await expectAccessible(page);
});

test("every feature link leads to a live route and the product pages are untouched", async ({
  page,
}) => {
  await page.goto("/promo");
  for (const [name, path] of [
    [/인쇄 시작 화면/u, "/start"],
    [/보낼 파일 고르기/u, "/send"],
    [/코드로 파일 받기/u, "/receive"],
    [/문서 스캔하기/u, "/scan"],
  ] as const) {
    await expect(page.getByRole("link", { name })).toHaveAttribute("href", path);
  }
  for (const path of ["/", "/start", "/kiosk", "/send", "/receive", "/scan"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    // Marketing film and scroll effects never reach a product screen.
    await expect(page.locator("video[src^='/promo/']"), path).toHaveCount(0);
  }
});
