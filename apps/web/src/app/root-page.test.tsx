import { afterEach, describe, expect, it, vi } from "vitest";

const { notFound, redirect } = vi.hoisted(() => ({ notFound: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/components/kiosk/batch-kiosk-simulator", () => ({
  BatchKioskSimulator: () => null,
}));

import RootPage from "./page";

describe("root page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockReset();
    redirect.mockReset();
  });

  it("shows the browser kiosk, with its URL switches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

    const page = await RootPage({
      searchParams: Promise.resolve({ printing: "auto", sound: "off" }),
    });

    expect(redirect).not.toHaveBeenCalled();
    expect(page.props).toEqual({ automaticPrinting: true, sound: false });
  });

  it("sends visitors to the guide when the browser kiosk is switched off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "false");
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");

    await RootPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith("/start");
  });
});
