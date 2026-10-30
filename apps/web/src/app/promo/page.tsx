import {
  ArrowRight,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Heart,
  LockKeyhole,
  Menu,
  X,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Wordmark } from "@print-cess/ui";

import { CopyButton } from "./copy-button";
import { HeroFilm } from "./hero-film";
import { HowDemo } from "./how-demo";
import { MoreTabs } from "./more-tabs";
import { faq, footer, hero, how, more, nav, REPOSITORY_URL, support, trust } from "./promo-copy";
import styles from "./promo.module.css";
import { supportConfig } from "./support-config";

export const metadata: Metadata = {
  title: "Print-cess 소개 · Print-cess by Club Paradiso",
  description: "휴대전화에서 보내고 바로 출력하는 셀프 인쇄. 사용 방법과 개발 현황을 소개해요.",
  robots: { index: false, follow: false },
};

export default function PromoPage() {
  const config = supportConfig();

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
          <HeroFilm />
          <div className={styles.heroInner}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>{hero.eyebrow}</p>
              <h1 id="hero-title">{hero.title}</h1>
              <p className={styles.heroLead}>{hero.lead}</p>
              <div className={styles.heroActions}>
                <a className={styles.primary} href="#how">
                  {hero.cta}
                  <ArrowRight aria-hidden="true" size={20} />
                </a>
                <Link className={styles.secondary} href="/start">
                  {hero.secondaryCta}
                </Link>
              </div>
              <ul className={styles.chips} aria-label="요약">
                {hero.chips.map((chip, index) => (
                  <li key={chip} data-status={index === hero.chips.length - 1}>
                    {chip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id={how.id} className={styles.section} aria-labelledby="how-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>사용 방법</p>
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

        <section
          id="more"
          className={`${styles.section} ${styles.band}`}
          aria-labelledby="more-title"
        >
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>기능</p>
            <h2 id="more-title">{more.title}</h2>
            <p>{more.lead}</p>
          </div>
          <MoreTabs />
        </section>

        <section id={trust.id} className={styles.section} aria-labelledby="trust-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>개발 현황</p>
            <h2 id="trust-title">{trust.title}</h2>
          </div>
          <div className={styles.status} role="note" aria-labelledby="status-title">
            <h3 id="status-title">{trust.statusTitle}</h3>
            <p>{trust.statusBody}</p>
          </div>
          <div className={styles.board}>
            <div className={styles.boardColumn} data-kind="works">
              <h3>{trust.board.worksTitle}</h3>
              <ul>
                {trust.board.works.map((item) => (
                  <li key={item}>
                    <Check aria-hidden="true" size={18} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className={styles.boardColumn} data-kind="notyet">
              <h3>{trust.board.notYetTitle}</h3>
              <ul>
                {trust.board.notYet.map((item) => (
                  <li key={item}>
                    <span className={styles.dash} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <a className={styles.textLink} href={trust.statusHref} rel="noreferrer">
                {trust.statusLink}
                <ExternalLink aria-hidden="true" size={16} />
              </a>
            </div>
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
          <details className={styles.limits}>
            <summary>
              <FileText aria-hidden="true" size={20} />
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
              <ExternalLink aria-hidden="true" size={16} />
            </a>
          </details>
        </section>

        <section
          id={support.id}
          className={`${styles.section} ${styles.band}`}
          aria-labelledby="support-title"
        >
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>후원</p>
            <h2 id="support-title">{support.title}</h2>
            <p>{support.lead}</p>
          </div>
          <div className={styles.supportGrid}>
            <div className={styles.supportCard}>
              <p className={styles.supportState} data-open={config.open}>
                <Heart aria-hidden="true" size={16} />
                {config.open ? support.openLabel : support.closedLabel}
              </p>
              <h3>{support.usesTitle}</h3>
              <ul className={styles.uses}>
                {support.uses.map((use) => (
                  <li key={use}>{use}</li>
                ))}
              </ul>

              {config.link ? (
                <div className={styles.supportAction}>
                  <a className={styles.primary} href={config.link.url} rel="noopener noreferrer">
                    {support.linkCta}
                    <ExternalLink aria-hidden="true" size={18} />
                  </a>
                  <p className={styles.supportNote}>
                    {support.linkNote} <strong className={styles.host}>{config.link.host}</strong>
                  </p>
                </div>
              ) : null}

              {config.bank ? (
                <div className={styles.bank}>
                  <h4>{support.bankTitle}</h4>
                  <p className={styles.bankLine}>
                    {config.bank.name} <span className={styles.account}>{config.bank.account}</span>
                  </p>
                  <p className={styles.supportNote}>예금주 {config.bank.holder}</p>
                  <CopyButton value={config.bank.account} />
                </div>
              ) : null}

              {config.open ? null : <p className={styles.supportNote}>{support.closedBody}</p>}
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
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section id={faq.id} className={styles.section} aria-labelledby="faq-title">
          <div className={styles.sectionHead}>
            <p className={styles.kicker}>FAQ</p>
            <h2 id="faq-title">{faq.title}</h2>
          </div>
          <div className={styles.faq}>
            {faq.items.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <ChevronDown aria-hidden="true" size={20} className={styles.chevron} />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
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
              <li>
                <a href="#support">후원하기</a>
              </li>
            </ul>
          </nav>
        </div>
      </footer>
    </div>
  );
}
