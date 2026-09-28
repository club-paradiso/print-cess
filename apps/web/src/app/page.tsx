import {
  Building2,
  ChevronRight,
  Download,
  LockKeyhole,
  Monitor,
  QrCode,
  ScanLine,
  Send,
} from "lucide-react";

import { translate } from "@print-cess/i18n";
import { Wordmark } from "@print-cess/ui";

import { SCAN_HOME_CTA } from "@/components/scan/scan-copy";
import { requestLocale } from "@/lib/request-locale";
import { isBrowserKioskEnabled } from "@/server/demo";

const kioskCta = {
  en: "Open kiosk",
  ko: "키오스크 열기",
  "zh-CN": "打开自助终端",
  id: "Buka kios",
  fil: "Buksan ang kiosk",
  vi: "Mở kiosk",
  th: "เปิดคีออสก์",
  ne: "किओस्क खोल्नुहोस्",
  km: "បើកគីអូស",
  ar: "فتح الكشك",
  ru: "Открыть киоск",
  mn: "Киоск нээх",
  uk: "Відкрити кіоск",
} as const;

const workstationCta = {
  en: "Work computer",
  ko: "업무용 PC",
  "zh-CN": "办公电脑",
  id: "Komputer kerja",
  fil: "Computer sa trabaho",
  vi: "Máy tính cơ quan",
  th: "คอมพิวเตอร์ที่ทำงาน",
  ne: "कार्य कम्प्युटर",
  km: "កុំព្យូទ័រការងារ",
  ar: "كمبيوتر العمل",
  ru: "Рабочий компьютер",
  mn: "Ажлын компьютер",
  uk: "Робочий комп’ютер",
} as const;

export default async function HomePage() {
  // The public root is the service entry point, not a dedicated kiosk URL.
  // Browser-kiosk stations open /kiosk directly; keeping / available is what
  // makes the independent phone-to-phone hand-off discoverable in Production.
  const locale = await requestLocale();
  const text = (key: string) => translate(locale, key);
  // In Production the browser-kiosk route deliberately fails closed unless it
  // is enabled. Do not advertise a shortcut to a route that will return 404.
  const kioskAvailable = process.env.NODE_ENV !== "production" || isBrowserKioskEnabled();

  return (
    <main className="status-page">
      <header className="home-header">
        <Wordmark />
      </header>
      <section className="home-hero">
        <h1>{text("homeTitle")}</h1>
        {/* Printing starts at the big screen, so this is a direction rather
            than a button: a button here would lead nowhere. */}
        <p className="home-print">
          <span className="home-print__icon" aria-hidden="true">
            <QrCode />
          </span>
          <span>{text("homeScanHint")}</span>
        </p>
      </section>
      <nav className="home-section" aria-labelledby="home-drop-title">
        <h2 id="home-drop-title">{text("dropTitle")}</h2>
        <p>{text("dropIntro")}</p>
        <ul className="home-actions">
          <li>
            <a className="home-action" href="/send">
              <span className="home-action__icon" aria-hidden="true">
                <Send />
              </span>
              <span>{text("dropSendCta")}</span>
              <ChevronRight className="home-action__chevron" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="home-action" href="/receive">
              <span className="home-action__icon" aria-hidden="true">
                <Download />
              </span>
              <span>{text("dropReceiveCta")}</span>
              <ChevronRight className="home-action__chevron" aria-hidden="true" />
            </a>
          </li>
          <li>
            <a className="home-action" href="/scan">
              <span className="home-action__icon" aria-hidden="true">
                <ScanLine />
              </span>
              <span>{SCAN_HOME_CTA[locale]}</span>
              <ChevronRight className="home-action__chevron" aria-hidden="true" />
            </a>
          </li>
        </ul>
        {/* Entrances for a managed office computer and for the kiosk display
            itself. Most visitors never need them, so they read quieter. */}
        <ul className="home-actions home-actions--quiet">
          <li>
            <a className="home-action" href="/workstation">
              <span className="home-action__icon" aria-hidden="true">
                <Building2 />
              </span>
              <span>{workstationCta[locale]}</span>
              <ChevronRight className="home-action__chevron" aria-hidden="true" />
            </a>
          </li>
          {kioskAvailable ? (
            <li>
              <a className="home-action" href="/kiosk">
                <span className="home-action__icon" aria-hidden="true">
                  <Monitor />
                </span>
                <span>{kioskCta[locale]}</span>
                <ChevronRight className="home-action__chevron" aria-hidden="true" />
              </a>
            </li>
          ) : null}
        </ul>
      </nav>
      <p className="status-page__privacy">
        <LockKeyhole aria-hidden="true" />
        <span>{text("homeNoAccount")}</span>
      </p>
    </main>
  );
}
