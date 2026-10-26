import { describe, expect, it } from "vitest";

import { decideRoot, hasKioskPin, isPhoneRequest, isPhoneScreen } from "./phone-at-kiosk";

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE =
  "Mozilla/5.0 (Linux; Android 15; SM-S921N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ANDROID_TABLET =
  "Mozilla/5.0 (Linux; Android 15; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPAD =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";
const WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("isPhoneRequest", () => {
  it.each([
    ["iPhone", IPHONE],
    ["Android phone", ANDROID_PHONE],
    ["Firefox for Android", "Mozilla/5.0 (Android 15; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0"],
  ])("treats %s as a phone", (_name, agent) => {
    expect(isPhoneRequest(headers({ "user-agent": agent }))).toBe(true);
  });

  it.each([
    ["Android tablet", ANDROID_TABLET],
    ["iPad (desktop user agent)", IPAD],
    ["Windows kiosk PC", WINDOWS],
    ["no user agent", ""],
  ])("keeps %s on the kiosk", (_name, agent) => {
    expect(isPhoneRequest(headers({ "user-agent": agent }))).toBe(false);
  });

  it("trusts the mobile client hint", () => {
    expect(isPhoneRequest(headers({ "user-agent": WINDOWS, "sec-ch-ua-mobile": "?1" }))).toBe(true);
    expect(isPhoneRequest(headers({ "user-agent": WINDOWS, "sec-ch-ua-mobile": "?0" }))).toBe(
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
  const pc = headers({ "user-agent": WINDOWS });
  const pinnedPhone = headers({ "user-agent": IPHONE, cookie: "pc_kiosk=1" });
  const params = (query = "") => new URLSearchParams(query);

  it("sends a phone to the guide and keeps a PC on the kiosk", () => {
    expect(decideRoot({ searchParams: params(), headers: phone })).toEqual({ kind: "phone-guide" });
    expect(decideRoot({ searchParams: params(), headers: pc })).toEqual({ kind: "kiosk" });
  });

  it("pins with ?kiosk=1 and then stays on the kiosk", () => {
    expect(decideRoot({ searchParams: params("kiosk=1"), headers: phone })).toEqual({
      kind: "kiosk",
      pin: "set",
    });
    expect(decideRoot({ searchParams: params(), headers: pinnedPhone })).toEqual({ kind: "kiosk" });
  });

  it("unpins with ?kiosk=0", () => {
    expect(decideRoot({ searchParams: params("kiosk=0"), headers: pinnedPhone })).toEqual({
      kind: "phone-guide",
      pin: "clear",
    });
    expect(decideRoot({ searchParams: params("kiosk=0"), headers: pc })).toEqual({
      kind: "kiosk",
      pin: "clear",
    });
  });

  it("shows the big screen once for ?view=kiosk without pinning", () => {
    expect(decideRoot({ searchParams: params("view=kiosk"), headers: phone })).toEqual({
      kind: "kiosk",
    });
  });
});

describe("isPhoneScreen", () => {
  it("treats a phone as a phone in either orientation", () => {
    expect(isPhoneScreen({ width: 393, height: 852 }, true)).toBe(true);
    expect(isPhoneScreen({ width: 852, height: 393 }, true)).toBe(true);
  });

  it("keeps tablets, including an iPad mini in portrait, on the kiosk", () => {
    expect(isPhoneScreen({ width: 744, height: 1133 }, true)).toBe(false);
    expect(isPhoneScreen({ width: 800, height: 1280 }, true)).toBe(false);
  });

  it("never redirects a mouse-driven screen, however small", () => {
    expect(isPhoneScreen({ width: 390, height: 844 }, false)).toBe(false);
  });
});
