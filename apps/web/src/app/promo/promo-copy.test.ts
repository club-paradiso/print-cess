import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { faq, footer, hero, more, support, trust } from "./promo-copy";

const everyLine = JSON.stringify({ hero, more, trust, footer, support, faq });

describe("/promo copy", () => {
  it("never claims a deployment, certification or official status", () => {
    for (const phrase of [
      "공식",
      "인증받",
      "정식 운영 중",
      "정부 서비스",
      "100%",
      "완벽",
      "절대",
    ]) {
      // The trust section names these only to deny them.
      const outsideDenial = everyLine.replaceAll("인증이나 정식 운영 중이라는 뜻도 아니에요", "");
      expect(outsideDenial, phrase).not.toContain(phrase);
    }
  });

  it("no longer carries the removed development-status messaging", () => {
    for (const phrase of [
      "개발·시연 단계",
      "승인받은 서비스가 아니에요",
      "statusLine",
      "statusTitle",
    ]) {
      expect(everyLine, phrase).not.toContain(phrase);
    }
  });

  it("does not advertise obsolete file limits or page-count restrictions", () => {
    for (const stale of ["20MB", "10MB", "32MB", "50페이지", "11페이지", "직원 승인"]) {
      expect(everyLine, stale).not.toContain(stale);
    }
  });

  it("only links to routes that exist", () => {
    const routes = [
      ...more.items.flatMap((item) => [
        item.href,
        "secondaryHref" in item ? item.secondaryHref : "",
      ]),
    ];
    for (const route of routes.filter(Boolean)) {
      expect(existsSync(join(process.cwd(), "src/app", route, "page.tsx")), route).toBe(true);
    }
  });
});

describe("/promo media", () => {
  const dir = join(process.cwd(), "public/promo");
  const files = [
    "university-720.mp4",
    "university-portrait.mp4",
    "airport-720.mp4",
    "airport-portrait.mp4",
  ];

  it("ships every cut and still the hero asks for", () => {
    for (const scene of ["university", "airport"]) {
      for (const name of [
        `${scene}-720.mp4`,
        `${scene}-portrait.mp4`,
        `${scene}-poster.webp`,
        `${scene}-poster-portrait.webp`,
      ]) {
        expect(existsSync(join(dir, name)), name).toBe(true);
      }
    }
  });

  it("keeps each film small enough for a phone on a mobile network", () => {
    for (const name of files) {
      expect(statSync(join(dir, name)).size, name).toBeLessThan(1_200_000);
    }
  });

  it("carries no audio track", () => {
    for (const name of files) {
      const bytes = readFileSync(join(dir, name));
      expect(bytes.includes(Buffer.from("soun")), name).toBe(false);
    }
  });
});
