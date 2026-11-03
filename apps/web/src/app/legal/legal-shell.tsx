import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@print-cess/ui";

import { LEGAL_EFFECTIVE_DATE } from "./legal-config";
import styles from "./legal.module.css";

import "../promo/pretendard.css";

export const LEGAL_DOCUMENTS = [
  {
    href: "/legal/privacy",
    label: "개인정보 처리방침",
    summary: "어떤 정보를 얼마 동안 처리하고 어떻게 지우는지, 누구에게 맡기는지 적었어요.",
  },
  {
    href: "/legal/terms",
    label: "이용약관",
    summary: "무료로 쓰는 조건, 이용자가 지킬 일, 서비스의 책임 범위를 적었어요.",
  },
  {
    href: "/legal/security",
    label: "보안 정책",
    summary: "파일을 어떻게 잠그는지, 보안 문제를 발견하면 어디로 알리는지 적었어요.",
  },
  {
    href: "/legal/licenses",
    label: "라이선스·오픈소스 고지",
    summary: "Print-cess의 Apache-2.0 라이선스와 함께 쓰는 오픈소스의 고지를 모았어요.",
  },
] as const;

export type LegalHref = (typeof LEGAL_DOCUMENTS)[number]["href"] | "/legal";

export type TocItem = { id: string; label: string };

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function LegalShell({
  current,
  kicker = "법적 고지",
  title,
  lead,
  summary,
  toc,
  children,
}: {
  current: LegalHref;
  kicker?: string;
  title: string;
  lead?: ReactNode;
  summary?: { title: string; items: { label: string; value: ReactNode }[] };
  toc?: TocItem[];
  children: ReactNode;
}) {
  return (
    <div className={styles.page} lang="ko" dir="ltr">
      <a className={styles.skip} href="#legal-main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/promo" className={styles.brand} aria-label="Print-cess 소개 페이지로">
            <Wordmark compact />
          </Link>
          <Link className={styles.back} href={current === "/legal" ? "/promo" : "/legal"}>
            <ArrowLeft aria-hidden="true" size={18} />
            {current === "/legal" ? "소개 페이지" : "법적 고지 목록"}
          </Link>
        </div>
      </header>

      <div className={styles.layout}>
        <nav className={styles.docNav} aria-label="법적 고지 문서">
          <p className={styles.docNavTitle}>문서</p>
          <ul className={styles.docList}>
            {LEGAL_DOCUMENTS.map((doc) => (
              <li key={doc.href}>
                <Link
                  href={doc.href}
                  aria-current={doc.href === current ? "page" : undefined}
                  className={doc.href === "/legal/privacy" ? styles.emphasis : undefined}
                >
                  {doc.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main id="legal-main" className={styles.article}>
          <p className={styles.kicker}>{kicker}</p>
          <h1 className={styles.title}>{title}</h1>
          {current === "/legal" ? null : (
            <p className={styles.meta}>
              <span>시행일 {formatDate(LEGAL_EFFECTIVE_DATE)}</span>
              <span>운영 Club Paradiso</span>
            </p>
          )}
          {lead ? <div className={styles.lead}>{lead}</div> : null}

          {summary ? (
            <section className={styles.summary} aria-labelledby="legal-summary">
              <h2 id="legal-summary" className={styles.summaryTitle}>
                {summary.title}
              </h2>
              <ul className={styles.summaryList}>
                {summary.items.map((item) => (
                  <li key={item.label}>
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {toc && toc.length > 0 ? (
            <details className={styles.toc} open>
              <summary>목차</summary>
              <ol>
                {toc.map((item) => (
                  <li key={item.id}>
                    <a href={`#${item.id}`}>{item.label}</a>
                  </li>
                ))}
              </ol>
            </details>
          ) : null}

          {children}
        </main>
      </div>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>Print-cess는 Club Paradiso의 오픈소스 프로젝트예요.</p>
          <p>
            문서 원본과 변경 이력은{" "}
            <a href="https://github.com/club-paradiso/print-cess" rel="noreferrer">
              GitHub 저장소
            </a>
            에서 볼 수 있어요.
          </p>
        </div>
      </footer>
    </div>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {children}
    </section>
  );
}

export function LegalTable({
  caption,
  head,
  rows,
}: {
  caption: string;
  head: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className={styles.tableWrap} role="region" aria-label={caption} tabIndex={0}>
      <table className={styles.table}>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} scope="col">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row">
                    {cell}
                  </th>
                ) : (
                  <td key={cellIndex} data-label={head[cellIndex]}>
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LegalNote({ children }: { children: ReactNode }) {
  return <p className={styles.note}>{children}</p>;
}

export { styles as legalStyles };
