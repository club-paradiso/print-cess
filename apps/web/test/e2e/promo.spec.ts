import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  await expect(page.getByText(/개발·시연 단계/u)).toHaveCount(0);

  const videos = page.locator("video");
  await expect(videos).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    await expect(videos.nth(index)).toHaveJSProperty("muted", true);
    await expect(videos.nth(index)).toHaveJSProperty("autoplay", false);
  }
  await expect(page.locator("[data-state='playing']")).toHaveCount(1, { timeout: 15_000 });
  // The film runs with no controls of any kind, by the owner's decision.
  await expect(page.locator("section[aria-labelledby='hero-title'] button")).toHaveCount(0);

  expect(errors.filter((text) => !/Failed to load resource/u.test(text))).toEqual([]);
});

test("reduced motion keeps the still and never loads the film", async ({ browser }) => {
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
  await expect(page.getByText(/움직임을 줄이는 설정이라 사진만 보여요/u)).toBeVisible();
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
    name: /QR 코드 찍기|파일 고르고 인쇄하기|프린터에서 종이 받기/u,
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

test("the statement band states the three steps and the facts", async ({ page }) => {
  await page.goto("/promo");
  await expect(
    page.getByRole("heading", { level: 2, name: /QR 찍고,\s*고르고,\s*받으면 끝\./u }),
  ).toBeAttached();
  await expect(page.getByText("새로 설치할 앱")).toBeAttached();
  // The print lines feed out once the line is read.
  const line = page.locator("#statement-title");
  await line.scrollIntoViewIfNeeded();
  await expect(line).toHaveAttribute("data-fed", "true");
});

test("the trust section says what it is and is not", async ({ page }) => {
  await page.goto("/promo#privacy");
  await page.getByText("파일 처리와 삭제 범위 보기").click();
  await expect(page.getByRole("heading", { name: "지금은 개발·시연 단계예요" })).toHaveCount(0);
  await expect(page.getByText(/계정이 필요 없어요/u)).toBeVisible();
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
    ["인쇄", /QR 연결 안내 열기/u, "/start"],
    ["공유", /파일 보내기 열기/u, "/send"],
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
  await expect(
    page.getByText(/후원하지 않아도 인쇄·공유·스캔 기능을 이용할 수 있어요/u),
  ).toBeVisible();
});

test("the FAQ answers in place", async ({ page }) => {
  await page.goto("/promo#faq");
  const question = page.getByText("어떤 파일을 인쇄할 수 있나요?");
  await question.click();
  await expect(page.getByText(/사진과 PDF는 각각 50MB 이하/u).first()).toBeVisible();
});

test("every product page is untouched and carries no promo media", async ({ page }) => {
  for (const path of ["/", "/start", "/kiosk", "/send", "/receive", "/scan"]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(200);
    await expect(page.locator("video[src^='/promo/']"), path).toHaveCount(0);
  }
});

test("@viewport menu dismisses with Escape, restores focus and closes after navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/promo");
  const menu = page.locator("header details");
  const toggle = menu.locator("summary");
  await toggle.click();
  await expect(menu).toHaveAttribute("open", "");
  await menu.getByRole("link", { name: "사용 방법", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(menu).not.toHaveAttribute("open");
  await expect(toggle).toBeFocused();
  await toggle.press("Enter");
  await menu.getByRole("link", { name: "사용 방법", exact: true }).click();
  await expect(page).toHaveURL(/#how$/u);
  await expect(menu).not.toHaveAttribute("open");
  await expect(page.locator("#how-title")).toBeFocused();
});

test("@viewport summaries stay visible and optional detail expands without starting a print", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/promo");
  const hero = page.locator("section[aria-labelledby='hero-title']");
  const entry = hero.getByRole("link", { name: "이용 화면 열기" });
  expect((await entry.boundingBox())!.y).toBeLessThan(568);
  const previews = page.locator("#how details");
  await expect(previews).toHaveCount(3);
  for (const preview of await previews.all()) await expect(preview).not.toHaveAttribute("open");
  await expect(
    page.getByRole("heading", { name: "프린터에서 종이 받기", exact: true }),
  ).toBeVisible();
  await previews.nth(1).locator("summary").click();
  await expect(previews.nth(1)).toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: /A4 한 부 인쇄/u })).toHaveCount(0);
  await expectNoSideScroll(page);
  for (const label of ["파일 처리와 삭제 범위 보기", "후원금 사용 계획과 참여 방법 보기"]) {
    const details = page
      .locator("details")
      .filter({ has: page.locator("summary", { hasText: label }) });
    await expect(details).not.toHaveAttribute("open");
    await details.locator("summary").click();
    await expect(details).toHaveAttribute("open", "");
  }
});

test("the core guide and feature destinations work without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 375, height: 812 },
  });
  const page = await context.newPage();
  await page.goto("/promo");
  await expect(
    page.getByRole("heading", { name: "프린터에서 종이 받기", exact: true }),
  ).toBeVisible();
  await page.locator("noscript summary").filter({ hasText: "공유" }).click();
  await expect(
    page.locator("noscript").getByRole("link", { name: "파일 보내기 열기" }),
  ).toHaveAttribute("href", "/send");
  await context.close();
});

test("@viewport the promo fits the full viewport matrix", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const metrics = [];
  const evidence = process.env.PROMO_QA_EVIDENCE_DIR;
  if (evidence) mkdirSync(evidence, { recursive: true });
  for (const [width, height] of [
    [320, 568],
    [375, 812],
    [390, 844],
    [430, 932],
    [768, 1024],
    [1440, 900],
  ]) {
    await page.setViewportSize({ width, height });
    await page.goto("/promo");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expectNoSideScroll(page);
    const layout = await page.evaluate(() => ({
      height: document.documentElement.scrollHeight,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sections: [...document.querySelectorAll("main > section")].map((element) => ({
        id: element.id || element.getAttribute("aria-labelledby"),
        top: Math.round(element.getBoundingClientRect().top + scrollY),
        height: Math.round(element.getBoundingClientRect().height),
      })),
    }));
    metrics.push({ width, viewportHeight: height, ...layout });
    if (evidence) {
      await page.screenshot({ path: join(evidence, `after-${width}.png`), fullPage: true });
      if (width === 390) await page.screenshot({ path: join(evidence, "after-first.png") });
    }
  }
  if (evidence) writeFileSync(join(evidence, "after.json"), JSON.stringify(metrics, null, 2));
});

test("@viewport legal documents have touch targets, readable dialogs and native focus return", async ({
  page,
}) => {
  await page.goto("/promo");
  for (const name of ["보안 정책", "개인정보 문서", "라이선스(Apache-2.0)"]) {
    const trigger = page.getByRole("button", { name, exact: true });
    expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await trigger.click();
    const dialog = page.getByRole("dialog", { name, exact: true });
    await expect(dialog).toBeVisible();
    const close = dialog.getByRole("button", { name: "닫기", exact: true });
    expect((await close.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await close.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});
