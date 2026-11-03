import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { parseContactEmail, privacyContact } from "./legal-config";
import { LEGAL_DOCUMENTS } from "./legal-shell";
import LegalIndexPage from "./page";
import LicensesPage from "./licenses/page";
import PrivacyPolicyPage from "./privacy/page";
import SecurityPolicyPage from "./security/page";
import TermsPage from "./terms/page";
import { THIRD_PARTY } from "./third-party";

const web = process.cwd();
const root = join(web, "../..");
const text = (html: string) => html.replace(/<[^>]+>/gu, " ").replace(/\s+/gu, " ");

describe("legal pages", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("every listed document has a route", () => {
    for (const doc of LEGAL_DOCUMENTS) {
      expect(existsSync(join(web, "src/app", doc.href, "page.tsx")), doc.href).toBe(true);
    }
  });

  it("renders every page with a single h1 and Korean language", () => {
    for (const Page of [
      LegalIndexPage,
      PrivacyPolicyPage,
      TermsPage,
      SecurityPolicyPage,
      LicensesPage,
    ]) {
      const html = renderToStaticMarkup(<Page />);
      expect(html.match(/<h1/gu)?.length).toBe(1);
      expect(html).toContain('lang="ko"');
    }
  });

  // 개인정보 보호법 제30조제1항 and 시행령 제31조제1항: the required items.
  it("privacy policy covers every item the law requires", () => {
    const html = text(renderToStaticMarkup(<PrivacyPolicyPage />));
    for (const heading of [
      "처리 목적",
      "처리하는 개인정보의 항목",
      "처리 및 보유 기간",
      "파기 절차 및 방법",
      "제3자 제공",
      "처리의 위탁과 국외 이전",
      "권리·의무 및 행사 방법",
      "안전성 확보 조치",
      "자동 수집 장치",
      "개인정보 보호책임자",
      "권익 침해 구제",
      "처리방침의 변경",
    ]) {
      expect(html, heading).toContain(heading);
    }
    // 제28조의8제2항: items, country, recipient, purpose/period, how to refuse.
    for (const recipient of ["Vercel Inc.(미국)", "Upstash, Inc.", "Google LLC(미국)"]) {
      expect(html).toContain(recipient);
    }
    expect(html).toContain("국외 이전을 원하지 않을 때");
    for (const office of ["118", "1833-6972", "1301", "182"]) expect(html).toContain(office);
  });

  it("privacy policy states the retention the product actually uses", () => {
    const html = text(renderToStaticMarkup(<PrivacyPolicyPage />));
    const env = readFileSync(join(root, ".env.example"), "utf8");
    expect(env).toContain("SESSION_TTL_SECONDS=180");
    expect(env).toContain("DROP_TTL_SECONDS=1800");
    expect(env).toContain("VISITOR_TTL_SECONDS=600");
    expect(html).toContain("약 3분");
    expect(html).toContain("기본 30분");
    expect(html).toContain("기본 10분");
    expect(html).toContain("print-cess-locale");
    expect(html).toContain("pc_kiosk");
  });

  it("names the privacy officer contact only when it is a plain address", () => {
    vi.stubEnv("PRINT_CESS_PRIVACY_CONTACT_EMAIL", "privacy@club-paradiso.example");
    vi.stubEnv("PRINT_CESS_PRIVACY_OFFICER", "  홍길동  ");
    expect(privacyContact()).toEqual({ officer: "홍길동", email: "privacy@club-paradiso.example" });
    const html = renderToStaticMarkup(<PrivacyPolicyPage />);
    expect(html).toContain('href="mailto:privacy@club-paradiso.example"');

    vi.stubEnv("PRINT_CESS_PRIVACY_CONTACT_EMAIL", "");
    vi.stubEnv("PRINT_CESS_PRIVACY_OFFICER", "");
    expect(privacyContact().email).toBeUndefined();
    expect(text(renderToStaticMarkup(<PrivacyPolicyPage />))).toContain(
      "전용 이메일은 아직 공개하지 않았어요",
    );
  });

  it.each([
    ["a@b.co", "a@b.co"],
    ['"a@b.co"', "a@b.co"],
    ["Name <a@b.co>", undefined],
    ["a@b.co\nBcc: c@d.co", undefined],
    ["javascript:alert(1)", undefined],
    ["a@localhost", undefined],
  ])("parses contact email %j", (value, expected) => {
    expect(parseContactEmail(value)).toBe(expected);
  });

  // 약관규제법 제7조제1호: a clause excluding liability for intent or gross negligence is void.
  it("terms keep liability for intent and gross negligence", () => {
    const html = text(renderToStaticMarkup(<TermsPage />));
    expect(html).toContain("고의 또는 중대한 과실로 생긴 손해");
    expect(html).toContain("기부금 영수증이나 세금 혜택이 없어요");
  });

  it("security page points to private reporting, not a public issue", () => {
    const html = renderToStaticMarkup(<SecurityPolicyPage />);
    expect(html).toContain("/security/advisories/new");
    expect(text(html)).toContain("영업일 3일");
  });
});

describe("licence notices", () => {
  const pkg = JSON.parse(readFileSync(join(web, "package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  const listed = new Map(
    THIRD_PARTY.flatMap((item) => item.packages.map((name) => [name, item] as const)),
  );

  it("lists every external runtime dependency with its exact version", () => {
    for (const [name, version] of Object.entries(pkg.dependencies)) {
      if (version.startsWith("workspace:")) continue;
      const item = listed.get(name);
      expect(item, `${name} is missing from /legal/licenses`).toBeDefined();
      expect(item?.version, name).toBe(version);
    }
    for (const name of listed.keys()) expect(pkg.dependencies[name], name).toBeDefined();
  });

  it("states the licence each package declares", () => {
    for (const [name, item] of listed) {
      const manifest = JSON.parse(
        readFileSync(join(web, "node_modules", name, "package.json"), "utf8"),
      ) as { license?: string };
      expect(manifest.license, name).toBe(item.license);
    }
  });

  it("serves byte-identical copies of the licence files", () => {
    const pairs: [string, string][] = [
      ["public/licenses/LICENSE.txt", join(root, "LICENSE")],
      ["public/licenses/NOTICE.txt", join(root, "NOTICE")],
      ["public/licenses/heic-to-LGPL-3.0.txt", join(web, "node_modules/heic-to/LICENSE")],
      ["public/licenses/pretendard-OFL-1.1.txt", join(web, "public/promo/fonts/LICENSE.txt")],
    ];
    for (const [served, source] of pairs) {
      expect(readFileSync(join(web, served)).equals(readFileSync(source)), served).toBe(true);
    }
  });
});
