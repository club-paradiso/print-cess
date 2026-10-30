import {
  ArrowRight,
  ExternalLink,
  FileText,
  LockKeyhole,
  ScanLine,
  Send,
  Printer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import { Wordmark } from "@print-cess/ui";

import { HeroFilm } from "./hero-film";
import { HowDemo } from "./how-demo";
import { footer, hero, how, more, REPOSITORY_URL, trust } from "./promo-copy";
import styles from "./promo.module.css";

export const metadata: Metadata = {
  title: "Print-cess 소개 · Print-cess by Club Paradiso",
  description: "휴대전화에서 보내고 바로 출력하는 셀프 인쇄. 사용 방법과 개발 현황을 소개해요.",
  robots: { index: false, follow: false },
};

const ICONS: Record<string, ReactNode> = {
  print: <Printer aria-hidden="true" size={24} />,
  share: <Send aria-hidden="true" size={24} />,
  scan: <ScanLine aria-hidden="true" size={24} />,
};

export default function PromoPage() {
  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>

      <header className={styles.header}>
        <Link href="/promo" className={styles.brand}>
          <Wordmark compact />
        </Link>
        <nav aria-label="이 페이지" className={styles.nav}>
          <a href="#how">사용 방법</a>
          <a href="#more">기능</a>
          <a href="#trust">개발 현황</a>
        </nav>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <HeroFilm />
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{hero.eyebrow}</p>
            <h1 id="hero-title">{hero.title}</h1>
            <p className={styles.heroLead}>{hero.lead}</p>
            <div className={styles.heroActions}>
              <a className={styles.primary} href="#how">
                {hero.cta}
                <ArrowRight aria-hidden="true" size={20} />
              </a>
              <Link className={styles.secondaryOnDark} href="/start">
                {hero.secondaryCta}
              </Link>
            </div>
            <p className={styles.heroStatus}>{hero.statusLine}</p>
          </div>
        </section>

        <section id={how.id} className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <h2 id="how-title">{how.title}</h2>
            <p>{how.lead}</p>
          </div>
          <HowDemo />
          <div className={styles.tryBox}>
            <div>
              <h3>{how.tryTitle}</h3>
              <p>{how.tryBody}</p>
            </div>
            <div className={styles.tryActions}>
              <Link className={styles.primary} href="/kiosk">
                {how.tryKiosk}
              </Link>
              <Link className={styles.secondary} href="/start">
                {how.tryStart}
              </Link>
            </div>
          </div>
        </section>

        <section id="more" className={styles.section} aria-labelledby="more-title">
          <div className={styles.sectionHead}>
            <h2 id="more-title">{more.title}</h2>
            <p>{more.lead}</p>
          </div>
          <div className={styles.cards}>
            {more.items.map((item) => (
              <article key={item.id} className={styles.card} aria-labelledby={`more-${item.id}`}>
                <span className={styles.cardIcon}>{ICONS[item.id]}</span>
                <h3 id={`more-${item.id}`}>{item.name}</h3>
                <p className={styles.cardBody}>{item.body}</p>
                <p className={styles.cardLabel}>{more.conditionsLabel}</p>
                <ul className={styles.conditions}>
                  {item.conditions.map((condition) => (
                    <li key={condition}>{condition}</li>
                  ))}
                </ul>
                <div className={styles.cardActions}>
                  <Link className={styles.secondary} href={item.href}>
                    {item.cta}
                  </Link>
                  {"secondaryHref" in item ? (
                    <Link className={styles.tertiary} href={item.secondaryHref}>
                      {item.secondaryCta}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id={trust.id} className={styles.section} aria-labelledby="trust-title">
          <div className={styles.sectionHead}>
            <h2 id="trust-title">{trust.title}</h2>
          </div>
          <div className={styles.status} role="note" aria-labelledby="status-title">
            <h3 id="status-title">{trust.statusTitle}</h3>
            <p>{trust.statusBody}</p>
            <a className={styles.textLink} href={trust.statusHref} rel="noreferrer">
              {trust.statusLink}
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </div>
          <ul className={styles.points}>
            {trust.points.map((point) => (
              <li key={point.title}>
                <LockKeyhole aria-hidden="true" size={20} />
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className={styles.limits}>
            <h3>
              <FileText aria-hidden="true" size={20} />
              {trust.limitsTitle}
            </h3>
            <ul>
              {trust.limits.map((limit) => (
                <li key={limit}>{limit}</li>
              ))}
            </ul>
            <a className={styles.textLink} href={trust.limitsHref} rel="noreferrer">
              {trust.limitsLink}
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div>
            <Wordmark />
            <p className={styles.footerNote}>{footer.note}</p>
          </div>
          <nav aria-label={footer.linksLabel}>
            <ul className={styles.footerLinks}>
              {footer.links.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    {...(link.href.startsWith(REPOSITORY_URL) ? { rel: "noreferrer" } : {})}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
