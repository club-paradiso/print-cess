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

/** The client component takes its words as props, so read them from there. */
function entryLabelsOf(node: unknown): Record<string, unknown> | undefined {
  if (Array.isArray(node)) return node.map(entryLabelsOf).find((labels) => labels !== undefined);
  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props: { labels?: Record<string, unknown>; children?: unknown } };
    if (element.props.labels && "scanCta" in element.props.labels) return element.props.labels;
    return entryLabelsOf(element.props.children);
  }
  return undefined;
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

    expect(copy).toContain("QR 코드를 스캔하세요");
    expect(copy).toContain("프린터 옆 Print-cess 화면에 QR 코드가 있어요.");
    expect(copy).toContain("스캔하면 인쇄할 파일을 고르는 화면이 열려요.");
    expect(copy).toContain("이 표시가 있는 화면이 Print-cess 화면이에요.");
    expect(copy).toContain("공유");
    expect(copy).toContain("스캔");
    expect(copy).toContain("보낼 파일 고르기");
    expect(copy).toContain("코드로 파일 받기");
    expect(copy).toContain("문서 스캔하기");
    expect(copy).toContain("업무용 PC");
    expect(copy).toContain("이 기기를 Print-cess 화면으로 쓰기");
    expect(copy).not.toContain("Here to print?");
    // The category word is for installers; a first-time visitor is never asked
    // to know it.
    expect(copy).not.toContain("키오스크");
    expect(entryLabelsOf(await HomePage())).toMatchObject({
      scanCta: "QR 코드 스캔하기",
      lostCta: "화면을 못 찾겠어요",
    });
  });

  it("falls back to English when no language is asked for", async () => {
    const copy = textOf(await HomePage());

    expect(copy).toContain("Here to print?");
    expect(copy).toContain("Find the Print-cess screen next to the printer.");
    expect(copy).toContain("Choose files to send");
    expect(copy).toContain("Receive files with a code");
    expect(copy).toContain("Scan a document");
    expect(copy).toContain("Work computer");
    expect(copy).toContain("Use this device as the print screen");
    expect(copy).not.toContain("kiosk");
  });

  /**
   * Turning the current device into the public print screen is a setup action,
   * but it must be visible immediately. Keep it above the visitor tools so an
   * installer never has to hunt through the bottom workplace section again.
   */
  it("puts the kiosk display entry above the other home-page links", async () => {
    const page = await HomePage();
    const order = hrefsOf(page);

    expect(headingsOf(page, "h1")).toEqual(["Here to print?"]);
    expect(headingsOf(page, "h2")).toEqual(["Share", "Scan", "At work or on a public computer"]);
    expect(order[0]).toBe("/kiosk");
    expect(order.indexOf("/kiosk")).toBeLessThan(order.indexOf("/send"));
    expect(order.indexOf("/kiosk")).toBeLessThan(order.indexOf("/scan"));
    expect(order.indexOf("/send")).toBeLessThan(order.indexOf("/workstation"));
    expect(order.indexOf("/scan")).toBeLessThan(order.indexOf("/workstation"));
  });

  it("keeps the first print section focused on the Beacon instead of repeating a four-step guide", async () => {
    const copy = textOf(await HomePage());

    expect(copy).toContain("Look for the screen with this mark.");
    expect(copy).toContain("Here to print?");
    for (const duplicateStep of [
      "Find the screen",
      "Scan its QR code",
      "Pick your file",
      "Take your paper",
    ]) {
      expect(copy).not.toContain(duplicateStep);
    }
    expect(copy.indexOf("Look for the screen with this mark.")).toBeLessThan(
      copy.indexOf("Choose files to send"),
    );
  });

  it("gives the rescue sheet and the scanner every word they show", async () => {
    const labels = entryLabelsOf(await HomePage()) as Record<string, unknown>;

    expect(labels.scanCta).toBe("Scan QR code");
    expect(labels.lostCta).toBe("I can't find the screen");
    expect(labels.lostSteps).toEqual([
      "Find the printer",
      "Find the big screen beside it",
      "Scan the QR code on that screen",
    ]);
    for (const [name, value] of Object.entries(labels)) {
      expect(value, name).toBeTruthy();
    }
  });

  it("never offers a print button that has nowhere honest to go", async () => {
    const hrefs = hrefsOf(await HomePage());

    // Printing starts at a kiosk's QR code. The home page describes that; it
    // does not link to a print route it cannot open.
    expect(hrefs.some((href) => href.startsWith("/s/"))).toBe(false);
    expect(hrefs).not.toContain("/print");
  });
});
