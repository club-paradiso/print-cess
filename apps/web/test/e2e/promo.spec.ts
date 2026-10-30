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

test("the walkthrough follows the step being read and never prints", async ({ page }) => {
  await page.goto("/promo#how");
  const steps = page.getByRole("heading", {
    level: 3,
    name: /QR 코드 찍기|휴대전화에서 파일 선택|프린터에서 종이 받기/u,
  });
  await expect(steps).toHaveCount(3);
  // Step two offers a second screen; the drawn buttons are not controls.
  const variants = page.getByRole("group", { name: "화면 고르기" });
  await variants.getByRole("button", { name: "확인하고 인쇄" }).click();
  await expect(variants.getByRole("button", { name: "확인하고 인쇄" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: /A4 한 부 인쇄/u })).toHaveCount(0);
  // Scrolling to the last step moves the sticky dock to it.
  await page
    .getByRole("heading", { level: 3, name: "프린터에서 종이 받기" })
    .evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(page.locator("[data-visible='true']").getByText("3/3")).toBeVisible();
});

test("the trust section says what it is and is not", async ({ page }) => {
  await page.goto("/promo#trust");
  await expect(page.getByRole("heading", { name: "지금은 개발·시연 단계예요" })).toBeVisible();
  await expect(page.getByText(/계정이 필요 없어요/u)).toBeVisible();
  await page.getByText("그래도 알아 둘 점").click();
  await expect(page.getByText(/즉시 지워진다는 약속은 아니에요/u)).toBeVisible();
});

test("@viewport has no accessibility violations and no side scroll", async ({ page }) => {
  await page.goto("/promo");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoSideScroll(page);
  await expectAccessible(page);
});

test("the tabs show one feature at a time, each with a real link", async ({ page }) => {
  await page.goto("/promo#more");
  const tabs = page.getByRole("tablist");
  for (const [tab, link, path] of [
    ["인쇄", /인쇄 시작 화면/u, "/start"],
    ["공유", /보낼 파일 고르기/u, "/send"],
    ["스캔", /문서 스캔하기/u, "/scan"],
  ] as const) {
    await tabs.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("tabpanel").getByRole("link", { name: link })).toHaveAttribute(
      "href",
      path,
    );
  }
  await tabs.getByRole("tab", { name: "공유" }).click();
  await expect(page.getByRole("link", { name: "코드로 파일 받기" })).toHaveAttribute(
    "href",
    "/receive",
  );
  await tabs.getByRole("tab", { name: "공유" }).press("ArrowRight");
  await expect(tabs.getByRole("tab", { name: "스캔" })).toHaveAttribute("aria-selected", "true");
});

test("the hero offers a screen preview and a motion switch", async ({ page }) => {
  await page.goto("/promo");
  const picker = page.getByRole("group", { name: "장면 고르기" });
  await picker.getByRole("button", { name: "화면 예시" }).click();
  await expect(picker.getByRole("button", { name: "화면 예시" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("화면 예시예요. 실제로 인쇄되지 않아요.")).toBeVisible();
  await page.getByRole("button", { name: "움직임 줄이기" }).click();
  await expect(page.getByRole("button", { name: "움직임 기본값" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-promo-motion", "reduced");
});

test("the scene picker switches the film", async ({ page }) => {
  await page.goto("/promo");
  const picker = page.getByRole("group", { name: "장면 고르기" });
  await expect(picker.getByRole("button", { name: "대학교" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await picker.getByRole("button", { name: "공항" }).click();
  await expect(picker.getByRole("button", { name: "공항" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("support stays closed until the owner configures a destination", async ({ page }) => {
  await page.goto("/promo#support");
  await expect(page.getByText("후원 창구 준비 중")).toBeVisible();
  await page.getByRole("button", { name: "후원 준비 상태 보기" }).click();
  await expect(page.getByRole("dialog", { name: "후원 안내" })).toBeVisible();
  await expect(page.getByText(/아직 후원을 받는 창구가 열리지 않았어요/u)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  // No payment route, amount field or card form is ever shown.
  await expect(page.getByRole("link", { name: /후원하러 가기/u })).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(0);
  await expect(page.getByText(/기능이나 한도가 생기지도 않아요/u)).toBeVisible();
});

test("the FAQ answers in place", async ({ page }) => {
  await page.goto("/promo#faq");
  const question = page.getByText("어떤 파일을 인쇄할 수 있나요?");
  await question.click();
  await expect(page.getByText(/사진은 20MB, PDF는 10MB 이하/u).first()).toBeVisible();
});

test("every product page is untouched and carries no promo media", async ({ page }) => {
  for (const path of ["/", "/start", "/kiosk", "/send", "/receive", "/scan"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("video[src^='/promo/']"), path).toHaveCount(0);
  }
});
