import { describe, expect, it } from "vitest";

import { parseSupportUrl, supportConfig } from "./support-config";

describe("supportConfig", () => {
  it("is closed when nothing is configured", () => {
    expect(supportConfig({} as NodeJS.ProcessEnv)).toEqual({
      link: undefined,
      bank: undefined,
      open: false,
    });
  });

  it("accepts a plain https link and names its host", () => {
    const config = supportConfig({
      PRINT_CESS_SUPPORT_URL: " https://github.com/sponsors/club-paradiso ",
    } as unknown as NodeJS.ProcessEnv);
    expect(config.open).toBe(true);
    expect(config.link?.host).toBe("github.com");
  });

  it.each([
    "http://example.com/pay",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "https://localhost/",
    "not a url",
  ])("rejects %s", (value) => {
    expect(parseSupportUrl(value)).toBeUndefined();
  });

  it("needs a complete, well-formed bank account", () => {
    const partial = {
      PRINT_CESS_SUPPORT_BANK_NAME: "은행",
      PRINT_CESS_SUPPORT_BANK_ACCOUNT: "123-456-7890",
    };
    expect(supportConfig(partial as unknown as NodeJS.ProcessEnv).open).toBe(false);
    const full = { ...partial, PRINT_CESS_SUPPORT_BANK_HOLDER: "홍길동" };
    expect(supportConfig(full as unknown as NodeJS.ProcessEnv).bank?.holder).toBe("홍길동");
    const bad = { ...full, PRINT_CESS_SUPPORT_BANK_ACCOUNT: "<script>" };
    expect(supportConfig(bad as unknown as NodeJS.ProcessEnv).open).toBe(false);
  });
});
