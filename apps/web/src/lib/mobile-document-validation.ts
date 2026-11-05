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

export { FileValidationError } from "./file-validation";
export type { ValidatedMobileFile } from "./file-validation";

export async function validateMobileDocument(
  file: File,
  options: { allowHwp?: boolean; allowHwpx?: boolean; trustedGeneratedPdf?: boolean } = {},
): Promise<ValidatedMobileFile> {
  const hwpx = isHwpxSelection(file);
  const hwp = !hwpx && isHwpSelection(file);
  if (!hwpx && !hwp) {
    return validateFileForMobile(file, {
      ...(options.allowHwpx === undefined ? {} : { allowHwpx: options.allowHwpx }),
      ...(options.trustedGeneratedPdf === undefined
        ? {}
        : { trustedGeneratedPdf: options.trustedGeneratedPdf }),
    });
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
  // Every other kiosk receives a locally rendered, verified PDF instead;
  // neither the server nor the kiosk needs to understand HWP/HWPX.
  if ((hwp && options.allowHwp) || (hwpx && options.allowHwpx)) {
    return { bytes, fileKind: hwpx ? "hwpx" : "hwp", pageCount: 1, normalized: false };
  }

  let pdf: Uint8Array | undefined;
  try {
    pdf = await convertHangulInBrowser(bytes);
    if (pdf.byteLength > MAX_PLAINTEXT_BYTES) throw new FileValidationError("tooLarge");
    const pageCount = await validatePdf(pdf);
    return { bytes: pdf, fileKind: "pdf", pageCount, normalized: true };
  } catch (error) {
    pdf?.fill(0);
    if (error instanceof FileValidationError && error.code === "tooLarge") throw error;
    throw new FileValidationError("hancomConversionFailed");
  } finally {
    bytes.fill(0);
  }
}
