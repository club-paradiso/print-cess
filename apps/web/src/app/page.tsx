import {
  ArrowRight,
  Building2,
  Camera,
  FileText,
  LaptopMinimal,
  LockKeyhole,
  Monitor,
  Printer,
  ScanLine,
  Smartphone,
} from "lucide-react";

import { translate } from "@print-cess/i18n";
import { RouteGlyph, Wordmark } from "@print-cess/ui";

import { requestLocale } from "@/lib/request-locale";
import { isBrowserKioskEnabled } from "@/server/demo";

export default async function HomePage() {
  // The public root is the service entry point, not a dedicated kiosk URL.
  // Browser-kiosk stations open /kiosk directly; this page is where somebody
  // who did not scan anything learns what Print-cess does, in one glance.
  const locale = await requestLocale();
  const text = (key: string) => translate(locale, key);
  // In Production the browser-kiosk route deliberately fails closed unless it
  // is enabled. Do not advertise a shortcut to a route that will return 404.
  const kioskAvailable = process.env.NODE_ENV !== "production" || isBrowserKioskEnabled();

  return (
    <main className="home">
      <header className="home-header">
        <Wordmark />
      </header>

      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title">{text("homeTitle")}</h1>
        <p>{text("homeLead")}</p>
      </section>

      {/* Three capabilities, three sheets of paper. Each says where a file goes
          before it says anything else, because that is the whole product. */}
      <div className="home-capabilities">
        <section className="home-sheet home-sheet--print" aria-labelledby="home-print">
          <RouteGlyph from={<Smartphone />} to={<Printer />} />
          <h2 id="home-print">{text("homePrintTitle")}</h2>
          <p>{text("homePrintBody")}</p>
          {/* Printing begins at the kiosk's QR code, so this is a direction and
              not a button: a button here would have nowhere honest to go. */}
          <ol className="home-steps">
            <li>{text("homePrintStepScan")}</li>
            <li>{text("homePrintStepPick")}</li>
            <li>{text("homePrintStepCollect")}</li>
          </ol>
        </section>

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

      {/* Managed workstations and the kiosk display are real, but they are not
          what most visitors came for. They sit below the line, in plain text. */}
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
          {kioskAvailable ? (
            <li>
              <a href="/kiosk">
                <Monitor aria-hidden="true" />
                {text("homeKioskCta")}
              </a>
            </li>
          ) : null}
        </ul>
      </nav>

      <p className="home-footnote">
        <LockKeyhole aria-hidden="true" />
        <span>{text("homeNoAccount")}</span>
      </p>
    </main>
  );
}
