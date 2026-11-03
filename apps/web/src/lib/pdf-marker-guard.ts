import { containsRefusedPdfMarker } from "./file-validation";

/**
 * PDFs this app builds from pictures (scans, unlocked PDFs) embed raw JPEG
 * bytes. Both inspectors scan a PDF's raw bytes for active-content names and
 * neither skips image streams:
 *  - the Windows kiosk (PdfDocumentInspector.ProhibitedTokens) refuses a name
 *    followed by a PDF delimiter;
 *  - the browser validatePdf refuses a name anywhere, also after #-escapes.
 * Compressed JPEG data can spell such a name purely by chance (a three-byte
 * `/AA` turns up in roughly one 2 MB page in eight), and a clean document is
 * then refused as active content. Every embedded picture is therefore checked
 * and re-encoded at a slightly different quality until it is clean.
 */
const WINDOWS_KIOSK_TOKENS = [
  "/JavaScript",
  "/JS",
  "/OpenAction",
  "/Launch",
  "/EmbeddedFile",
  "/Filespec",
  "/AA",
  "/URI",
  "/Encrypt",
] as const;
const PDF_DELIMITERS = new Set([0, 9, 10, 12, 13, 32, 0x2f, 0x3c, 0x3e, 0x5b, 0x5d, 0x28, 0x29]);

function containsWindowsKioskToken(bytes: Uint8Array): boolean {
  const searchable = new TextDecoder("latin1").decode(bytes);
  for (const token of WINDOWS_KIOSK_TOKENS) {
    let offset = searchable.indexOf(token);
    while (offset >= 0) {
      const after = offset + token.length;
      if (after === bytes.length || PDF_DELIMITERS.has(bytes[after]!)) return true;
      offset = searchable.indexOf(token, offset + 1);
    }
  }
  return false;
}

/** True when either the Windows kiosk or the browser validator would refuse these bytes. */
export function containsKioskProhibitedToken(bytes: Uint8Array): boolean {
  return containsWindowsKioskToken(bytes) || containsRefusedPdfMarker(bytes);
}

/** Qualities tried in order; each step changes the compressed bytes. */
export function jpegQualityLadder(start: number): number[] {
  return Array.from({ length: 6 }, (_, step) => Math.round((start - step * 0.01) * 100) / 100);
}

/**
 * Encodes a picture as JPEG, retrying at nearby qualities until its bytes hold
 * no refused PDF marker. Throws `error()` if every quality is refused, which
 * in practice does not happen (about one page in a million).
 */
export async function encodePdfSafeJpeg(
  encode: (quality: number) => Promise<Blob>,
  startQuality: number,
  error: () => Error,
): Promise<{ blob: Blob; bytes: Uint8Array }> {
  for (const quality of jpegQualityLadder(startQuality)) {
    const blob = await encode(quality);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!containsKioskProhibitedToken(bytes)) return { blob, bytes };
    bytes.fill(0);
  }
  throw error();
}
