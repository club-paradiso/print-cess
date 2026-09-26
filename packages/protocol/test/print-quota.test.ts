import { describe, expect, it } from "vitest";

import {
  PUBLIC_FREE_PAGE_LIMIT,
  PrintQuotaError,
  SYSTEM_MAX_PAGE_LIMIT,
  decidePrintQuota,
  printQuotaLogRecord,
  type PrintQuotaDocument,
} from "../src/index.js";

const pdf = (pages: number): PrintQuotaDocument => ({ pages, exact: true });
const image = (): PrintQuotaDocument => ({ pages: 1, exact: true });
/** HWP and HWPX: the phone knows a floor, not a count. */
const hangul = (): PrintQuotaDocument => ({ pages: 1, exact: false });

describe("print quota policy", () => {
  it("keeps the courtesy limit and the technical ceiling as different numbers", () => {
    expect(PUBLIC_FREE_PAGE_LIMIT).toBe(11);
    expect(SYSTEM_MAX_PAGE_LIMIT).toBe(50);
    expect(PUBLIC_FREE_PAGE_LIMIT).toBeLessThan(SYSTEM_MAX_PAGE_LIMIT);
  });

  describe("a single PDF", () => {
    it.each([1, 10, 11])("allows %i pages", (pages) => {
      expect(decidePrintQuota([pdf(pages)])).toMatchObject({ kind: "allowed", totalPages: pages });
    });

    it.each([12, 49, 50])("asks for staff authorization at %i pages", (pages) => {
      expect(decidePrintQuota([pdf(pages)])).toMatchObject({
        kind: "staffOverrideRequired",
        totalPages: pages,
        publicLimit: 11,
        systemLimit: 50,
      });
    });

    it("refuses 51 pages outright", () => {
      expect(decidePrintQuota([pdf(51)])).toMatchObject({
        kind: "hardLimitExceeded",
        totalPages: 51,
      });
    });
  });

  describe("images", () => {
    it("allows eleven images", () => {
      const decision = decidePrintQuota(Array.from({ length: 11 }, image));
      expect(decision).toMatchObject({ kind: "allowed", totalPages: 11 });
    });

    it("asks for staff authorization at twelve images", () => {
      const decision = decidePrintQuota(Array.from({ length: 12 }, image));
      expect(decision).toMatchObject({ kind: "staffOverrideRequired", totalPages: 12 });
    });
  });

  describe("a mixed batch", () => {
    // The bypass this policy exists to close: each file passes on its own, and
    // only the total is over the line.
    it("sums every document rather than judging them one at a time", () => {
      expect(decidePrintQuota([pdf(7), image(), pdf(3)])).toMatchObject({
        kind: "allowed",
        totalPages: 11,
      });
      expect(decidePrintQuota([pdf(7), image(), pdf(4)])).toMatchObject({
        kind: "staffOverrideRequired",
        totalPages: 12,
      });
    });
  });

  describe("staff override", () => {
    it.each([12, 50])("prints %i pages once staff authorize it", (pages) => {
      expect(decidePrintQuota([pdf(pages)], { staffOverride: true })).toMatchObject({
        kind: "allowed",
        overridden: true,
        totalPages: pages,
      });
    });

    it("cannot raise the technical ceiling", () => {
      expect(decidePrintQuota([pdf(51)], { staffOverride: true })).toMatchObject({
        kind: "hardLimitExceeded",
        overridden: false,
      });
    });

    it("is not recorded on a request that was already within the free limit", () => {
      expect(decidePrintQuota([pdf(5)], { staffOverride: true })).toMatchObject({
        kind: "allowed",
        overridden: false,
      });
    });
  });

  describe("documents whose pagination only the kiosk can settle", () => {
    it("flags the total as a floor rather than a count", () => {
      const decision = decidePrintQuota([hangul()]);
      expect(decision).toMatchObject({ kind: "allowed", hasUnverifiedPagination: true });
    });

    it("does not let a verified batch inherit the flag", () => {
      expect(decidePrintQuota([pdf(4), image()]).hasUnverifiedPagination).toBe(false);
    });

    it("still counts the floor toward the total", () => {
      expect(decidePrintQuota([pdf(11), hangul()])).toMatchObject({
        kind: "staffOverrideRequired",
        totalPages: 12,
      });
    });
  });

  describe("rejected inputs", () => {
    it("refuses an empty print session", () => {
      expect(() => decidePrintQuota([])).toThrow(PrintQuotaError);
    });

    it.each([0, -1, 1.5, Number.NaN])("refuses %s as a page count", (pages) => {
      expect(() => decidePrintQuota([{ pages, exact: true }])).toThrow(PrintQuotaError);
    });
  });

  describe("log record", () => {
    it("carries the decision and no document detail", () => {
      const record = printQuotaLogRecord(decidePrintQuota([pdf(37)], { staffOverride: true }));
      expect(record).toStrictEqual({
        totalPages: 37,
        publicPageLimit: 11,
        systemPageLimit: 50,
        quotaDecision: "allowed",
        quotaOverride: true,
        overrideType: "staff",
        paginationVerified: true,
      });
    });

    it("names no override type when none was used", () => {
      expect(printQuotaLogRecord(decidePrintQuota([pdf(2)]))).toMatchObject({
        quotaOverride: false,
        overrideType: null,
      });
    });
  });
});
