import { describe, expect, it } from "vitest";

import { NextRequest } from "next/server";
import { afterEach, vi } from "vitest";

import { blobConnectOrigins, buildContentSecurityPolicy, proxy } from "./proxy";

function env(values: Record<string, string> = {}): NodeJS.ProcessEnv {
  return values as NodeJS.ProcessEnv;
}

describe("Content Security Policy", () => {
  it("allows the exact Vercel private Blob signing endpoint", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false, env());

    expect(policy).toContain(
      "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com https://blob.vercel-storage.com",
    );
    expect(policy).toContain("frame-src 'self' blob:");
    expect(policy).not.toContain("https://*.vercel.com");
  });

  it("permits WebAssembly compilation without enabling JavaScript eval in production", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false, env());

    expect(policy).toContain("'wasm-unsafe-eval'");
    expect(policy).not.toContain(" 'unsafe-eval'");
  });

  it("allows Emscripten eval and same-origin PDF preview only on the scanner route", () => {
    const scanner = buildContentSecurityPolicy("test-nonce", false, env(), true);
    const ordinary = buildContentSecurityPolicy("test-nonce", false, env(), false);

    expect(scanner).toContain(" 'unsafe-eval'");
    expect(scanner).toContain("frame-ancestors 'self'");
    expect(scanner).toContain("style-src 'self' 'unsafe-inline'");
    expect(ordinary).not.toContain(" 'unsafe-eval'");
    expect(ordinary).toContain("frame-ancestors 'none'");
    expect(ordinary).toContain("style-src 'self' 'nonce-test-nonce'");
  });

  it("allows only the pinned OCR asset origins required for local recognition", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false, env());

    expect(policy).toContain("https://cdn.jsdelivr.net");
    expect(policy).toContain("https://tessdata.projectnaptha.com");
    expect(policy).toContain(
      "worker-src 'self' blob: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js",
    );
    expect(policy).not.toContain("worker-src *");
    expect(policy).not.toContain("connect-src *");
  });

  it("allows the exact CDN packages the app loads, not the whole CDN host", () => {
    const policy = buildContentSecurityPolicy("test-nonce", false, env());
    const directive = (name: string) =>
      policy
        .split("; ")
        .find((part) => part.startsWith(`${name} `))!
        .split(" ")
        .slice(1);

    for (const name of ["script-src", "worker-src"]) {
      const sources = directive(name);
      expect(sources).not.toContain("https://cdn.jsdelivr.net");
      expect(sources).toContain("https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/");
      expect(sources).toContain("https://cdn.jsdelivr.net/npm/tesseract.js-core@7.0.0/");
    }
  });

  it("admits the configured S3 endpoint so the browser can reach it", () => {
    const origins = blobConnectOrigins(
      env({
        PRINT_CESS_BLOB_PROVIDER: "railway-s3",
        S3_ENDPOINT: "https://storage.example.test",
        S3_BUCKET: "print-cess",
      }),
    );

    expect(origins).toEqual([
      "https://storage.example.test",
      "https://print-cess.storage.example.test",
    ]);
  });

  it("drops the virtual-hosted form when the bucket forces path style", () => {
    const origins = blobConnectOrigins(
      env({
        PRINT_CESS_BLOB_PROVIDER: "railway-s3",
        S3_ENDPOINT: "https://storage.example.test",
        S3_BUCKET: "print-cess",
        S3_FORCE_PATH_STYLE: "true",
      }),
    );

    expect(origins).toEqual(["https://storage.example.test"]);
  });

  it("never widens the policy for a missing, plaintext, or malformed endpoint", () => {
    for (const endpoint of [undefined, "http://storage.example.test", "not-a-url"]) {
      const origins = blobConnectOrigins(
        env({
          PRINT_CESS_BLOB_PROVIDER: "railway-s3",
          ...(endpoint ? { S3_ENDPOINT: endpoint } : {}),
        }),
      );
      expect(origins).toEqual([]);
    }
  });

  it("keeps a path or query out of the admitted origin", () => {
    const origins = blobConnectOrigins(
      env({
        PRINT_CESS_BLOB_PROVIDER: "railway-s3",
        S3_ENDPOINT: "https://storage.example.test/bucket?token=secret",
      }),
    );

    expect(origins).toEqual(["https://storage.example.test"]);
  });

  it("does not admit S3 when the Vercel provider is selected", () => {
    const policy = buildContentSecurityPolicy(
      "test-nonce",
      false,
      env({ S3_ENDPOINT: "https://storage.example.test" }),
    );

    expect(policy).not.toContain("storage.example.test");
  });
});

describe("phones at the kiosk address", () => {
  const IPHONE =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
  const WINDOWS =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

  function request(path: string, agent: string, cookie?: string) {
    return new NextRequest(`https://print-cess.test${path}`, {
      headers: { "user-agent": agent, ...(cookie ? { cookie } : {}) },
    });
  }

  afterEach(() => vi.unstubAllEnvs());

  it("redirects a phone from / to the visitor guide", () => {
    const response = proxy(request("/", IPHONE));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://print-cess.test/start?from=kiosk");
  });

  it("leaves a PC, a pinned station and other paths alone", () => {
    expect(proxy(request("/", WINDOWS)).headers.get("location")).toBeNull();
    expect(proxy(request("/", IPHONE, "pc_kiosk=1")).headers.get("location")).toBeNull();
    expect(proxy(request("/send", IPHONE)).headers.get("location")).toBeNull();
    expect(proxy(request("/?view=kiosk", IPHONE)).headers.get("location")).toBeNull();
  });

  it("pins a station with ?kiosk=1", () => {
    const cookie = proxy(request("/?kiosk=1", WINDOWS)).headers.get("set-cookie") ?? "";
    expect(cookie).toContain("pc_kiosk=1");
    expect(cookie.toLowerCase()).toContain("httponly");
  });

  it("does not redirect when the root is not the kiosk in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_BROWSER_KIOSK", "false");
    expect(proxy(request("/", IPHONE)).headers.get("location")).toBeNull();
  });
});
