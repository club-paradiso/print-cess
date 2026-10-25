import { BatchKioskSimulator } from "@/components/kiosk/batch-kiosk-simulator";
import { VisitorHome } from "@/components/home/visitor-home";
import { isBrowserKioskEnabled } from "@/server/demo";
import { requestKioskLocale } from "@/lib/request-locale";

type RootSearchParams = { printing?: string | string[]; sound?: string | string[] };

/**
 * Whether this request asked for the shared display. Decided by the address
 * alone, never by screen size or user agent, so a phone can never be shown the
 * display by mistake: the display's switches (`?printing=`, `?sound=`) are only
 * ever typed into a station, and the codes phones scan open `/s/...`, not `/`.
 * A station with no switches belongs at `/kiosk`.
 */
function asksForDisplay({ printing, sound }: RootSearchParams): boolean {
  return printing !== undefined || sound !== undefined;
}

export default async function RootPage({
  searchParams,
}: {
  searchParams: Promise<RootSearchParams>;
}) {
  const params = await searchParams;
  const kioskAvailable = process.env.NODE_ENV !== "production" || isBrowserKioskEnabled();
  if (!kioskAvailable || !asksForDisplay(params)) return <VisitorHome />;

  const locale = await requestKioskLocale();
  return (
    <BatchKioskSimulator
      automaticPrinting={params.printing === "auto"}
      sound={params.sound !== "off"}
      services
      initialLocale={locale}
    />
  );
}
