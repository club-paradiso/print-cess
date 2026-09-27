import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import RoyalPromoPage, { metadata } from "./page";

function nodes(node: ReactNode): ReactNode[] {
  if (node === null || node === undefined || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [node];
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (typeof node === "object" && "props" in node) {
    const element = node as { props: { children?: ReactNode } };
    return [node, ...nodes(element.props.children)];
  }
  return [];
}

function textOf(node: ReactNode): string {
  return nodes(node)
    .filter((item) => typeof item === "string" || typeof item === "number")
    .join(" ");
}

describe("royal promo page", () => {
  it("renders one campaign heading, all exact slogans, and four source artworks", () => {
    const page = RoyalPromoPage();
    const all = nodes(page);
    const copy = textOf(page);
    const headings = all.filter(
      (node) => typeof node === "object" && node !== null && "type" in node && node.type === "h1",
    );
    const imageSources = all.flatMap((node) => {
      if (typeof node !== "object" || node === null || !("props" in node)) return [];
      const src = (node.props as { src?: unknown }).src;
      return typeof src === "string" && src.startsWith("/promo/royal/") ? [src] : [];
    });

    expect(headings).toHaveLength(1);
    expect(copy).toContain("아니 황궁에 사람이 몇인데 공주가 직접 출력함");
    expect(copy).toContain("황태자 전하도 파일은 직접 보내셔야 합니다");
    expect(copy).toContain("제국을 구하셔도 출력은 셀프입니다");
    expect(copy).toContain("황태자는 됐고, 용지가 걸렸다고");
    expect(new Set(imageSources)).toEqual(
      new Set([
        "/promo/royal/01-palace-princess.png",
        "/promo/royal/02-crown-prince.png",
        "/promo/royal/03-save-the-empire.png",
        "/promo/royal/04-paper-jam.png",
      ]),
    );
  });

  it("uses real service routes and route-scoped metadata", () => {
    const page = RoyalPromoPage();
    const hrefs = nodes(page).flatMap((node) => {
      if (typeof node !== "object" || node === null || !("props" in node)) return [];
      const href = (node.props as { href?: unknown }).href;
      return typeof href === "string" ? [href] : [];
    });

    expect(hrefs).toContain("/");
    expect(hrefs).toContain("#royal-gallery");
    expect(metadata.title).toBe("공주는 편한 게 최고야 | Print-cess by Club Paradiso");
  });
});
