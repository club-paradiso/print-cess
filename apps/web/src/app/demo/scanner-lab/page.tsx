import { notFound } from "next/navigation";

import { ScannerLab } from "@/components/scan/scanner-lab";
import { isDemoRouteEnabled } from "@/server/demo";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Development and CI only: the scanner accuracy lab. It never ships as a public
 * page; in a Production build it is reachable only where demo routes are
 * enabled, which `isDemoRouteEnabled` already refuses for real Production.
 */
export default function ScannerLabPage() {
  if (process.env.NODE_ENV === "production" && !isDemoRouteEnabled()) notFound();
  return <ScannerLab />;
}
