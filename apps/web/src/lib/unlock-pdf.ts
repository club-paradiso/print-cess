import { MAX_PLAINTEXT_BYTES } from "@print-cess/protocol";

import { FileValidationError } from "./file-validation";
import { containsKioskProhibitedToken, encodePdfSafeJpeg } from "./pdf-marker-guard";
import { buildScannedPdf, type PdfImagePage } from "./scan-pdf";

/**
 * Password-protected PDFs (정부24 and other issuers often save documents this
 * way) are unlocked on the visitor's phone, never on the kiosk or the server.
 *
 * The phone asks for the password, opens the PDF with PDF.js, draws every page
 * to a picture and builds a fresh, unencrypted image PDF from those pictures.
 * Only that rebuilt PDF goes through the normal end-to-end encrypted upload, so
 * the password itself never leaves the phone and the kiosk, server and blob
 * store never see it. Rasterising also drops any scripts, forms or embedded
 * files the original carried, because only page pictures survive.
 *
 * A PDF whose issuer switched printing off is refused rather than unlocked:
 * removing a restriction the issuer set on purpose is a policy decision, not a
 * convenience this kiosk makes on the visitor's behalf.
 */

export type PdfProtection =
  /** No /Encrypt dictionary at all. */
  | "none"
  /** An open (user) password is required before any page can be read. */
  | "password"
  /** Opens without a password, but carries an owner password that allows printing. */
  | "restricted"
  /** Opens without a password, but the issuer has switched printing off. */
  | "printRestricted";

export const MAX_PDF_PASSWORD_ATTEMPTS = 5;
/** Same long edge the Windows kiosk uses when it rasterises a PDF page (A4 at ~200 dpi). */
export const UNLOCK_LONG_EDGE_PIXELS = 2_339;
const JPEG_QUALITY = 0.9;
const MAX_PDF_PASSWORD_LENGTH = 128;

/** PDF.js permission flags (PermissionFlag in pdfjs-dist/shared/util). */
const PERMISSION_PRINT = 0x04;
const PERMISSION_PRINT_HIGH_QUALITY = 0x800;
/** PDF.js PasswordResponses. */
const NEED_PASSWORD = 1;
const INCORRECT_PASSWORD = 2;

type PdfJsPage = {
  getViewport(options: { scale: number }): { width: number; height: number };
  render(options: Record<string, unknown>): { promise: Promise<unknown> };
  cleanup(): unknown;
};

type PdfJsDocument = {
  numPages: number;
  getPermissions(): Promise<Set<number> | readonly number[] | null>;
  getPage(pageNumber: number): Promise<PdfJsPage>;
  cleanup(): Promise<unknown> | unknown;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocument>;
  onPassword: ((update: (password: string) => void, reason: number) => void) | null;
  destroy(): Promise<unknown>;
};

export type PdfJsModule = {
  getDocument(source: Record<string, unknown>): PdfJsLoadingTask;
};

/** Draws one PDF page into a JPEG. Injected in tests, where there is no canvas. */
export type PageRasterizer = (page: PdfJsPage) => Promise<PdfImagePage>;

export type UnlockOptions = {
  loadPdfJs?: () => Promise<PdfJsModule>;
  rasterize?: PageRasterizer;
  /** Called after each page, so the UI can show progress on long documents. */
  onPage?: (done: number, total: number) => void;
};

export { containsKioskProhibitedToken } from "./pdf-marker-guard";

export function containsEncryptMarker(bytes: Uint8Array): boolean {
  const searchable = new TextDecoder("latin1").decode(bytes);
  return (
    searchable.includes("/Encrypt") ||
    searchable
      .replace(/#([0-9a-fA-F]{2})/g, (_, hex: string) =>
        String.fromCharCode(Number.parseInt(hex, 16)),
      )
      .includes("/Encrypt")
  );
}

async function loadBrowserPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs as unknown as PdfJsModule;
}

type OpenOutcome =
  | { kind: "opened"; task: PdfJsLoadingTask; document: PdfJsDocument }
  | { kind: "needsPassword" }
  | { kind: "wrongPassword" };

async function openPdf(
  pdfjs: PdfJsModule,
  bytes: Uint8Array,
  password: string | undefined,
): Promise<OpenOutcome> {
  const task = pdfjs.getDocument({
    data: bytes.slice(),
    ...(password === undefined ? {} : { password }),
    stopAtErrors: true,
    enableXfa: false,
    isEvalSupported: false,
    disableAutoFetch: true,
    disableStream: true,
    disableFontFace: true,
  });
  let passwordReason: number | undefined;
  task.onPassword = (_update, reason) => {
    // Never retry inside PDF.js: one attempt per visitor action, so the
    // attempt limit below is the only place a password is ever tried.
    passwordReason = reason;
    void task.destroy();
  };
  try {
    const document = await task.promise;
    return { kind: "opened", task, document };
  } catch (error) {
    await task.destroy().catch(() => undefined);
    const name = error instanceof Error ? error.name : "";
    const code = (error as { code?: unknown } | null)?.code;
    if (passwordReason === INCORRECT_PASSWORD || code === INCORRECT_PASSWORD)
      return { kind: "wrongPassword" };
    if (
      passwordReason === NEED_PASSWORD ||
      code === NEED_PASSWORD ||
      name === "PasswordException" ||
      String(error).toLowerCase().includes("password")
    ) {
      return password ? { kind: "wrongPassword" } : { kind: "needsPassword" };
    }
    throw new FileValidationError("damagedFile");
  }
}

async function printAllowed(document: PdfJsDocument): Promise<boolean> {
  const permissions = await document.getPermissions();
  if (permissions === null) return true;
  const flags = permissions instanceof Set ? permissions : new Set(permissions);
  return flags.has(PERMISSION_PRINT) || flags.has(PERMISSION_PRINT_HIGH_QUALITY);
}

async function close(outcome: Extract<OpenOutcome, { kind: "opened" }>): Promise<void> {
  try {
    await outcome.document.cleanup();
  } finally {
    await outcome.task.destroy().catch(() => undefined);
  }
}

/** Classifies a PDF that failed ordinary validation because it is encrypted. */
export async function inspectPdfProtection(
  bytes: Uint8Array,
  options: Pick<UnlockOptions, "loadPdfJs"> = {},
): Promise<PdfProtection> {
  if (!containsEncryptMarker(bytes)) return "none";
  const pdfjs = await (options.loadPdfJs ?? loadBrowserPdfJs)();
  const outcome = await openPdf(pdfjs, bytes, undefined);
  if (outcome.kind !== "opened") return "password";
  try {
    return (await printAllowed(outcome.document)) ? "restricted" : "printRestricted";
  } finally {
    await close(outcome);
  }
}

export function normalizePdfPassword(password: string): string {
  // Keep the visitor's password exactly as typed, except for an accidental
  // trailing newline from a paste. Do not trim spaces: they may be part of it.
  const value = password.replace(/[\r\n]+$/u, "");
  if (value.length === 0 || value.length > MAX_PDF_PASSWORD_LENGTH)
    throw new FileValidationError("wrongPdfPassword");
  return value;
}

/**
 * Opens a protected PDF with the visitor's password and returns a new,
 * unencrypted image PDF of every page. Throws FileValidationError:
 *  - wrongPdfPassword   the password did not open the file
 *  - printRestrictedPdf the issuer switched printing off
 *  - tooLarge           the rebuilt PDF would exceed the upload limit
 *  - damagedFile        PDF.js could not read or draw a page
 */
export async function unlockPdf(
  bytes: Uint8Array,
  password: string | undefined,
  options: UnlockOptions = {},
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const pdfjs = await (options.loadPdfJs ?? loadBrowserPdfJs)();
  const outcome = await openPdf(
    pdfjs,
    bytes,
    password === undefined ? undefined : normalizePdfPassword(password),
  );
  if (outcome.kind === "wrongPassword") throw new FileValidationError("wrongPdfPassword");
  if (outcome.kind === "needsPassword") throw new FileValidationError("wrongPdfPassword");

  const pages: PdfImagePage[] = [];
  try {
    if (!(await printAllowed(outcome.document)))
      throw new FileValidationError("printRestrictedPdf");
    const total = outcome.document.numPages;
    if (total < 1) throw new FileValidationError("damagedFile");
    const rasterize = options.rasterize ?? rasterizeWithCanvas;
    let size = 0;
    for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
      const page = await outcome.document.getPage(pageNumber);
      try {
        const image = await rasterize(page);
        size += image.bytes.byteLength;
        if (size > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
        pages.push(image);
      } finally {
        page.cleanup();
      }
      options.onPage?.(pageNumber, total);
    }
    const rebuilt = buildScannedPdf(pages);
    if (rebuilt.byteLength > MAX_PLAINTEXT_BYTES) {
      rebuilt.fill(0);
      throw new FileValidationError("tooLarge");
    }
    // Fail closed on the phone rather than let the kiosk refuse it later.
    if (containsKioskProhibitedToken(rebuilt)) {
      rebuilt.fill(0);
      throw new FileValidationError("damagedFile");
    }
    return { bytes: rebuilt, pageCount: total };
  } catch (error) {
    if (error instanceof FileValidationError) throw error;
    throw new FileValidationError("damagedFile");
  } finally {
    for (const page of pages) page.bytes.fill(0);
    await close(outcome);
  }
}

/** Browser rasteriser: one reused canvas, white background, JPEG output. */
export async function rasterizeWithCanvas(page: PdfJsPage): Promise<PdfImagePage> {
  const base = page.getViewport({ scale: 1 });
  const scale = UNLOCK_LONG_EDGE_PIXELS / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new FileValidationError("damagedFile");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    const { bytes } = await encodePdfSafeJpeg(
      (quality) =>
        new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("toBlob failed"))),
            "image/jpeg",
            quality,
          ),
        ),
      JPEG_QUALITY,
      () => new FileValidationError("damagedFile"),
    );
    return { bytes, width: canvas.width, height: canvas.height };
  } finally {
    // Release the backing store right away; iOS Safari caps total canvas memory.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export type PdfPasswordRequest = {
  fileName: string;
  /** Set after a failed attempt so the prompt can say why it is asking again. */
  errorKey?: "wrongPdfPassword";
  attemptsLeft: number;
};

/** Resolves with the typed password, or null when the visitor gives up. */
export type PdfPasswordPrompt = (request: PdfPasswordRequest) => Promise<string | null>;

export class PdfPasswordCancelled extends Error {
  constructor() {
    super("PDF password entry cancelled");
    this.name = "PdfPasswordCancelled";
  }
}

/**
 * Turns a PDF that ordinary validation refused as `lockedPdf` into a printable,
 * unencrypted PDF, asking for the password at most MAX_PDF_PASSWORD_ATTEMPTS
 * times. The caller zeroes the original bytes; the result is a new buffer.
 */
export async function unlockLockedPdf(
  bytes: Uint8Array,
  fileName: string,
  prompt: PdfPasswordPrompt,
  options: UnlockOptions = {},
): Promise<{ bytes: Uint8Array; pageCount: number }> {
  const protection = await inspectPdfProtection(bytes, options);
  if (protection === "none") throw new FileValidationError("damagedFile");
  if (protection === "printRestricted") throw new FileValidationError("printRestrictedPdf");
  if (protection === "restricted") return unlockPdf(bytes, undefined, options);

  let errorKey: PdfPasswordRequest["errorKey"];
  for (let attempt = 0; attempt < MAX_PDF_PASSWORD_ATTEMPTS; attempt += 1) {
    const password = await prompt({
      fileName,
      attemptsLeft: MAX_PDF_PASSWORD_ATTEMPTS - attempt,
      ...(errorKey ? { errorKey } : {}),
    });
    if (password === null) throw new PdfPasswordCancelled();
    try {
      return await unlockPdf(bytes, password, options);
    } catch (error) {
      if (error instanceof FileValidationError && error.code === "wrongPdfPassword") {
        errorKey = "wrongPdfPassword";
        continue;
      }
      throw error;
    }
  }
  throw new FileValidationError("pdfPasswordTooManyTries");
}
