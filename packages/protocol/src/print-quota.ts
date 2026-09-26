/**
 * Two different numbers govern how much a visitor may print, and conflating
 * them is the mistake this module exists to prevent.
 *
 * `SYSTEM_MAX_PAGE_LIMIT` is what the kiosk can render and submit safely. It is
 * a property of the machine, so nobody overrides it.
 *
 * `PUBLIC_FREE_PAGE_LIMIT` is what a walk-up visitor may print without asking.
 * It is a service policy, so staff can override it for legitimate work.
 *
 * Keeping them as one constant would mean that relaxing the courtesy limit also
 * raises the technical ceiling, and that tightening the ceiling silently
 * changes the public offer.
 */
export const PUBLIC_FREE_PAGE_LIMIT = 11;
export const SYSTEM_MAX_PAGE_LIMIT = 50;

/**
 * One document's contribution to a print session.
 *
 * `exact` is false when the number is a floor rather than a fact. Hangul
 * decides HWP and HWPX pagination while rendering, and only the kiosk runs
 * Hangul — so a phone can say "at least one page" and nothing stronger. The
 * flag exists so that a floor is never mistaken for a count; see
 * `docs/PRINT_QUOTA.md`.
 */
export type PrintQuotaDocument = {
  pages: number;
  exact: boolean;
};

export type PrintQuotaDecisionKind = "allowed" | "staffOverrideRequired" | "hardLimitExceeded";

export type PrintQuotaDecision = {
  kind: PrintQuotaDecisionKind;
  /** Sum of the counts supplied. A floor if `hasUnverifiedPagination` is true. */
  totalPages: number;
  publicLimit: number;
  systemLimit: number;
  /** At least one document's real page count is only knowable at the kiosk. */
  hasUnverifiedPagination: boolean;
  /** A staff authorization turned a blocked request into an allowed one. */
  overridden: boolean;
};

export type PrintQuotaOptions = {
  /**
   * Set only where the authorization was actually performed. The browser must
   * never set this from a client-supplied value: the kiosk re-decides on its
   * own rendered page count and its own staff authentication.
   */
  staffOverride?: boolean;
};

export function decidePrintQuota(
  documents: readonly PrintQuotaDocument[],
  options: PrintQuotaOptions = {},
): PrintQuotaDecision {
  let totalPages = 0;
  let hasUnverifiedPagination = false;
  for (const document of documents) {
    if (!Number.isInteger(document.pages) || document.pages < 1) {
      throw new PrintQuotaError("A document must contribute at least one whole page");
    }
    totalPages += document.pages;
    if (!document.exact) hasUnverifiedPagination = true;
  }
  if (documents.length === 0) {
    throw new PrintQuotaError("A print session must contain at least one document");
  }

  const base = {
    totalPages,
    publicLimit: PUBLIC_FREE_PAGE_LIMIT,
    systemLimit: SYSTEM_MAX_PAGE_LIMIT,
    hasUnverifiedPagination,
  };

  // The technical ceiling is checked first and on purpose: no authorization
  // exists that makes the machine able to print more than it can print.
  if (totalPages > SYSTEM_MAX_PAGE_LIMIT) {
    return { ...base, kind: "hardLimitExceeded", overridden: false };
  }
  if (totalPages > PUBLIC_FREE_PAGE_LIMIT) {
    return options.staffOverride
      ? { ...base, kind: "allowed", overridden: true }
      : { ...base, kind: "staffOverrideRequired", overridden: false };
  }
  return { ...base, kind: "allowed", overridden: false };
}

/**
 * The shape written to operational logs. It carries the decision and nothing
 * about the documents themselves — no filenames, no content, no credential.
 */
export type PrintQuotaLogRecord = {
  totalPages: number;
  publicPageLimit: number;
  systemPageLimit: number;
  quotaDecision: PrintQuotaDecisionKind;
  quotaOverride: boolean;
  overrideType: "staff" | null;
  paginationVerified: boolean;
};

export function printQuotaLogRecord(decision: PrintQuotaDecision): PrintQuotaLogRecord {
  return {
    totalPages: decision.totalPages,
    publicPageLimit: decision.publicLimit,
    systemPageLimit: decision.systemLimit,
    quotaDecision: decision.kind,
    quotaOverride: decision.overridden,
    overrideType: decision.overridden ? "staff" : null,
    paginationVerified: !decision.hasUnverifiedPagination,
  };
}

export class PrintQuotaError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "PrintQuotaError";
  }
}
