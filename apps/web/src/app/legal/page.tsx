import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_DOCUMENTS, LegalShell, legalStyles } from "./legal-shell";

export const metadata: Metadata = {
  title: "법적 고지 · Print-cess by Club Paradiso",
  description: "Print-cess의 개인정보 처리방침, 이용약관, 보안 정책, 라이선스.",
  robots: { index: false, follow: false },
};

export default function LegalIndexPage() {
  return (
    <LegalShell
      current="/legal"
      title="정책과 고지"
      lead={
        <p>Print-cess를 쓰기 전에 알아 둘 문서를 한곳에 모았어요. 각 문서 맨 위에 요약이 있어요.</p>
      }
    >
      <ul className={legalStyles.cards}>
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.href}>
            <Link href={doc.href}>
              <strong>{doc.label}</strong>
              <span>{doc.summary}</span>
            </Link>
          </li>
        ))}
      </ul>
    </LegalShell>
  );
}
