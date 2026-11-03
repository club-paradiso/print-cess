import { ArrowRight, Check, LockKeyhole, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import QRCode from "qrcode";

import { Wordmark } from "@print-cess/ui";

import { KIOSK_VIEW_ONCE_PATH } from "@/lib/phone-at-kiosk";
import { QR_COLORS } from "@/lib/qr-style";
import { isBrowserKioskEnabled } from "@/server/demo";

import { HeroFilm } from "./hero-film";
import { Journey } from "./journey";
import { MoreTabs } from "./more-tabs";
import { PromoTabs } from "./promo-tabs";
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

/**
 * One view of the page. Home is shown by default; another view shows when the
 * URL fragment points inside it (CSS `:target`, see promo.module.css), so the
 * tabs work without JavaScript and every view stays in the server HTML.
 */
function ViewPanel({
  view,
  label,
  children,
}: {
  view: (typeof nav.items)[number]["view"];
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className={styles.view} data-view={view} role="region" aria-label={label}>
      {children}
    </div>
  );
}

export default async function PromoPage() {
  const config = supportConfig();
  const kioskAvailable = process.env.NODE_ENV !== "production" || isBrowserKioskEnabled();
  const tossQr = config.toss
    ? await QRCode.toDataURL(config.toss, { margin: 1, width: 264, color: QR_COLORS })
    : undefined;

  return (
    <div className={styles.page} lang="ko" dir="ltr">
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <a href="#top" className={styles.brand}>
            <Wordmark compact />
          </a>
          <PromoTabs />
          <div className={styles.headerActions}>
            <Link className={styles.headerCta} href="/start">
              {nav.start}
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className={styles.views}>
        {/* Home keeps only the hero, support and the FAQ; the rest opens from the top tabs. */}
        <ViewPanel view="home" label="홈">
          <section id="top" className={styles.hero} aria-labelledby="hero-title">
            <HeroFilm>
              <p className={styles.eyebrow}>{hero.eyebrow}</p>
              <h1 id="hero-title">
                <span>{hero.titleLines[0]}</span> <span>{hero.titleLines[1]}</span>
              </h1>
              <p className={styles.heroLead}>{hero.lead}</p>
              <p className={styles.heroGloss}>{hero.gloss}</p>
              <div className={styles.heroActions}>
                <Link className={styles.filmPrimary} href={KIOSK_VIEW_ONCE_PATH}>
                  {hero.secondaryCta}
                  <ArrowRight aria-hidden="true" size={20} />
                </Link>
                <a className={styles.filmGlass} href="#how">
                  {hero.cta}
                </a>
              </div>
            </HeroFilm>
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
              <div className={styles.supportEntry}>
                <p className={styles.pill} data-state={config.open ? "done" : "next"}>
                  {config.open ? support.openLabel : support.closedLabel}
                </p>
                <SupportAction config={config} tossQr={tossQr} />
                <p className={styles.fine}>{support.fine}</p>
                <p className={styles.fine}>
                  {support.taxNote} <Link href={support.taxHref}>이용약관 보기</Link>
                </p>
              </div>
              <div className={styles.supportGrid}>
                <div>
                  <h3>{support.usesTitle}</h3>
                  <ul className={styles.uses}>
                    {support.uses.map((use) => (
                      <li key={use}>
                        <Check aria-hidden="true" size={18} />
                        {use}
                      </li>
                    ))}
                  </ul>
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
              <SectionHead kicker="FAQ" title={faq.title} id="faq-title">
                <p>{faq.lead}</p>
              </SectionHead>
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
        </ViewPanel>

        <ViewPanel view="how" label="사용 방법">
          <section id={how.id} className={styles.section} aria-labelledby="how-title">
            <div className={styles.container}>
              <SectionHead kicker="사용 방법" title={how.title} id="how-title">
                <p>{how.lead}</p>
              </SectionHead>
              <div className={styles.statementBand}>
                <StatementLine id="statement-title" words={statement.words} />
                <ul className={styles.facts}>
                  {statement.facts.map((fact) => (
                    <li key={fact.label}>
                      <strong>{fact.value}</strong>
                      <span>{fact.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Journey />
              <div className={styles.tryBox}>
                <div>
                  <h3>{kioskAvailable ? how.tryTitle : how.entryTitle}</h3>
                  <p>{kioskAvailable ? how.tryBody : how.entryBody}</p>
                </div>
                <div className={styles.tryActions}>
                  {kioskAvailable ? (
                    <Link className={styles.filmPrimary} href="/kiosk">
                      {how.tryKiosk}
                    </Link>
                  ) : null}
                  <Link className={styles.filmGlass} href={KIOSK_VIEW_ONCE_PATH}>
                    {how.tryStart}
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </ViewPanel>

        <ViewPanel view="more" label="기능">
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
        </ViewPanel>

        <ViewPanel view="privacy" label="개인정보">
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
                <p className={styles.privacyCaveat}>{trust.privacyCaveat}</p>
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
                <div className={styles.limits}>
                  <h3>{trust.limitsTitle}</h3>
                  <ul>
                    {trust.limits.map((limit) => (
                      <li key={limit}>{limit}</li>
                    ))}
                  </ul>
                  <Link className={styles.textLink} href={trust.limitsHref}>
                    {trust.limitsLink}
                    <ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </ViewPanel>
      </main>

      <footer className={styles.footer}>
        <div className={`${styles.container} ${styles.footerGrid}`}>
          <div className={styles.footerBrand}>
            <Wordmark />
            <p className={styles.footerMotto}>{hero.eyebrow}</p>
            <p className={styles.footerNote}>{footer.note}</p>
            <p className={styles.footerNote}>{footer.copyright}</p>
          </div>
          <div className={styles.footerNavs}>
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
                <li>
                  <a href="#support">개발 후원하기</a>
                </li>
              </ul>
            </nav>
            <nav aria-label={footer.legalLabel}>
              <ul className={styles.footerLinks}>
                {footer.legal.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className={link.emphasis ? styles.footerEmphasis : undefined}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
