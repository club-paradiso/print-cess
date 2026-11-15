import type { Metadata } from "next";

import { BulkReceiveFlow } from "@/components/bulk/bulk-receive-flow";
import { requestKioskLocale } from "@/lib/request-locale";

export const metadata: Metadata = {
  title: "대용량 받기 · Print-cess by Club Paradiso",
  description: "보내는 기기의 QR로 사진과 파일을 한꺼번에 받아요.",
  robots: { index: false, follow: false },
};

export default async function BulkReceivePage() {
  return <BulkReceiveFlow initialLocale={await requestKioskLocale()} />;
}
