import type { PrintQuotaDocument } from "@print-cess/protocol";

import type { ValidatedMobileFile } from "./file-validation";

/**
 * Turns a validated selection into the quota's view of it, carrying the
 * distinction between a page count and a floor rather than flattening both to
 * a number. Both mobile flows go through here so they cannot drift apart.
 */
export function quotaDocument(validated: ValidatedMobileFile): PrintQuotaDocument {
  return { pages: validated.pageCount, exact: validated.pageCountIsExact };
}
