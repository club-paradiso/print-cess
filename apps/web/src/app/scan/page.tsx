import type { Metadata } from "next";

import { ScannerFlow } from "@/components/scan/scanner-flow";
import { requestLocale } from "@/lib/request-locale";

export const metadata: Metadata = {
  title: "Scan a document · Print-cess by Club Paradiso",
  description: "Scan paper into a PDF, send it to another device, or print it immediately.",
  robots: { index: false, follow: false },
};

export default async function ScanPage() {
  return <ScannerFlow initialLocale={await requestLocale()} />;
}
