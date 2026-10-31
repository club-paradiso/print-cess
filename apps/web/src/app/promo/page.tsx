import { ArrowRight, Check, ChevronDown, ExternalLink, LockKeyhole, Menu, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { Wordmark } from "@print-cess/ui";

import { QR_COLORS } from "@/lib/qr-style";

import { HeroFilm } from "./hero-film";
import { Journey } from "./journey";
import { LegalDocumentModal } from "./legal-document-modal";
import { MoreTabs } from "./more-tabs";
import { StatementLine } from "./statement-line";
import {
  faq,
  footer,
  hero,
  how,
  more,
  nav,
  REPOSITORY_URL,
  statement,
  support,
  trust,
} from "./promo-copy";
import styles from "./promo.module.css";
import { SupportAction } from "./support-action";
import { supportConfig } from "./support-config";

import "./pretendard.css";

export const metadata: Metadata = {
  title: "Print-cess 소개 · Print-cess by Club Paradiso",
  description: "휴대전화에서 보내고 바로 출력하는 셀프 인쇄. 사용 방법과 주요 기능을 소개해요.",
  robots: { index: false, follow: false },
};

function SectionHead({
  kicker,
  title,
  id,
  children,
}: {
  kicker: string;
  title: string;
  id: string;
  children?: React.ReactNode;
}) {
  return (
    <header className={styles.sectionHead}>
      <p className={styles.kicker}>
        <span className={styles.kickerDot} aria-hidden="true" />
        {kicker}
      </p>
      <h2 id={id}>{title}</h2>
      {children ? <div className={styles.lede}>{children}</div> : null}
    </header>
  );
}

export default async function PromoPage() {
  const config = supportConfig();
  const tossQr = config.toss
    ? await QRCode.toDataURL(config.toss, { margin: 1, width: 264, color: QR_COLORS })
    : undefined;

  return (
    <div className={styles.page}>
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/promo" className={styles.brand}>
            <Wordmark compact />
          </Link>
          <nav aria-label={nav.label} className={styles.nav}>
            {nav.items.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.headerCta} href="/start">
              {nav.start}
            </Link>
            <details className={styles.menu}>
              <summary className={styles.menuButton}>
                <Menu aria-hidden="true" size={20} className={styles.menuOpen} />
                <X aria-hidden="true" size={20} className={styles.menuClose} />
                <span>{nav.menu}</span>
              </summary>
              <nav aria-label={`${nav.label} (메뉴)`} className={styles.menuList}>
                {nav.items.map((item) => (
                  <a key={item.href} href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <HeroFilm>
            <p className={styles.eyebrow}>{hero.eyebrow}</p>
            <h1 id="hero-title">
              <span>{hero.titleLines[0]}</span> <span>{hero.titleLines[1]}</span>
            </h1>
            <p className={styles.heroLead}>{hero.lead}</p>
            <p className={styles.heroGloss}>{hero.gloss}</p>
            <div className={styles.heroActions}>
              <a className={styles.filmPrimary} href="#how">
                {hero.cta}
                <ArrowRight aria-hidden="true" size={20} />
              </a>
              <Link className={styles.filmGlass} href="/start">
                {hero.secondaryCta}
              </Link>
            </div>
          </HeroFilm>
        </section>

        <section className={styles.statement} aria-labelledby="statement-title">
          <div className={styles.container}>
            <StatementLine id="statement-title" words={statement.words} />
            <p className={styles.statementLead}>{statement.lead}</p>
            <ul className={styles.facts}>
              {statement.facts.map((fact) => (
                <li key={fact.label}>
                  <strong>{fact.value}</strong>
                  <span>{fact.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id={how.id} className={styles.section} aria-labelledby="how-title">
          <div className={styles.container}>
            <SectionHead kicker="사용 방법" title={how.title} id="how-title">
              <p>{how.lead}</p>
            </SectionHead>
            <Journey />
            <div className={styles.tryBox}>
              <div>
                <h3>{how.tryTitle}</h3>
                <p>{how.tryBody}</p>
              </div>
              <div className={styles.tryActions}>
                <Link className={styles.filmPrimary} href="/kiosk">
                  {how.tryKiosk}
                </Link>
                <Link className={styles.filmGlass} href="/start">
                  {how.tryStart}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section
          id="more"
          className={`${styles.section} ${styles.paper}`}
          aria-labelledby="more-title"
        >
          <div className={styles.container}>
            <SectionHead kicker="기능" title={more.title} id="more-title">
              <p>{more.lead}</p>
            </SectionHead>
            <MoreTabs />
          </div>
        </section>

        <section
          id="privacy"
          className={`${styles.section} ${styles.dark}`}
          aria-labelledby="privacy-title"
        >
          <div className={`${styles.container} ${styles.split}`}>
            <div>
              <SectionHead kicker="개인정보" title={trust.privacyTitle} id="privacy-title">
                <p>{trust.privacyLead}</p>
              </SectionHead>
              <ul className={styles.privacyRows} aria-label={trust.privacyTitle}>
                {trust.privacyRows.map((row) => (
                  <li key={row.title} data-on={row.on}>
                    <span className={styles.privacyToken} aria-hidden="true">
                      {row.on ? <LockKeyhole size={18} /> : <X size={18} />}
                    </span>
                    <span className={styles.privacyLine} aria-hidden="true" />
                    <span className={styles.privacyLabel}>
                      <strong>{row.title}</strong>
                      {row.body}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <ul className={styles.points}>
                {trust.points.map((point) => (
                  <li key={point.title}>
                    <strong>{point.title}</strong>
                    <span>{point.body}</span>
                  </li>
                ))}
              </ul>
              <details className={styles.limits}>
                <summary>
                  {trust.limitsTitle}
                  <ChevronDown aria-hidden="true" size={18} className={styles.chevron} />
                </summary>
                <ul>
                  {trust.limits.map((limit) => (
                    <li key={limit}>{limit}</li>
                  ))}
                </ul>
                <a className={styles.textLink} href={trust.limitsHref} rel="noreferrer">
                  {trust.limitsLink}
                  <ExternalLink aria-hidden="true" size={15} />
                </a>
              </details>
            </div>
          </div>
        </section>

        <section
          id={support.id}
          className={`${styles.section} ${styles.paper}`}
          aria-labelledby="support-title"
        >
          <div className={styles.container}>
            <SectionHead kicker="후원" title={support.title} id="support-title">
              <p>{support.lead}</p>
            </SectionHead>
            <div className={styles.supportGrid}>
              <div className={styles.supportCard}>
                <p className={styles.pill} data-state={config.open ? "done" : "next"}>
                  {config.open ? support.openLabel : support.closedLabel}
                </p>
                <h3>{support.usesTitle}</h3>
                <ul className={styles.uses}>
                  {support.uses.map((use) => (
                    <li key={use}>
                      <Check aria-hidden="true" size={18} />
                      {use}
                    </li>
                  ))}
                </ul>
                <div className={styles.supportButtons}>
                  <SupportAction config={config} tossQr={tossQr} />
                </div>
                <p className={styles.fine}>{support.fine}</p>
              </div>

              <div className={styles.free}>
                <h3>{support.freeTitle}</h3>
                <ul>
                  {support.free.map((item) => (
                    <li key={item.title}>
                      <a href={item.href} rel="noreferrer">
                        <strong>{item.title}</strong>
                        <span>{item.body}</span>
                        <ArrowRight aria-hidden="true" size={18} className={styles.freeArrow} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section id={faq.id} className={styles.section} aria-labelledby="faq-title">
          <div className={`${styles.container} ${styles.split}`}>
            <SectionHead kicker="FAQ" title={faq.title} id="faq-title" />
            <div className={styles.faq}>
              {faq.items.map((item) => (
                <details key={item.q}>
                  <summary>
                    <span>{item.q}</span>
                    <span className={styles.faqToggle} aria-hidden="true" />
                  </summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <Wordmark />
            <p className={styles.footerMotto}>{hero.eyebrow}</p>
            <p className={styles.footerNote}>{footer.note}</p>
          </div>
          <nav aria-label={footer.linksLabel}>
            <ul className={styles.footerLinks}>
              {footer.links.map((link) => (
                <li key={link.href}>
                  {link.label === "보안 정책" ? (
                    <LegalDocumentModal kind="security" label={link.label} />
                  ) : link.label === "라이선스(Apache-2.0)" ? (
                    <LegalDocumentModal kind="license" label={link.label} />
                  ) : (
                    <a href={link.href} {...(link.href.startsWith(REPOSITORY_URL) ? { rel: "noreferrer" } : {})}>{link.label}</a>
                  )}
                </li>
              ))}
              <li>
                <a href="#support">개발 후원하기</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
