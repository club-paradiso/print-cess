import { describe, expect, it } from "vitest";

import { parseSupportUrl, parseTossSendUrl, supportConfig } from "./support-config";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;
const BANK = {
  PRINT_CESS_SUPPORT_BANK_NAME: "예시은행",
  PRINT_CESS_SUPPORT_BANK_ACCOUNT: "0001112223",
};
const TOSS =
  "supertoss://send?amount=0&bank=%EC%98%88%EC%8B%9C%EC%9D%80%ED%96%89&accountNo=0001112223&origin=qr";

describe("supportConfig", () => {
  it("is closed when nothing is configured", () => {
    expect(supportConfig(env({}))).toEqual({
      link: undefined,
      bank: undefined,
      toss: undefined,
      open: false,
    });
  });

  it("accepts a plain https link and names its host", () => {
    const config = supportConfig(
      env({ PRINT_CESS_SUPPORT_URL: " https://buymeacoffee.com/example " }),
    );
    expect(config.open).toBe(true);
    expect(config.link?.host).toBe("buymeacoffee.com");
  });

  it.each([
    "http://example.com/pay",
    "javascript:alert(1)",
    "https://user:pass@example.com/",
    "https://localhost/",
    "not a url",
  ])("rejects the link %s", (value) => {
    expect(parseSupportUrl(value)).toBeUndefined();
  });

  it("opens a bank transfer without a holder, as the TAPSO site does", () => {
    const config = supportConfig(env(BANK));
    expect(config.open).toBe(true);
    expect(config.bank).toEqual({ name: "예시은행", account: "0001112223", holder: "" });
  });

  it("refuses a malformed account", () => {
    expect(
      supportConfig(env({ ...BANK, PRINT_CESS_SUPPORT_BANK_ACCOUNT: "<script>" })).bank,
    ).toBeUndefined();
    expect(supportConfig(env({ PRINT_CESS_SUPPORT_BANK_ACCOUNT: "0001112223" })).open).toBe(false);
  });

  it("shows a Toss link only for the same account and with no amount", () => {
    expect(supportConfig(env({ ...BANK, PRINT_CESS_SUPPORT_TOSS_SEND_URL: TOSS })).toss).toBe(TOSS);
    const bank = { name: "예시은행", account: "0001112223" };
    expect(parseTossSendUrl(TOSS.replace("0001112223", "9999999999"), bank)).toBeUndefined();
    expect(parseTossSendUrl(TOSS.replace("amount=0", "amount=50000"), bank)).toBeUndefined();
    expect(parseTossSendUrl("https://toss.me/someone", bank)).toBeUndefined();
    expect(parseTossSendUrl(TOSS, undefined)).toBeUndefined();
  });
});
