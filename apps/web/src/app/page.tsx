import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { BatchKioskSimulator } from "@/components/kiosk/batch-kiosk-simulator";
import { PhoneFallbackRedirect } from "@/components/kiosk/phone-fallback-redirect";
import { hasKioskPin } from "@/lib/phone-at-kiosk";
import { isBrowserKioskEnabled } from "@/server/demo";
import { requestKioskLocale } from "@/lib/request-locale";

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<{
    printing?: string | string[];
    sound?: string | string[];
    kiosk?: string | string[];
    view?: string | string[];
  }>;
}) {
  if (process.env.NODE_ENV === "production" && !isBrowserKioskEnabled()) redirect("/start");
  const { printing, sound, kiosk, view } = await searchParams;
  const locale = await requestKioskLocale();
  const requestHeaders = await headers();
  // A station that was pinned, or a visitor who asked to see the big screen,
  // stays here whatever the screen size.
  const stay =
    kiosk === "1" ||
    view === "kiosk" ||
    (kiosk !== "0" && hasKioskPin(requestHeaders.get("cookie")));
  return (
    <>
      {stay ? null : <PhoneFallbackRedirect />}
      <BatchKioskSimulator
        automaticPrinting={printing === "auto"}
        sound={sound !== "off"}
        services
        initialLocale={locale}
      />
    </>
  );
}
