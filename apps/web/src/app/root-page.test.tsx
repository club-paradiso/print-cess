import { afterEach, describe, expect, it, vi } from "vitest";

const { notFound, redirect } = vi.hoisted(() => ({ notFound: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/components/kiosk/batch-kiosk-simulator", () => ({
  BatchKioskSimulator: () => null,
}));
vi.mock("@/components/home/visitor-home", () => ({
  VisitorHome: () => null,
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "accept-language": "ko-KR,ko;q=0.9" })),
}));

import { BatchKioskSimulator } from "@/components/kiosk/batch-kiosk-simulator";
import { VisitorHome } from "@/components/home/visitor-home";
import RootPage from "./page";

type Params = { printing?: string | string[]; sound?: string | string[] };
const render = (params: Params) => RootPage({ searchParams: Promise.resolve(params) });

describe("root page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockReset();
    redirect.mockReset();
  });

  it("is the visitor's home when the address asks for nothing else", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

    const page = await render({});

    expect(page.type).toBe(VisitorHome);
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });

  it("ignores query parameters that are not display switches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

    const page = await RootPage({
      searchParams: Promise.resolve({ utm_source: "qr", lang: "en" } as Params),
    });

    expect(page.type).toBe(VisitorHome);
  });

  it.each([
    [{ printing: "auto" }, true, true],
    [{ sound: "off" }, false, false],
    [{ printing: "auto", sound: "off" }, true, false],
    [{ printing: "manual" }, false, true],
  ] as const)(
    "shows the shared display, with its other features, for %o",
    async (params, automaticPrinting, sound) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

      const page = await render(params);

      expect(page.type).toBe(BatchKioskSimulator);
      expect(page.props).toEqual({
        automaticPrinting,
        sound,
        services: true,
        initialLocale: "ko",
      });
    },
  );

  it("stays the visitor's home, with no redirect loop, when the browser kiosk is switched off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "false");
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");

    for (const params of [{}, { printing: "auto" }, { sound: "off" }]) {
      const page = await render(params);
      expect(page.type).toBe(VisitorHome);
    }
    expect(redirect).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
  });
});
