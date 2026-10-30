import { afterEach, describe, expect, it, vi } from "vitest";

const { notFound, redirect } = vi.hoisted(() => ({ notFound: vi.fn(), redirect: vi.fn() }));

vi.mock("next/navigation", () => ({ notFound, redirect }));
vi.mock("@/components/kiosk/batch-kiosk-simulator", () => ({
  BatchKioskSimulator: () => null,
}));
vi.mock("@/components/kiosk/phone-fallback-redirect", () => ({
  PhoneFallbackRedirect: () => null,
}));

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "accept-language": "ko-KR,ko;q=0.9" })),
}));

import type { ReactElement } from "react";

import { BatchKioskSimulator } from "@/components/kiosk/batch-kiosk-simulator";
import { PhoneFallbackRedirect } from "@/components/kiosk/phone-fallback-redirect";

import RootPage from "./page";

function parts(page: unknown) {
  const children = (page as ReactElement<{ children: unknown[] }>).props.children;
  const list = (Array.isArray(children) ? children : [children]) as (ReactElement | null)[];
  return {
    kiosk: list.find((child) => child?.type === BatchKioskSimulator),
    fallback: list.find((child) => child?.type === PhoneFallbackRedirect),
  };
}

describe("root page", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    notFound.mockReset();
    redirect.mockReset();
  });

  it("shows the browser kiosk with links to the other features, and its URL switches", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

    const page = await RootPage({
      searchParams: Promise.resolve({ printing: "auto", sound: "off" }),
    });

    expect(redirect).not.toHaveBeenCalled();
    const { kiosk, fallback } = parts(page);
    expect(fallback).toBeDefined();
    expect(kiosk?.props).toEqual({
      automaticPrinting: true,
      sound: false,
      services: true,
      initialLocale: "ko",
    });
  });

  it("skips the phone check for a pinned station or a one-off big-screen view", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "true");

    for (const query of [{ kiosk: "1" }, { view: "kiosk" }]) {
      const page = await RootPage({ searchParams: Promise.resolve(query) });
      const { kiosk, fallback } = parts(page);
      expect(kiosk).toBeDefined();
      expect(fallback).toBeUndefined();
    }
  });

  it("sends visitors to the guide when the browser kiosk is switched off", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "false");
    vi.stubEnv("ENABLE_DEMO_ROUTES", "false");

    await RootPage({ searchParams: Promise.resolve({}) });

    expect(redirect).toHaveBeenCalledWith("/start");
  });
});
