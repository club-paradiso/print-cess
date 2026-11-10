import { beforeEach, describe, expect, it, vi } from "vitest";

import { convertHangulInBrowser } from "./hangul-browser-conversion";

import { validateMobileDocument } from "./mobile-document-validation";

vi.mock("./hangul-browser-conversion", () => ({
  convertHangulInBrowser: vi.fn(),
}));

function structuralHwp(properties = 0, includeScriptStream = false): File {
  const bytes = new Uint8Array(2048);
  bytes.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const view = new DataView(bytes.buffer);
  view.setUint16(0x1c, 0xfffe, true);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x38, 4096, true);
  bytes.set(utf16("FileHeader"), 512);
  bytes.set(utf16("DocInfo"), 640);
  bytes.set(new TextEncoder().encode("HWP Document File"), 1024);
  view.setUint32(1060, properties, true);
  if (includeScriptStream) bytes.set(utf16("Scripts"), 768);
  return new File([bytes], "application.hwp", { type: "application/x-hwp" });
}

function utf16(value: string): Uint8Array {
  return new Uint8Array(
    [...value].flatMap((character) => [
      character.charCodeAt(0) & 0xff,
      character.charCodeAt(0) >> 8,
    ]),
  );
}

describe("mobile HWP validation", () => {
  beforeEach(() => vi.mocked(convertHangulInBrowser).mockReset());

  it("converts legacy HWP on a browser kiosk instead of requiring native Hancom", async () => {
    vi.mocked(convertHangulInBrowser).mockImplementation(() => {
      throw new Error("renderer error");
    });
    const attempt = validateMobileDocument(structuralHwp(), { allowHwp: false });
    await expect(attempt).rejects.toMatchObject({ code: "hancomConversionFailed" });
    expect(convertHangulInBrowser).toHaveBeenCalledOnce();
  });

  it("never sends a scripted HWP into a browser renderer", async () => {
    const attempt = validateMobileDocument(structuralHwp(0, true), { allowHwp: false });
    await expect(attempt).rejects.toMatchObject({ code: "damagedFile" });
    expect(convertHangulInBrowser).not.toHaveBeenCalled();
  });

  it("keeps native HWP printing when supported, but converts on other kiosks", async () => {
    const file = structuralHwp();

    vi.mocked(convertHangulInBrowser).mockImplementation(() => {
      throw new Error("render failed");
    });
    await expect(validateMobileDocument(file)).rejects.toMatchObject({
      code: "hancomConversionFailed",
    });
    await expect(validateMobileDocument(file, { allowHwp: true })).resolves.toMatchObject({
      fileKind: "hwp",
      normalized: false,
      pageCount: 1,
    });
  });

  it("rejects protected and scripted HWP before encryption", async () => {
    await expect(
      validateMobileDocument(structuralHwp(1 << 1), { allowHwp: true }),
    ).rejects.toMatchObject({ code: "damagedFile" });
    await expect(
      validateMobileDocument(structuralHwp(0, true), { allowHwp: true }),
    ).rejects.toMatchObject({ code: "damagedFile" });
  });
});
