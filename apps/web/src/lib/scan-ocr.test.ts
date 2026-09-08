import { describe, expect, it } from "vitest";

import { ocrLanguagesForLocale } from "./scan-ocr";

describe("scanner OCR language selection", () => {
  it("uses only English for the English UI", () => {
    expect(ocrLanguagesForLocale("en")).toEqual(["eng"]);
  });

  it("keeps English as a secondary language for mixed Korean documents", () => {
    expect(ocrLanguagesForLocale("ko")).toEqual(["kor", "eng"]);
  });

  it("maps every supported locale to a Tesseract language", () => {
    expect(ocrLanguagesForLocale("zh-CN")).toEqual(["chi_sim", "eng"]);
    expect(ocrLanguagesForLocale("id")).toEqual(["ind", "eng"]);
    expect(ocrLanguagesForLocale("fil")).toEqual(["tgl", "eng"]);
    expect(ocrLanguagesForLocale("vi")).toEqual(["vie", "eng"]);
    expect(ocrLanguagesForLocale("th")).toEqual(["tha", "eng"]);
    expect(ocrLanguagesForLocale("ne")).toEqual(["nep", "eng"]);
    expect(ocrLanguagesForLocale("km")).toEqual(["khm", "eng"]);
    expect(ocrLanguagesForLocale("ar")).toEqual(["ara", "eng"]);
    expect(ocrLanguagesForLocale("ru")).toEqual(["rus", "eng"]);
    expect(ocrLanguagesForLocale("mn")).toEqual(["mon", "eng"]);
    expect(ocrLanguagesForLocale("uk")).toEqual(["ukr", "eng"]);
  });
});
