import { describe, expect, it } from "vitest";

import { ocrLanguagesForLocale } from "./scan-ocr";

describe("scanner OCR privacy boundary", () => {
  it("selects local recognition languages without constructing an OCR API request", () => {
    const languages = ocrLanguagesForLocale("ko");
    expect(languages).toEqual(["kor", "eng"]);
    expect(JSON.stringify(languages)).not.toMatch(/https?:|api|upload/iu);
  });
});
