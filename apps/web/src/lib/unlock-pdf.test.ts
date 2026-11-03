import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { validatePdf } from "./file-validation";
import {
  containsEncryptMarker,
  containsKioskProhibitedToken,
  inspectPdfProtection,
  normalizePdfPassword,
  MAX_PDF_PASSWORD_ATTEMPTS,
  PdfPasswordCancelled,
  unlockLockedPdf,
  unlockPdf,
  type PdfJsModule,
} from "./unlock-pdf";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../test/fixtures/locked-pdf/${name}`, import.meta.url)));

const loadPdfJs = async () =>
  (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModule;

// Node has no canvas: stand in a tiny JPEG whose size follows the page.
const rasterize = async (page: {
  getViewport(o: { scale: number }): { width: number; height: number };
}) => {
  const viewport = page.getViewport({ scale: 1 });
  return {
    bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
    width: Math.round(viewport.width),
    height: Math.round(viewport.height),
  };
};

const options = { loadPdfJs, rasterize };

describe("password-protected PDF unlocking", () => {
  it.each(["user-aes256.pdf", "user-rc4.pdf"])(
    "%s needs a password, unlocks with the right one, and passes normal validation",
    async (name) => {
      const bytes = fixture(name);
      expect(containsEncryptMarker(bytes)).toBe(true);
      await expect(inspectPdfProtection(bytes, { loadPdfJs })).resolves.toBe("password");

      const progress: number[] = [];
      const unlocked = await unlockPdf(bytes, "0401", {
        ...options,
        onPage: (done) => progress.push(done),
      });
      expect(unlocked.pageCount).toBe(2);
      expect(progress).toEqual([1, 2]);
      expect(containsEncryptMarker(unlocked.bytes)).toBe(false);

      const pdfjs = await loadPdfJs();
      const reopened = await pdfjs.getDocument({ data: unlocked.bytes.slice() }).promise;
      expect(reopened.numPages).toBe(2);
      // The rebuilt PDF is what the existing pipeline accepts unchanged.
      expect(new TextDecoder("latin1").decode(unlocked.bytes)).not.toMatch(
        /\/JavaScript|\/OpenAction|\/Launch|\/EmbeddedFile|\/AA/,
      );
    },
  );

  it("rejects a wrong password without revealing anything else", async () => {
    await expect(unlockPdf(fixture("user-aes256.pdf"), "9999", options)).rejects.toThrow(
      expect.objectContaining({ code: "wrongPdfPassword" }),
    );
  });

  it("treats an empty password as wrong instead of trying it", async () => {
    expect(() => normalizePdfPassword("")).toThrow(
      expect.objectContaining({ code: "wrongPdfPassword" }),
    );
    expect(normalizePdfPassword(" 04 01 \n")).toBe(" 04 01 ");
  });

  it("unlocks an owner-only PDF that still allows printing without asking for a password", async () => {
    const bytes = fixture("owner-print-allowed.pdf");
    await expect(inspectPdfProtection(bytes, { loadPdfJs })).resolves.toBe("restricted");
    const unlocked = await unlockPdf(bytes, undefined, options);
    expect(unlocked.pageCount).toBe(2);
    expect(containsEncryptMarker(unlocked.bytes)).toBe(false);
  });

  it("refuses a PDF whose issuer switched printing off", async () => {
    const bytes = fixture("owner-print-blocked.pdf");
    await expect(inspectPdfProtection(bytes, { loadPdfJs })).resolves.toBe("printRestricted");
    await expect(unlockPdf(bytes, undefined, options)).rejects.toThrow(
      expect.objectContaining({ code: "printRestrictedPdf" }),
    );
  });

  it("refuses a password PDF whose issuer switched printing off, even with the right password", async () => {
    await expect(unlockPdf(fixture("user-print-blocked.pdf"), "0401", options)).rejects.toThrow(
      expect.objectContaining({ code: "printRestrictedPdf" }),
    );
  });

  it("reports an unencrypted PDF as unprotected", async () => {
    const plain = new TextEncoder().encode("%PDF-1.7\n%%EOF");
    await expect(inspectPdfProtection(plain, { loadPdfJs })).resolves.toBe("none");
  });

  it("keeps rejecting the original locked file in ordinary validation", async () => {
    await expect(validatePdf(fixture("user-aes256.pdf"))).rejects.toThrow(
      expect.objectContaining({ code: "lockedPdf" }),
    );
  });

  it("spots the byte runs the Windows kiosk refuses, only when a delimiter follows", () => {
    const bytes = (value: string) => new Uint8Array(Array.from(value, (c) => c.charCodeAt(0)));
    expect(containsKioskProhibitedToken(bytes("\xff\xd8/JS(\xff"))).toBe(true);
    expect(containsKioskProhibitedToken(bytes("\xff\xd8/AA"))).toBe(true);
    expect(containsKioskProhibitedToken(bytes("\xff\xd8/JSX\xff"))).toBe(false);
    // The browser validator matches /AA anywhere, even with a letter after it,
    // and also after #-escapes are decoded.
    expect(containsKioskProhibitedToken(bytes("\xff\xd8/AAB"))).toBe(true);
    expect(containsKioskProhibitedToken(bytes("\xff\xd8/#41A\xff"))).toBe(true);
    expect(containsKioskProhibitedToken(bytes("\xff\xd8\xff\xd9"))).toBe(false);
  });

  it("produces a PDF the Windows kiosk inspector will accept", async () => {
    const unlocked = await unlockPdf(fixture("user-aes256.pdf"), "0401", options);
    expect(containsKioskProhibitedToken(unlocked.bytes)).toBe(false);
  });

  it("asks again after a wrong password and unlocks on the next try", async () => {
    const requests: unknown[] = [];
    const answers = ["1111", "0401"];
    const unlocked = await unlockLockedPdf(
      fixture("user-aes256.pdf"),
      "certificate.pdf",
      async (request) => {
        requests.push(request);
        return answers.shift() ?? null;
      },
      options,
    );
    expect(unlocked.pageCount).toBe(2);
    expect(requests).toEqual([
      { fileName: "certificate.pdf", attemptsLeft: MAX_PDF_PASSWORD_ATTEMPTS },
      {
        fileName: "certificate.pdf",
        attemptsLeft: MAX_PDF_PASSWORD_ATTEMPTS - 1,
        errorKey: "wrongPdfPassword",
      },
    ]);
  });

  it("stops after the attempt limit", async () => {
    let asked = 0;
    await expect(
      unlockLockedPdf(
        fixture("user-rc4.pdf"),
        "a.pdf",
        async () => {
          asked += 1;
          return "wrong";
        },
        options,
      ),
    ).rejects.toThrow(expect.objectContaining({ code: "pdfPasswordTooManyTries" }));
    expect(asked).toBe(MAX_PDF_PASSWORD_ATTEMPTS);
  });

  it("lets the visitor cancel", async () => {
    await expect(
      unlockLockedPdf(fixture("user-aes256.pdf"), "a.pdf", async () => null, options),
    ).rejects.toBeInstanceOf(PdfPasswordCancelled);
  });

  it("never prompts for an owner-only PDF", async () => {
    let asked = 0;
    const unlocked = await unlockLockedPdf(
      fixture("owner-print-allowed.pdf"),
      "a.pdf",
      async () => {
        asked += 1;
        return null;
      },
      options,
    );
    expect(unlocked.pageCount).toBe(2);
    expect(asked).toBe(0);
  });

  it("refuses a print-restricted PDF before asking for anything", async () => {
    await expect(
      unlockLockedPdf(fixture("owner-print-blocked.pdf"), "a.pdf", async () => "x", options),
    ).rejects.toThrow(expect.objectContaining({ code: "printRestrictedPdf" }));
  });
});
