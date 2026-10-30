import { describe, expect, it } from "vitest";

import { decideRoot, hasKioskPin, isNonDesktopRequest, isNonDesktopScreen } from "./phone-at-kiosk";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 15; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPAD =
  "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("isNonDesktopRequest", () => {
  it.each([
    ["iPhone", IPHONE],
    ["Android phone", ANDROID_PHONE],
    ["Android tablet without Mobile token", ANDROID_TABLET],
    ["iPad", IPAD],
    ["Firefox for Android", "Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0"],
  ])("redirects %s to the guide", (_name, agent) => {
    expect(isNonDesktopRequest(headers({ "user-agent": agent }))).toBe(true);
  });

  it.each([
    ["iPad disguised as macOS (handled by client)", IPAD_DESKTOP_MODE],
    ["Windows kiosk PC", WINDOWS],
    ["no user agent", ""],
  ])("leaves %s to the client-side check", (_name, agent) => {
    expect(isNonDesktopRequest(headers({ "user-agent": agent }))).toBe(false);
  });

  it("honors the mobile client hint", () => {
    expect(isNonDesktopRequest(headers({ "user-agent": WINDOWS, "sec-ch-ua-mobile": "?1" }))).toBe(
      true,
    );
    expect(isNonDesktopRequest(headers({ "user-agent": WINDOWS, "sec-ch-ua-mobile": "?0" }))).toBe(
      false,
    );
  });
});

describe("hasKioskPin", () => {
  it("reads only an exact pin", () => {
    expect(hasKioskPin("a=1; pc_kiosk=1; b=2")).toBe(true);
    expect(hasKioskPin("pc_kiosk=0")).toBe(false);
    expect(hasKioskPin("xpc_kiosk=1")).toBe(false);
    expect(hasKioskPin(null)).toBe(false);
  });
});

describe("decideRoot", () => {
  const phone = headers({ "user-agent": IPHONE });
  const tablet = headers({ "user-agent": ANDROID_TABLET });
  const ipad = headers({ "user-agent": IPAD });
  const pc = headers({ "user-agent": WINDOWS });
  const pinnedTablet = headers({ "user-agent": ANDROID_TABLET, cookie: "pc_kiosk=1" });
  const params = (query = "") => new URLSearchParams(query);

  it("sends phones and tablets to /start while keeping a desktop on /", () => {
    for (const device of [phone, tablet, ipad]) {
      expect(decideRoot({ searchParams: params(), headers: device })).toEqual({
        kind: "phone-guide",
      });
    }
    expect(decideRoot({ searchParams: params(), headers: pc })).toEqual({ kind: "kiosk" });
  });

  it("pins touchscreen stations with ?kiosk=1", () => {
    expect(decideRoot({ searchParams: params("kiosk=1"), headers: tablet })).toEqual({
      kind: "kiosk",
      pin: "set",
    });
    expect(decideRoot({ searchParams: params(), headers: pinnedTablet })).toEqual({
      kind: "kiosk",
    });
  });

  it("unpins with ?kiosk=0 and redirects the newly unpinned tablet", () => {
    expect(decideRoot({ searchParams: params("kiosk=0"), headers: pinnedTablet })).toEqual({
      kind: "phone-guide",
      pin: "clear",
    });
    expect(decideRoot({ searchParams: params("kiosk=0"), headers: pc })).toEqual({
      kind: "kiosk",
      pin: "clear",
    });
  });

  it("shows the kiosk once with ?view=kiosk without pinning", () => {
    for (const device of [phone, tablet, ipad]) {
      expect(decideRoot({ searchParams: params("view=kiosk"), headers: device })).toEqual({
        kind: "kiosk",
      });
    }
  });
});

describe("isNonDesktopScreen", () => {
  it("redirects touch phones and tablets in either orientation", () => {
    for (const screen of [
      { width: 393, height: 852 },
      { width: 852, height: 393 },
      { width: 744, height: 1133 },
      { width: 1133, height: 744 },
      { width: 800, height: 1280 },
      { width: 1024, height: 1366 },
      { width: 1032, height: 1376 },
    ]) {
      expect(isNonDesktopScreen(screen, true)).toBe(true);
    }
  });

  it("does not redirect a mouse-driven small desktop window", () => {
    expect(isNonDesktopScreen({ width: 390, height: 844 }, false)).toBe(false);
  });

  it("keeps large touch displays as kiosks", () => {
    expect(isNonDesktopScreen({ width: 1280, height: 1920 }, true)).toBe(false);
  });
});
