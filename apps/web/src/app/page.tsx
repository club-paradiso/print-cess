import type { ReactNode } from "react";
import {
  ArrowRight,
  Building2,
  Camera,
  FileText,
  LaptopMinimal,
  LockKeyhole,
  Monitor,
  ScanLine,
  Smartphone,
} from "lucide-react";

import { translate } from "@print-cess/i18n";
import { RouteGlyph, Wordmark } from "@print-cess/ui";

import { PrintEntryActions, type PrintEntryLabels } from "@/components/home/print-entry-actions";
import { requestLocale } from "@/lib/request-locale";
import { isBrowserKioskEnabled } from "@/server/demo";

/**
 * The product name is one word. Without this, a narrow screen breaks it at its
 * hyphen and leaves "Print-" at the end of one line and "cess" at the start of
 * the next.
 */
function keepNameTogether(sentence: string): ReactNode {
  const parts = sentence.split("Print-cess");
  return parts.flatMap((part, index) =>
    index === 0
      ? [part]
      : [
          <span className="home-nowrap" key={index}>
            Print-cess
          </span>,
          part,
        ],
  );
}

export default async function HomePage() {
  // The public root is the service entry point, not a dedicated kiosk URL.
  // Browser-kiosk stations open /kiosk directly; this page is where somebody
  // who did not scan anything lands, and it is built for finding the screen.
  const locale = await requestLocale();
  const text = (key: string) => translate(locale, key);
  // In Production the browser-kiosk route deliberately fails closed unless it
  // is enabled. Do not advertise a shortcut to a route that will return 404.
  const kioskAvailable = process.env.NODE_ENV !== "production" || isBrowserKioskEnabled();

  const labels: PrintEntryLabels = {
    scanCta: text("homeScanQrCta"),
    lostCta: text("homeLostCta"),
    lostTitle: text("homeLostTitle"),
    lostSteps: [text("homeLostStep1"), text("homeLostStep2"), text("homeLostStep3")],
    lostHint: text("homeLostHint"),
    beaconCaption: text("homeBeaconCaption"),
    close: text("homeDialogClose"),
    scanTitle: text("qrScanTitle"),
    scanHint: text("qrScanHint"),
    scanStarting: text("qrScanStarting"),
    scanDenied: text("qrScanDenied"),
    scanUnsupported: text("qrScanUnsupported"),
    scanInvalid: text("qrScanInvalid"),
  };

  return (
    <main className="home">
      <header className="home-header">
        <Wordmark />
        {kioskAvailable ? (
          <a className="home-kiosk-entry" href="/kiosk">
            <span className="home-kiosk-entry__icon" aria-hidden="true">
              <Monitor />
            </span>
            <span className="home-kiosk-entry__copy">
              <span className="home-kiosk-entry__eyebrow">{text("homeWorkplaceTitle")}</span>
              <strong>{text("homeKioskCta")}</strong>
            </span>
            <ArrowRight className="home-kiosk-entry__arrow" aria-hidden="true" />
          </a>
        ) : null}
      </header>

      {/* Printing is the first task, but the landing page must not become an
          instruction manual. Keep the first screen action-first: explain where
          the session starts, then let the visitor scan. Detailed wayfinding and
          the Beacon belong in the recovery sheet opened only when needed. */}
      <section className="print-entry" aria-labelledby="home-title">
        <div className="print-entry__copy">
          <h1 id="home-title">{text("homePrintHeading")}</h1>
          <p className="print-entry__lead">
            <span>{keepNameTogether(text("homePrintLead"))}</span>
            <span>{text("homePrintLead2")}</span>
          </p>
        </div>

        <PrintEntryActions labels={labels} />
      </section>

      {/* Share and Scan are real, first-class tools, but they are not why most
          visitors came, so they sit below Print as two smaller sheets. */}
      <div className="home-capabilities">
        <section className="home-sheet home-sheet--share" aria-labelledby="home-share">
          <RouteGlyph from={<Smartphone />} to={<LaptopMinimal />} />
          <h2 id="home-share">{text("homeShareTitle")}</h2>
          <p>{text("homeShareBody")}</p>
          <div className="home-sheet__actions">
            <a className="pc-button pc-button--primary home-cta" href="/send">
              {text("homeShareCta")}
              <ArrowRight className="home-cta__arrow" aria-hidden="true" />
            </a>
            <a className="home-link" href="/receive">
              {text("homeReceiveCta")}
            </a>
          </div>
        </section>

        <section className="home-sheet home-sheet--scan" aria-labelledby="home-scan">
          <RouteGlyph from={<Camera />} to={<FileText />} />
          <h2 id="home-scan">{text("homeScanTitle")}</h2>
          <p>{text("homeScanBody")}</p>
          <div className="home-sheet__actions">
            <a className="pc-button pc-button--secondary home-cta" href="/scan">
              <ScanLine aria-hidden="true" />
              {text("homeScanCta")}
            </a>
          </div>
        </section>
      </div>

      {/* Managed workstations remain a secondary institutional entrance.
          The browser display entry is intentionally promoted above the fold. */}
      <nav className="home-workplace" aria-labelledby="home-workplace-title">
        <div>
          <h2 id="home-workplace-title">{text("homeWorkplaceTitle")}</h2>
          <p>{text("homeWorkplaceBody")}</p>
        </div>
        <ul>
          <li>
            <a href="/workstation">
              <Building2 aria-hidden="true" />
              {text("homeWorkstationCta")}
            </a>
          </li>
        </ul>
      </nav>

      <p className="home-footnote">
        <LockKeyhole aria-hidden="true" />
        <span>{text("homeNoAccount")}</span>
      </p>
    </main>
  );
}
