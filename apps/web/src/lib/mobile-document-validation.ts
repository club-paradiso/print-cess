import { MAX_PLAINTEXT_BYTES } from "@print-cess/protocol";

import {
  FileValidationError,
  readSelectedFileBytes,
  validateFileForMobile,
  validatePdf,
  type ValidatedMobileFile,
} from "./file-validation";
import { convertHangulInBrowser } from "./hangul-browser-conversion";
import { isHwpSelection, validateHwpHeader } from "./hwp-validation";
import { isHwpxSelection, validateHwpxHeader } from "./hwpx-validation";
import { needsKioskPdfNormalization } from "./pdf-marker-guard";
import { unlockPdf } from "./unlock-pdf";

export { FileValidationError } from "./file-validation";
export type { ValidatedMobileFile } from "./file-validation";

/**
 * Renders a PDF's printable page appearances into a new safe PDF. A source
 * accepted by PDF.js but rejected by the kiosk cannot pass straight through.
 * Text/links/scripts/attachments are not retained; the preview uses the same
 * normalized bytes that are sent to the printer.
 */
async function normalizePdfForKiosk(bytes: Uint8Array): Promise<ValidatedMobileFile> {
  const safe = await unlockPdf(bytes, undefined);
  try {
    if (needsKioskPdfNormalization(safe.bytes)) throw new FileValidationError("damagedFile");
    const pages = await validatePdf(safe.bytes);
    if (pages !== safe.pageCount) throw new FileValidationError("damagedFile");
    return { bytes: safe.bytes, fileKind: "pdf", pageCount: pages, normalized: true };
  } catch (error) {
    safe.bytes.fill(0);
    throw error;
  }
}

function hasPdfHeaderWithinPreamble(bytes: Uint8Array): boolean {
  const prefix = new TextDecoder("ascii").decode(bytes.subarray(0, 1024));
  return /%PDF-[12]\\.[0-9]/u.test(prefix);
}

export async function validateMobileDocument(
  file: File,
  options: { allowHwp?: boolean; allowHwpx?: boolean; trustedGeneratedPdf?: boolean } = {},
): Promise<ValidatedMobileFile> {
  const hwpx = isHwpxSelection(file);
  const hwp = !hwpx && isHwpSelection(file);
  if (!hwpx && !hwp) {
    let validated: ValidatedMobileFile;
    try {
      validated = await validateFileForMobile(file, {
        ...(options.allowHwpx === undefined ? {} : { allowHwpx: options.allowHwpx }),
        ...(options.trustedGeneratedPdf === undefined
          ? {}
          : { trustedGeneratedPdf: options.trustedGeneratedPdf }),
      });
    } catch (error) {
      if (
        !(error instanceof FileValidationError) ||
        (error.code !== "damagedFile" && error.code !== "unsupportedType")
      ) {
        throw error;
      }
      // PDF.js can repair certain malformed cross-references and accept
      // a legitimate PDF with a header after a small preamble. The Windows
      // kiosk requires a canonical first-byte header and EOF near the end.
      // The recovered file is *always* rasterized, never forwarded unchanged.
      if (
        error.code === "unsupportedType" &&
        file.type !== "application/pdf" &&
        !/\\.pdf$/iu.test(file.name)
      ) {
        throw error;
      }
      if (file.size > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
      const original = await readSelectedFileBytes(file);
      try {
        if (original.byteLength > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
        if (!hasPdfHeaderWithinPreamble(original)) throw error;
        try {
          return await normalizePdfForKiosk(original);
        } catch (conversionError) {
          // If the PDF engine asks for a password that was not detected by
          // the lightweight marker scan, use the existing local password flow.
          if (
            conversionError instanceof FileValidationError &&
            conversionError.code === "wrongPdfPassword"
          ) {
            throw new FileValidationError("lockedPdf");
          }
          throw conversionError;
        }
      } finally {
        original.fill(0);
      }
    }

    if (validated.fileKind === "pdf" && needsKioskPdfNormalization(validated.bytes)) {
      try {
        return await normalizePdfForKiosk(validated.bytes);
      } finally {
        validated.bytes.fill(0);
      }
    }
    return validated;
  }

  if (file.size > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
  const bytes = await readSelectedFileBytes(file);
  if (bytes.byteLength > MAX_PLAINTEXT_BYTES) {
    bytes.fill(0);
    throw new FileValidationError("tooLarge");
  }

  try {
    if (hwpx) validateHwpxHeader(bytes);
    else validateHwpHeader(bytes);
  } catch {
    bytes.fill(0);
    throw new FileValidationError("damagedFile");
  }

  // A licensed Windows kiosk can still print the original document directly.
  // Every other kiosk receives a locally rendered, verified PDF instead.
  if ((hwp && options.allowHwp) || (hwpx && options.allowHwpx)) {
    return { bytes, fileKind: hwpx ? "hwpx" : "hwp", pageCount: 1, normalized: false };
  }

  let pdf: Uint8Array | undefined;
  let preservePdf = false;
  try {
    pdf = await convertHangulInBrowser(bytes);
    if (pdf.byteLength > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
    if (needsKioskPdfNormalization(pdf)) return await normalizePdfForKiosk(pdf);
    const pageCount = await validatePdf(pdf);
    preservePdf = true;
    return { bytes: pdf, fileKind: "pdf", pageCount, normalized: true };
  } catch (error) {
    if (error instanceof FileValidationError && error.code === "tooLarge") throw error;
    throw new FileValidationError("hancomConversionFailed");
  } finally {
    if (!preservePdf) pdf?.fill(0);
    bytes.fill(0);
  }
}
