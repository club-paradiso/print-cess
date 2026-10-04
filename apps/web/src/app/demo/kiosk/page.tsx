import { notFound } from "next/navigation";

import { KioskSimulator } from "@/components/kiosk/kiosk-simulator";
import { isBrowserKioskEnabled, isDemoRouteEnabled } from "@/server/demo";

export default function KioskDemoPage() {
  if (
    process.env.NODE_ENV === "production" &&
    !isDemoRouteEnabled() &&
    !(process.env.ENABLE_BROWSER_KIOSK === "true" && isBrowserKioskEnabled())
  ) {
    notFound();
  }
  return <KioskSimulator />;
}
