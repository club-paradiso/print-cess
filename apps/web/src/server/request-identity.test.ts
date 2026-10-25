import { describe, expect, it } from "vitest";

import { clientAddress, trustedProxyHops } from "./request-identity";

function request(headers: Record<string, string>): Request {
  return new Request("https://print.example.test/api/drops", { headers });
}

describe("clientAddress", () => {
  it("uses Vercel's own client header on Vercel", () => {
    const environment = { NODE_ENV: "production", VERCEL: "1" } as NodeJS.ProcessEnv;
    expect(
      clientAddress(
        request({
          "x-vercel-forwarded-for": "198.51.100.7",
          "x-forwarded-for": "198.51.100.7",
        }),
        environment,
      ),
    ).toBe("198.51.100.7");
  });

  it("ignores client-chosen entries to the left of the trusted proxies", () => {
    const environment = {
      NODE_ENV: "production",
      PRINT_CESS_TRUSTED_PROXY_HOPS: "1",
    } as NodeJS.ProcessEnv;
    expect(
      clientAddress(request({ "x-forwarded-for": "203.0.113.9, 198.51.100.7" }), environment),
    ).toBe("198.51.100.7");
  });

  it("counts every configured hop from the right", () => {
    const environment = {
      NODE_ENV: "production",
      PRINT_CESS_TRUSTED_PROXY_HOPS: "2",
    } as NodeJS.ProcessEnv;
    expect(
      clientAddress(
        request({ "x-forwarded-for": "203.0.113.9, 198.51.100.7, 10.0.0.2" }),
        environment,
      ),
    ).toBe("198.51.100.7");
  });

  it("gives every caller one shared bucket when the chain is shorter than the hops", () => {
    const environment = {
      NODE_ENV: "production",
      PRINT_CESS_TRUSTED_PROXY_HOPS: "2",
    } as NodeJS.ProcessEnv;
    expect(clientAddress(request({ "x-forwarded-for": "198.51.100.7" }), environment)).toBe(
      "unknown",
    );
  });

  it("never trusts the first value in production without a proxy setting", () => {
    const environment = { NODE_ENV: "production" } as NodeJS.ProcessEnv;
    expect(clientAddress(request({ "x-forwarded-for": "203.0.113.9" }), environment)).toBe(
      "unknown",
    );
  });

  it("lets development pick an address through the first value", () => {
    const environment = { NODE_ENV: "development" } as NodeJS.ProcessEnv;
    expect(
      clientAddress(request({ "x-forwarded-for": "203.0.113.9, 10.0.0.2" }), environment),
    ).toBe("203.0.113.9");
    expect(clientAddress(request({}), environment)).toBe("local");
  });
});

describe("trustedProxyHops", () => {
  it("is null when unset", () => {
    expect(trustedProxyHops({} as NodeJS.ProcessEnv)).toBeNull();
  });

  it.each(["0", "6", "1.5", "two", "-1"])("rejects %s", (value) => {
    expect(() =>
      trustedProxyHops({
        NODE_ENV: "test",
        PRINT_CESS_TRUSTED_PROXY_HOPS: value,
      } as NodeJS.ProcessEnv),
    ).toThrow(/PRINT_CESS_TRUSTED_PROXY_HOPS/u);
  });
});
