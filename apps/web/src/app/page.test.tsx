import { afterEach, describe, expect, it, vi } from "vitest";

const { acceptLanguage } = vi.hoisted(() => ({ acceptLanguage: { value: "" } }));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "accept-language": acceptLanguage.value })),
}));

import HomePage from "./page";

/** Walks the rendered tree collecting every string, so copy can be asserted. */
function textOf(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textOf((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function headingsOf(node: unknown, level: string): string[] {
  if (Array.isArray(node)) return node.flatMap((child) => headingsOf(child, level));
  if (node && typeof node === "object" && "props" in node) {
    const element = node as { type?: unknown; props: { children?: unknown } };
    return element.type === level
      ? [textOf(element.props.children)]
      : headingsOf(element.props.children, level);
  }
  return [];
}

function hrefsOf(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(hrefsOf);
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props: { href?: unknown; children?: unknown } }).props;
    return [...(typeof props.href === "string" ? [props.href] : []), ...hrefsOf(props.children)];
  }
  return [];
}

describe("home page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    acceptLanguage.value = "";
  });

  it("keeps file hand-off, workstation, and kiosk entry discoverable when the browser kiosk is enabled", async () => {
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");
    vi.stubEnv("VERCEL_ENV", "production");

    const page = await HomePage();

    expect(page.props.className).toBe("home");
    expect(hrefsOf(page)).toEqual(
      expect.arrayContaining(["/scan", "/send", "/receive", "/workstation", "/kiosk"]),
    );
  });

  it("keeps workstation access while hiding a disabled production kiosk shortcut", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "false");
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");
    vi.stubEnv("VERCEL_ENV", "production");

    const page = await HomePage();
    const hrefs = hrefsOf(page);

    expect(hrefs).toEqual(expect.arrayContaining(["/scan", "/send", "/receive", "/workstation"]));
    expect(hrefs).not.toContain("/kiosk");
  });

  it("keeps the public entry page on the dedicated kiosk Preview branch", async () => {
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_GIT_COMMIT_REF", "preview");

    const page = await HomePage();

    expect(page.props.className).toBe("home");
    expect(hrefsOf(page)).toEqual(
      expect.arrayContaining(["/scan", "/send", "/receive", "/workstation", "/kiosk"]),
    );
  });

  it("greets a visitor in the language their browser asked for", async () => {
    acceptLanguage.value = "ko-KR,ko;q=0.9,en;q=0.8";

    const copy = textOf(await HomePage());

    expect(copy).toContain("파일을 다른 기기로, 또는 바로 종이로");
    expect(copy).toContain("인쇄");
    expect(copy).toContain("공유");
    expect(copy).toContain("스캔");
    expect(copy).toContain("보낼 파일 고르기");
    expect(copy).toContain("코드로 파일 받기");
    expect(copy).toContain("문서 스캔하기");
    expect(copy).toContain("업무용 PC");
    expect(copy).toContain("키오스크 열기");
    expect(copy).not.toContain("Send a file to another device");
  });

  it("falls back to English when no language is asked for", async () => {
    const copy = textOf(await HomePage());

    expect(copy).toContain("Send a file to another device, or straight to paper.");
    expect(copy).toContain("Choose files to send");
    expect(copy).toContain("Receive files with a code");
    expect(copy).toContain("Scan a document");
    expect(copy).toContain("Work computer");
    expect(copy).toContain("Open kiosk");
  });

  /**
   * The three capabilities are the page. Institutional entrances share it, but
   * below them and never as one of them: a visitor who came to print or share
   * should not have to read past a managed-workstation link to find out how.
   */
  it("leads with Print, Share and Scan and keeps workplaces secondary", async () => {
    const page = await HomePage();
    const order = hrefsOf(page);

    expect(headingsOf(page, "h2")).toEqual([
      "Print",
      "Share",
      "Scan",
      "At work or on a public computer",
    ]);
    expect(order.indexOf("/send")).toBeLessThan(order.indexOf("/workstation"));
    expect(order.indexOf("/scan")).toBeLessThan(order.indexOf("/workstation"));
  });

  it("never offers a print button that has nowhere honest to go", async () => {
    const hrefs = hrefsOf(await HomePage());

    // Printing starts at a kiosk's QR code. The home page describes that; it
    // does not link to a print route it cannot open.
    expect(hrefs.some((href) => href.startsWith("/s/"))).toBe(false);
    expect(hrefs).not.toContain("/print");
  });
});
