import { describe, expect, it } from "vitest";

import { restrictBrowserPrintCapabilities } from "./browser-print-capabilities";

describe("browser kiosk print capabilities", () => {
  it("never advertises HWP or HWPX even if the request claims native support", () => {
    const input = {
      protocolVersion: 1 as const,
      kioskPublicKey: "test-public-key",
      kioskPublicKeyFingerprint: "test-fingerprint",
      supportsHwp: true,
      supportsHwpx: true,
      supportsBundle: false,
    };
    expect(restrictBrowserPrintCapabilities(input)).toEqual({
      ...input,
      supportsHwp: false,
      supportsHwpx: false,
      supportsBundle: true,
    });
  });

  it("preserves all non-capability session credentials", () => {
    const input = {
      protocolVersion: 1,
      kioskPublicKey: "public",
      kioskPublicKeyFingerprint: "fingerprint",
    };
    expect(restrictBrowserPrintCapabilities(input)).toEqual({
      ...input,
      supportsHwp: false,
      supportsHwpx: false,
      supportsBundle: true,
    });
  });
});
