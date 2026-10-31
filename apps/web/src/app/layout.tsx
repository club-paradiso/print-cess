import type { Metadata, Viewport } from "next";
import { Pathway_Extreme } from "next/font/google";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { isRightToLeft } from "@print-cess/i18n";

import { requestLocale } from "@/lib/request-locale";

import "@print-cess/ui/styles.css";
import "./styles.css";
import "./kiosk.css";
import "./admin.css";
import "./drop.css";
import "./workstation.css";
import "./visitor.css";
import "./multi-print.css";
import "./scan.css";
import "./scan-pro.css";

// The logo face. next/font self-hosts it at build time, so the kiosk and the
// phone page never reach out to Google for it. It sets the wordmark only.
const logoFont = Pathway_Extreme({
  subsets: ["latin"],
  variable: "--pc-font-logo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Print-cess by Club Paradiso",
  description: "Secure self-service document printing",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#faf8f7",
  colorScheme: "light",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  await connection();
  const locale = await requestLocale();

  return (
    <html lang={locale} dir={isRightToLeft(locale) ? "rtl" : "ltr"} className={logoFont.variable}>
      <body>{children}</body>
    </html>
  );
}
