import type { Metadata } from "next";

import { BulkSendFlow } from "@/components/bulk/bulk-send-flow";
import { requestKioskLocale } from "@/lib/request-locale";

export const metadata: Metadata = {
  title: "대용량 전송 · Print-cess by Club Paradiso",
  description: "사진과 파일을 최대 3,000개까지 기기끼리 바로 보내요.",
  robots: { index: false, follow: false },
};

// Korean by default; an explicit language choice persists through the
// allowlisted preference cookie.
export default async function BulkSendPage() {
  return <BulkSendFlow initialLocale={await requestKioskLocale()} />;
}
